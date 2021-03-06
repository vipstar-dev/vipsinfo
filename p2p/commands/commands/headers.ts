import { BufferReader, BufferWriter, Header } from '@/lib'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'

export interface HeadersMessageOptions extends MessageOptions {
  headers?: Header[]
}

export interface IHeadersMessage extends HeadersMessageOptions, IMessage {}

class HeadersMessage extends Message implements IHeadersMessage {
  public headers: Header[]

  constructor({ headers, ...options }: HeadersMessageOptions) {
    super('headers', options)
    this.headers = headers || []
  }

  static fromBuffer(
    payload: Buffer,
    options: HeadersMessageOptions
  ): HeadersMessage {
    const message = new HeadersMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    const writer = new BufferWriter()
    writer.writeVarintNumber(this.headers.length)
    for (const header of this.headers) {
      header.toBufferWriter(writer)
      writer.writeUInt8(0)
    }
    return writer.toBuffer()
  }

  set payload(payload: Buffer) {
    const reader = new BufferReader(payload)
    const count = reader.readVarintNumber()
    this.headers = []
    if (count) {
      for (let i = 0; i < count; ++i) {
        this.headers.push(Header.fromBufferReader(reader))
        reader.readUInt8()
      }
    }
    Message.checkFinished(reader)
  }
}

export default HeadersMessage
