import BufferWriter from '@/lib/encoding/buffer-writer'
import Script, { InvalidScriptError, IScript, ScriptChunk } from '@/lib/script'
import Opcode, { IOpcode, OpcodeReversedMap } from '@/lib/script/opcode'
import OutputScript, { IOutputScript } from '@/lib/script/output'

export type InputTypes =
  | 'UNKNOWN'
  | 'COINBASE'
  | 'PUBKEY'
  | 'PUBKEYHASH'
  | 'SCRIPTHASH'
  | 'SCRIPTHASH_WRAP_MULTISIG'
  | 'MULTISIG'
  | 'SCRIPTHASH_WRAP_WITNESS_V0_KEYHASH'
  | 'SCRIPTHASH_WRAP_WITNESS_V0_SCRIPTHASH'
  | 'SCRIPTHASH_WRAP_WITNESS_V0_SCRIPTHASH_WRAP_MULTISIG'
  | 'WITNESS_V0_KEYHASH'
  | 'WITNESS_V0_SCRIPTHASH'
  | 'CONTRACT_SPEND'

const TYPES: { [key in InputTypes]: string } = {
  UNKNOWN: 'nonstandard',
  COINBASE: 'coinbase',
  PUBKEY: 'pubkey',
  PUBKEYHASH: 'pubkeyhash',
  SCRIPTHASH: 'scripthash',
  SCRIPTHASH_WRAP_MULTISIG: 'scripthash(multisig)',
  MULTISIG: 'multisig',
  SCRIPTHASH_WRAP_WITNESS_V0_KEYHASH: 'scripthash(witness_v0_keyhash)',
  SCRIPTHASH_WRAP_WITNESS_V0_SCRIPTHASH: 'scripthash(witness_v0_scripthash)',
  SCRIPTHASH_WRAP_WITNESS_V0_SCRIPTHASH_WRAP_MULTISIG:
    'scripthash(witness_v0_scripthash(multisig))',
  WITNESS_V0_KEYHASH: 'witness_v0_keyhash',
  WITNESS_V0_SCRIPTHASH: 'witness_v0_scripthash',
  CONTRACT_SPEND: 'contract',
}

const SIGHASH_ALL = 1
const SIGHASH_NONE = 2
const SIGHASH_SINGLE = 3
const SIGHASH_ANYONECANPAY = 0x80

export interface IInputScript extends IScript {
  scriptPubKey: IOutputScript | undefined
  witness: (Buffer | undefined)[]
  type: string
  isStandard(): boolean
}

export interface ICoinbaseScript extends IInputScript {
  buffer: Buffer | undefined
  parsedChunks: ScriptChunk[] | null
}

export interface IPublicKeyInputScript extends IInputScript {
  signature: Buffer | undefined
}

export interface IPublicKeyHashInputScript extends IInputScript {
  signature: Buffer | undefined
  publicKey: Buffer | undefined
}

export interface IScriptHashInputScript extends IInputScript {
  redeemScript: IOutputScript
}

export interface IMultisigInputScript extends IInputScript {
  signatures: (Buffer | undefined)[]
}

export interface IWitnessV0KeyHashInputScript extends IInputScript {
  signature: Buffer | undefined
  publicKey: Buffer | undefined
}

export interface IWitnessV0ScriptHashInputScript extends IInputScript {
  redeemScript: IOutputScript
}

class InputScript extends Script implements IInputScript {
  public scriptPubKey: IOutputScript | undefined
  public witness: (Buffer | undefined)[]

  constructor(
    chunks: ScriptChunk[],
    scriptPubKey: IOutputScript,
    witness: Buffer[]
  ) {
    super(chunks)
    this.scriptPubKey = scriptPubKey
    this.witness = witness
  }

  static fromBuffer(
    buffer: Buffer,
    {
      scriptPubKey,
      witness = [],
      isCoinbase = false,
    }: {
      scriptPubKey: IOutputScript
      witness: Buffer[]
      isCoinbase: boolean
    }
  ): IInputScript {
    if (isCoinbase) {
      return new CoinbaseScript([{ code: -1, buffer }], scriptPubKey, witness)
    }
    const chunks = Script.parseBuffer(buffer)
    if (scriptPubKey.type === OutputScript.UNKNOWN) {
      return new InputScript(chunks, scriptPubKey, witness)
    }
    if (ScriptHashInputScript.isValid(chunks, scriptPubKey)) {
      return new ScriptHashInputScript(chunks, scriptPubKey, witness)
    }
    if (witness.length) {
      for (const Class of [
        WitnessV0KeyHashInputScript,
        WitnessV0ScriptHashInputScript,
      ]) {
        if (Class.isValid(chunks, scriptPubKey)) {
          return new Class(chunks, scriptPubKey, witness)
        }
      }
    } else {
      for (const Class of [
        PublicKeyInputScript,
        PublicKeyHashInputScript,
        MultisigInputScript,
        ContractSpendScript,
      ]) {
        if (Class.isValid(chunks, scriptPubKey)) {
          return new Class(chunks, scriptPubKey, witness)
        }
      }
    }
    return new InputScript(chunks, scriptPubKey, witness)
  }

