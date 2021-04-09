import Message, {
  IMessage,
  MessageOptions,
} from '@p2p/commands/commands/message'
import {
  parseInventories,
  writeInventories,
} from '@p2p/commands/commands/utils'
import Inventory, { InventoryConstructor } from '@p2p/commands/inventory'
import BufferReader from 'vipsinfo-lib/encoding/buffer-reader'
import BufferWriter from 'vipsinfo-lib/encoding/buffer-writer'

export interface GetDataMessageOptions extends MessageOptions {
  inventories?: InventoryConstructor[]
}

export interface IGetDataMessage extends GetDataMessageOptions, IMessage {
  forTransaction(data: Buffer): GetDataMessage
  forBlock(data: Buffer): GetDataMessage
  forFilteredBlock(data: Buffer): GetDataMessage
}

class GetDataMessage extends Message implements IGetDataMessage {
  public inventories: InventoryConstructor[]

  constructor({ inventories, ...options }: GetDataMessageOptions) {
    super('getdata', options)
    this.inventories = inventories || []
  }

  static fromBuffer(
    payload: Buffer,
    options: GetDataMessageOptions
  ): GetDataMessage {
    const message = new GetDataMessage(options)
    message.payload = payload
    return message
  }

  forTransaction(data: Buffer): GetDataMessage {
    return new GetDataMessage({
      inventories: [Inventory.forTransaction(data)],
      chain: this.chain,
    })
  }

  forBlock(data: Buffer): GetDataMessage {
    return new GetDataMessage({
      inventories: [Inventory.forBlock(data)],
      chain: this.chain,
    })
  }

  forFilteredBlock(data: Buffer): GetDataMessage {
    return new GetDataMessage({
      inventories: [Inventory.forFilteredBlock(data)],
      chain: this.chain,
    })
  }

  get payload(): Buffer {
    const writer = new BufferWriter()
    writeInventories(writer, this.inventories)
    return writer.toBuffer()
  }

  set payload(payload: Buffer) {
    const reader = new BufferReader(payload)
    this.inventories = parseInventories(reader)
    Message.checkFinished(reader)
  }
}

export default GetDataMessage
