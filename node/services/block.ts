import assert from 'assert'
import LRU from 'lru-cache'
import Sequelize, { ModelCtor, Optional } from 'sequelize'

import Block from '@/lib/block/block'
import { IBus } from '@/node/bus'
import BlockModel, { BlockCreationAttributes } from '@/node/models/block'
import HeaderModel from '@/node/models/header'
import TransactionModel from '@/node/models/transaction'
import TransactionOutputModel from '@/node/models/transaction-output'
import Service, {
  BaseConfig,
  IService,
  Subscriptions,
} from '@/node/services/base'
import { ITip } from '@/node/services/db'
import { IHeaderService } from '@/node/services/header'
import AsyncQueue from '@/node/utils'
import Timeout = NodeJS.Timeout
import { Services } from '@/node/node'

const { gt: $gt, between: $between } = Sequelize.Op

interface BlockConfig extends BaseConfig {
  recentBlockHashesCount?: number
  readAheadBlockCount?: number
  pause?: boolean
  reorgToBlock?: number
}

interface BlockSubscriptions extends Subscriptions {
  block: IBus[]
  transaction: IBus[]
  address: IBus[]
}

export interface BlockAPIMethods {
  getBlockTip: () => ITip | undefined
  isSynced: () => boolean
}

interface IBlockService extends IService, BlockAPIMethods {
  subscriptions: BlockSubscriptions
  APIMethods: BlockAPIMethods
  _checkTip(): Promise<void>
  _resetTip(): Promise<void>
  _loadRecentBlockHashes(): Promise<void>
  _getTimeSinceLastBlock(): Promise<string | void>
  _queueBlock(block: BlockModel): void
  _onReorg(blocks: ITip[]): Promise<void>
  _removeAllSubscriptions(): void
  _onHeaders(): Promise<void>
  _startBlockSubscription(): void
  _findLatestValidBlockHeader(): Promise<ITip | undefined>
  _findBlocksToRemove(commonHeader: ITip): Promise<ITip[]>
  _handleReorg(): Promise<void>
  _processReorg(blocksToRemove: ITip[]): Promise<void>
  _onBlock(rawBlock: BlockObject): Promise<void>
  _processBlock(block: BlockObject): Promise<void>
  _saveBlock(rawBlock: BlockObject): Promise<void>
  _handleError(...err: (string | number)[]): void
  _syncBlock(block: BlockObject): Promise<void>
  __onBlock(rawBlock: BlockObject): Promise<BlockModel | undefined>
  _setTip(tip: ITip): Promise<void>
  _logSynced(): Promise<void>
  _onSynced(): Promise<void>
  _startSync(): Promise<void>
  _sync(): Promise<void>
  _logProgress(): void
}

export interface BlockObject
  extends Optional<BlockCreationAttributes, 'height'> {}

class BlockService extends Service implements IBlockService {
  public subscriptions: BlockSubscriptions = {
    block: [],
    transaction: [],
    address: [],
  }
  private tip: ITip | undefined
  private readonly header: IHeaderService | undefined
  private initialSync: boolean = false
  private processingBlock: boolean = false
  private blocksInQueue: number = 0
  private lastBlockSaved: Buffer = Buffer.alloc(0)
  private readonly recentBlockHashesCount: number = 0
  private readonly recentBlockHashes: LRU<string, Buffer>
  private readonly readAheadBlockCount: number = 0
  private readonly pauseSync: boolean
  private readonly reorgToBlock: number | false
  private reorging: boolean = false
  private tipResetNeeded: boolean = false
  private blockProcessor: AsyncQueue<BlockObject, 'block'> | undefined
  private bus: IBus | undefined
  private subscribedBlock: boolean = false
  private reportInterval: Timeout | undefined
  private getBlocksTimer: Timeout | undefined
  private Header: ModelCtor<HeaderModel> | undefined
  private Block: ModelCtor<BlockModel> | undefined
  private Transaction: ModelCtor<TransactionModel> | undefined
  private TransactionOutput: ModelCtor<TransactionOutputModel> | undefined

