import util from 'util'

import { sha256d } from '@/lib/crypto/hash'
import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
import Input, { ITransactionInput } from '@/lib/transaction/input'
import Output, { ITransactionOutput } from '@/lib/transaction/output'

export interface TransactionConstructor {
  version: number | undefined
  flag: number | undefined
  inputs: (ITransactionInput | undefined)[]
  outputs: (ITransactionOutput | undefined)[]
  lockTime: number | undefined
}

export interface ITransaction extends TransactionConstructor {
  _id: bigint | undefined
  id: Buffer
  hash: Buffer
  size: number
  weight: number
  toBuffer(): Buffer
  toHashBuffer(): Buffer
  toBufferWriter(writer: BufferWriter): void
  toHashBufferWriter(writer: BufferWriter): void
  isCoinbase(): boolean
  isCoinstake(): boolean | undefined
}

class Transaction implements ITransaction {
  public version: number | undefined
  public flag: number | undefined
  public inputs: (ITransactionInput | undefined)[]
  public outputs: (ITransactionOutput | undefined)[]
  public lockTime: number | undefined
  public _id: bigint | undefined
  private __id: Buffer | null = null
  private _hash: Buffer | null = null

  constructor({
    version,
    flag,
    inputs,
    outputs,
    lockTime,
  }: TransactionConstructor) {
    this.version = version
    this.flag = flag
    this.inputs = inputs
    this.outputs = outputs
    this.lockTime = lockTime
  }

  get id(): Buffer {
    this.__id = this.__id || sha256d(this.toHashBuffer()).reverse()
    return this.__id
  }

  get hash(): Buffer {
    this._hash = this._hash || sha256d(this.toBuffer()).reverse()
    return this._hash
  }

  get size(): number {
    return this.toBuffer().length
  }

  get weight(): number {
    return this.toBuffer().length + this.toHashBuffer().length * 3
  }

  static fromBuffer(buffer: Buffer): Transaction {
    return Transaction.fromBufferReader(new BufferReader(buffer))
  }

  static fromBufferReader(reader: BufferReader): Transaction {
    const version: number | undefined = reader.readInt32LE()
    const inputs: ITransactionInput[] = []
    let flag: number | undefined = 0
    const outputs: ITransactionOutput[] = []
    let inputCount: number = reader.readVarintNumber() || 0
    if (!inputCount) {
      flag = reader.readUInt8()
      inputCount = reader.readVarintNumber() || 0
    }
    for (let i = 0; i < inputCount; ++i) {
      inputs.push(Input.fromBufferReader(reader))
    }
    const outputCount = reader.readVarintNumber() || 0
    for (let i = 0; i < outputCount; ++i) {
      outputs.push(Output.fromBufferReader(reader))
    }
    if (flag) {
      for (let i = 0; i < inputCount; ++i) {
        const witnessCount = reader.readVarintNumber() || 0
        for (let j = 0; j < witnessCount; ++j) {
          inputs[i].witness.push(reader.readVarLengthBuffer())
        }
      }
    }
    const lockTime: number | undefined = reader.readUInt32LE()
    return new Transaction({ version, flag, inputs, outputs, lockTime })
  }

  toBuffer(): Buffer {
    const writer: BufferWriter = new BufferWriter()
    this.toBufferWriter(writer)
    return writer.toBuffer()
  }

  toHashBuffer(): Buffer {
    const writer: BufferWriter = new BufferWriter()
    this.toHashBufferWriter(writer)
    return writer.toBuffer()
  }

  toBufferWriter(writer: BufferWriter): void {
    writer.writeInt32LE(this.version || 0)
    if (this.flag) {
      writer.writeUInt8(0)
      writer.writeUInt8(this.flag)
    }
    writer.writeVarintNumber(this.inputs.length)
    for (const input of this.inputs) {
      input?.toBufferWriter(writer)
    }
    writer.writeVarintNumber(this.outputs.length)
    for (const output of this.outputs) {
      output?.toBufferWriter(writer)
    }
    if (this.flag) {
      for (const input of this.inputs) {
        writer.writeVarintNumber(input?.witness.length || 0)
        for (const script of input?.witness || []) {
          if (script instanceof Buffer) {
            writer.writeVarLengthBuffer(script)
          }
        }
      }
    }
    writer.writeUInt32LE(this.lockTime || 0)
  }

  toHashBufferWriter(writer: BufferWriter): void {
    writer.writeInt32LE(this.version || 0)
    writer.writeVarintNumber(this.inputs.length)
    for (const input of this.inputs) {
      input?.toBufferWriter(writer)
    }
    writer.writeVarintNumber(this.outputs.length)
    for (const output of this.outputs) {
      output?.toBufferWriter(writer)
    }
    writer.writeUInt32LE(this.lockTime || 0)
  }

  [util.inspect.custom]() {
    return `<Transaction ${this.id.toString('hex')}>`
  }

  isCoinbase(): boolean {
    return (
      this.inputs.length === 1 &&
      Buffer.compare(
        this.inputs[0]?.prevTxId || Buffer.alloc(0),
        Buffer.alloc(32)
      ) === 0 &&
      this.outputs.length > 0
    )
  }

  isCoinstake(): boolean | undefined {
    return (
      this.inputs.length > 0 &&
      Buffer.compare(
        this.inputs[0]?.prevTxId || Buffer.alloc(0),
        Buffer.alloc(32)
      ) !== 0 &&
      this.outputs.length >= 2 &&
      this.outputs[0]?.isEmpty()
    )
  }
}

export default Transaction
