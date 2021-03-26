import LRU from 'lru-cache'

import { IBlock } from '@/lib/block/block'
import { Services } from '@/node/node'
import Service, { BaseConfig, IService } from '@/node/services/base'
import {
  InventoryConstructor,
  types as InvTypes,
} from '@/p2p/commands/inventory'
import Messages from '@/p2p/commands/messages'
import Peer from '@/p2p/peer'
import Pool, { PoolConstructor } from '@/p2p/pool'
import Timeout = NodeJS.Timeout
import EventEmitter from 'events'

import { IChain } from '@/lib'
import Header from '@/lib/block/header'
import Transaction from '@/lib/transaction'
import BlockMessage from '@/p2p/commands/commands/block'
import GetDataMessage from '@/p2p/commands/commands/getdata'
import { GetHeadersMessageOptions } from '@/p2p/commands/commands/getheaders'
import HeadersMessage from '@/p2p/commands/commands/headers'
import InvMessage from '@/p2p/commands/commands/inv'
import TxMessage from '@/p2p/commands/commands/tx'
import { AddressData } from '@/p2p/commands/commands/utils'
import RpcClient from '@/rpc'

export interface P2pConfig extends BaseConfig {
  peers: AddressData[]
  blockCacheCount?: LRU<Buffer, IBlock>
  maxPeers?: number
}

export interface IP2PService extends IService, P2PAPIMethods {
  options: P2pConfig
  APIMethods: P2PAPIMethods
  _disconnectPool(): void
  _addPeer(peer: Peer): void
  _broadcast(
    subscribers: EventEmitter[],
    name: string,
    entity: IBlock | Header[] | Transaction
  ): void
  _setRetryInterval(): void
  _connect(): void
  _getBestHeight(): number
  _initCache(): void
  _initP2P(): void
  _initPool(): void
  _initPubSub(): void
  _onPeerBlock(peer: Peer, message: BlockMessage): void
  _onPeerDisconnect(peer: Peer, address: AddressData): void
  _onPeerGetData(peer: Peer, message: GetDataMessage): void
  _onPeerHeaders(peer: Peer, message: HeadersMessage): void
  _onPeerInventories(peer: Peer, message: InvMessage): void
  _matchChain(chain: IChain): IChain | void
  _onPeerReady(peer: Peer, address: AddressData): void
  _onPeerTransaction(peer: Peer, message: TxMessage): void
  _removePeer(peer: Peer): void
  _setListeners(): void
  _setResourceFilter(filter: BlockFilter): Partial<GetHeadersMessageOptions>
}

export interface P2PAPIMethods {
  clearInventoryCache: () => void
  getP2PBlock: ({
    blockHash,
    filter,
  }: {
    blockHash: Buffer
    filter: BlockFilter
  }) => Promise<unknown>
  getHeaders: (filter: BlockFilter) => void
  getMempool: () => void
  getConnections: () => number | undefined
  sendRawTransaction: (data: Buffer) => Promise<Buffer | undefined>
}

export interface BlockFilter {
  startHash: Buffer
  endHash: Buffer
}

class P2PService extends Service implements IP2PService {
  public options: P2pConfig
  private outgoingTransactions: LRU<string, Transaction> = new LRU(100)
  private blockCache: LRU<Buffer, IBlock>
  private pool: Pool | undefined
  private peer: Peer | undefined
  private peers: Peer[] = []
  private inventories: LRU<string, boolean> = new LRU()
  private maxPeers: number = 60
  private configPeers: Partial<AddressData>[] = []
  private messages: Messages | undefined
  private retryInterval: Timeout | null = null

  constructor(options: P2pConfig) {
    super(options)
    this.options = options
    this._initP2P()
    this._initPubSub()
    this.blockCache =
      options.blockCacheCount || new LRU({ max: 10, maxAge: 5 * 60 * 1000 })
  }

  static get dependencies(): Services[] {
    return ['db']
  }

  get dependencies(): Services[] {
    return P2PService.dependencies
  }

  get APIMethods(): P2PAPIMethods {
    return {
      clearInventoryCache: () => this.clearInventoryCache(),
      getP2PBlock: ({
        blockHash,
        filter,
      }: {
        blockHash: Buffer
        filter: BlockFilter
      }) => this.getP2PBlock({ blockHash, filter }),
      getHeaders: (filter: BlockFilter) => this.getHeaders(filter),
      getMempool: () => this.getMempool(),
      getConnections: () => this.getConnections(),
      sendRawTransaction: (data: Buffer) => this.sendRawTransaction(data),
    }
  }

