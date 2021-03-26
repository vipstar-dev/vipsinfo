import assert from 'assert'
import { ModelCtor, Op } from 'sequelize'

import Header, { IHeader } from '@/lib/block/header'
import { IBus } from '@/node/bus'
import BlockModel from '@/node/models/block'
import HeaderModel, { HeaderCreationAttributes } from '@/node/models/header'
import { Services } from '@/node/node'
import Service, { BaseConfig, IService } from '@/node/services/base'
import { ITip } from '@/node/services/db'
import { IP2PService } from '@/node/services/p2p'
import AsyncQueue from '@/node/utils'

const { gt: $gt, between: $between } = Op

const MAX_CHAINWORK = BigInt(1) << BigInt(256)
const STARTING_CHAINWORK = BigInt(0x10001)

export interface HeaderAPIMethods {
  getBestHeight: () => number | undefined
}

export interface IHeaderService extends IService, HeaderAPIMethods {
  _adjustTipBackToCheckpoint(): void
  _setGenesisBlock(): Promise<void>
  _startHeaderSubscription(): void
  _queueBlock(block: BlockModel): void
  _processBlocks(block: BlockModel): Promise<void>
  _persistHeader(block: BlockModel): Promise<void>
  _syncBlock(block: BlockModel): Promise<void>
  _onHeader(header: HeaderCreationAttributes): void
  _onHeaders(headers: HeaderModel[]): Promise<void>
  _handleError(...err: (string | number)[]): void
  _onHeadersSave(): Promise<void>
  _stopHeaderSubscription(): void
  _startBlockSubscription(): void
  _syncComplete: boolean
  _detectReorg(block: BlockModel): boolean
  _handleReorg(block: BlockModel): Promise<void>
  _onBestHeight(height: number): void
  _startSync(): void
  _removeAllSubscriptions(): void
  _logProcess(): void
  _getP2PHeaders(hash: Buffer): void
  _sync(): void
  getEndHash(
    tip: ITip,
    blockCount: number
  ): Promise<{ targetHash: Buffer; endHash: Buffer | null } | void>
  getLastHeader(): HeaderModel | HeaderCreationAttributes | undefined
  _adjustHeadersForCheckpointTip(): Promise<void>
  _getChainwork(
    header: HeaderCreationAttributes,
    prevHeader: HeaderModel | HeaderCreationAttributes
  ): bigint
}

class HeaderService extends Service implements IHeaderService {
  private p2p: IP2PService | undefined
  private tip: ITip | undefined
  private readonly genesisHeader: IHeader | undefined
  private lastHeader: HeaderModel | HeaderCreationAttributes | undefined
  private initialSync: boolean = true
  private originalHeight: number = 0
  private lastHeaderCount: number = 2000
  private bus: IBus | undefined
  private reorging: boolean = false
  private blockProcessor: AsyncQueue<BlockModel, 'block'> | undefined
  private subscribedHeaders: boolean = false
  private lastTipHeightReported: number | undefined
  private Header: ModelCtor<HeaderModel> | undefined
  private _subscribedBlock: boolean = false
  private _bestHeight: number | undefined

  constructor(options: BaseConfig) {
    super(options)
    let p2p = this.node.services.get('p2p')
    if (p2p) {
      this.p2p = p2p as IP2PService
    }
    this.genesisHeader = Header.fromBuffer(this.chain.genesis)
  }

  static get dependencies(): Services[] {
    return ['db', 'p2p']
  }

  get dependencies(): Services[] {
    return HeaderService.dependencies
  }

  get APIMethods(): HeaderAPIMethods {
    /*
    return {getBestHeight: this.getBestHeight.bind(this)}
     */
    return { getBestHeight: this.getBestHeight.bind(this) }
  }

  getBestHeight(): number | undefined {
    return this.tip?.height
  }

  async start(): Promise<void> {
    this.Header = this.node.addedMethods.getModel?.('header') as
      | ModelCtor<HeaderModel>
      | undefined
    this.tip = await this.node.addedMethods.getServiceTip?.(this.name)
    this._adjustTipBackToCheckpoint()
    if (this.tip && this.tip.height === 0) {
      await this._setGenesisBlock()
    }
    await this._adjustHeadersForCheckpointTip()
    this.blockProcessor = new AsyncQueue((block: BlockModel) =>
      this._processBlocks(block)
    )
    this.p2p?.on('bestHeight', this._onBestHeight.bind(this))
    // this.bus = this.node.openBus({ remoteAddress: 'localhost-header' })
    this.bus = this.node.openBus()
  }

