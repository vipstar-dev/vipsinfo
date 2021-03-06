import { BufferReader, BufferWriter } from '@/lib'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'

export interface GetBlocksMessageOptions extends MessageOptions {
  protocolVersion?: number
  starts?: Buffer[]
  stop?: Buffer
}

export interface IGetBlocksMessage extends IMessage {
  version?: number
  starts: Buffer[]
  stop: Buffer
}

class GetBlocksMessage extends Message implements IGetBlocksMessage {
  public version: number | undefined
  public starts: Buffer[]
  public stop: Buffer

  constructor({ starts, stop, ...options }: GetBlocksMessageOptions) {
    super('getblocks', options)
    this.version = options.protocolVersion
    this.starts = starts || []
    this.stop = stop || Buffer.alloc(32)
  }

  static fromBuffer(
    payload: Buffer,
    options: GetBlocksMessageOptions
  ): GetBlocksMessage {
    const message = new GetBlocksMessage(options)
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
      if (start) {
        writer.write(Buffer.from(start).reverse())
      }
    }
    if (this.stop) {
      writer.write(Buffer.from(this.stop).reverse())
    }
    return writer.toBuffer()
  }

  set payload(payload: Buffer) {
    const reader = new BufferReader(payload)
    const version: number | undefined = reader.readUInt32LE()
    if (version) {
      this.version = version
    }
    const startCount = reader.readVarintNumber()
    this.starts = []
    if (startCount) {
      for (let i = 0; i < startCount; ++i) {
        const start: Buffer | undefined = reader.read(32)
        if (start) {
          this.starts.push(start.reverse())
        }
      }
      const stop: Buffer | undefined = reader.read(32)
      if (stop) {
        this.stop = stop.reverse()
      }
    }
    Message.checkFinished(reader)
  }
}

export default GetBlocksMessage
