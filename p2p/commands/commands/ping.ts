import Message, {
  IMessage,
  MessageOptions,
} from '@p2p/commands/commands/message'
import { getNonce } from '@p2p/commands/commands/utils'
import BufferReader from 'vipsinfo-lib/encoding/buffer-reader'

export interface PingMessageOptions extends MessageOptions {
  nonce?: Buffer
}

export interface IPingMessage extends PingMessageOptions, IMessage {}

class PingMessage extends Message implements IPingMessage {
  public nonce: Buffer

  constructor({ nonce = getNonce(), ...options }: PingMessageOptions) {
    super('ping', options)
    this.nonce = nonce
  }

  static fromBuffer(payload: Buffer, options: PingMessageOptions): PingMessage {
    const message = new PingMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    return this.nonce
  }

  set payload(payload: Buffer) {
    const reader = new BufferReader(payload)
    const nonce = reader.read(8)
    if (nonce) {
      this.nonce = nonce
    }
    Message.checkFinished(reader)
  }
}

export default PingMessage
