import util from 'util'

import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'

export interface ITransactionInput {
  prevTxId: Buffer | undefined
  outputIndex: number | undefined
  scriptSig: Buffer | undefined
  sequence: number | undefined
  witness: (Buffer | undefined)[]
  toBuffer(): Buffer
  toBufferWriter(writer: BufferWriter): void
}

class Input implements ITransactionInput {
  public prevTxId: Buffer | undefined
  public outputIndex: number | undefined
  public scriptSig: Buffer | undefined
  public sequence: number | undefined
  public witness: (Buffer | undefined)[]

  constructor({
    prevTxId,
    outputIndex,
    scriptSig,
    sequence,
    witness = [],
  }: {
    prevTxId: Buffer | undefined
    outputIndex: number | undefined
    scriptSig: Buffer | undefined
    sequence: number | undefined
    witness?: Buffer[]
  }) {
    this.prevTxId = prevTxId
    this.outputIndex = outputIndex
    this.scriptSig = scriptSig
    this.sequence = sequence
    this.witness = witness
  }

  static fromBuffer(buffer: Buffer) {
    return Input.fromBufferReader(new BufferReader(buffer))
  }

  static fromBufferReader(reader: BufferReader): Input {
    const prevTxId: Buffer | undefined = reader.read(32)?.reverse()
    const outputIndex: number | undefined = reader.readUInt32LE()
    const scriptSig: Buffer | undefined = reader.readVarLengthBuffer()
    const sequence: number | undefined = reader.readUInt32LE()
    return new Input({ prevTxId, outputIndex, scriptSig, sequence })
  }

  toBuffer(): Buffer {
    const writer: BufferWriter = new BufferWriter()
    this.toBufferWriter(writer)
    return writer.toBuffer()
  }

  toBufferWriter(writer: BufferWriter): void {
    if (
      this.prevTxId &&
      this.outputIndex !== undefined &&
      this.scriptSig &&
      this.sequence !== undefined
    ) {
      writer.write(Buffer.from(this.prevTxId).reverse())
      writer.writeUInt32LE(this.outputIndex)
      writer.writeVarLengthBuffer(this.scriptSig)
      writer.writeUInt32LE(this.sequence)
    }
  }

  [util.inspect.custom](
    depth: string,
    { indentationLvl }: { indentationLvl: number; [key: string]: any }
  ): string {
    const indentation = ' '.repeat(indentationLvl && indentationLvl - 1)
    return `Input {
  ${indentation}prevTxId: '${this.prevTxId?.toString('hex')}',
  ${indentation}outputIndex: ${this.outputIndex},
  ${indentation}scriptSig: ${this.scriptSig?.toString('hex')},
  ${indentation}sequence: ${this.sequence}
  ${indentation}}`
  }
}

export default Input
