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
  private _id: Buffer | null = null
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
    this._id = this._id || sha256d(this.toHashBuffer()).reverse()
    return this._id
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
    let version: number | undefined = reader.readInt32LE()
    let inputs: ITransactionInput[] = []
    let flag: number | undefined = 0
    let outputs: ITransactionOutput[] = []
    let lockTime: number | undefined
    let inputCount: number = reader.readVarintNumber() || 0
    if (!inputCount) {
      flag = reader.readUInt8()
      inputCount = reader.readVarintNumber() || 0
    }
    for (let i = 0; i < inputCount; ++i) {
      inputs.push(Input.fromBufferReader(reader))
    }
    let outputCount = reader.readVarintNumber() || 0
    for (let i = 0; i < outputCount; ++i) {
      outputs.push(Output.fromBufferReader(reader))
    }
    if (flag) {
      for (let i = 0; i < inputCount; ++i) {
        let witnessCount = reader.readVarintNumber() || 0
        for (let j = 0; j < witnessCount; ++j) {
          inputs[i].witness.push(reader.readVarLengthBuffer())
        }
      }
    }
    lockTime = reader.readUInt32LE()
    return new Transaction({ version, flag, inputs, outputs, lockTime })
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
    writer.writeInt32LE(this.version || 0)
    if (this.flag) {
      writer.writeUInt8(0)
      writer.writeUInt8(this.flag)
    }
    writer.writeVarintNumber(this.inputs.length)
    for (let input of this.inputs) {
      input?.toBufferWriter(writer)
    }
    writer.writeVarintNumber(this.outputs.length)
    for (let output of this.outputs) {
      output?.toBufferWriter(writer)
    }
    if (this.flag) {
      for (let input of this.inputs) {
        writer.writeVarintNumber(input?.witness.length || 0)
        for (let script of input?.witness || []) {
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
    for (let input of this.inputs) {
      input?.toBufferWriter(writer)
    }
    writer.writeVarintNumber(this.outputs.length)
    for (let output of this.outputs) {
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
