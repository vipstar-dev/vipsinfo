import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'

export interface GetHeadersMessageOptions extends MessageOptions {
  protocolVersion: number
  starts: Buffer[]
  stop?: Buffer
}

export interface IGetHeadersMessage extends IMessage {
  version: number
  starts: Buffer[]
  stop: Buffer
}

class GetHeadersMessage extends Message implements IGetHeadersMessage {
  public version: number
  public starts: Buffer[]
  public stop: Buffer

  constructor({ starts, stop, ...options }: GetHeadersMessageOptions) {
    super('getheaders', options)
    this.version = options.protocolVersion
    this.starts = starts
    this.stop = stop || Buffer.alloc(32)
  }

  static fromBuffer(payload: Buffer, options: GetHeadersMessageOptions) {
    let message = new GetHeadersMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    let writer = new BufferWriter()
    writer.writeUInt32LE(this.version)
    writer.writeVarintNumber(this.starts.length)
    for (let start of this.starts) {
      writer.write(Buffer.from(start).reverse())
    }
    writer.write(Buffer.from(this.stop).reverse())
    return writer.toBuffer()
  }

  set payload(payload) {
    let reader = new BufferReader(payload)
    let version = reader.readUInt32LE()
    if (version) {
      this.version = version
    }
    let startCount = reader.readVarintNumber()
    this.starts = []
    if (startCount) {
      for (let i = 0; i < startCount; ++i) {
        let start = reader.read(32)
        if (start) {
          this.starts.push(start.reverse())
        }
      }
    }
    let stop = reader.read(32)
    if (stop) {
      this.stop = stop.reverse()
    }
    Message.checkFinished(reader)
  }
}

module.exports = GetHeadersMessage
