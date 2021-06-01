import { BIP32Interface, fromBase58 } from 'bip32'

import {
  Address,
  Base58Check,
  BIP32,
  hash160,
  IAddress,
  IChain,
  Opcode,
} from '@/lib'

interface Network {
  wif: number
  bip32: BIP32
}

export function BIP32FromBase58(
  inString: string,
  chain: IChain
): BIP32Interface {
  const buffer = Base58Check.decode(inString)
  if (buffer.length !== 78) throw new TypeError('Invalid buffer length')
  const network: Partial<Network> = {
    wif: chain.name === 'mainnet' ? 0x80 : 0xef,
  }

  // 4 bytes: version bytes
  const version = buffer.readUInt32BE(0)
  if (version === chain.bip32.standard.public) {
    network.bip32 = chain.bip32.standard
  } else if (version === chain.bip32.segwitP2SH.public) {
    network.bip32 = chain.bip32.segwitP2SH
  } else if (version === chain.bip32.segwitNative.public) {
    network.bip32 = chain.bip32.segwitNative
  } else {
    throw new TypeError('Invalid network version')
  }

  return fromBase58(inString, network as Network)
}

export function deriveAddressFromTo(
  xpub: string,
  change: number,
  fromIndex: number,
  toIndex: number,
  chain: IChain
): IAddress[] {
  if (toIndex <= fromIndex) {
    throw Error('toIndex<=fromIndex')
  }
  if (
    parseInt(change.toString()) !== change &&
    parseInt(fromIndex.toString()) !== fromIndex &&
    parseInt(toIndex.toString()) !== toIndex
  ) {
    throw Error(
      'change or fromIndex or toIndex is invalid. Please use int format.'
    )
  }
  const extKey = BIP32FromBase58(xpub, chain)
  const changeExtKey = extKey.derive(change)
  const addresses: IAddress[] = []
  for (let i = fromIndex; i < toIndex; i++) {
    const indexExtKey = changeExtKey.derive(i)
    let address: IAddress
    if (indexExtKey.network.bip32.public === chain.bip32.segwitP2SH.public) {
      const pubKeyHash = indexExtKey.identifier
      const scriptHash = hash160(
        Buffer.from([Opcode.OP_0, pubKeyHash.length, ...pubKeyHash])
      )
      address = new Address({
        type: Address.PAY_TO_SCRIPT_HASH,
        data: scriptHash,
        chain,
      })
    } else if (
      indexExtKey.network.bip32.public === chain.bip32.segwitNative.public
    ) {
      address = new Address({
        type: Address.PAY_TO_WITNESS_KEY_HASH,
        data: indexExtKey.identifier,
        chain,
      })
    } else {
      // default to P2PKH address
      address = new Address({
        type: Address.PAY_TO_PUBLIC_KEY_HASH,
        data: indexExtKey.identifier,
        chain,
      })
    }
    addresses.push(address)
  }
  return addresses
}

export function derivationBasePath(xpub: string, chain: IChain): string {
  const extKey = BIP32FromBase58(xpub, chain)
  let indexNum = extKey.index
  let index = ''
  // default bip number
  let bip = '44'
  if (indexNum >= 0x80000000) {
    indexNum -= 0x80000000
    index = "'"
  }
  index = `${indexNum}${index}`
  if (extKey.depth != 3) {
    return `unknown/${index}`
  }
  if (extKey.network.bip32.public === chain.bip32.segwitP2SH.public) {
    bip = '49'
  } else if (extKey.network.bip32.public === chain.bip32.segwitNative.public) {
    bip = '84'
  }

  return `m/${bip}'/${chain.slip44 ? chain.slip44 : 1}'/${index}`
}