  constructor(options: BlockConfig) {
    super(options)
    this.header = this.node.services.get('header') as IHeaderService | undefined
    this.recentBlockHashesCount = options.recentBlockHashesCount || 144
    this.recentBlockHashes = new LRU(this.recentBlockHashesCount)
    this.readAheadBlockCount = options.readAheadBlockCount || 2
    this.pauseSync = options.pause || false
    this.reorgToBlock = options.reorgToBlock || false
  }

  static get dependencies(): Services[] {
    return ['db', 'header', 'p2p']
  }

  get dependencies(): Services[] {
    return BlockService.dependencies
  }

  get APIMethods(): BlockAPIMethods {
    /*
    return {
      getBlockTip: this.getTip.bind(this),
      isSynced: this.isSynced.bind(this)
    }
     */
    return {
      getBlockTip: () => this.getBlockTip(),
      isSynced: () => this.isSynced(),
    }
  }

  isSynced(): boolean {
    return !this.initialSync
  }

  getBlockTip(): ITip | undefined {
    return this.tip
  }

  async _checkTip(): Promise<void> {
    this.logger.info('Block Service: checking the saved tip...')
    if (this.Header && this.tip) {
      let header =
        (await HeaderModel.findByHeight(this.tip.height)) ||
        this.header?.getLastHeader()
      if (
        header &&
        Buffer.compare(header.hash, this.tip.hash) === 0 &&
        !this.reorgToBlock
      ) {
        this.logger.info('Block Service: saved tip is good to go')
      }
      await this._handleReorg()
    }
  }

  async _resetTip(): Promise<void> {
    if (!this.tipResetNeeded) {
      return
    }
    this.tipResetNeeded = false
    this.logger.warn(
      'Block Service: resetting tip due to a non-exist tip block...'
    )
    let headerModel = this.header?.getLastHeader()
    if (headerModel) {
      let { hash, height } = headerModel
      this.logger.info('Block Service: retrieved all the headers of lookups')
      let block: BlockModel | null | undefined
      do {
        block = await this.Block?.findOne({
          where: { hash },
          attributes: ['hash'],
        })
        if (!block) {
          this.logger.debug(
            'Block Service: block:',
            hash.toString('hex'),
            'was not found, proceeding to older blocks'
          )
        }
        let header: BlockModel | null | undefined = await this.Block?.findOne({
          where: { height: --height },
          attributes: ['hash'],
        })
        assert(header, 'Header not found for reset')
        if (!block) {
          this.logger.debug(
            'Block Service: trying block:',
            header.hash.toString('hex')
          )
        }
      } while (!block)
      await this._setTip({ height: height + 1, hash })
    }
  }

  async start(): Promise<void> {
    this.Header = this.node.addedMethods.getModel?.('header') as
      | ModelCtor<HeaderModel>
      | undefined
    this.Block = this.node.addedMethods.getModel?.('block') as
      | ModelCtor<BlockModel>
      | undefined
    this.Transaction = this.node.addedMethods.getModel?.('transaction') as
      | ModelCtor<TransactionModel>
      | undefined
    this.TransactionOutput = this.node.addedMethods.getModel?.(
      'transaction_output'
    ) as ModelCtor<TransactionOutputModel> | undefined
    let tip: ITip | undefined = await this.node.addedMethods.getServiceTip?.(
      'block'
    )
    if (
      tip &&
      tip.height > 0 &&
      !(await this.Block?.findOne({
        where: { height: tip.height },
        attributes: ['height'],
      }))
    ) {
      tip = undefined
    }
    this.blockProcessor = new AsyncQueue((block: BlockObject) =>
      this._onBlock(block)
    )
    // this.bus = this.node.openBus({ remoteAddress: 'localhost-block' })
    this.bus = this.node.openBus()
    if (!tip) {
      this.tipResetNeeded = true
      return
    }
    await this.Block?.destroy({ where: { height: { [$gt]: tip.height } } })
    if (this.header) {
      this.header.on('reorg', () => {
        this.reorging = true
      })
      this.header.on('reorg complete', () => {
        this.reorging = false
      })
    }
    await this._setTip(tip)
    await this._loadRecentBlockHashes()
  }