  _adjustTipBackToCheckpoint(): void {
    if (this.tip) {
      this.originalHeight = this.tip.height
      if (this.tip.height < 2000 && this.genesisHeader) {
        this.tip.height = 0
        this.tip.hash = this.genesisHeader.hash
      } else {
        this.tip.height -= 2000
      }
    }
  }

  async _setGenesisBlock(): Promise<void> {
    if (this.tip && this.genesisHeader) {
      assert(
        Buffer.compare(this.tip.hash, this.genesisHeader.hash) === 0,
        'Expected tip hash to be genesis hash, but it was not'
      )
      await this.Header?.destroy({ truncate: true })
      this.lastHeader = await this.Header?.create({
        hash: this.genesisHeader.hash,
        height: 0,
        version: this.genesisHeader.version as number,
        prevHash: this.genesisHeader.prevHash as Buffer,
        merkleRoot: this.genesisHeader.merkleRoot as Buffer,
        timestamp: this.genesisHeader.timestamp as number,
        bits: this.genesisHeader.bits as number,
        nonce: this.genesisHeader.nonce as number,
        hashStateRoot: this.genesisHeader.hashStateRoot as Buffer,
        hashUTXORoot: this.genesisHeader.hashUTXORoot as Buffer,
        stakePrevTxId: this.genesisHeader.stakePrevTxId as Buffer,
        stakeOutputIndex: this.genesisHeader.stakeOutputIndex as number,
        signature: this.genesisHeader.signature as Buffer,
        chainwork: STARTING_CHAINWORK,
      })
    }
  }

  _startHeaderSubscription(): void {
    if (this.subscribedHeaders) {
      return
    }
    this.subscribedHeaders = true
    this.logger.info('Header Service: subscribe to p2p headers')
    if (this.bus) {
      this.bus.on('p2p/headers', (headers) => this._onHeaders(headers))
      this.bus.subscribe('p2p/headers')
    }
  }

  _queueBlock(block: BlockModel): void {
    this.blockProcessor?.push(block, (...err: (string | number)[]) => {
      if (err) {
        this._handleError(...err)
      } else {
        this.logger.debug(
          `Header Service: completed processing block: ${block.hash.toString(
            'hex'
          )},`,
          'prev hash:',
          block.header.prevHash?.toString('hex')
        )
      }
    })
  }

  async _processBlocks(block: BlockModel): Promise<void> {
    if (this.node.stopping || this.reorging) {
      return
    }
    try {
      let header: HeaderModel | null = await HeaderModel.findByHash(block.hash)
      if (header) {
        this.logger.debug('Header Service: block already exists in data set')
      } else {
        await this._persistHeader(block)
      }
    } catch (err) {
      this._handleError(err)
    }
  }

  async _persistHeader(block: BlockModel): Promise<void> {
    if (!this._detectReorg(block)) {
      await this._syncBlock(block)
      return
    }
    this.reorging = true
    this.emit('reorg')
    await this._handleReorg(block)
    this._startSync()
  }

  async _syncBlock(block: BlockModel): Promise<void> {
    this.logger.debug('Header Service: new block:', block.hash.toString('hex'))
    if (this.Header) {
      let header = new HeaderModel({
        hash: block.header.hash,
        height: block.header.height,
        version: block.header.version,
        prevHash: block.header.prevHash,
        merkleRoot: block.header.merkleRoot,
        timestamp: block.header.timestamp,
        bits: block.header.bits,
        nonce: block.header.nonce,
        hashStateRoot: block.header.hashStateRoot,
        hashUTXORoot: block.header.hashUTXORoot,
        stakePrevTxId: block.header.stakePrevTxId,
        stakeOutputIndex: block.header.stakeOutputIndex,
        signature: block.header.signature,
        chainwork: block.header.chainwork,
      })
      this._onHeader(header)
      await header.save()
      if (this.node.addedMethods.updateServiceTip && this.tip) {
        await this.node.addedMethods.updateServiceTip(this.name, this.tip)
      }
    }
  }

