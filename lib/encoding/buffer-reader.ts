class BufferReader {
  private buffer: Buffer | undefined

  constructor(buffer: Buffer) {
    this.buffer = buffer
  }

  get length(): number | undefined {
    return this.buffer?.length
  }

  get finished(): boolean {
    return this.buffer?.length === 0
  }

  read(length: number): Buffer | undefined {
    const buffer: Buffer | undefined = this.buffer?.slice(0, length)
    this.buffer = this.buffer?.slice(length)
    return buffer
  }

  readHexString(length: number): string | undefined {
    return this.read(length)?.toString('hex')
  }

  readAll(): Buffer | undefined {
    const buffer: Buffer | undefined = this.buffer
    this.buffer = Buffer.alloc(0)
    return buffer
  }

  readUInt8(): number | undefined {
    const value: number | undefined = this.buffer?.readUInt8(0)
    this.buffer = this.buffer?.slice(1)
    return value
  }

  readUInt16LE(): number | undefined {
    const value: number | undefined = this.buffer?.readUInt16LE(0)
    this.buffer = this.buffer?.slice(2)
    return value
  }

  readUInt16BE(): number | undefined {
    const value: number | undefined = this.buffer?.readUInt16BE(0)
    this.buffer = this.buffer?.slice(2)
    return value
  }

  readUInt32LE(): number | undefined {
    const value: number | undefined = this.buffer?.readUInt32LE(0)
    this.buffer = this.buffer?.slice(4)
    return value
  }

  readUInt32BE(): number | undefined {
    const value: number | undefined = this.buffer?.readUInt32BE(0)
    this.buffer = this.buffer?.slice(4)
    return value
  }

  readInt32LE(): number | undefined {
    const value: number | undefined = this.buffer?.readInt32LE(0)
    this.buffer = this.buffer?.slice(4)
    return value
  }

  readInt32BE(): number | undefined {
    const value: number | undefined = this.buffer?.readInt32BE(0)
    this.buffer = this.buffer?.slice(4)
    return value
  }

  readUInt64LE(): bigint {
    const low: number | undefined = this.buffer?.readUInt32LE()
    const high: number | undefined = this.buffer?.readUInt32LE(4)
    const value: bigint = (BigInt(high) << BigInt(32)) + BigInt(low)
    this.buffer = this.buffer?.slice(8)
    return value
  }

  readVarintNumber(): number | undefined {
    const first: number | undefined = this.readUInt8()
    switch (first) {
      case 0xfd:
        return this.readUInt16LE()
      case 0xfe:
        return this.readUInt32LE()
      case 0xff:
        return Number(this.readUInt64LE())
      default:
        return first
    }
  }

  readVarLengthBuffer(): Buffer | undefined {
    const length: number | undefined = this.readVarintNumber()
    return this.read(typeof length === 'number' ? length : 0)
  }

  push(buffer: Buffer) {
    if (typeof this.buffer === 'undefined' || this.buffer === null) {
      this.buffer = buffer
    } else {
      this.buffer = Buffer.concat([this.buffer, buffer])
    }
  }

  skip(offset: number) {
    this.buffer = this.buffer?.slice(offset)
  }

  slice(...args: number[]) {
    return this.buffer?.slice(...args)
  }
}

export default BufferReader
