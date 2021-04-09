import { sha256d } from '@lib/crypto/hash'

const ALPHABET: string =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const ALPHABET_MAP: { [key: string]: number } = {}

for (let index = 0; index < ALPHABET.length; ++index) {
  ALPHABET_MAP[ALPHABET[index]] = index
}

export class InvalidBase58Error extends Error {
  constructor(...args: string[]) {
    super(...args)
    Error.captureStackTrace(this, this.constructor)
  }

  get name(): string {
    return this.constructor.name
  }
}

export class Base58 {
  static encode(buf: Buffer): string {
    const result: number[] = []
    let n: bigint = BigInt(0)
    for (const x of buf) {
      n = (n << BigInt(8)) | BigInt(x)
    }
    while (n > 0) {
      const r: bigint = n % BigInt(58)
      n /= BigInt(58)
      result.push(Number(r))
    }
    for (let i = 0; buf[i] === 0; ++i) {
      result.push(0)
    }
    return result
      .reverse()
      .map((x: number): string => ALPHABET[x])
      .join('')
  }

  static decode(str: string): Buffer {
    if (str === '') {
      return Buffer.alloc(0)
    }
    let n: bigint = BigInt(0)
    for (const s of str) {
      if (!(s in ALPHABET_MAP)) {
        throw new InvalidBase58Error(str)
      }
      n = n * BigInt(58) + BigInt(ALPHABET_MAP[s])
    }
    const list: number[] = []
    while (n > 0) {
      list.push(Number(n & BigInt(0xff)))
      n >>= BigInt(8)
    }
    for (let i = 0; i < str.length && str[i] === ALPHABET[0]; ++i) {
      list.push(0)
    }
    return Buffer.from(list.reverse())
  }
}

export class InvalidBase58ChecksumError extends Error {
  constructor(...args: string[]) {
    super(...args)
    Error.captureStackTrace(this, this.constructor)
  }

  get name(): string {
    return this.constructor.name
  }
}

export class Base58Check {
  static encode(buf: Buffer): string {
    const checkedBuffer: Buffer = Buffer.alloc(buf.length + 4)
    const hashBuffer: Buffer = sha256d(buf)
    buf.copy(checkedBuffer)
    hashBuffer.copy(checkedBuffer, buf.length)
    return Base58.encode(checkedBuffer)
  }

  static decode(str: string): Buffer {
    const buf: Buffer = Base58.decode(str)
    const data: Buffer = buf.slice(0, -4)
    const checksum: Buffer = buf.slice(-4)
    const hashBuffer: Buffer = sha256d(data)
    if (Buffer.compare(hashBuffer.slice(0, 4), checksum) !== 0) {
      throw new InvalidBase58ChecksumError(str)
    }
    return data
  }
}
