import BN from 'bn.js'

declare module 'ethereumjs-abi' {
  export type rawDecodeResults = string | boolean | BN
  export type rawEncodeArgument = string | number | boolean

  export function eventID(name: string, types: string[]): Buffer

  export function methodID(name: string, types: string[]): Buffer

  export function rawEncode(
    types: string[],
    values: (rawEncodeArgument | rawEncodeArgument[])[]
  ): Buffer

  export function rawDecode(
    types: string[],
    data: Buffer
  ): (rawDecodeResults | rawDecodeResults[])[]
}