  async _loadRecentBlockHashes(): Promise<void> {
    let hashes: Buffer[] = []
    if (this.Block && this.tip) {
      hashes = (
        await this.Block.findAll({
          where: {
            height: {
              [$between]: [
                this.tip.height - this.recentBlockHashesCount,
                this.tip.height,
              ],
            },
          },
          attributes: ['hash'],
          order: [['height', 'ASC']],
        })
      ).map((block: BlockModel) => block.hash)
    }
    for (let i = 0; i < hashes.length - 1; ++i) {
      this.recentBlockHashes.set(hashes[i + 1].toString('hex'), hashes[i])
    }
    this.logger.info(
      'Block Service: loaded:',
      this.recentBlockHashes.length,
      'hashes from the index'
    )
  }

  async _getTimeSinceLastBlock(): Promise<string | void> {
    if (this.Header && this.tip) {
      let header: Pick<
        HeaderModel,
        'timestamp'
      > | null = await this.Header.findOne({
        where: { height: Math.max(this.tip.height - 1, 0) },
        attributes: ['timestamp'],
      })
      let tip: Pick<
        HeaderModel,
        'timestamp'
      > | null = await this.Header.findOne({
        where: { height: this.tip.height },
        attributes: ['timestamp'],
      })
      if (header && tip) {
        return convertSecondsToHumanReadable(tip.timestamp - header.timestamp)
      }
    }
  }

  _queueBlock(block: BlockModel): void {
    ++this.blocksInQueue
    this.blockProcessor?.push(block, async (...err: (string | number)[]) => {
      if (err) {
        this._handleError(...err)
      } else {
        // this._logSynced(block.hash)
        await this._logSynced()
        --this.blocksInQueue
      }
    })
  }

  async onReorg(height: number): Promise<void> {
    await this.Block?.destroy({ where: { height: { [$gt]: height } } })
  }

  async _onReorg(blocks: ITip[]): Promise<void> {
    let targetHeight = blocks[blocks.length - 1].height - 1
    /* let { hash: targetHash } = await HeaderModel.findByHeight(targetHeight, {
      attributes: ['hash'],
    }) */
    try {
      for (let service of this.node.getServicesByOrder().reverse()) {
        this.logger.info('Block Service: reorging', service.name, 'service')
        // await service.onReorg(targetHeight, targetHash)
        await service.onReorg(targetHeight)
      }
    } catch (err) {
      this._handleError(err)
    }
  }

  _removeAllSubscriptions(): void {
    if (this.bus) {
      this.bus.unsubscribe('p2p/block')
      this.bus.removeAllListeners()
      this.removeAllListeners()
      this.subscribedBlock = false
      if (this.reportInterval) {
        clearInterval(this.reportInterval)
      }
      if (this.getBlocksTimer) {
        clearTimeout(this.getBlocksTimer)
      }
    }
  }

  async onHeaders(): Promise<void> {
    if (this.pauseSync) {
      this.logger.warn('Block Service: pausing sync due to config option')
    } else {
      this.initialSync = true
      return new Promise((resolve) => {
        let interval = setInterval(() => {
          if (!this.processingBlock) {
            clearInterval(interval)
            resolve(this._onHeaders())
          }
        }, 1000).unref()
      })
    }
  }

  async _onHeaders(): Promise<void> {
    await this._resetTip()
    return new Promise((resolve, reject) => {
      let interval = setInterval(async () => {
        if (this.blocksInQueue === 0) {
          clearInterval(interval)
          this._removeAllSubscriptions()
          try {
            await this._checkTip()
            this.reorging = false
            await this._startSync()
            resolve()
          } catch (err) {
            reject(err)
          }
        }
      }, 1000).unref()
    })
  }

  _startBlockSubscription(): void {
    if (!this.subscribedBlock && this.bus) {
      this.subscribedBlock = true
      this.logger.info('Block Service: starting p2p block subscription')
      this.bus.on('p2p/block', (block: BlockModel) => this._queueBlock(block))
      this.bus.subscribe('p2p/block')
    }
  }