  _onHeader(header: HeaderCreationAttributes): void {
    if (this.lastHeader && this.tip) {
      header.height = this.lastHeader?.height + 1
      header.chainwork = this._getChainwork(header, this.lastHeader)
      this.lastHeader = header
      this.tip.height = header.height
      this.tip.hash = header.hash
    }
  }

  async _onHeaders(headers: HeaderModel[]): Promise<void> {
    try {
      this.lastHeaderCount = headers.length
      if (headers.length === 0) {
        this._onHeadersSave().catch((err) => this._handleError(err))
      } else {
        this.logger.debug(
          'Header Service: received:',
          headers.length,
          'header(s)'
        )
        let transformedHeaders: HeaderCreationAttributes[] = headers.map(
          (header: HeaderModel) => ({
            hash: header.hash,
            height: 0,
            version: header.version,
            prevHash: header.prevHash,
            merkleRoot: header.merkleRoot,
            timestamp: header.timestamp,
            bits: header.bits,
            nonce: header.nonce,
            hashStateRoot: header.hashStateRoot,
            hashUTXORoot: header.hashUTXORoot,
            stakePrevTxId: header.stakePrevTxId,
            stakeOutputIndex: header.stakeOutputIndex,
            signature: header.signature,
            chainwork: BigInt(0),
          })
        )
        for (let header of transformedHeaders) {
          if (this.lastHeader && header.prevHash) {
            assert(
              Buffer.compare(this.lastHeader.hash, header.prevHash) === 0,
              `headers not in order: ${this.lastHeader.hash.toString(
                'hex'
              )}' -and- ${header.prevHash.toString(
                'hex'
              )}, last header at height: ${this.lastHeader.height}`
            )
            this._onHeader(header)
          }
        }
        await HeaderModel.bulkCreate(transformedHeaders)
      }
      if (this.node.addedMethods.updateServiceTip && this.tip) {
        await this.node.addedMethods.updateServiceTip(this.name, this.tip)
      }
      await this._onHeadersSave()
    } catch (err) {
      this._handleError(err)
    }
  }

  _handleError(...err: (string | number)[]): void {
    this.logger.error('Header Service:', ...err)
    this.node.stop().then()
  }

  async _onHeadersSave(): Promise<void> {
    this._logProcess()
    if (!this._syncComplete) {
      this._sync()
      return
    }
    this._stopHeaderSubscription()
    this._startBlockSubscription()
    this.logger.debug(
      'Header Service:',
      this.lastHeader?.hash.toString('hex'),
      'is the best block hash'
    )
    if (!this.initialSync) {
      return
    }
    this.logger.info('Header Service: sync complete')
    this.initialSync = false
    for (let service of this.node.getServicesByOrder()) {
      await service.onHeaders()
    }
    this.emit('reorg complete')
    this.reorging = false
  }

  _stopHeaderSubscription(): void {
    if (this.subscribedHeaders) {
      this.subscribedHeaders = false
      this.logger.info(
        'Header Service: p2p header subscription no longer needed, unsubscribing'
      )
      this.bus?.unsubscribe('p2p/headers')
    }
  }

  _startBlockSubscription(): void {
    if (!this._subscribedBlock) {
      this._subscribedBlock = true
      this.logger.info('Header Service: starting p2p block subscription')
      if (this.bus) {
        this.bus.on('p2p/block', (block: BlockModel) => this._queueBlock(block))
        this.bus.subscribe('p2p/block')
      }
    }
  }

  get _syncComplete(): boolean {
    return this.lastHeaderCount < 2000
  }

  _detectReorg(block: BlockModel): boolean {
    if (this.lastHeader) {
      return Buffer.compare(this.lastHeader.hash, block.header.prevHash) !== 0
    }
    return false
  }

  async _handleReorg(block: BlockModel): Promise<void> {
    this.logger.warn(
      `Header Service: reorganization detected, current tip hash: ${this.tip?.hash.toString(
        'hex'
      )},`,
      'new block causing the reorg:',
      block.hash.toString('hex')
    )
    this._adjustTipBackToCheckpoint()
    await this._adjustHeadersForCheckpointTip()
  }

  _onBestHeight(height: number): void {
    this.logger.info('Header Service: best height is:', height)
    this._bestHeight = height
    this._startSync()
  }

