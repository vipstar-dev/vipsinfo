import { IChain } from '@lib/chain'
import { hash160 } from '@lib/crypto/hash'
import {
  Base58Check,
  InvalidBase58ChecksumError,
  InvalidBase58Error,
} from '@lib/encoding/base58'
import SegwitAddress, {
  InvalidSegwitAddressError,
} from '@lib/encoding/segwit-address'
import OutputScript, {
  IContractOutputScript,
  IEVMContractCallBySenderScript,
  IEVMContractCallScript,
  IEVMContractCreateBySenderScript,
  IEVMContractCreateScript,
  IMultisigOutputScript,
  IPublicKeyHashOutputScript,
  IPublicKeyOutputScript,
  IScriptHashOutputScript,
  IWitnessV0KeyHashOutputScript,
  IWitnessV0ScriptHashOut,
} from '@lib/script/output'
import util from 'util'

export type AddressTypes =
  | 'PAY_TO_PUBLIC_KEY_HASH'
  | 'PAY_TO_SCRIPT_HASH'
  | 'PAY_TO_WITNESS_KEY_HASH'
  | 'PAY_TO_WITNESS_SCRIPT_HASH'
  | 'CONTRACT'
  | 'EVM_CONTRACT'

const TYPES: { [key in AddressTypes]: string } = {
  PAY_TO_PUBLIC_KEY_HASH: 'pubkeyhash',
  PAY_TO_SCRIPT_HASH: 'scripthash',
  PAY_TO_WITNESS_KEY_HASH: 'witness_v0_keyhash',
  PAY_TO_WITNESS_SCRIPT_HASH: 'witness_v0_scripthash',
  CONTRACT: 'contract',
  EVM_CONTRACT: 'evm_contract',
}

export interface AddressConstructor {
  type: string | null
  data: Buffer | undefined
  chain: IChain
}

export interface IAddress extends AddressConstructor {
  [Symbol.toStringTag]: string
  toString(): string | undefined
}

class Address implements IAddress {
  public type: string | null
  public data: Buffer | undefined
  public chain: IChain

  constructor({ type, data, chain }: AddressConstructor) {
    this.type = type
    this.data = data
    this.chain = chain
  }

  get [Symbol.toStringTag](): string {
    return 'Address'
  }

  static fromScript(
    script:
      | IPublicKeyOutputScript
      | IPublicKeyHashOutputScript
      | IScriptHashOutputScript
      | IMultisigOutputScript
      | IWitnessV0KeyHashOutputScript
      | IWitnessV0ScriptHashOut
      | IEVMContractCreateScript
      | IEVMContractCreateBySenderScript
      | IEVMContractCallScript
      | IEVMContractCallBySenderScript
      | IContractOutputScript,
    chain: IChain,
    transactionId: Buffer,
    outputIndex: number
  ) {
    switch (script.type) {
      case OutputScript.PUBKEY:
        return new Address({
          type: TYPES.PAY_TO_PUBLIC_KEY_HASH,
          data: hash160((script as IPublicKeyOutputScript).publicKey as Buffer),
          chain,
        })
      case OutputScript.PUBKEYHASH:
        return new Address({
          type: TYPES.PAY_TO_PUBLIC_KEY_HASH,
          data: (script as IPublicKeyHashOutputScript).publicKeyHash,
          chain,
        })
      case OutputScript.SCRIPTHASH:
        return new Address({
          type: TYPES.PAY_TO_SCRIPT_HASH,
          data: (script as IScriptHashOutputScript).scriptHash,
          chain,
        })
      case OutputScript.WITNESS_V0_KEYHASH:
        return new Address({
          type: TYPES.PAY_TO_WITNESS_KEY_HASH,
          data: (script as IWitnessV0KeyHashOutputScript).publicKeyHash,
          chain,
        })
      case OutputScript.WITNESS_V0_SCRIPTHASH:
        return new Address({
          type: TYPES.PAY_TO_WITNESS_SCRIPT_HASH,
          data: (script as IWitnessV0ScriptHashOut).scriptHash,
          chain,
        })
      case OutputScript.EVM_CONTRACT_CREATE:
      case OutputScript.EVM_CONTRACT_CREATE_SENDER:
        return new Address({
          type: TYPES.EVM_CONTRACT,
          data: hash160(
            Buffer.concat([
              Buffer.from(transactionId).reverse(),
              getUInt32LEBuffer(outputIndex),
            ])
          ),
          chain,
        })
      case OutputScript.EVM_CONTRACT_CALL:
      case OutputScript.EVM_CONTRACT_CALL_SENDER:
        return new Address({
          type: TYPES.EVM_CONTRACT,
          data: (script as IEVMContractCallScript).contract,
          chain,
        })
      case OutputScript.CONTRACT:
        return new Address({
          type: TYPES.CONTRACT,
          data: (script as IContractOutputScript).contract,
          chain,
        })
    }
  }