  async _findLatestValidBlockHeader(): Promise<ITip | undefined> {
    if (this.reorgToBlock) {
      let header: ITip | null = await HeaderModel.findByHeight(
        this.reorgToBlock,
        {
          attributes: ['hash', 'height'],
        }
      )
      assert(header, 'Block Service: header not found to reorg to')
      return header
    }
    if (this.tip) {
      let blockServiceHash: Buffer | undefined = this.tip.hash
      let blockServiceHeight: number = this.tip.height
      let header: ITip | undefined
      for (let i = 0; i <= this.recentBlockHashes.length; ++i) {
        let currentHeader: ITip | null = await HeaderModel.findByHash(
          blockServiceHash as Buffer,
          {
            attributes: ['hash', 'height'],
          }
        )
        let hash: Buffer = blockServiceHash as Buffer
        let height: number = blockServiceHeight--
        blockServiceHash = this.recentBlockHashes.get(hash.toString('hex'))
        if (
          currentHeader &&
          Buffer.compare(currentHeader.hash, hash) === 0 &&
          currentHeader.height === height
        ) {
          header = currentHeader
          break
        }
      }
      assert(
        header,
        [
          'Block Service: we could not locate any of our recent block hashes in the header service index.',
          'Perhaps our header service synced to the wrong chain?',
        ].join(' ')
      )
      assert(
        header.height <= this.tip.height,
        [
          'Block Service: we found a common ancestor header whose height was greater than our current tip.',
          'This should be impossible',
        ].join(' ')
      )
      return header
    }
  }

  async _findBlocksToRemove(commonHeader: ITip): Promise<ITip[]> {
    let hash: Buffer | undefined = this.tip?.hash
    let blocks: ITip[] = []
    if (hash && this.Block) {
      let block: Pick<BlockModel, 'height'> | null = await this.Block.findOne({
        where: { hash },
        attributes: ['height'],
      })
      if (block) {
        let { height } = block
        for (
          let i = 0;
          i < this.recentBlockHashes.length &&
          Buffer.compare(hash, commonHeader.hash) !== 0;
          ++i
        ) {
          blocks.push({ height, hash })
          let prevBlock: Pick<
            BlockModel,
            'hash'
          > | null = await this.Block.findOne({
            where: { height: --height },
            attributes: ['hash'],
          })
          hash = prevBlock?.hash || Buffer.alloc(0)
        }
      }
    }
    return blocks
  }

  async _handleReorg(): Promise<void> {
    this.node.addedMethods.clearInventoryCache?.()
    let commonAncestorHeader = await this._findLatestValidBlockHeader()
    if (commonAncestorHeader && this.tip) {
      if (Buffer.compare(commonAncestorHeader.hash, this.tip.hash) === 0) {
        return
      }
      let blocksToRemove = await this._findBlocksToRemove(commonAncestorHeader)
      assert(
        blocksToRemove.length > 0 &&
          blocksToRemove.length <= this.recentBlockHashes.length,
        'Block Service: the number of blocks to remove looks incorrect'
      )
      this.logger.warn(
        'Block Service: chain reorganization detected, current height/hash:',
        `${this.tip.height}/${this.tip.hash.toString('hex')}`,
        'common ancestor hash:',
        commonAncestorHeader.hash.toString('hex'),
        `at height: ${commonAncestorHeader.height}.`,
        'There are:',
        blocksToRemove.length,
        'block(s) to remove'
      )
      await this._setTip({
        hash: commonAncestorHeader.hash,
        height: commonAncestorHeader.height,
      })
      await this._processReorg(blocksToRemove)
      for (let subscription of this.subscriptions.block) {
        subscription.emit('block/reorg', {
          hash: commonAncestorHeader.hash,
          height: commonAncestorHeader.height,
        })
      }
    }
  }

  async _processReorg(blocksToRemove: ITip[]): Promise<void> {
    for (let block of blocksToRemove) {
      this.recentBlockHashes.del(block.hash.toString('hex'))
    }
    await this._onReorg(blocksToRemove)
    this.logger.info(
      'Block Service: removed',
      blocksToRemove.length,
      'blocks(s) during the reorganization event'
    )
  }

