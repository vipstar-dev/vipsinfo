import { BinaryLike, createHash } from 'crypto'

export function sha256(buffer: BinaryLike) {
  return createHash('sha256').update(buffer).digest()
}

export function sha256sha256(buffer: BinaryLike) {
  return sha256(sha256(buffer))
}

function ripemd160(buffer: BinaryLike) {
  return createHash('ripemd160').update(buffer).digest()
}

export function sha256ripemd160(buffer: BinaryLike) {
  return ripemd160(sha256(buffer))
}
