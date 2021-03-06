import util from 'util'

import { sha256d } from '@/lib/crypto/hash'
import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'

const GENESIS_BITS = 0x1f00ffff

export interface HeaderConstructor {
  version: number | undefined
  prevHash: Buffer | undefined
  merkleRoot: Buffer | undefined
  timestamp: number | undefined
  bits: number | undefined
  nonce: number | undefined
  hashStateRoot: Buffer | undefined
  hashUTXORoot: Buffer | undefined
  stakePrevTxId: Buffer | undefined
  stakeOutputIndex: number | undefined
  signature: Buffer | undefined
}

export interface IHeader extends HeaderConstructor {
  id: Buffer
  hash: Buffer
  difficulty: number
  toBuffer(): Buffer
  toBufferWriter(writer: BufferWriter): void
  isProofOfStake: boolean
}

class Header implements IHeader {
  public version: number | undefined
  public prevHash: Buffer
  public merkleRoot: Buffer | undefined
  public timestamp: number | undefined
  public bits: number | undefined
  public nonce: number | undefined
  public hashStateRoot: Buffer | undefined
  public hashUTXORoot: Buffer | undefined
  public stakePrevTxId: Buffer | undefined
  public stakeOutputIndex: number | undefined
  public signature: Buffer | undefined
  private _hash: Buffer | null = null

  constructor({
    version,
    prevHash,
    merkleRoot,
    timestamp,
    bits,
    nonce,
    hashStateRoot,
    hashUTXORoot,
    stakePrevTxId,
    stakeOutputIndex,
    signature,
  }: HeaderConstructor) {
    this.version = version
    this.prevHash = prevHash || Buffer.alloc(32)
    this.merkleRoot = merkleRoot
    this.timestamp = timestamp
    this.bits = bits
    this.nonce = nonce
    this.hashStateRoot = hashStateRoot
    this.hashUTXORoot = hashUTXORoot
    this.stakePrevTxId = stakePrevTxId
    this.stakeOutputIndex = stakeOutputIndex
    this.signature = signature
  }

  static fromBuffer(buffer: Buffer): Header {
    return Header.fromBufferReader(new BufferReader(buffer))
  }

  static fromBufferReader(reader: BufferReader): Header {
    const version: number | undefined = reader.readInt32LE()
    const prevHash: Buffer | undefined = Buffer.from(
      reader.read(32) as Buffer
    ).reverse()
    const merkleRoot: Buffer | undefined = Buffer.from(
      reader.read(32) as Buffer
    ).reverse()
    const timestamp: number | undefined = reader.readUInt32LE()
    const bits: number | undefined = reader.readUInt32LE()
    const nonce: number | undefined = reader.readUInt32LE()
    const hashStateRoot: Buffer | undefined = Buffer.from(
      reader.read(32) as Buffer
    ).reverse()
    const hashUTXORoot: Buffer | undefined = Buffer.from(
      reader.read(32) as Buffer
    ).reverse()
    const stakePrevTxId: Buffer | undefined = Buffer.from(
      reader.read(32) as Buffer
    ).reverse()
    const stakeOutputIndex: number | undefined = reader.readUInt32LE()
    const signature: Buffer | undefined = reader.readVarLengthBuffer()
    return new Header({
      version,
      prevHash,
      merkleRoot,
      timestamp,
      bits,
      nonce,
      hashStateRoot,
      hashUTXORoot,
      stakePrevTxId,
      stakeOutputIndex,
      signature,
    })
  }

  toBuffer(): Buffer {
    const writer: BufferWriter = new BufferWriter()
    this.toBufferWriter(writer)
    return writer.toBuffer()
  }

  toBufferWriter(writer: BufferWriter): void {
    writer.writeInt32LE(this.version || 0)
    writer.write(Buffer.from(this.prevHash).reverse())
    writer.write(Buffer.from(this.merkleRoot as Buffer).reverse())
    writer.writeUInt32LE(this.timestamp || 0)
    writer.writeUInt32LE(this.bits || 0)
    writer.writeUInt32LE(this.nonce || 0)
    writer.write(Buffer.from(this.hashStateRoot as Buffer).reverse())
    writer.write(Buffer.from(this.hashUTXORoot as Buffer).reverse())
    writer.write(Buffer.from(this.stakePrevTxId as Buffer).reverse())
    writer.writeUInt32LE(this.stakeOutputIndex || 0)
    writer.writeVarLengthBuffer(this.signature || Buffer.alloc(0))
  }

  get id(): Buffer {
    return this.hash
  }

  get hash(): Buffer {
    this._hash = this._hash || sha256d(this.toBuffer()).reverse()
    return this._hash
  }

  [util.inspect.custom](depth = 0): string {
    if (depth === 0) {
      return `<Header ${this.hash.toString('hex')}>`
    } else {
      return `Header ${JSON.stringify(
        {
          hash: this.hash.toString('hex'),
          version: this.version,
          prevHash: this.prevHash.toString('hex'),
          timestamp: this.timestamp,
          bits: this.bits,
          nonce: this.nonce,
          hashStateRoot: this.hashStateRoot?.toString('hex'),
          hashUTXORoot: this.hashUTXORoot?.toString('hex'),
          stakePrevTxId: this.stakePrevTxId?.toString('hex'),
          stakeOutputIndex: this.stakeOutputIndex,
          signature: this.signature?.toString('hex'),
        },
        null,
        2
      )}`
    }
  }

  get isProofOfStake(): boolean {
    return (
      Buffer.compare(
        this.stakePrevTxId || Buffer.alloc(0),
        Buffer.alloc(32)
      ) !== 0 && this.stakeOutputIndex !== 0xffffffff
    )
  }

  get difficulty(): number {
    const bits = this.bits || 0
    let nShift = (bits >> 24) & 0xff
    let dDiff = 0x0000ffff / (bits & 0x00ffffff)

    while (nShift < 29) {
      dDiff *= 256.0
      nShift++
    }
    while (nShift > 29) {
      dDiff /= 256.0
      nShift--
    }

    return dDiff
  }
}

export default Header
