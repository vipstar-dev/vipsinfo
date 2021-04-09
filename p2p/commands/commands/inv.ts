import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'
import {
  parseInventories,
  writeInventories,
} from '@/p2p/commands/commands/utils'
import Inventory, { InventoryConstructor } from '@/p2p/commands/inventory'

export interface InvMessageOptions extends MessageOptions {
  inventories?: InventoryConstructor[]
}

export interface IInvMessage extends InvMessageOptions, IMessage {
  forTransaction(data: Buffer): InvMessage
  forBlock(data: Buffer): InvMessage
  forFilteredBlock(data: Buffer): InvMessage
}

class InvMessage extends Message implements IInvMessage {
  public inventories: InventoryConstructor[]

  constructor({ inventories, ...options }: InvMessageOptions) {
    super('inv', options)
    this.inventories = inventories || []
  }

  static fromBuffer(payload: Buffer, options: InvMessageOptions): InvMessage {
    const message = new InvMessage(options)
    message.payload = payload
    return message
  }

  forTransaction(data: Buffer): InvMessage {
    return new InvMessage({
      inventories: [Inventory.forTransaction(data)],
      chain: this.chain,
    })
  }

  forBlock(data: Buffer): InvMessage {
    return new InvMessage({
      inventories: [Inventory.forBlock(data)],
      chain: this.chain,
    })
  }

  forFilteredBlock(data: Buffer): InvMessage {
    return new InvMessage({
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

export default InvMessage
