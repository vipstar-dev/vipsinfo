import BufferReader from '@lib/encoding/buffer-reader'
import BufferWriter from '@lib/encoding/buffer-writer'
import Opcode, { OpcodeReversedMap } from '@lib/script/opcode'
import util from 'util'

export class InvalidScriptError extends Error {
  constructor(...args: string[]) {
    super(...args)
    Error.captureStackTrace(this, this.constructor)
  }

  get name(): string {
    return this.constructor.name
  }
}

export interface ScriptChunk {
  code: number
  buffer?: Buffer
}

export interface IScript {
  chunks: ScriptChunk[]
  toBuffer(): Buffer
  toBufferWriter(writer: BufferWriter): void
  toString(): string
  isEmpty(): boolean
}

class Script implements IScript {
  public chunks: ScriptChunk[]

  constructor(chunks: ScriptChunk[]) {
    this.chunks = chunks
  }

  static parseBuffer(buffer: Buffer): ScriptChunk[] {
    const reader: BufferReader = new BufferReader(buffer)
    const chunks: ScriptChunk[] = []
    try {
      while (!reader.finished) {
        const code: number | undefined = reader.readUInt8()
        if (code) {
          if (code > 0 && code < Opcode.OP_PUSHDATA1) {
            const buf = reader.read(code)
            chunks.push({ code, buffer: buf })
          } else if (code === Opcode.OP_PUSHDATA1) {
            const length = reader.readUInt8()
            const buf = reader.read(length ? length : 0)
            chunks.push({ code, buffer: buf })
          } else if (code === Opcode.OP_PUSHDATA2) {
            const length = reader.readUInt16LE()
            const buf = reader.read(length ? length : 0)
            chunks.push({ code, buffer: buf })
          } else if (code === Opcode.OP_PUSHDATA4) {
            const length = reader.readUInt32LE()
            const buf = reader.read(length ? length : 0)
            chunks.push({ code, buffer: buf })
          } else {
            chunks.push({ code })
          }
        }
      }
    } catch (err) {
      throw new InvalidScriptError()
    }
    return chunks
  }

  toBuffer(): Buffer {
    const writer: BufferWriter = new BufferWriter()
    this.toBufferWriter(writer)
    return writer.toBuffer()
  }

  toBufferWriter(writer: BufferWriter): void {
    for (const { code, buffer } of this.chunks) {
      writer.writeUInt8(code)
      if (buffer) {
        if (code < Opcode.OP_PUSHDATA1) {
          writer.write(buffer)
        } else if (code === Opcode.OP_PUSHDATA1) {
          writer.writeUInt8(buffer.length)
          writer.write(buffer)
        } else if (code === Opcode.OP_PUSHDATA2) {
          writer.writeUInt16LE(buffer.length)
          writer.write(buffer)
        } else if (code === Opcode.OP_PUSHDATA4) {
          writer.writeUInt32LE(buffer.length)
          writer.write(buffer)
        }
      }
    }
  }

  toString(): string {
    const chunks: (string | number | undefined)[] = this.chunks.map(
      ({ code, buffer }: ScriptChunk) => {
        if (buffer) {
          return buffer.toString('hex')
        } else if (code in OpcodeReversedMap) {
          return OpcodeReversedMap[code]
        } else {
          return code
        }
      }
    )
    return chunks.join(' ')
  }

  static buildChunk(buffer: Buffer): ScriptChunk {
    if (buffer.length < Opcode.OP_PUSHDATA1) {
      return { code: buffer.length, buffer }
    } else if (buffer.length <= 0xff) {
      return { code: Opcode.OP_PUSHDATA1, buffer }
    } else if (buffer.length <= 0xffff) {
      return { code: Opcode.OP_PUSHDATA2, buffer }
    } else {
      return { code: Opcode.OP_PUSHDATA4, buffer }
    }
  }

  [util.inspect.custom](): string {
    return `<Script ${this.toString()}>`
  }

  isEmpty(): boolean {
    return this.chunks.length === 0
  }
}

export default Script
