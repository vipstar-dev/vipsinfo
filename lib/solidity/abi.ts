import { methodID, rawEncode, rawDecode, eventID } from 'ethereumjs-abi'
import qrc20List from '@/lib/solidity/qrc20-abi.json'
import qrc721List from '@/lib/solidity/qrc721-abi.json'

export interface MethodABIsIO {
  type: string
  name: string
}

export interface EventABIsIO extends MethodABIsIO {
  indexed: boolean
}

export interface MethodABIConstructor {
  type: string
  name: string
  stateMutability: string
  inputs: MethodABIsIO[]
  outputs: MethodABIsIO[]
}

export interface IMethodABI extends MethodABIConstructor {
  id: Buffer
  encodeInputs(params: any[]): Buffer
  decodeInputs(data: Buffer): any[]
  encodeOutputs(params: any[]): Buffer
  decodeOutputs(data: Buffer): any[]
}

export interface EventABIConstructor {
  type: string
  name: string
  anonymous: boolean
  inputs: EventABIsIO[]
}

export interface IEventABI extends EventABIConstructor {
  id: Buffer
  encode(params: any[]): { data: Buffer; topics: Buffer[] }
  decode(params: { data: Buffer; topics: Buffer[] }): any[]
}

function getTypes(
  abi: IMethodABI | IEventABI | { inputs: EventABIsIO[] },
  category: 'inputs' | 'outputs'
): string[] {
  let result: string[] = []
  // @ts-ignore
  for (let item of abi[category]) {
    /* TODO: I cannot understand this code....
    if (item.type === 'tuple') {
      result.push(`(${getTypes({[category]: item.components}).join(',')})`)
    } else {
      result.push(item.type)
    } */
    result.push(item.type)
  }
  return result
}

export class MethodABI implements IMethodABI {
  public type: string
  public name: string
  public stateMutability: string
  public inputs: MethodABIsIO[]
  public outputs: MethodABIsIO[]
  private _id: Buffer | null = null

  constructor({
    type = 'function',
    name,
    stateMutability,
    inputs = [],
    outputs = [],
  }: MethodABIConstructor) {
    this.type = type
    this.name = name
    this.stateMutability = stateMutability
    this.inputs = inputs
    this.outputs = outputs
  }

  get id(): Buffer {
    this._id = this._id || methodID(this.name, getTypes(this, 'inputs'))
    return this._id
  }

  encodeInputs(params: any[]): Buffer {
    return rawEncode(getTypes(this, 'inputs'), params)
  }

  decodeInputs(data: Buffer): any[] {
    return rawDecode(getTypes(this, 'inputs'), data)
  }

  encodeOutputs(params: any[]): Buffer {
    return rawEncode(getTypes(this, 'outputs'), params)
  }

  decodeOutputs(data: Buffer): any[] {
    return rawDecode(getTypes(this, 'outputs'), data)
  }
}

export class EventABI implements IEventABI {
  public type: string
  public name: string
  public anonymous: boolean
  public inputs: EventABIsIO[]
  private _id: Buffer | null = null

  constructor({ name, anonymous = false, inputs = [] }: EventABIConstructor) {
    this.type = 'event'
    this.name = name
    this.anonymous = anonymous
    this.inputs = inputs
  }

  get id(): Buffer {
    this._id = this._id || eventID(this.name, getTypes(this, 'inputs'))
    return this._id
  }

  encode(params: any[]): { data: Buffer; topics: Buffer[] } {
    let topics: Buffer[] = []
    let unindexedInputs: EventABIsIO[] = this.inputs.filter(input => !input.indexed)
    let unindexedParams: any[] = []
    for (let index = 0; index < this.inputs.length; ++index) {
      let input = this.inputs[index]
      if (input.indexed) {
        topics.push(rawEncode(
          getTypes({inputs: [input]}, 'inputs'),
          [params[index]]
        ))
      } else {
        unindexedInputs.push(input)
        unindexedParams.push(params[index])
      }
    }
    let data = rawEncode(
      getTypes({inputs: unindexedInputs}, 'inputs'),
      unindexedParams
    )
    return {
      data,
      topics
    }
  }

  decode({ data, topics }: { data: Buffer; topics: Buffer[] }): any[] {
    let indexedInputs: EventABIsIO[] = this.inputs.filter(input => input.indexed)
    let unindexedInputs: EventABIsIO[] = this.inputs.filter(input => !input.indexed)
    let indexedParams: any[] = []
    for (let index = 0; index < topics.length; ++index) {
      let input: EventABIsIO = indexedInputs[index]
      let [param]: any[] = rawDecode(getTypes({inputs: [input]}, 'inputs'), topics[index])
      indexedParams.push(param)
    }
    let unindexedParams: any[] = rawDecode(getTypes({inputs: unindexedInputs}, 'inputs'), data)
    let params: any[] = []
    for (let index = 0, i = 0, j = 0; index < this.inputs.length; ++index) {
      let input: EventABIsIO = this.inputs[index]
      if (input.indexed) {
        params.push(indexedParams[i++])
      } else {
        params.push(unindexedParams[j++])
      }
    }
    return params
  }
}

function transformABIList(
  abiList: (MethodABIConstructor | EventABIConstructor)[]
): (IMethodABI | IEventABI | undefined)[] {
  return abiList.map((abi: MethodABIConstructor | EventABIConstructor) => {
    if (abi.type === 'function') {
      return new MethodABI(abi as MethodABIConstructor)
    } else if (abi.type === 'event') {
      return new EventABI(abi as EventABIConstructor)
    }
  })
}

export const qrc20ABIs = transformABIList(qrc20List)
export const qrc721ABIs = transformABIList(qrc721List)

Object.assign(exports, {MethodABI, EventABI, qrc20ABIs, qrc721ABIs})
