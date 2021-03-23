import assert from 'assert'

import { IChain, sha256d } from '@/lib'
import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'

export interface MessageOptions {
  chain: IChain
}

export interface IMessage extends MessageOptions {
  command: string
  payload: Buffer
  toBuffer(): Buffer
}

class Message implements IMessage {
  public command: string
  public chain: IChain

  constructor(command: string, options: MessageOptions) {
    this.command = command
    this.chain = options.chain
  }

  get payload(): Buffer {
    return Buffer.alloc(0)
  }

  set payload(payload: Buffer) {}

  toBuffer(): Buffer {
    let command: Buffer = Buffer.alloc(12)
    command.write(this.command, 'ascii')
    let payload: Buffer = this.payload
    let checksum: Buffer = sha256d(payload).slice(0, 4)
    let writer: BufferWriter = new BufferWriter()
    writer.write(this.chain.networkMagic)
    writer.write(command)
    writer.writeUInt32LE(payload.length)
    writer.write(checksum)
    writer.write(payload)
    return writer.toBuffer()
  }

  static checkFinished(reader: BufferReader) {
    assert(reader.finished, 'Data still available after parsing')
  }
}

export default Message
