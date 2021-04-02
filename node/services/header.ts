import assert from 'assert'
import { ModelCtor, Op } from 'sequelize'

import { IBlock } from '@/lib'
import Header, { IHeader } from '@/lib/block/header'
import { IBus } from '@/node/bus'
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
  _queueBlock(block: IBlock): void
  _processBlocks(block: IBlock): Promise<void>
  _persistHeader(block: IBlock): Promise<void>
  _syncBlock(block: IBlock): Promise<void>
  _onHeader(header: HeaderCreationAttributes): void
  _onHeaders(headers: IHeader[]): Promise<void>
  _handleError(methodName: string, ...err: (string | number | null)[]): void
  _onHeadersSave(): Promise<void>
  _stopHeaderSubscription(): void
  _startBlockSubscription(): void
  _syncComplete: boolean
  _detectReorg(block: IBlock): boolean
  _handleReorg(block: IBlock): Promise<void>
  _onBestHeight(height: number): void
  _startSync(): void
  _removeAllSubscriptions(): void
  _logProcess(): void
  _getP2PHeaders(hash: Buffer): void
  _sync(): void
  getEndHash(
    tip: ITip,
    blockCount: number
  ): Promise<{ targetHash: Buffer; endHash: Buffer | undefined } | void>
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
  private blockProcessor: AsyncQueue<IBlock, 'block'> | undefined
  private subscribedHeaders: boolean = false
  private lastTipHeightReported: number | undefined
  private Header: ModelCtor<HeaderModel> | undefined
  private _subscribedBlock: boolean = false
  private _bestHeight: number | undefined

  constructor(options: BaseConfig) {
    super(options)
    const p2p = this.node.services.get('p2p')
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
    return { getBestHeight: () => this.getBestHeight() }
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
    this.blockProcessor = new AsyncQueue((block: IBlock) =>
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
      this.bus.on('p2p/headers', (headers: IHeader[]) => {
        void new Promise((resolve) => {
          resolve(this._onHeaders(headers))
        })
      })
      this.bus.subscribe('p2p/headers')
    }
  }

  _queueBlock(block: IBlock): void {
    this.blockProcessor?.push(block, (...err: (string | number | null)[]) => {
      if (err[0]) {
        this._handleError('_queueBlock', ...err)
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

  async _processBlocks(block: IBlock): Promise<void> {
    if (this.node.stopping || this.reorging) {
      return
    }
    try {
      const header: HeaderModel | null = await HeaderModel.findByHash(
        block.hash
      )
      if (header) {
        this.logger.debug('Header Service: block already exists in data set')
      } else {
        await this._persistHeader(block)
      }
    } catch (err) {
      this._handleError('_processBlocks', err)
    }
  }

  async _persistHeader(block: IBlock): Promise<void> {
    if (!this._detectReorg(block)) {
      await this._syncBlock(block)
      return
    }
    this.reorging = true
    this.emit('reorg')
    await this._handleReorg(block)
    this._startSync()
  }

  async _syncBlock(block: IBlock): Promise<void> {
    this.logger.debug('Header Service: new block:', block.hash.toString('hex'))
    if (this.lastHeader) {
      const headerCreationObject: HeaderCreationAttributes = {
        hash: block.header.hash,
        height: this.lastHeader.height + 1,
        version: block.header.version as number,
        prevHash: block.header.prevHash,
        merkleRoot: block.header.merkleRoot as Buffer,
        timestamp: block.header.timestamp as number,
        bits: block.header.bits as number,
        nonce: block.header.nonce as number,
        hashStateRoot: block.header.hashStateRoot as Buffer,
        hashUTXORoot: block.header.hashUTXORoot as Buffer,
        stakePrevTxId: block.header.stakePrevTxId as Buffer,
        stakeOutputIndex: block.header.stakeOutputIndex as number,
        signature: block.header.signature as Buffer,
        chainwork: BigInt(0),
      }
      headerCreationObject.chainwork = this._getChainwork(
        headerCreationObject,
        this.lastHeader
      )
      const header = new HeaderModel(headerCreationObject)
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

  async _onHeaders(headers: IHeader[]): Promise<void> {
    try {
      this.lastHeaderCount = headers.length
      if (headers.length === 0) {
        this._onHeadersSave().catch((err) =>
          this._handleError('_onHeaders1', err)
        )
      } else {
        this.logger.debug(
          'Header Service: received:',
          headers.length,
          'header(s)'
        )
        const transformedHeaders: HeaderCreationAttributes[] = headers.map(
          (header: IHeader) => ({
            hash: header.hash,
            height: 0,
            version: header.version as number,
            prevHash: header.prevHash,
            merkleRoot: header.merkleRoot as Buffer,
            timestamp: header.timestamp as number,
            bits: header.bits as number,
            nonce: header.nonce as number,
            hashStateRoot: header.hashStateRoot as Buffer,
            hashUTXORoot: header.hashUTXORoot as Buffer,
            stakePrevTxId: header.stakePrevTxId as Buffer,
            stakeOutputIndex: header.stakeOutputIndex as number,
            signature: header.signature as Buffer,
            chainwork: BigInt(0),
          })
        )
        for (const header of transformedHeaders) {
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
      this._handleError('_onHeaders2', err)
    }
  }

  _handleError(methodName: string, ...err: (string | number | null)[]): void {
    this.logger.error('Header Service:', `handle error(${methodName}):`, ...err)
    void this.node.stop().then()
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
    for (const service of this.node.getServicesByOrder()) {
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
        this.bus.on('p2p/block', (block: IBlock) => this._queueBlock(block))
        this.bus.subscribe('p2p/block')
      }
    }
  }

  get _syncComplete(): boolean {
    return this.lastHeaderCount < 2000
  }

  _detectReorg(block: IBlock): boolean {
    if (this.lastHeader && block.header.prevHash) {
      return (
        Buffer.compare(
          this.lastHeader.hash,
          block.header.prevHash
        ) !== 0
      )
    }
    return false
  }

  async _handleReorg(block: IBlock): Promise<void> {
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
    const interval = setInterval(() => {
      if (this.blockProcessor && this.blockProcessor.length === 0 && this.tip) {
        clearInterval(interval)
        const numNeeded =
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
      const bestHeight = Math.max(
        Number(this._bestHeight),
        Number(this.lastHeader?.height)
      )
      const progress =
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
  ): Promise<{ targetHash: Buffer; endHash: Buffer | undefined } | void> {
    assert(
      blockCount >= 1,
      'Header Service: block count to getEndHash must be at least 1'
    )
    if (this.tip && this.Header) {
      const numResultsNeeded = Math.min(
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
      const startingHeight = tip.height + 1
      const results = (
        await this.Header.findAll({
          where: {
            height: {
              [$between]: [startingHeight, startingHeight + blockCount],
            },
          },
          attributes: ['hash'],
        })
      ).map((header: Pick<HeaderModel, 'hash'>) => header.hash)
      const index = numResultsNeeded - 1
      const endHash = index <= 0 || !results[index] ? undefined : results[index]
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
      const lastHeader = await HeaderModel.findByHeight(this.tip.height)
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
    const target = fromCompact(header.bits)
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
  const exponent = bits >>> 24
  let num = BigInt(bits & 0x7fffff) << BigInt(8 * (exponent - 3))
  if ((bits >>> 23) & 1) {
    num = -num
  }
  return num
}

export default HeaderService
