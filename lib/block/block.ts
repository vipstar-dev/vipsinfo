import util from 'util'

import Header, { IHeader } from '@/lib/block/header'
import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
import Transaction, { ITransaction } from '@/lib/transaction'

export interface BlockConstructor {
  header: IHeader
  transactions: ITransaction[]
}

export interface IBlock extends BlockConstructor {
  id: Buffer
  hash: Buffer
  size: number
  weight: number
  toBuffer(): Buffer
  toHashBuffer(): Buffer
  toBufferWriter(writer: BufferWriter): void
  toHashBufferWriter(writer: BufferWriter): void
}

class Block implements IBlock {
  public header: IHeader
  public transactions: ITransaction[]

  constructor({ header, transactions }: BlockConstructor) {
    this.header = header
    this.transactions = transactions
  }

  get id(): Buffer {
    return this.header.id
  }

  get hash(): Buffer {
    return this.header.hash
  }

  get size(): number {
    return this.toBuffer().length
  }

  get weight(): number {
    return this.toBuffer().length + this.toHashBuffer().length * 3
  }

  static fromBuffer(buffer: Buffer): Block {
    return Block.fromBufferReader(new BufferReader(buffer))
  }

  static fromBufferReader(reader: BufferReader): Block {
    let header: IHeader = Header.fromBufferReader(reader)
    let transactionCount: number = reader.readVarintNumber() || 0
    let transactions: ITransaction[] = []
    for (let i = 0; i < transactionCount; ++i) {
      transactions.push(Transaction.fromBufferReader(reader))
    }
    return new Block({ header, transactions })
  }

  toBuffer(): Buffer {
    let writer: BufferWriter = new BufferWriter()
    this.toBufferWriter(writer)
    return writer.toBuffer()
  }

  toHashBuffer(): Buffer {
    let writer: BufferWriter = new BufferWriter()
    this.toHashBufferWriter(writer)
    return writer.toBuffer()
  }

  toBufferWriter(writer: BufferWriter): void {
    this.header.toBufferWriter(writer)
    writer.writeVarintNumber(this.transactions.length)
    for (let transaction of this.transactions) {
      transaction.toBufferWriter(writer)
    }
  }

  toHashBufferWriter(writer: BufferWriter): void {
    this.header.toBufferWriter(writer)
    writer.writeVarintNumber(this.transactions.length)
    for (let transaction of this.transactions) {
      transaction.toHashBufferWriter(writer)
    }
  }

  [util.inspect.custom](): string {
    return `<Block ${this.id.toString('hex')}>`
  }
}

export default Block