  clearInventoryCache(): void {
    this.inventories.reset()
  }

  getConnections(): number | undefined {
    return this.pool?.connections
  }

  async getP2PBlock({
    blockHash,
    filter,
  }: {
    blockHash: Buffer
    filter: BlockFilter
  }): Promise<IBlock> {
    let block = this.blockCache.get(blockHash)
    if (block) {
      return block
    }
    // let blockFilter = this._setResourceFilter(filter, 'blocks')
    let blockFilter = this._setResourceFilter(filter)
    if (
      this.peer &&
      this.messages &&
      this.messages.commands.getblocks &&
      this.chain
    ) {
      this.peer.sendMessage(
        this.messages.commands.getblocks({ chain: this.chain, ...blockFilter })
      )
    }
    return new Promise((resolve, reject) => {
      let timeout: Timeout
      let callback = (block: IBlock) => {
        clearTimeout(timeout)
        resolve(block)
      }
      timeout = setTimeout(() => {
        this.removeListener(blockHash.toString('hex'), callback)
        reject()
      }, 5000)
      this.once(blockHash.toString('hex'), callback)
    })
  }

  getHeaders(filter: BlockFilter): void {
    // let headerFilter = this._setResourceFilter(filter, 'headers')
    let headerFilter = this._setResourceFilter(filter)
    if (
      this.peer &&
      this.messages &&
      this.messages.commands.getheaders &&
      this.chain
    ) {
      this.peer.sendMessage(
        this.messages.commands.getheaders({
          chain: this.chain,
          ...headerFilter,
        })
      )
    }
  }

  getMempool(): void {
    if (
      this.peer &&
      this.messages &&
      this.messages.commands.mempool &&
      this.chain
    ) {
      this.peer.sendMessage(
        this.messages.commands.mempool({ chain: this.chain })
      )
    }
  }

  async sendRawTransaction(data: Buffer): Promise<Buffer | undefined> {
    let rpcClient:
      | RpcClient
      | undefined = this.node?.addedMethods.getRpcClient?.()
    if (rpcClient && rpcClient.rpcMethods.sendrawtransaction) {
      let id:
        | string
        | undefined = (await rpcClient.rpcMethods.sendrawtransaction(
        data.toString('hex')
      )) as string | undefined

      if (id) {
        return Buffer.from(id, 'hex')
      }
    }
  }

  async start(): Promise<void> {
    this._initCache()
    this._initPool()
    this._setListeners()
  }

  _disconnectPool(): void {
    this.logger.info(
      'P2P Service: diconnecting pool and peers. SIGINT issued, system shutdown initiated'
    )
    this.pool?.disconnect()
  }

  _addPeer(peer: Peer): void {
    this.peers.push(peer)
  }

  _broadcast(
    subscribers: EventEmitter[],
    name: string,
    entity: IBlock | Header[] | Transaction
  ): void {
    for (let emitter of subscribers) {
      emitter.emit(name, entity)
    }
  }

  _setRetryInterval(): void {
    if (!this.retryInterval && !this.node?.stopping) {
      this.retryInterval = setInterval(() => {
        this.logger.info('P2P Service: retry connection to p2p network')
        this.pool?.connect()
      }, 5000).unref()
    }
  }

  _connect(): void {
    this.logger.info('P2P Service: connecting to p2p network')
    this.pool?.connect()
    this._setRetryInterval()
  }

  _getBestHeight(): number {
    if (this.peers.length === 0) {
      return 0
    }
    let maxHeight = -Infinity
    for (let peer of this.peers) {
      if (peer.bestHeight > maxHeight) {
        maxHeight = peer.bestHeight
        this.peer = peer
      }
    }
    return maxHeight
  }

  _initCache(): void {
    this.inventories = new LRU(1000)
  }

  _initP2P(): void {
    this.maxPeers = this.options.maxPeers || 60
    this.configPeers = this.options.peers
    if (this.chain) {
      this.messages = new Messages({ chain: this.chain })
    }
    this.peers = []
  }

  _initPool(): void {
    let options: PoolConstructor = {
      dnsSeed: false,
      // maxPeers: this.maxPeers,
      maxSize: this.maxPeers,
      chain: this.chain,
    }
    if (this.configPeers) {
      options.addresses = this.configPeers
    }
    this.pool = new Pool(options)
  }

  _initPubSub(): void {
    this.subscriptions = {
      block: [],
      headers: [],
      transaction: [],
    }
  }

  _onPeerBlock(peer: Peer, message: BlockMessage): void {
    if (message.block) {
      this.blockCache.set(message.block.id, message.block)
      this.emit(message.block.id.toString('hex'), message.block)
      this._broadcast(this.subscriptions.block, 'p2p/block', message.block)
    }
  }

