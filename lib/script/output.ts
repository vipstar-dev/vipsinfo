import secp256k1 from 'secp256k1'

import BufferWriter from '@/lib/encoding/buffer-writer'
import Script, { IScript, ScriptChunk } from '@/lib/script'
import Opcode, { OpcodeReversedMap } from '@/lib/script/opcode'

export type OutputTypes =
  | 'UNKNOWN'
  | 'PUBKEY'
  | 'PUBKEYHASH'
  | 'SCRIPTHASH'
  | 'MULTISIG'
  | 'DATA'
  | 'WITNESS_V0_KEYHASH'
  | 'WITNESS_V0_SCRIPTHASH'
  | 'EVM_CONTRACT_CREATE'
  | 'EVM_CONTRACT_CREATE_SENDER'
  | 'EVM_CONTRACT_CALL'
  | 'EVM_CONTRACT_CALL_SENDER'
  | 'CONTRACT'

const TYPES: { [key in OutputTypes]: string } = {
  UNKNOWN: 'nonstandard',
  PUBKEY: 'pubkey',
  PUBKEYHASH: 'pubkeyhash',
  SCRIPTHASH: 'scripthash',
  MULTISIG: 'multisig',
  DATA: 'nulldata',
  WITNESS_V0_KEYHASH: 'witness_v0_keyhash',
  WITNESS_V0_SCRIPTHASH: 'witness_v0_scripthash',
  EVM_CONTRACT_CREATE: 'evm_create',
  EVM_CONTRACT_CREATE_SENDER: 'evm_create_sender',
  EVM_CONTRACT_CALL: 'evm_call',
  EVM_CONTRACT_CALL_SENDER: 'evm_call_sender',
  CONTRACT: 'call',
}

export interface IOutputScript extends IScript {
  type: string
  isStandard(): boolean
}

export interface IPublicKeyOutputScript extends IOutputScript {
  publicKey: Buffer | undefined
}

export interface IPublicKeyHashOutputScript extends IOutputScript {
  publicKeyHash: Buffer | undefined
}

export interface IScriptHashOutputScript extends IOutputScript {
  scriptHash: Buffer | undefined
}

export interface IMultisigOutputScript extends IOutputScript {
  publicKeys: (Buffer | undefined)[]
  signaturesRequired: number | undefined
}

export interface IDataOutputScript extends IOutputScript {
  buffer: Buffer | undefined
}

export interface IWitnessV0KeyHashOutputScript extends IOutputScript {
  publicKeyHash: Buffer | undefined
}

export interface IWitnessV0ScriptHashOut extends IOutputScript {
  scriptHash: Buffer | undefined
}

export interface IEVMContractCreateScript extends IOutputScript {
  gasLimit: number | undefined
  gasPrice: number | undefined
  byteCode: Buffer | undefined
}

export interface IEVMContractCreateBySenderScript extends IOutputScript {
  senderType: number | undefined
  senderData: Buffer | undefined
  signature: Buffer | undefined
  gasLimit: number | undefined
  gasPrice: number | undefined
  byteCode: Buffer | undefined
}

export interface IEVMContractCallScript extends IOutputScript {
  gasLimit: number | undefined
  gasPrice: number | undefined
  byteCode: Buffer | undefined
  contract: Buffer | undefined
}

export interface IEVMContractCallBySenderScript extends IOutputScript {
  senderType: number | undefined
  senderData: Buffer | undefined
  signature: Buffer | undefined
  gasLimit: number | undefined
  gasPrice: number | undefined
  byteCode: Buffer | undefined
  contract: Buffer | undefined
}

export interface IContractOutputScript extends IOutputScript {
  contract: Buffer | undefined
}