  async _onBlock(rawBlock: BlockObject): Promise<void> {
    if (this.reorging) {
      this.processingBlock = false
      return
    }
    this.processingBlock = true
    try {
      if (
        await this.Block?.findOne({
          where: { hash: rawBlock.hash },
          attributes: ['height'],
        })
      ) {
        this.processingBlock = false
        this.logger.debug(
          'Block Service: not syncing, block already in database'
        )
      } else {
        await this._processBlock(rawBlock)
      }
    } catch (err) {
      this.processingBlock = false
      this._handleError(err)
    }
  }

  async _processBlock(block: BlockObject): Promise<void> {
    if (this.node.stopping) {
      this.processingBlock = false
      return
    }
    this.logger.debug('Block Service: new block:', block.hash.toString('hex'))
    if (
      this.tip &&
      block.header?.prevHash &&
      Buffer.compare(block.header.prevHash, this.tip.hash) === 0
    ) {
      await this._saveBlock(block)
    } else {
      this.processingBlock = false
    }
  }

  async _saveBlock(rawBlock: BlockObject): Promise<void> {
    if (!('height' in rawBlock) && this.tip) {
      rawBlock.height = this.tip.height + 1
    }
    try {
      for (let service of this.node.getServicesByOrder()) {
        await service.onBlock(rawBlock)
      }
      await this.__onBlock(rawBlock)
      this.recentBlockHashes.set(
        rawBlock.hash.toString('hex'),
        rawBlock.header?.prevHash as Buffer
      )
      await this._setTip({
        hash: rawBlock.hash,
        height: rawBlock.height as number,
      })
      this.processingBlock = false
      for (let subscription of this.subscriptions.block) {
        subscription.emit('block/block', rawBlock)
      }
    } catch (err) {
      this.processingBlock = false
      throw err
    }
  }

  _handleError(...err: (string | number)[]): void {
    if (!this.node.stopping) {
      this.logger.error('Block Service: handle error', ...err)
      this.node.stop().then()
    }
  }

  async _syncBlock(block: BlockObject): Promise<void> {
    if (this.getBlocksTimer) {
      clearTimeout(this.getBlocksTimer)
    }
    if (Buffer.compare(this.lastBlockSaved, block.hash) === 0) {
      this.processingBlock = false
      return
    }
    try {
      await this._saveBlock(block)
      this.lastBlockSaved = block.hash
      let lastHeaderHeight = this.header?.getLastHeader()?.height
      if (this.tip && lastHeaderHeight && this.tip.height < lastHeaderHeight) {
        this.emit('next block')
      } else {
        this.emit('synced')
      }
    } catch (err) {
      this._handleError(err)
    }
  }

  async __onBlock(rawBlock: BlockObject): Promise<BlockModel | undefined> {
    let header: Pick<
      HeaderModel,
      'height' | 'stakePrevTxId' | 'stakeOutputIndex' | 'isProofOfStake'
    > | null
    do {
      header = await HeaderModel.findByHash(rawBlock.hash, {
        attributes: ['height', 'stakePrevTxId', 'stakeOutputIndex'],
      })
    } while (!header)
    let isProofOfStake = header.isProofOfStake()
    let minerId = (
      await this.TransactionOutput?.findOne({
        where: { outputIndex: isProofOfStake ? 1 : 0 },
        attributes: ['addressId'],
        include: [
          {
            model: this.Transaction,
            as: 'transaction',
            required: true,
            where: {
              blockHeight: header.height,
              indexInBlock: isProofOfStake ? 1 : 0,
            },
            attributes: [],
          },
        ],
      })
    )?.addressId as bigint
    return await this.Block?.create({
      hash: rawBlock.hash,
      height: header.height,
      size: rawBlock.size,
      weight: rawBlock.weight,
      minerId,
      transactionsCount: rawBlock.transactionsCount,
      contractTransactionsCount: rawBlock.contractTransactionsCount,
    })
  }

