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

export class Bech32 {
  public hrp: string
  public data: number[]

  constructor(hrp: string, data: number[]) {
    this.hrp = hrp
    this.data = data
  }

  private static polymod(values: number[]): number {
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

  private static hrpExpand(hrp: string): number[] {
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

  private createChecksum(): number[] {
    let values: number[] = [
      ...Bech32.hrpExpand(this.hrp),
      ...this.data,
      0,
      0,
      0,
      0,
      0,
      0,
    ]
    let mod: number = Bech32.polymod(values) ^ 1
    let result: number[] = []
    for (let p = 0; p < 6; ++p) {
      result.push((mod >>> (5 * (5 - p))) & 31)
    }
    return result
  }

  encode(): string {
    let combined: number[] = this.data.concat(this.createChecksum())
    return `${this.hrp}1${combined.map((s: number) => CHARSET[s]).join('')}`
  }

  private static verifyChecksum(hrp: string, data: number[]): boolean {
    return this.polymod(Bech32.hrpExpand(hrp).concat(data)) === 1
  }

  static decode(bechString: string): { hrp: string; data: number[] } {
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
    if (!Bech32.verifyChecksum(hrp, data)) {
      throw new InvalidBech32StringError(bechString)
    }
    return { hrp, data: data.slice(0, data.length - 6) }
  }
}