class OutputScript extends Script implements IOutputScript {
  static fromBuffer(buffer: Buffer): OutputScript {
    if (buffer[0] === Opcode.OP_RETURN) {
      return new DataOutputScript([
        { code: Opcode.OP_RETURN, buffer: buffer.slice(1) },
      ])
    }
    let chunks: ScriptChunk[] = Script.parseBuffer(buffer)
    for (const Class of [
      PublicKeyOutputScript,
      PublicKeyHashOutputScript,
      ScriptHashOutputScript,
      MultisigOutputScript,
      WitnessV0KeyHashOutputScript,
      WitnessV0ScriptHashOut,
      EVMContractCreateScript,
      EVMContractCreateBySenderScript,
      EVMContractCallScript,
      EVMContractCallBySenderScript,
      ContractOutputScript,
    ]) {
      if (Class.isValid(chunks)) {
        return new Class(chunks)
      }
    }
    return new OutputScript(chunks)
  }

  toString(): string {
    let chunks: (string | number | undefined)[] = this.chunks.map(
      ({ code, buffer }: ScriptChunk) => {
        if (buffer) {
          return buffer.toString('hex')
        } else if (code in OpcodeReversedMap) {
          return OpcodeReversedMap[code]
        } else {
          return code
        }
      }
    )
    if (['OP_CREATE', 'OP_CALL'].includes(<string>chunks[chunks.length - 1])) {
      for (let i = 0; i < 3; ++i) {
        chunks[i] = parseNumberChunk(this.chunks[i])
      }
    }
    return chunks.join(' ')
  }

  get type(): string {
    return TYPES.UNKNOWN
  }

  isStandard(): boolean {
    return this.type !== TYPES.UNKNOWN
  }
}

function parseNumberChunk(chunk: ScriptChunk): number | undefined {
  let code = new Opcode(chunk.code)
  if (code.isSmallInt()) {
    return code.toSmallInt()
  } else if (chunk.buffer) {
    return Number.parseInt(chunk.buffer.reverse().toString('hex'), 16)
  }
}

function buildNumberChunk(n: number): ScriptChunk {
  let list: number[] = []
  if (n <= 0xff) {
    list = [n]
  } else if (n <= 0xffff) {
    list = [n & 0xff, n >> 8]
  } else if (n <= 0xffffff) {
    list = [n & 0xff, (n >> 8) & 0xff, n >> 16]
  } else {
    list = [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >> 24]
  }
  if (list[list.length - 1] >= 0x80) {
    list.push(0)
  }
  return Script.buildChunk(Buffer.from(list))
}

