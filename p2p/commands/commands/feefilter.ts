import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'

export interface FeeFilterMessageOptions extends MessageOptions {
  feeRate: bigint
}

export interface IFeeFilterMessage extends FeeFilterMessageOptions, IMessage {}

class FeeFilterMessage extends Message {
  public feeRate: bigint

  constructor({ feeRate, ...options }: FeeFilterMessageOptions) {
    super('feefilter', options)
    this.feeRate = feeRate
  }

  get payload(): Buffer {
    let writer = new BufferWriter()
    writer.writeUInt64LE(this.feeRate)
    return writer.toBuffer()
  }

  set payload(payload: Buffer) {
    let reader = new BufferReader(payload)
    this.feeRate = reader.readUInt64LE()
    Message.checkFinished(reader)
  }
}

export default FeeFilterMessage