  get type(): string {
    return TYPES.UNKNOWN
  }

  isStandard(): boolean {
    return this.type !== TYPES.UNKNOWN
  }
}

function signature2String(signature: Buffer): string {
  const sighash: number = signature[signature.length - 1]
  let sighashString: string = ''
  if (sighash & SIGHASH_ANYONECANPAY) {
    if (sighash & SIGHASH_ALL) {
      sighashString = '[ALL|ANYONECANPAY]'
    } else if (sighash & SIGHASH_NONE) {
      sighashString = '[NONE|ANYONECANPAY]'
    } else if (sighash & SIGHASH_SINGLE) {
      sighashString = '[SINGLE|ANYONECANPAY]'
    }
  } else if (sighash & SIGHASH_ALL) {
    sighashString = '[ALL]'
  } else if (sighash & SIGHASH_NONE) {
    sighashString = '[NONE]'
  } else if (sighash & SIGHASH_SINGLE) {
    sighashString = '[SINGLE]'
  }
  return signature.slice(0, -1).toString('hex') + sighashString
}

class CoinbaseScript extends InputScript implements ICoinbaseScript {
  public buffer: Buffer | undefined
  public parsedChunks: ScriptChunk[] | null = null

  constructor(
    chunks: ScriptChunk[],
    scriptPubKey: IOutputScript,
    witness: Buffer[]
  ) {
    super(chunks, scriptPubKey, witness)
    this.buffer = chunks[0].buffer
    try {
      if (this.buffer) {
        this.parsedChunks = Script.parseBuffer(this.buffer)
      }
    } catch (err) {
      if (err instanceof InvalidScriptError) {
        this.parsedChunks = null
      } else {
        throw err
      }
    }
  }

  toBufferWriter(writer: BufferWriter): void {
    writer.write(this.buffer || Buffer.alloc(0))
  }

  toString(): string {
    if (this.parsedChunks) {
      const chunks: (string | number)[] = this.parsedChunks.map(
        ({ code, buffer }) => {
          if (buffer) {
            return buffer.toString('hex')
          } else if (code in OpcodeReversedMap) {
            return OpcodeReversedMap[code]
          } else {
            return code
          }
        }
      )
      const code: IOpcode = new Opcode(this.parsedChunks[0].code)
      if (code.isSmallInt()) {
        chunks[0] = code.toSmallInt() as number
      } else if ((this.parsedChunks[0].buffer?.length || 0) <= 4) {
        chunks[0] = Number.parseInt(
          this.parsedChunks[0].buffer?.reverse().toString('hex') || '',
          16
        )
      }
      return chunks.join(' ')
    } else {
      return `${this.buffer?.toString('hex')} (invalid script)`
    }
  }

  get type(): string {
    return TYPES.COINBASE
  }
}

class PublicKeyInputScript
  extends InputScript
  implements IPublicKeyInputScript {
  public signature: Buffer | undefined

  constructor(
    chunks: ScriptChunk[],
    scriptPubKey: IOutputScript,
    witness: Buffer[]
  ) {
    super(chunks, scriptPubKey, witness)
    this.signature = chunks[0].buffer
  }

  static isValid(chunks: ScriptChunk[], scriptPubKey: IOutputScript): boolean {
    return scriptPubKey.type === OutputScript.PUBKEY
  }

  toString(): string {
    return signature2String(this.signature || Buffer.alloc(0))
  }

  get type(): string {
    return TYPES.PUBKEY
  }
}

class PublicKeyHashInputScript
  extends InputScript
  implements IPublicKeyHashInputScript {
  public signature: Buffer | undefined
  public publicKey: Buffer | undefined

  constructor(
    chunks: ScriptChunk[],
    scriptPubKey: IOutputScript,
    witness: Buffer[]
  ) {
    super(chunks, scriptPubKey, witness)
    this.signature = chunks[0].buffer
    this.publicKey = chunks[1].buffer
  }

  static isValid(chunks: ScriptChunk[], scriptPubKey: IOutputScript): boolean {
    return scriptPubKey.type === OutputScript.PUBKEYHASH
  }

  toString(): string {
    return [
      signature2String(this.signature || Buffer.alloc(0)),
      this.publicKey?.toString('hex'),
    ].join(' ')
  }

  get type(): string {
    return TYPES.PUBKEYHASH
  }
}