  _onPeerDisconnect(peer: Peer, address: AddressData): void {
    this._removePeer(peer)
    if (this.peers.length === 0) {
      this._setRetryInterval()
    }
    this.logger.info('P2P Service: disconnected from peer:', address.ip.v4)
  }

  _onPeerGetData(peer: Peer, message: GetDataMessage): void {
    if (message.inventories[0] && message.inventories[0].data) {
      let txId: string = Buffer.from(message.inventories[0].data)
        .reverse()
        .toString('hex')
      let tx = this.outgoingTransactions.get(txId)
      if (tx && this.messages?.commands.tx) {
        peer.sendMessage(
          this.messages.commands.tx({ chain: this.chain, transaction: tx })
        )
      }
    }
  }

  _onPeerHeaders(peer: Peer, message: HeadersMessage): void {
    this._broadcast(this.subscriptions.headers, 'p2p/headers', message.headers)
  }

  _onPeerInventories(peer: Peer, message: InvMessage): void {
    let newDataNeeded: InventoryConstructor[] = []
    for (let inventory of message.inventories) {
      if (
        inventory.data &&
        !this.inventories.get(inventory.data.toString('hex'))
      ) {
        this.inventories.set(inventory.data.toString('hex'), true)
        if (
          inventory.type &&
          [
            InvTypes.TRANSACTION,
            InvTypes.BLOCK,
            InvTypes.FILTERED_BLOCK,
          ].includes(inventory.type)
        ) {
          inventory.type |= InvTypes.WITNESS
        }
        newDataNeeded.push(inventory)
      }
    }
    if (newDataNeeded.length > 0 && this.messages?.commands.getdata) {
      peer.sendMessage(
        this.messages.commands.getdata({
          chain: this.chain,
          inventories: newDataNeeded,
        })
      )
    }
  }

  _matchChain(chain: IChain): IChain | void {
    if (this.chain.name === chain.name) {
      return chain
    }
    this.logger.error(
      `P2P Service: configured chain: "${this.chain.name}"`,
      `does not match our peer's reported network: "${chain.name}"`
    )
    this.node.stop().then()
  }

  _onPeerReady(peer: Peer, address: AddressData): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval)
      this.retryInterval = null
    }
    if (!this._matchChain(peer.chain)) {
      return
    }
    this.logger.info(
      `Connected to peer: ${address.ip.v4},`,
      `chain: ${peer.chain.name}, version: ${peer.version},`,
      `subversion: ${peer.subversion},`,
      `status: ${peer.status},`,
      `port: ${peer.port},`,
      `best height: ${peer.bestHeight}`
    )
    this._addPeer(peer)
    let bestHeight = this._getBestHeight()
    if (bestHeight >= 0) {
      this.emit('bestHeight', bestHeight)
    }
  }

  _onPeerTransaction(peer: Peer, message: TxMessage): void {
    if (message.transaction) {
      this._broadcast(
        this.subscriptions.transaction,
        'p2p/transaction',
        message.transaction
      )
    }
  }

  _removePeer(peer: Peer): void {
    this.peers.splice(this.peers.indexOf(peer), 1)
  }

  _setListeners(): void {
    this.node.on('stopping', () => this._disconnectPool())
    if (this.pool) {
      this.pool.on('peerready', (peer: Peer, address: AddressData) =>
        this._onPeerReady(peer, address)
      )
      this.pool.on('peerdisconnect', (peer: Peer, address: AddressData) =>
        this._onPeerDisconnect(peer, address)
      )
      this.pool.on('peerinv', (peer: Peer, message: InvMessage) =>
        this._onPeerInventories(peer, message)
      )
      this.pool.on('peertx', (peer: Peer, message: TxMessage) =>
        this._onPeerTransaction(peer, message)
      )
      this.pool.on('peerblock', (peer: Peer, message: BlockMessage) =>
        this._onPeerBlock(peer, message)
      )
      this.pool.on('peerheaders', (peer: Peer, message: HeadersMessage) =>
        this._onPeerHeaders(peer, message)
      )
      this.pool.on('peergetdata', (peer: Peer, message: GetDataMessage) =>
        this._onPeerGetData(peer, message)
      )
      this.node.on('ready', () => this._connect())
    }
  }

  _setResourceFilter(filter: BlockFilter): Partial<GetHeadersMessageOptions> {
    return { starts: [filter.startHash], stop: filter.endHash || 0 }
  }
}

export default P2PService
