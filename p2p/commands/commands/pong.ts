import BufferReader from '@/lib/encoding/buffer-reader'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'
import { getNonce } from '@/p2p/commands/commands/utils'

export interface PongMessageOptions extends MessageOptions {
  nonce?: Buffer
}

export interface IPongMessage extends PongMessageOptions, IMessage {}

class PongMessage extends Message implements IPongMessage {
  public nonce: Buffer

  constructor({ nonce = getNonce(), ...options }: PongMessageOptions) {
    super('pong', options)
    this.nonce = nonce
  }

  static fromBuffer(payload: Buffer, options: PongMessageOptions): PongMessage {
    const message = new PongMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    return this.nonce
  }

  set payload(payload) {
    const reader = new BufferReader(payload)
    const nonce = reader.read(8)
    if (nonce) {
      this.nonce = nonce
    }
    Message.checkFinished(reader)
  }
}

export default PongMessage