  static fromString(str: string, chain: IChain) {
    if (/^[0-9a-f]{40}$/.test(str)) {
      return new Address({
        type: TYPES.CONTRACT,
        data: Buffer.from(str, 'hex'),
        chain,
      })
    }
    try {
      const result: Buffer = Base58Check.decode(str)
      if (result.length === 21) {
        if (result[0] === chain.pubkeyhash) {
          return new Address({
            type: TYPES.PAY_TO_PUBLIC_KEY_HASH,
            data: result.slice(1),
            chain,
          })
        } else if (result[0] === chain.scripthash) {
          return new Address({
            type: TYPES.PAY_TO_SCRIPT_HASH,
            data: result.slice(1),
            chain,
          })
        } else if (result[0] === chain.evm) {
          return new Address({
            type: TYPES.EVM_CONTRACT,
            data: result.slice(1),
            chain,
          })
        }
      }
    } catch (err) {
      if (
        !(
          err instanceof InvalidBase58Error ||
          err instanceof InvalidBase58ChecksumError
        )
      ) {
        throw err
      }
    }
    try {
      const {
        hrp,
        version,
        program,
      }: {
        hrp: string
        version: number
        program: Buffer
      } = SegwitAddress.decode(str) as {
        hrp: string
        version: number
        program: Buffer
      }
      if (hrp === chain.witnesshrp && version === 0) {
        if (program.length === 20) {
          return new Address({
            type: TYPES.PAY_TO_WITNESS_KEY_HASH,
            data: program,
            chain,
          })
        } else if (program.length === 32) {
          return new Address({
            type: TYPES.PAY_TO_WITNESS_SCRIPT_HASH,
            data: program,
            chain,
          })
        }
      }
    } catch (err) {
      if (!(err instanceof InvalidSegwitAddressError)) {
        throw err
      }
    }
  }

  toString(): string | undefined {
    if (this.data) {
      switch (this.type) {
        case TYPES.PAY_TO_PUBLIC_KEY_HASH:
          return Base58Check.encode(
            Buffer.from([this.chain.pubkeyhash, ...this.data])
          )
        case TYPES.PAY_TO_SCRIPT_HASH:
          return Base58Check.encode(
            Buffer.from([this.chain.scripthash, ...this.data])
          )
        case TYPES.PAY_TO_WITNESS_KEY_HASH:
        case TYPES.PAY_TO_WITNESS_SCRIPT_HASH:
          return SegwitAddress.encode(this.chain.witnesshrp, 0, this.data)
        case TYPES.CONTRACT:
          return this.data.toString('hex')
        case TYPES.EVM_CONTRACT:
          return Base58Check.encode(Buffer.from([this.chain.evm, ...this.data]))
      }
    }
  }

  [util.inspect.custom](): string {
    return `<Address: ${this.toString()}, type: ${this.type}>`
  }
}

function getUInt32LEBuffer(n: number): Buffer {
  const buffer: Buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(n)
  return buffer
}

export default Object.assign(Address, TYPES)