export class PublicKeyOutputScript
  extends OutputScript
  implements IPublicKeyOutputScript {
  public publicKey: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.publicKey = chunks[0].buffer
  }

  static build(publicKey: Buffer): PublicKeyOutputScript {
    return new PublicKeyOutputScript([
      Script.buildChunk(publicKey),
      { code: Opcode.OP_CHECKSIG },
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean | undefined {
    return (
      chunks.length === 2 &&
      chunks[0].buffer &&
      secp256k1.publicKeyVerify(chunks[0].buffer) &&
      chunks[1].code === Opcode.OP_CHECKSIG
    )
  }

  get type(): string {
    return TYPES.PUBKEY
  }
}

export class PublicKeyHashOutputScript
  extends OutputScript
  implements IPublicKeyHashOutputScript {
  public publicKeyHash: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.publicKeyHash = chunks[2].buffer
  }

  static build(publicKeyHash: Buffer): PublicKeyHashOutputScript {
    return new PublicKeyHashOutputScript([
      { code: Opcode.OP_DUP },
      { code: Opcode.OP_HASH160 },
      Script.buildChunk(publicKeyHash),
      { code: Opcode.OP_EQUALVERIFY },
      { code: Opcode.OP_CHECKSIG },
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean | undefined {
    return (
      chunks.length === 5 &&
      chunks[0].code === Opcode.OP_DUP &&
      chunks[1].code === Opcode.OP_HASH160 &&
      chunks[2].buffer &&
      chunks[2].buffer.length === 20 &&
      chunks[3].code === Opcode.OP_EQUALVERIFY &&
      chunks[4].code === Opcode.OP_CHECKSIG
    )
  }

  get type(): string {
    return TYPES.PUBKEYHASH
  }
}

export class ScriptHashOutputScript
  extends OutputScript
  implements IScriptHashOutputScript {
  public scriptHash: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.scriptHash = chunks[1].buffer
  }

  static build(scriptHash: Buffer): ScriptHashOutputScript {
    return new ScriptHashOutputScript([
      { code: Opcode.OP_HASH160 },
      Script.buildChunk(scriptHash),
      { code: Opcode.OP_CHECKSIG },
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean | undefined {
    return (
      chunks.length === 3 &&
      chunks[0].code === Opcode.OP_HASH160 &&
      chunks[1].buffer &&
      chunks[1].buffer.length === 20 &&
      chunks[2].code === Opcode.OP_EQUAL
    )
  }

  get type(): string {
    return TYPES.SCRIPTHASH
  }
}

export class MultisigOutputScript
  extends OutputScript
  implements IMultisigOutputScript {
  public publicKeys: (Buffer | undefined)[]
  public signaturesRequired: number | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.publicKeys = chunks.slice(1, -2).map((chunk) => chunk.buffer)
    this.signaturesRequired = new Opcode(chunks[0].code).toSmallInt()
  }

  static build(
    publicKeys: Buffer[],
    signaturesRequired: number
  ): MultisigOutputScript {
    return new MultisigOutputScript([
      // @ts-ignore
      { code: Opcode[`OP_${signaturesRequired}`] },
      // @ts-ignore
      ...this.publicKeys?.map(Script.buildChunk),
      // @ts-ignore
      { code: Opcode[`OP_${this.publicKeys.length}`] },
      { code: Opcode.OP_CHECKMULTISIG },
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean {
    return (
      chunks.length > 3 &&
      new Opcode(chunks[0].code).isSmallInt() &&
      chunks
        .slice(1, -2)
        .every(
          (chunk) => chunk.buffer && secp256k1.publicKeyVerify(chunk.buffer)
        ) &&
      new Opcode(chunks[chunks.length - 2].code).toSmallInt() ===
        chunks.length - 3 &&
      chunks[chunks.length - 1].code === Opcode.OP_CHECKMULTISIG
    )
  }

  toString(): string {
    return [
      this.signaturesRequired,
      ...this.publicKeys.map((publicKey) => publicKey?.toString('hex')),
      this.publicKeys.length,
      'OP_CHECKMULTISIG',
    ].join(' ')
  }

  get type(): string {
    return TYPES.MULTISIG
  }
}

export class DataOutputScript
  extends OutputScript
  implements IDataOutputScript {
  public buffer: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.buffer = chunks[0].buffer
  }

  static build(buffer: Buffer): DataOutputScript {
    return new DataOutputScript([{ code: Opcode.OP_RETURN, buffer }])
  }

  toBufferWriter(writer: BufferWriter): void {
    if (this.buffer !== undefined) {
      writer.writeUInt8(Opcode.OP_RETURN)
      writer.write(this.buffer)
    }
  }

  toString(): string {
    if (this.buffer && this.buffer[0] === this.buffer.length) {
      return `OP_RETURN ${this.buffer.slice(1).toString('hex')}`
    } else {
      return `OP_RETURN ${this.buffer?.toString('hex')} (invalid script)`
    }
  }

  get type(): string {
    return TYPES.DATA
  }
}

export class WitnessV0KeyHashOutputScript
  extends OutputScript
  implements IWitnessV0KeyHashOutputScript {
  public publicKeyHash: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.publicKeyHash = chunks[1].buffer
  }

  static build(publicKeyHash: Buffer): WitnessV0KeyHashOutputScript {
    return new WitnessV0KeyHashOutputScript([
      { code: Opcode.OP_0 },
      Script.buildChunk(publicKeyHash),
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean | undefined {
    return (
      chunks.length === 2 &&
      chunks[0].code === Opcode.OP_0 &&
      chunks[1].buffer &&
      chunks[1].buffer.length === 20
    )
  }

  get type(): string {
    return TYPES.WITNESS_V0_KEYHASH
  }
}

export class WitnessV0ScriptHashOut
  extends OutputScript
  implements IWitnessV0ScriptHashOut {
  public scriptHash: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.scriptHash = chunks[1].buffer
  }

  static build(scriptHash: Buffer): WitnessV0ScriptHashOut {
    return new WitnessV0ScriptHashOut([
      { code: Opcode.OP_0 },
      Script.buildChunk(scriptHash),
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean | undefined {
    return (
      chunks.length === 2 &&
      chunks[0].code === Opcode.OP_0 &&
      chunks[1].buffer &&
      chunks[1].buffer.length === 32
    )
  }

  get type(): string {
    return TYPES.WITNESS_V0_SCRIPTHASH
  }
}

export class EVMContractCreateScript
  extends OutputScript
  implements IEVMContractCreateScript {
  public gasLimit: number | undefined
  public gasPrice: number | undefined
  public byteCode: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.gasLimit = parseNumberChunk(chunks[1])
    this.gasPrice = parseNumberChunk(chunks[2])
    this.byteCode = chunks[3].buffer
  }

  static build({
    gasLimit,
    gasPrice,
    byteCode,
  }: {
    gasLimit: number
    gasPrice: number
    byteCode: Buffer
  }): EVMContractCreateScript {
    return new EVMContractCreateScript([
      buildNumberChunk(4),
      buildNumberChunk(gasLimit),
      buildNumberChunk(gasPrice),
      Script.buildChunk(byteCode),
      { code: Opcode.OP_CREATE },
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean {
    return (
      chunks.length === 5 &&
      parseNumberChunk(chunks[0]) === 4 &&
      chunks[4].code === Opcode.OP_CREATE
    )
  }

  toString(): string {
    return [
      4,
      this.gasLimit,
      this.gasPrice,
      this.byteCode?.toString('hex'),
      'OP_CREATE',
    ].join(' ')
  }

  get type(): string {
    return TYPES.EVM_CONTRACT_CREATE
  }
}

export class EVMContractCreateBySenderScript
  extends OutputScript
  implements IEVMContractCreateBySenderScript {
  public senderType: number | undefined
  public senderData: Buffer | undefined
  public signature: Buffer | undefined
  public gasLimit: number | undefined
  public gasPrice: number | undefined
  public byteCode: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.senderType = parseNumberChunk(chunks[0])
    this.senderData = chunks[1].buffer
    this.signature = chunks[2].buffer
    this.gasLimit = parseNumberChunk(chunks[5])
    this.gasPrice = parseNumberChunk(chunks[6])
    this.byteCode = chunks[7].buffer
  }

  static build({
    senderType,
    senderData,
    signature,
    gasLimit,
    gasPrice,
    byteCode,
  }: {
    senderType: number
    senderData: Buffer
    signature: Buffer
    gasLimit: number
    gasPrice: number
    byteCode: Buffer
  }): EVMContractCreateBySenderScript {
    return new EVMContractCreateBySenderScript([
      buildNumberChunk(senderType),
      Script.buildChunk(senderData),
      Script.buildChunk(signature),
      { code: Opcode.OP_SENDER },
      buildNumberChunk(4),
      buildNumberChunk(gasLimit),
      buildNumberChunk(gasPrice),
      Script.buildChunk(byteCode),
      { code: Opcode.OP_CREATE },
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean {
    return (
      chunks.length === 9 &&
      chunks[3].code === Opcode.OP_SENDER &&
      parseNumberChunk(chunks[4]) === 4 &&
      chunks[8].code === Opcode.OP_CREATE
    )
  }

  toString(): string {
    return [
      this.senderType,
      this.senderData?.toString('hex'),
      this.signature?.toString('hex'),
      'OP_SENDER',
      4,
      this.gasLimit,
      this.gasPrice,
      this.byteCode?.toString('hex'),
      'OP_CREATE',
    ].join(' ')
  }

  get type(): string {
    return TYPES.EVM_CONTRACT_CREATE_SENDER
  }
}

export class EVMContractCallScript
  extends OutputScript
  implements IEVMContractCallScript {
  public gasLimit: number | undefined
  public gasPrice: number | undefined
  public byteCode: Buffer | undefined
  public contract: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.gasLimit = parseNumberChunk(chunks[1])
    this.gasPrice = parseNumberChunk(chunks[2])
    this.byteCode = chunks[3].buffer
    this.contract = chunks[4].buffer
  }

  static build({
    gasLimit,
    gasPrice,
    byteCode,
    contract,
  }: {
    gasLimit: number
    gasPrice: number
    byteCode: Buffer
    contract: Buffer
  }): EVMContractCallScript {
    return new EVMContractCallScript([
      buildNumberChunk(4),
      buildNumberChunk(gasLimit),
      buildNumberChunk(gasPrice),
      Script.buildChunk(byteCode),
      Script.buildChunk(contract),
      { code: Opcode.OP_CALL },
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean {
    return (
      chunks.length === 6 &&
      parseNumberChunk(chunks[0]) === 4 &&
      chunks[5].code === Opcode.OP_CALL
    )
  }

  toString(): string {
    return [
      4,
      this.gasLimit,
      this.gasPrice,
      this.byteCode?.toString('hex'),
      this.contract?.toString('hex'),
      'OP_CALL',
    ].join(' ')
  }

  get type(): string {
    return TYPES.EVM_CONTRACT_CALL
  }
}

export class EVMContractCallBySenderScript
  extends OutputScript
  implements IEVMContractCallBySenderScript {
  public senderType: number | undefined
  public senderData: Buffer | undefined
  public signature: Buffer | undefined
  public gasLimit: number | undefined
  public gasPrice: number | undefined
  public byteCode: Buffer | undefined
  public contract: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.senderType = parseNumberChunk(chunks[0])
    this.senderData = chunks[1].buffer
    this.signature = chunks[2].buffer
    this.gasLimit = parseNumberChunk(chunks[5])
    this.gasPrice = parseNumberChunk(chunks[6])
    this.byteCode = chunks[7].buffer
    this.contract = chunks[8].buffer
  }

  static build({
    senderType,
    senderData,
    signature,
    gasLimit,
    gasPrice,
    byteCode,
    contract,
  }: {
    senderType: number
    senderData: Buffer
    signature: Buffer
    gasLimit: number
    gasPrice: number
    byteCode: Buffer
    contract: Buffer
  }): EVMContractCallBySenderScript {
    return new EVMContractCallBySenderScript([
      buildNumberChunk(senderType),
      Script.buildChunk(senderData),
      Script.buildChunk(signature),
      { code: Opcode.OP_SENDER },
      buildNumberChunk(4),
      buildNumberChunk(gasLimit),
      buildNumberChunk(gasPrice),
      Script.buildChunk(byteCode),
      Script.buildChunk(contract),
      { code: Opcode.OP_CALL },
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean {
    return (
      chunks.length === 10 &&
      chunks[3].code === Opcode.OP_SENDER &&
      parseNumberChunk(chunks[4]) === 4 &&
      chunks[9].code === Opcode.OP_CALL
    )
  }

  toString(): string {
    return [
      this.senderType,
      this.senderData?.toString('hex'),
      this.signature?.toString('hex'),
      'OP_SENDER',
      4,
      this.gasLimit,
      this.gasPrice,
      this.byteCode?.toString('hex'),
      this.contract?.toString('hex'),
      'OP_CALL',
    ].join(' ')
  }

  get type(): string {
    return TYPES.EVM_CONTRACT_CALL_SENDER
  }
}

export class ContractOutputScript
  extends OutputScript
  implements IContractOutputScript {
  public contract: Buffer | undefined

  constructor(chunks: ScriptChunk[]) {
    super(chunks)
    this.contract = chunks[4].buffer
  }

  static build(contract: Buffer): EVMContractCallBySenderScript {
    return new EVMContractCallBySenderScript([
      buildNumberChunk(0),
      buildNumberChunk(0),
      buildNumberChunk(0),
      Script.buildChunk(Buffer.alloc(1)),
      { code: 20, buffer: contract },
      { code: Opcode.OP_CALL },
    ])
  }

  static isValid(chunks: ScriptChunk[]): boolean {
    return (
      chunks.length === 6 &&
      parseNumberChunk(chunks[0]) === 0 &&
      chunks[5].code === Opcode.OP_CALL
    )
  }

  toString(): string {
    return [0, 0, 0, '00', this.contract?.toString('hex'), 'OP_CALL'].join(' ')
  }

  get type(): string {
    return TYPES.CONTRACT
  }
}

export default Object.assign(OutputScript, TYPES)
