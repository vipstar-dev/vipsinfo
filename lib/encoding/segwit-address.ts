import { Bech32, InvalidBech32StringError } from '@/lib/encoding/bech32'

export class InvalidSegwitAddressError extends Error {
  constructor(...args: string[]) {
    super(...args)
    Error.captureStackTrace(this, this.constructor)
  }

  get name(): string {
    return this.constructor.name
  }
}

function convertBits(
  data: Buffer | number[],
  fromBits: number,
  toBits: number,
  padding: boolean
): Buffer | null {
  let acc: number = 0
  let bits: number = 0
  let result: number[] = []
  let maxV: number = (1 << toBits) - 1
  for (let p = 0; p < data.length; ++p) {
    let value: number = data[p]
    if (value < 0 || value >>> fromBits !== 0) {
      return null
    }
    acc = (acc << fromBits) | value
    bits += fromBits
    while (bits >= toBits) {
      bits -= toBits
      result.push((acc >>> bits) & maxV)
    }
  }
  if (padding) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxV)
    }
  } else if (bits >= fromBits || (acc << (toBits - bits)) & maxV) {
    return null
  }
  return Buffer.from(result)
}

export class SegwitAddress {
  static encode(hrp: string, version: number, program: Buffer): string {
    let dataBuffer: Buffer | null = convertBits(program, 8, 5, true)
    let dataArray: number[] = []
    if (dataBuffer !== null) {
      dataBuffer.map((n: number) => dataArray.push(n))
    }
    return new Bech32(hrp, [version, ...dataArray]).encode()
  }

  static decode(
    address: string
  ): { hrp: string; version: number; program: Buffer } | null | undefined {
    try {
      let { hrp, data }: { hrp: string; data: number[] } = Bech32.decode(
        address
      )
      let [version, ...programBits]: number[] = data
      if (data.length < 1 || data[0] > 16) {
        throw new InvalidSegwitAddressError(address)
      }
      let program: Buffer | null = convertBits(programBits, 5, 8, false)
      if (program === null || program.length < 2 || program.length > 40) {
        return null
      }
      if (version === 0 && program.length !== 20 && program.length !== 32) {
        return null
      }
      return { hrp, version, program }
    } catch (err) {
      if (err instanceof InvalidBech32StringError) {
        throw new InvalidSegwitAddressError(address)
      }
    }
  }
}

export default SegwitAddress
