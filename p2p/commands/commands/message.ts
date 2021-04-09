import assert from 'assert'

import { BufferReader, BufferWriter, IChain, sha256d } from '@/lib'

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
    const command: Buffer = Buffer.alloc(12)
    command.write(this.command, 'ascii')
    const payload: Buffer = this.payload
    const checksum: Buffer = sha256d(payload).slice(0, 4)
    const writer: BufferWriter = new BufferWriter()
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
