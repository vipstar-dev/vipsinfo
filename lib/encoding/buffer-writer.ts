class BufferWriter {
  private buffer: Buffer[] = []

  toBuffer() {
    return Buffer.concat(this.buffer)
  }

  write(buffer: Buffer) {
    this.buffer.push(buffer)
  }

  writeHexString(s: string) {
    this.buffer.push(Buffer.from(s, 'hex'))
  }

  writeUInt8(n: number) {
    const buffer: Buffer = Buffer.alloc(1)
    buffer.writeUInt8(n, 0)
    this.write(buffer)
  }

  writeUInt16LE(n: number) {
    const buffer: Buffer = Buffer.alloc(2)
    buffer.writeUInt16LE(n, 0)
    this.write(buffer)
  }

  writeUInt16BE(n: number) {
    const buffer: Buffer = Buffer.alloc(2)
    buffer.writeUInt16BE(n, 0)
    this.write(buffer)
  }

  writeUInt32LE(n: number) {
    const buffer: Buffer = Buffer.alloc(4)
    buffer.writeUInt32LE(n, 0)
    this.write(buffer)
  }

  writeUInt32BE(n: number) {
    const buffer: Buffer = Buffer.alloc(4)
    buffer.writeUInt32BE(n, 0)
    this.write(buffer)
  }

  writeInt32LE(n: number) {
    const buffer: Buffer = Buffer.alloc(4)
    buffer.writeInt32LE(n, 0)
    this.write(buffer)
  }

  writeInt32BE(n: number) {
    const buffer: Buffer = Buffer.alloc(4)
    buffer.writeInt32BE(n, 0)
    this.write(buffer)
  }

  writeUInt64LE(n: bigint) {
    const buffer: Buffer = Buffer.alloc(8)
    buffer.writeUInt32LE(Number(n & BigInt(0xffffffff)), 0)
    buffer.writeUInt32LE(Number(n >> BigInt(32)), 4)
    this.write(buffer)
  }

  writeVarintNumber(n: number | bigint) {
    if (n < 0xfd) {
      const buffer = Buffer.alloc(1)
      buffer.writeUInt8(Number(n), 0)
      this.write(buffer)
    } else if (n < 0x10000) {
      const buffer = Buffer.alloc(1 + 2)
      buffer.writeUInt8(0xfd, 0)
      buffer.writeUInt16LE(Number(n), 1)
      this.write(buffer)
    } else if (n < 0x100000000) {
      const buffer = Buffer.alloc(1 + 4)
      buffer.writeUInt8(0xfe, 0)
      buffer.writeUInt32LE(Number(n), 1)
      this.write(buffer)
    } else {
      const buffer = Buffer.alloc(1 + 8)
      buffer.writeUInt8(0xff, 0)
      buffer.writeUIntLE(Number(n), 1, 64)
      this.write(buffer)
    }
  }

  writeVarLengthBuffer(buffer: Buffer) {
    this.writeVarintNumber(buffer.length)
    this.write(buffer)
  }
}

export default BufferWriter
