import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
import Message, {IMessage, MessageOptions} from '@/p2p/commands/commands/message'
import {
  Inventory,
  parseInventories,
  writeInventories,
} from '@/p2p/commands/commands/utils'

export interface GetDataMessageOptions extends MessageOptions {
  inventories: Inventory[]
}

export interface IGetDataMessage extends GetDataMessageOptions, IMessage {}

class GetDataMessage extends Message implements IGetDataMessage {
  public inventories: Inventory[]

  constructor({ inventories, ...options }: GetDataMessageOptions) {
    super('getdata', options)
    this.inventories = inventories
  }

  static fromBuffer(
    payload: Buffer,
    options: GetDataMessageOptions
  ): GetDataMessage {
    let message = new GetDataMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    let writer = new BufferWriter()
    writeInventories(writer, this.inventories)
    return writer.toBuffer()
  }

  set payload(payload: Buffer) {
    let reader = new BufferReader(payload)
    this.inventories = parseInventories(reader)
    Message.checkFinished(reader)
  }
}

export default GetDataMessage
