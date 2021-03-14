const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

export class InvalidBech32StringError extends Error {
  constructor(...args: string[]) {
    super(...args)
    Error.captureStackTrace(this, this.constructor)
  }

  get name(): string {
    return this.constructor.name
  }
}

function polymod(values: number[]): number {
  let mod: number = 1
  for (let x of values) {
    let top: number = mod >>> 25
    mod = ((mod & 0x1ffffff) << 5) | x
    for (let i = 0; i < 5; ++i) {
      if ((top >>> i) & 1) {
        mod ^= GENERATOR[i]
      }
    }
  }
  return mod
}

function hrpExpand(hrp: string): number[] {
  let result: number[] = []
  for (let p = 0; p < hrp.length; ++p) {
    result.push(hrp.charCodeAt(p) >>> 5)
  }
  result.push(0)
  for (let p = 0; p < hrp.length; ++p) {
    result.push(hrp.charCodeAt(p) & 31)
  }
  return result
}

function verifyChecksum(hrp: string, data: number[]): boolean {
  return polymod(hrpExpand(hrp).concat(data)) === 1
}

function createChecksum(hrp: string, data: number[]): number[] {
  let values: number[] = [...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]
  let mod: number = polymod(values) ^ 1
  let result: number[] = []
  for (let p = 0; p < 6; ++p) {
    result.push((mod >>> (5 * (5 - p))) & 31)
  }
  return result
}

export function encode(hrp: string, data: number[]): string {
  let combined: number[] = data.concat(createChecksum(hrp, data))
  return `${hrp}1${combined.map((s: number) => CHARSET[s]).join('')}`
}

export function decode(bechString: string) {
  let hasLower: boolean = false
  let hasUpper: boolean = false
  for (let p = 0; p < bechString.length; ++p) {
    let code: number = bechString.charCodeAt(p)
    if (code < 33 || code > 126) {
      throw new InvalidBech32StringError(bechString)
    }
    if (code >= 97 && code <= 122) {
      hasLower = true
    }
    if (code >= 65 && code <= 90) {
      hasUpper = true
    }
  }
  if (hasLower && hasUpper) {
    throw new InvalidBech32StringError(bechString)
  }
  bechString = bechString.toLowerCase()
  let position: number = bechString.lastIndexOf('1')
  if (
    position < 1 ||
    position + 7 > bechString.length ||
    bechString.length > 90
  ) {
    throw new InvalidBech32StringError(bechString)
  }
  let hrp: string = bechString.slice(0, position)
  let data: number[] = []
  for (let s of bechString.slice(position + 1)) {
    let d = CHARSET.indexOf(s)
    if (d === -1) {
      throw new InvalidBech32StringError(bechString)
    }
    data.push(d)
  }
  if (!verifyChecksum(hrp, data)) {
    throw new InvalidBech32StringError(bechString)
  }
  return { hrp, data: data.slice(0, data.length - 6) }
}
