import { BufferReader, BufferWriter } from '@/lib'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'

export const codes: { [key: string]: number } = {
  MALFORMED: 0x01,
  INVALID: 0x10,
  OBSOLETE: 0x11,
  DUPLICATE: 0x12,
  NONSTANDARD: 0x40,
  DUST: 0x41,
  INSUFFICIENTFEE: 0x42,
  CHECKPOINT: 0x43,
}

export interface RejectMessageOptions extends MessageOptions {
  message?: string
  code?: number
  reason?: string
  data?: Buffer
}

export interface IRejectMessage extends RejectMessageOptions, IMessage {}

class RejectMessage extends Message implements IRejectMessage {
  public message: string | undefined
  public code: number | undefined
  public reason: string | undefined
  public data: Buffer | undefined

  constructor({
    message,
    code,
    reason,
    data,
    ...options
  }: RejectMessageOptions) {
    super('reject', options)
    this.message = message
    this.code = code
    this.reason = reason
    this.data = data
  }

  static fromBuffer(
    payload: Buffer,
    options: RejectMessageOptions
  ): RejectMessage {
    const message = new RejectMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    const writer = new BufferWriter()
    if (this.message && this.code && this.reason && this.data) {
      writer.writeVarLengthBuffer(Buffer.from(this.message, 'ascii'))
      writer.writeUInt8(this.code)
      writer.writeVarLengthBuffer(Buffer.from(this.reason, 'ascii'))
      writer.write(this.data)
    }
    return writer.toBuffer()
  }

  set payload(payload: Buffer) {
    const reader = new BufferReader(payload)
    const message = reader.readVarLengthBuffer()?.toString('ascii')
    const code = reader.readUInt8()
    const reason = reader.readVarLengthBuffer()?.toString('ascii')
    const data = reader.readAll()
    if (message && code && reason && data) {
      this.message = message
      this.code = code
      this.reason = reason
      this.data = data
    }
    Message.checkFinished(reader)
  }
}

export default RejectMessage
