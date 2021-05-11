import socketio from 'socket.io'

import { IBus } from '@/node/bus'
import { Services } from '@/node/node'
import Service, { BaseConfig, IService } from '@/node/services/base'
import { ITip } from '@/node/services/db'

export interface ServerConfig extends BaseConfig {
  port: number
}

export interface IServerService extends IService {
  _onConnection(socket: socketio.Server): void
  _onBlock(block: ITip): void
  _onReorg(block: ITip): void
  _onMempoolTransaction(transaction: { id: Buffer }): void
}

class ServerService extends Service implements IServerService {
  public options: ServerConfig
  private bus: IBus | undefined
  private io: socketio.Server | undefined

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

  // eslint-disable-next-line @typescript-eslint/require-await
  async start() {
    // this.bus = this.node?.openBus({ remoteAddress: 'localhost-server' })
    this.bus = this.node?.openBus()
    this.bus?.on('block/block', (block: ITip) => this._onBlock(block))
    this.bus?.subscribe('block/block')
    this.bus?.on('block/reorg', (block: ITip) => this._onReorg(block))
    this.bus?.subscribe('block/reorg')
    this.bus?.on('mempool/transaction', (transaction: { id: Buffer }) =>
      this._onMempoolTransaction(transaction)
    )
    this.bus?.subscribe('mempool/transaction')

    this.io = socketio(this.options.port || 3001, { serveClient: false })
    this.io.on('connection', this._onConnection.bind(this))
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async stop(): Promise<void> {
    this.io?.close()
  }

  _onConnection(socket: socketio.Server): void {
    socket.emit('tip', this.node.addedMethods.getBlockTip?.())
  }

  _onBlock(block: ITip): void {
    this.io?.sockets.emit('block', { hash: block.hash, height: block.height })
  }

  _onReorg(block: ITip): void {
    this.io?.sockets.emit('reorg', { hash: block.hash, height: block.height })
  }

  _onMempoolTransaction(transaction: { id: Buffer }): void {
    this.io?.sockets.emit('mempool-transaction', transaction.id)
  }
}

export default ServerService
