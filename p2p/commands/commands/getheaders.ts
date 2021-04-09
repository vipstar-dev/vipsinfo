import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'

export interface GetHeadersMessageOptions extends MessageOptions {
  protocolVersion?: number
  starts?: Buffer[]
  stop?: Buffer
}

export interface IGetHeadersMessage extends IMessage {
  version?: number
  starts: Buffer[]
  stop: Buffer
}

class GetHeadersMessage extends Message implements IGetHeadersMessage {
  public version: number | undefined
  public starts: Buffer[]
  public stop: Buffer

  constructor({ starts, stop, ...options }: GetHeadersMessageOptions) {
    super('getheaders', options)
    this.version = options.protocolVersion
    this.starts = starts || []
    this.stop = stop || Buffer.alloc(32)
  }

  static fromBuffer(
    payload: Buffer,
    options: GetHeadersMessageOptions
  ): GetHeadersMessage {
    const message = new GetHeadersMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    const writer = new BufferWriter()
    if (this.version) {
      writer.writeUInt32LE(this.version)
    }
    writer.writeVarintNumber(this.starts.length)
    for (const start of this.starts) {
      writer.write(Buffer.from(start).reverse())
    }
    writer.write(Buffer.from(this.stop).reverse())
    return writer.toBuffer()
  }

  set payload(payload) {
    const reader = new BufferReader(payload)
    const version = reader.readUInt32LE()
    if (version) {
      this.version = version
    }
    const startCount = reader.readVarintNumber()
    this.starts = []
    if (startCount) {
      for (let i = 0; i < startCount; ++i) {
        const start = reader.read(32)
        if (start) {
          this.starts.push(start.reverse())
        }
      }
    }
    const stop = reader.read(32)
    if (stop) {
      this.stop = stop.reverse()
    }
    Message.checkFinished(reader)
  }
}

export default GetHeadersMessage