  _startSync(): void {
    this.initialSync = true
    this.logger.debug(
      'Header Service: starting sync routines, ensuring no pre-exiting subscriptions to p2p blocks'
    )
    this._removeAllSubscriptions()
    let interval = setInterval(() => {
      if (this.blockProcessor && this.blockProcessor.length === 0 && this.tip) {
        clearInterval(interval)
        let numNeeded =
          Math.max(Number(this._bestHeight), this.originalHeight) -
          this.tip.height
        assert(numNeeded >= 0)
        if (numNeeded > 0) {
          this.logger.info(
            'Header Service: gathering:',
            numNeeded,
            'header(s) from the peer-to-peer network'
          )
          this._sync()
        } else if (numNeeded === 0) {
          this.logger.info(
            'Header Service: we seem to be already synced with the peer'
          )
        }
      }
    }, 0).unref()
  }

  _removeAllSubscriptions(): void {
    if (this.bus) {
      this.bus.unsubscribe('p2p/headers')
      this.bus.unsubscribe('p2p/block')
      this._subscribedBlock = false
      this.subscribedHeaders = false
      this.bus.removeAllListeners()
    }
  }

  _logProcess(): void {
    if (this.tip) {
      if (!this.initialSync || this.lastTipHeightReported === this.tip.height) {
        return
      }
      let bestHeight = Math.max(
        Number(this._bestHeight),
        Number(this.lastHeader?.height)
      )
      let progress =
        bestHeight === 0 ? 0 : ((this.tip.height / bestHeight) * 100).toFixed(2)
      this.logger.info(
        'Header Service: download progress:',
        `${this.tip.height}/${bestHeight}`,
        `(${progress}%)`
      )
      this.lastTipHeightReported = this.tip.height
    }
  }

  _getP2PHeaders(hash: Buffer): void {
    this.node.addedMethods.getHeaders?.({ startHash: hash })
  }

  _sync(): void {
    this._startHeaderSubscription()
    if (this.tip) this._getP2PHeaders(this.tip.hash)
  }

  async getEndHash(
    tip: ITip,
    blockCount: number
  ): Promise<{ targetHash: Buffer; endHash: Buffer | null } | void> {
    assert(
      blockCount >= 1,
      'Header Service: block count to getEndHash must be at least 1'
    )
    if (this.tip && this.Header) {
      let numResultsNeeded = Math.min(
        this.tip.height - tip.height,
        blockCount + 1
      )
      if (
        numResultsNeeded === 0 &&
        Buffer.compare(this.tip.hash, tip.hash) === 0
      ) {
        return
      } else if (numResultsNeeded <= 0) {
        throw new Error('Header Service: block service is mis-aligned')
      }
      let startingHeight = tip.height + 1
      let results = (
        await this.Header.findAll({
          where: {
            height: {
              [$between]: [startingHeight, startingHeight + blockCount],
            },
          },
          attributes: ['hash'],
        })
      ).map((header: Pick<HeaderModel, 'hash'>) => header.hash)
      let index = numResultsNeeded - 1
      let endHash = index <= 0 || !results[index] ? null : results[index]
      return { targetHash: results[0], endHash }
    }
  }

  getLastHeader(): HeaderModel | HeaderCreationAttributes | undefined {
    return this.lastHeader
  }

  async _adjustHeadersForCheckpointTip(): Promise<void> {
    this.logger.info(
      'Header Service: getting last header synced at height:',
      this.tip?.height
    )
    if (this.tip && this.Header) {
      await this.Header.destroy({
        where: { height: { [$gt]: this.tip.height } },
      })
      let lastHeader = await HeaderModel.findByHeight(this.tip.height)
      if (lastHeader) {
        this.lastHeader = lastHeader
        this.tip.height = this.lastHeader.height
        this.tip.hash = this.lastHeader.hash
      }
    }
  }

  _getChainwork(
    header: HeaderCreationAttributes,
    prevHeader: HeaderModel | HeaderCreationAttributes
  ): bigint {
    let target = fromCompact(header.bits)
    if (target <= BigInt(0)) {
      return BigInt(0)
    }
    return prevHeader.chainwork + MAX_CHAINWORK / (target + BigInt(1))
  }
}

function fromCompact(bits: number): bigint {
  if (bits === 0) {
    return BigInt(0)
  }
  let exponent = bits >>> 24
  let num = BigInt(bits & 0x7fffff) << BigInt(8 * (exponent - 3))
  if ((bits >>> 23) & 1) {
    num = -num
  }
  return num
}

export default HeaderService