class ScriptHashInputScript
  extends InputScript
  implements IScriptHashInputScript {
  public redeemScript: IOutputScript

  constructor(
    chunks: ScriptChunk[],
    scriptPubKey: IOutputScript,
    witness: Buffer[]
  ) {
    super(chunks, scriptPubKey, witness)
    this.redeemScript = OutputScript.fromBuffer(
      chunks[chunks.length - 1].buffer || Buffer.alloc(0)
    )
  }

  static isValid(chunks: ScriptChunk[], scriptPubKey: IOutputScript): boolean {
    return scriptPubKey.type === OutputScript.SCRIPTHASH
  }

  toString(): string {
    const redeemString: string = `(${this.redeemScript.toString()})`
    switch (this.redeemScript.type) {
      case OutputScript.PUBKEY:
        return [
          signature2String(this.chunks[0].buffer as Buffer),
          redeemString,
        ].join(' ')
      case OutputScript.PUBKEYHASH:
        return [
          signature2String(this.chunks[0].buffer as Buffer),
          this.chunks[1].buffer?.toString('hex'),
          redeemString,
        ].join(' ')
      case OutputScript.MULTISIG:
        return [
          0,
          ...this.chunks
            .slice(1, -1)
            .map((chunk) => signature2String(chunk.buffer || Buffer.alloc(0))),
          redeemString,
        ].join(' ')
      default:
        return [
          ...this.chunks.slice(0, -1).map(({ code, buffer }) => {
            if (buffer) {
              return buffer.toString('hex')
            } else if (code in OpcodeReversedMap) {
              return OpcodeReversedMap[code]
            } else {
              return code
            }
          }),
          redeemString,
        ].join(' ')
    }
  }

  get type(): string {
    if (this.redeemScript.type === OutputScript.WITNESS_V0_SCRIPTHASH) {
      const witnessRedeemScript = OutputScript.fromBuffer(
        this.witness[this.witness.length - 1] || Buffer.alloc(0)
      )
      if (witnessRedeemScript.isStandard()) {
        return `${TYPES.SCRIPTHASH}(${TYPES.WITNESS_V0_SCRIPTHASH}(${witnessRedeemScript.type}))`
      } else {
        return `${TYPES.SCRIPTHASH}(${TYPES.WITNESS_V0_SCRIPTHASH})`
      }
    }
    if (this.redeemScript.isStandard()) {
      return `${TYPES.SCRIPTHASH}(${this.redeemScript.type})`
    } else {
      return TYPES.SCRIPTHASH
    }
  }
}

class MultisigInputScript extends InputScript implements IMultisigInputScript {
  public signatures: (Buffer | undefined)[]

  constructor(
    chunks: ScriptChunk[],
    scriptPubKey: IOutputScript,
    witness: Buffer[]
  ) {
    super(chunks, scriptPubKey, witness)
    this.signatures = chunks.slice(1).map((chunk) => chunk.buffer)
  }

  static isValid(chunks: ScriptChunk[], scriptPubKey: IOutputScript): boolean {
    return scriptPubKey.type === OutputScript.MULTISIG
  }

  toString(): string {
    return [
      0,
      ...this.signatures.map((signature) =>
        signature2String(signature || Buffer.alloc(0))
      ),
    ].join(' ')
  }

  get type(): string {
    return TYPES.MULTISIG
  }
}

class WitnessV0KeyHashInputScript
  extends InputScript
  implements IWitnessV0KeyHashInputScript {
  public signature: Buffer | undefined
  public publicKey: Buffer | undefined

  constructor(
    chunks: ScriptChunk[],
    scriptPubKey: IOutputScript,
    witness: Buffer[]
  ) {
    super(chunks, scriptPubKey, witness)
    this.signature = witness[0]
    this.publicKey = witness[1]
  }

  static isValid(chunks: ScriptChunk[], scriptPubKey: IOutputScript): boolean {
    return scriptPubKey.type === OutputScript.WITNESS_V0_KEYHASH
  }

  get type(): string {
    return TYPES.WITNESS_V0_KEYHASH
  }
}

class WitnessV0ScriptHashInputScript
  extends InputScript
  implements IWitnessV0ScriptHashInputScript {
  public redeemScript: IOutputScript

  constructor(
    chunks: ScriptChunk[],
    scriptPubKey: IOutputScript,
    witness: Buffer[]
  ) {
    super(chunks, scriptPubKey, witness)
    this.redeemScript = OutputScript.fromBuffer(witness[witness.length - 1])
  }

  static isValid(chunks: ScriptChunk[], scriptPubKey: IOutputScript): boolean {
    return scriptPubKey.type === OutputScript.WITNESS_V0_SCRIPTHASH
  }

  get type(): string {
    if (this.redeemScript.isStandard()) {
      return `${TYPES.WITNESS_V0_SCRIPTHASH}(${this.redeemScript.type})`
    } else {
      return TYPES.WITNESS_V0_SCRIPTHASH
    }
  }
}

class ContractSpendScript extends InputScript implements IInputScript {
  static isValid(chunks: ScriptChunk[], scriptPubKey: IOutputScript) {
    return (
      [
        OutputScript.EVM_CONTRACT_CALL,
        OutputScript.EVM_CONTRACT_CALL_SENDER,
        OutputScript.CONTRACT,
      ].includes(scriptPubKey.type) &&
      chunks.length === 1 &&
      chunks[0].code === Opcode.OP_SPEND
    )
  }

  get type(): string {
    return TYPES.CONTRACT_SPEND
  }
}

export default Object.assign(InputScript, TYPES)
