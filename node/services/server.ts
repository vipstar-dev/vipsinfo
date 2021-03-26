import socketio from 'socket.io'

import { IBus } from '@/node/bus'
import { Services } from '@/node/node'
import Service, { BaseConfig } from '@/node/services/base'
import { IBlock } from '@/node/services/block'

export interface ServerConfig extends BaseConfig {
  port: number
}

class ServerService extends Service {
  public options: ServerConfig
  public bus: IBus | undefined
  public io: socketio.Server | undefined
  public height: number | undefined
  public hash: Buffer | undefined
  public id: Buffer | undefined

  constructor(options: ServerConfig) {
    super(options)
    this.options = options
  }

  static get dependencies(): Services[] {
    return ['block', 'mempool']
  }

  get dependencies(): Services[] {
    return ServerService.dependencies
  }

  async start() {
    // this.bus = this.node?.openBus({ remoteAddress: 'localhost-server' })
    this.bus = this.node?.openBus()
    this.bus?.on('block/block', () => this._onBlock(this))
    this.bus?.subscribe('block/block')
    this.bus?.on('block/reorg', () => this._onReorg(this))
    this.bus?.subscribe('block/reorg')
    this.bus?.on('mempool/transaction', () => this._onMempoolTransaction(this))
    this.bus?.subscribe('mempool/transaction')

    this.io = socketio(this.options.port || 3001, { serveClient: false })
    this.io.on('connection', this._onConnection.bind(this))
  }

  async stop() {
    this.io?.close()
  }

  _onConnection(socket: socketio.Server): void {
    socket.emit('tip', this.node?.addedMethods.getBlockTip)
  }

  _onBlock(block: IBlock): void {
    this.io?.sockets.emit('block', { hash: block.hash, height: block.height })
  }

  _onReorg(block: IBlock): void {
    this.io?.sockets.emit('reorg', { hash: block.hash, height: block.height })
  }

  _onMempoolTransaction(transaction: { id: Buffer | undefined }): void {
    this.io?.sockets.emit('mempool-transaction', transaction.id)
  }
}

export default ServerService