  async _setTip(tip: ITip): Promise<void> {
    this.logger.debug('Block Service: setting tip to height:', tip.height)
    this.logger.debug(
      'Block Service: setting tip to hash:',
      tip.hash.toString('hex')
    )
    this.tip = tip
    await this.node.addedMethods.updateServiceTip?.(this.name, tip)
  }

  async _logSynced(): Promise<void> {
    if (this.reorging) {
      return
    }
    try {
      let diff: string | void = await this._getTimeSinceLastBlock()
      this.logger.info(
        'Block Service: the best block hash is:',
        this.tip?.hash.toString('hex'),
        'at height:',
        `${this.tip?.height}.`,
        'Block interval:',
        diff
      )
    } catch (err) {
      this._handleError(err)
    }
  }

  async _onSynced(): Promise<void> {
    if (this.reportInterval) {
      clearInterval(this.reportInterval)
    }
    this._logProgress()
    this.initialSync = false
    this._startBlockSubscription()
    // this._logSynced(this.tip.hash)
    await this._logSynced()
    for (let service of this.node.getServicesByOrder()) {
      await service.onSynced()
    }
  }

  async _startSync(): Promise<void> {
    let lastHeaderHeight = this.header?.getLastHeader()?.height
    if (lastHeaderHeight && this.tip) {
      let numNeeded = Math.max(lastHeaderHeight - this.tip.height, 0)
      this.logger.info(
        'Block Service: gathering:',
        numNeeded,
        'block(s) from the peer-to-peer network'
      )
      if (numNeeded > 0) {
        this.on('next block', () => this._sync())
        this.on('synced', () => this._onSynced())
        if (this.reportInterval) {
          clearInterval(this.reportInterval)
        }
        if (this.tip.height === 0) {
          let genesisBlock = (Block.fromBuffer(
            this.chain.genesis
          ) as unknown) as BlockObject
          genesisBlock.height = 0
          await this._saveBlock(genesisBlock)
        }
        this.reportInterval = setInterval(
          this._logProgress.bind(this),
          5000
        ).unref()
        await this._sync()
      } else {
        await this._onSynced()
      }
    }
  }

  async _sync(): Promise<void> {
    if (this.node.stopping || this.reorging) {
      return
    }
    this.processingBlock = true
    this.logger.debug(
      'Block Service: querying header service for next block using tip:',
      this.tip?.hash.toString('hex')
    )
    try {
      if (this.tip) {
        let hashes = await this.header?.getEndHash(
          this.tip,
          this.readAheadBlockCount
        )
        if (hashes) {
          let { targetHash, endHash } = hashes
          if (!targetHash && !endHash) {
            this.processingBlock = false
            this.emit('synced')
          } else {
            this.node.addedMethods.clearInventoryCache?.()
            this.getBlocksTimer = setTimeout(() => {
              this.logger.debug(
                'Block Service: block timeout, emitting for next block'
              )
              this.processingBlock = false
              if (!this.reorging) {
                this.emit('next block')
              }
            }, 5000).unref()
            let block = await this.node.addedMethods.getP2PBlock?.({
              filter: { startHash: this.tip.hash, endHash },
              blockHash: targetHash,
            })
            await this._syncBlock((block as unknown) as BlockObject)
          }
        }
      }
    } catch (err) {
      this.processingBlock = false
      throw err
    }
  }

  _logProgress(): void {
    if (!this.initialSync) {
      return
    }
    let headerBestHeight = this.node.addedMethods.getBestHeight?.()
    if (headerBestHeight && this.tip) {
      let bestHeight = Math.max(headerBestHeight, this.tip.height)
      let progress =
        bestHeight && ((this.tip.height / bestHeight) * 100).toFixed(4)
      this.logger.info(
        'Block Service: download progress:',
        `${this.tip.height}/${bestHeight} (${progress}%)`
      )
    }
  }
}

function convertSecondsToHumanReadable(seconds: number): string {
  let result: string = ''
  let minutes: number | undefined
  if (seconds >= 60) {
    minutes = Math.floor(seconds / 60)
    seconds %= 60
  }
  if (minutes) {
    result = `${minutes} minute(s) `
  }
  if (seconds) {
    result += `${seconds} seconds`
  }
  return result
}

export default BlockService