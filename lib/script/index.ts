import util from 'util'
import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
import Opcode, { OpcodeReversedMap } from '@/lib/script/opcode'

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

class Script {
  public chunks: ScriptChunk[]

  constructor(chunks: ScriptChunk[]) {
    this.chunks = chunks
  }

  static parseBuffer(buffer: Buffer): ScriptChunk[] {
    let reader: BufferReader = new BufferReader(buffer)
    let chunks: ScriptChunk[] = []
    try {
      while (!reader.finished) {
        let code: number | undefined = reader.readUInt8()
        if (code) {
          if (code > 0 && code < Opcode.OP_PUSHDATA1) {
            let buf = reader.read(code)
            chunks.push({ code, buffer: buf })
          } else if (code === Opcode.OP_PUSHDATA1) {
            let length = reader.readUInt8()
            let buf = reader.read(length ? length : 0)
            chunks.push({ code, buffer: buf })
          } else if (code === Opcode.OP_PUSHDATA2) {
            let length = reader.readUInt16LE()
            let buf = reader.read(length ? length : 0)
            chunks.push({ code, buffer: buf })
          } else if (code === Opcode.OP_PUSHDATA4) {
            let length = reader.readUInt32LE()
            let buf = reader.read(length ? length : 0)
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
    let writer: BufferWriter = new BufferWriter()
    this.toBufferWriter(writer)
    return writer.toBuffer()
  }

  toBufferWriter(writer: BufferWriter): void {
    for (let { code, buffer } of this.chunks) {
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
    let chunks: (string | number)[] = this.chunks.map(
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
