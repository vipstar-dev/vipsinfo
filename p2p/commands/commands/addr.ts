import { BufferReader, BufferWriter } from '@/lib'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'
import { AddressData } from '@/p2p/commands/commands/utils'
import { parseAddress, writeAddress } from '@/p2p/commands/commands/utils'

export interface AddrMessageOptions extends MessageOptions {
  addresses?: AddressData[]
}

export interface IAddrMessage extends AddrMessageOptions, IMessage {}

class AddrMessage extends Message implements IAddrMessage {
  public addresses: AddressData[]

  constructor({ addresses = [], ...options }: AddrMessageOptions) {
    super('addr', options)
    this.addresses = addresses || []
  }

  static fromBuffer(payload: Buffer, options: AddrMessageOptions): AddrMessage {
    const message = new AddrMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    const writer = new BufferWriter()
    writer.writeVarintNumber(this.addresses.length)
    for (const address of this.addresses) {
      if (address.timestamp) {
        writer.writeUInt32LE(address.timestamp)
        writeAddress(writer, address)
      }
    }
    return writer.toBuffer()
  }

  set payload(payload: Buffer) {
    const reader = new BufferReader(payload)
    const addressCount = reader.readVarintNumber()
    this.addresses = []
    if (addressCount) {
      for (let i = 0; i < addressCount; ++i) {
        const timestamp = reader.readUInt32LE()
        const address = parseAddress(reader)
        address.timestamp = timestamp
        this.addresses.push(address)
      }
    }
    Message.checkFinished(reader)
  }
}

export default AddrMessage
