import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'

export interface ISendCmpctMessage extends IMessage {
  useCmpctBlock: boolean | undefined
  cmpctBlockVersion: bigint | undefined
}

class SendCmpctMessage extends Message implements ISendCmpctMessage {
  public useCmpctBlock: boolean | undefined
  public cmpctBlockVersion: bigint | undefined

  constructor({ ...options }: MessageOptions) {
    super('sendcmpct', options)
  }

  static fromBuffer(
    payload: Buffer,
    options: MessageOptions
  ): SendCmpctMessage {
    const message = new SendCmpctMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    const writer = new BufferWriter()
    writer.writeUInt8(Number(this.useCmpctBlock))
    writer.writeUInt64LE(BigInt(this.cmpctBlockVersion))
    return writer.toBuffer()
  }

  set payload(payload: Buffer) {
    const reader = new BufferReader(payload)
    this.useCmpctBlock = Boolean(reader.readUInt8())
    this.cmpctBlockVersion = reader.readUInt64LE()
    Message.checkFinished(reader)
  }
}

export default SendCmpctMessage
