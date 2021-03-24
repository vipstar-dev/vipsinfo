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
import { InventoryConstructor } from '@/p2p/commands/inventory'

export interface InvMessageOptions extends MessageOptions {
  inventories: InventoryConstructor[]
}

export interface IInvMessage extends InvMessageOptions, IMessage {}

class InvMessage extends Message implements IInvMessage {
  public inventories: InventoryConstructor[]

  constructor({ inventories, ...options }: InvMessageOptions) {
    super('inv', options)
    this.inventories = inventories
  }

  static fromBuffer(payload: Buffer, options: InvMessageOptions): InvMessage {
    let message = new InvMessage(options)
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

export default InvMessage
