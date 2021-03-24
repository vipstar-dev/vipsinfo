import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'

export interface InventoryConstructor {
  type?: number
  data?: Buffer
}

export interface IInventory {
  toBuffer(): Buffer
  toBufferWriter(writer: BufferWriter): void
}

export const types: { [kwy: string]: number } = {
  ERROR: 0,
  TRANSACTION: 1,
  BLOCK: 2,
  FILTERED_BLOCK: 3,
  CMPCT_BLOCK: 4,
  WITNESS: 0x40000000,
}

class Inventory implements IInventory {
  type: number | undefined
  data: Buffer | undefined

  constructor({ type, data }: InventoryConstructor) {
    this.type = type
    this.data = data
  }

  static forItem(type: number, data: Buffer) {
    return new Inventory({ type, data })
  }

  static forTransaction(data: Buffer) {
    return Inventory.forItem(types.TRANSACTION, data)
  }

  static forBlock(data: Buffer) {
    return Inventory.forItem(types.BLOCK, data)
  }

  static forFilteredBlock(data: Buffer) {
    return Inventory.forItem(types.FILTERED_BLOCK, data)
  }

  static fromBuffer(buffer: Buffer) {
    return Inventory.fromBufferReader(new BufferReader(buffer))
  }

  static fromBufferReader(reader: BufferReader) {
    let type = reader.readUInt32LE()
    let data = reader.read(32)
    return new Inventory({ type, data: data?.reverse() })
  }

  toBuffer(): Buffer {
    let writer = new BufferWriter()
    this.toBufferWriter(writer)
    return writer.toBuffer()
  }

  toBufferWriter(writer: BufferWriter) {
    if (this.type && this.data) {
      writer.writeUInt32LE(this.type)
      writer.write(this.data.reverse())
    }
  }
}

export default Inventory
