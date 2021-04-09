import BufferReader from '@lib/encoding/buffer-reader'
import BufferWriter from '@lib/encoding/buffer-writer'
import OutputScript, { IOutputScript } from '@lib/script/output'
import util from 'util'

export interface ITransactionOutput {
  value: bigint | undefined
  scriptPubKey: IOutputScript | undefined
  toBuffer(): Buffer
  toBufferWriter(writer: BufferWriter): void
  isEmpty(): boolean | undefined
}

class Output implements ITransactionOutput {
  public value: bigint | undefined
  public scriptPubKey: IOutputScript | undefined

  constructor({
    value,
    scriptPubKey,
  }: {
    value: bigint | undefined
    scriptPubKey: IOutputScript | undefined
  }) {
    this.value = value
    this.scriptPubKey = scriptPubKey
  }

  static fromBuffer(buffer: Buffer): Output {
    return Output.fromBufferReader(new BufferReader(buffer))
  }

  static fromBufferReader(reader: BufferReader): Output {
    const value: bigint = reader.readUInt64LE()
    const scriptPubKey: IOutputScript = OutputScript.fromBuffer(
      <Buffer>reader.readVarLengthBuffer()
    )
    return new Output({ value, scriptPubKey })
  }

  toBuffer(): Buffer {
    const writer: BufferWriter = new BufferWriter()
    this.toBufferWriter(writer)
    return writer.toBuffer()
  }

  toBufferWriter(writer: BufferWriter): void {
    if (this.value !== undefined && this.scriptPubKey) {
      writer.writeUInt64LE(this.value)
      writer.writeVarLengthBuffer(this.scriptPubKey.toBuffer())
    }
  }

  [util.inspect.custom](): string {
    return `<Output (${this.value} satoshis) ${this.scriptPubKey}>`
  }

  isEmpty(): boolean | undefined {
    return this.value === BigInt(0) && this.scriptPubKey?.isEmpty()
  }
}

export default Output
