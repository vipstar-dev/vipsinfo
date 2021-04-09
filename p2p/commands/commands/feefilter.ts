import { BufferReader, BufferWriter } from '@/lib'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'

export interface FeeFilterMessageOptions extends MessageOptions {
  feeRate?: bigint
}

export interface IFeeFilterMessage extends FeeFilterMessageOptions, IMessage {}

class FeeFilterMessage extends Message implements IFeeFilterMessage {
  public feeRate: bigint | undefined

  constructor({ feeRate, ...options }: FeeFilterMessageOptions) {
    super('feefilter', options)
    this.feeRate = feeRate
  }

  static fromBuffer(
    payload: Buffer,
    options: FeeFilterMessageOptions
  ): FeeFilterMessage {
    const message = new FeeFilterMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    const writer = new BufferWriter()
    if (this.feeRate) {
      writer.writeUInt64LE(this.feeRate)
    }
    return writer.toBuffer()
  }

  set payload(payload: Buffer) {
    const reader = new BufferReader(payload)
    this.feeRate = reader.readUInt64LE()
    Message.checkFinished(reader)
  }
}

export default FeeFilterMessage
