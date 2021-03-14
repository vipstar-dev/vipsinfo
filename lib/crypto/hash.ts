import { BinaryLike, createHash } from 'crypto'

export function sha256(buffer: BinaryLike): Buffer {
  return createHash('sha256').update(buffer).digest()
}

export function sha256d(buffer: BinaryLike): Buffer {
  return sha256(sha256(buffer))
}

function ripemd160(buffer: BinaryLike): Buffer {
  return createHash('ripemd160').update(buffer).digest()
}

export function hash160(buffer: BinaryLike): Buffer {
  return ripemd160(sha256(buffer))
}
