import EventEmitter from 'events'
import { Socket } from 'net'

import { IChain } from '@/lib'
import BufferReader from '@/lib/encoding/buffer-reader'
import Message from '@/p2p/commands/commands/message'
import PingMessage from '@/p2p/commands/commands/ping'
import RejectMessage from '@/p2p/commands/commands/reject'
import VersionMessage from '@/p2p/commands/commands/version'
import Messages from '@/p2p/commands/messages'

const MAX_RECEIVE_BUFFER = 10000000
export const status: { [key: string]: string } = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  READY: 'ready',
}

export interface PeerConstructor {
  socket?: Socket
  host?: string
  port?: number
  chain: IChain
}

class Peer extends EventEmitter {
  public chain: IChain
  private socket: Socket | null = null
  private readonly host: string = '127.0.0.1'
  public port: number = 3888
  public status: string = status.DISCONNECTED
  private messages: Messages | null = null
  private receiveBuffer: BufferReader = new BufferReader(Buffer.alloc(0))
  public bestHeight: number = 0
  public version: number = 0
  public subversion: string | null = null
  private versionSent: boolean = false

  constructor({
    socket,
    host = '127.0.0.1',
    port = 3888,
    chain,
  }: PeerConstructor) {
    super()
    this.chain = chain
    if (socket) {
      this.socket = socket
      this.host = this.socket?.remoteAddress || this.host
      this.port = this.socket?.remotePort || this.port
      this.status = status.CONNECTED
      this.addSocketEventHandlers()
    } else {
      this.host = host
      this.port = port || this.chain.port
    }
    this.messages = new Messages({ chain: this.chain })

    this.on('ping', (message: PingMessage) => this.sendPong(message.nonce))
    this.on('version', (message: VersionMessage) => {
      this.version = message.version
      this.subversion = message.subversion
      this.bestHeight = message.startHeight
      const verackResponse = this.messages?.commands.verack?.({ chain })
      if (verackResponse) {
        this.sendMessage(verackResponse)
      }
      if (!this.versionSent) {
        this.sendVersion()
      }
    })
    this.on('verack', () => {
      this.status = status.READY
      this.emit('ready')
    })
    this.on('reject', (message: RejectMessage) => {
      console.log(message)
    })
  }

  connect(): void {
    this.socket = new Socket()
    this.status = status.CONNECTING
    this.socket.on('connect', () => {
      this.status = status.CONNECTED
      this.emit('connect')
      this.sendVersion()
    })
    this.addSocketEventHandlers()
    this.socket.connect(this.port, this.host)
  }

  disconnect(): void {
    this.status = status.DISCONNECTED
    this.socket?.destroy()
    this.emit('disconnect')
  }

  addSocketEventHandlers() {
    this.socket?.on('data', (data) => {
      this.receiveBuffer.push(data)
      if (Number(this.receiveBuffer?.length) > MAX_RECEIVE_BUFFER) {
        this.disconnect()
      } else {
        this.readMessage()
      }
    })
    this.socket?.on('end', () => this.disconnect())
    this.socket?.on('error', (err: string) => this.onError(err))
  }

  onError(err: string): void {
    this.emit('error', err)
    if (this.status !== status.DISCONNECTED) {
      this.disconnect()
    }
  }

  sendMessage(message: Message): void {
    this.socket?.write(message.toBuffer())
  }

  sendVersion(): void {
    const message = this.messages?.commands.version?.({ chain: this.chain })
    if (message) {
      this.versionSent = true
      this.sendMessage(message)
    }
  }

  sendPong(nonce: Buffer): void {
    const message = this.messages?.commands.pong?.({
      chain: this.chain,
      nonce,
    })
    if (message) {
      this.sendMessage(message)
    }
  }

  readMessage(): void {
    const message = this.messages?.parseBuffer(this.receiveBuffer)
    if (message) {
      this.emit(message.command, message)
      this.readMessage()
    }
  }
}

export default Peer
