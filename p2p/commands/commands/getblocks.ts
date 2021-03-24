import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
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
    let message = new GetBlocksMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    let writer = new BufferWriter()
    if (this.version) {
      writer.writeUInt32LE(this.version)
    }
    writer.writeVarintNumber(this.starts.length)
    for (let start of this.starts) {
      if (start) {
        writer.write(start?.reverse())
      }
    }
    if (this.stop) {
      writer.write(this.stop?.reverse())
    }
    return writer.toBuffer()
  }

  set payload(payload: Buffer) {
    let reader = new BufferReader(payload)
    let version: number | undefined = reader.readUInt32LE()
    if (version) {
      this.version = version
    }
    let startCount = reader.readVarintNumber()
    this.starts = []
    if (startCount) {
      for (let i = 0; i < startCount; ++i) {
        let start: Buffer | undefined = reader.read(32)
        if (start) {
          this.starts.push(start.reverse())
        }
      }
      let stop: Buffer | undefined = reader.read(32)
      if (stop) {
        this.stop = stop.reverse()
      }
    }
    Message.checkFinished(reader)
  }
}

export default GetBlocksMessage
