import http from 'http'
import https from 'https'

const cl = (...args: (string | number | undefined)[]) => console.log(...args)
function noop() {}

type loggersConfig = 'none' | 'normal' | 'debug'
type loggerPattern = 'info' | 'warn' | 'error' | 'debug'

type loggerObject = {
  [key in loggerPattern]: (...args: (string | number | undefined)[]) => void
}

const loggers: {
  [key in loggersConfig]: loggerObject
} = {
  none: { info: noop, warn: noop, error: noop, debug: noop },
  normal: { info: cl, warn: cl, error: cl, debug: noop },
  debug: { info: cl, warn: cl, error: cl, debug: cl },
}

const config: { logger: loggersConfig; log?: loggerObject } = {
  logger: 'normal',
}

export interface RpcClientConfig {
  host?: string
  port?: number
  user?: string
  password?: string
  protocol?: string
  disableAgent?: boolean
}

export interface QtumPpcRequest {
  jsonrpc?: string
  method: string
  params: (string | number | boolean | object)[]
  id: number
}

export interface QtumPpcResponse {
  result?: object
  error?: string
}

interface rpcMethods {
  callcontract: (
    ...args: {
      toString: () => string
    }[]
  ) => Promise<object | string | number | undefined> | void
  estimatesmartfee: (
    ...args: string[]
  ) => Promise<object | string | number | undefined> | void
  getcontractcode: (
    ...args: {
      toString: () => string
    }[]
  ) => Promise<object | string | number | undefined> | void
  getdgpinfo: (
    ...args: {
      toString: () => string
    }[]
  ) => Promise<object | string | number | undefined> | void
  getstorage: (
    ...args: {
      toString: () => string
    }[]
  ) => Promise<object | string | number | undefined> | void
  gettransactionreceipt: (args: {
    toString: () => string
  }) => Promise<object | string | number | undefined> | void
  listcontracts: (
    ...args: string[]
  ) => Promise<object | string | number | undefined> | void
  sendrawtransaction: (
    ...args: {
      toString: () => string
    }[]
  ) => Promise<object | string | number | undefined> | void
}

export type callTypes = 'str' | 'int' | 'float' | 'bool' | 'obj'

type strConvert = (arg: { toString: () => string }) => string
type intConvert = (arg: string) => number
type floatConvert = (arg: string) => number
type boolConvert = (arg: string | number | boolean) => boolean
type objConvert = (arg: string | object) => object

export type typeConvertFunctions =
  | strConvert
  | intConvert
  | floatConvert
  | boolConvert
  | objConvert

export interface typeConvert {
  str: strConvert
  int: intConvert
  float: floatConvert
  bool: boolConvert
  obj: objConvert
}

export type callspecTypes =
  | 'callcontract'
  | 'estimatesmartfee'
  | 'getcontractcode'
  | 'getdgpinfo'
  | 'getstorage'
  | 'gettransactionreceipt'
  | 'listcontracts'
  | 'sendrawtransaction'

class RpcClient {
  private readonly host: string = '127.0.0.1'
  private readonly port: number = 3889
  private user: string = 'user'
  private password: string = 'password'
  private protocol: typeof http | typeof https | null = null
  public batchedCalls: QtumPpcRequest[] | null = null
  private readonly disableAgent: boolean = false
  private readonly log: loggerObject | null = null
  public rejectUnauthorized: undefined
  public httpOptions: object = {}
  public rpcMethods: Partial<rpcMethods> = {}

  constructor({
    host = '127.0.0.1',
    port = 3889,
    user = 'user',
    password = 'password',
    protocol = 'http',
    disableAgent = false,
  }: RpcClientConfig = {}) {
    this.host = host
    this.port = port
    this.user = user
    this.password = password
    this.protocol = protocol === 'http' ? http : https
    this.disableAgent = disableAgent
    this.log = config.log || loggers[config.logger || 'normal']
    this.generateRPCMethods()
  }

  rpc(
    _request: QtumPpcRequest | QtumPpcRequest[]
  ):
    | Promise<object | string | number | undefined>
    | Promise<object | string | number | undefined>[] {
    let request: string = JSON.stringify(_request)
    let auth: string = Buffer.from(`${this.user}:${this.password}`).toString(
      'base64'
    )
    let options = {
      host: this.host,
      port: this.port,
      method: 'POST',
      path: '/',
      rejectUnauthorized: this.rejectUnauthorized,
      agent: this.disableAgent ? false : undefined,
    }
    if (this.httpOptions) {
      Object.assign(options, this.httpOptions)
    }

    return new Promise((resolve, reject) => {
      let req = this.protocol?.request(options, (res) => {
        let buffer: Buffer[] = []
        res.on('data', (data: Buffer) => buffer.push(data))
        res.on('end', () => {
          if (res.statusCode === 401) {
            reject(
              new Error(`Qtum JSON-RPC: Connection Rejected: 401 Unauthorized`)
            )
          } else if (res.statusCode === 403) {
            reject(
              new Error(`Qtum JSON-RPC: Connection Rejected: 403 Forbidden`)
            )
          } else if (
            res.statusCode === 500 &&
            buffer.toString() === 'Work queue depth exceeded'
          ) {
            let exceededError = new Error(`Qtum JSON-RPC: ${buffer}`)
            // exceededError.code = 429
            reject(exceededError)
          } else {
            try {
              let parsedBuffer:
                | QtumPpcResponse
                | QtumPpcResponse[] = JSON.parse(
                Buffer.concat(buffer).toString()
              )
              if (Array.isArray(parsedBuffer)) {
                parsedBuffer.map((result: QtumPpcResponse) => {
                  if (result.error) {
                    return Promise.reject(result.error)
                  } else {
                    return Promise.resolve(result.result)
                  }
                })
              } else if (parsedBuffer.error) {
                reject(parsedBuffer.error)
              } else {
                resolve(parsedBuffer.result)
              }
            } catch (err) {
              if (this.log) {
                this.log.error(err.stack)
                this.log.error(buffer.toString())
                this.log.error(`HTTP Status code: ${res.statusCode}`)
              }
              reject(
                new Error(`Qtum JSON-RPC: Error Parsing JSON: ${err.message}`)
              )
            }
          }
        })
      })
      if (req) {
        req.on('error', (err) =>
          reject(new Error(`Qtum JSON-RPC: Request Error: ${err.message}`))
        )
        req.setHeader('Content-Length', request.length)
        req.setHeader('Content-Type', 'application/json')
        req.setHeader('Authorization', `Basic ${auth}`)
        req.write(request)
        req.end()
      }
    })
  }

  async batch(batchCallback: Function) {
    this.batchedCalls = []
    batchCallback()
    try {
      return await this.rpc(this.batchedCalls)
    } finally {
      this.batchedCalls = null
    }
  }

  generateRPCMethods() {
    let self = this
    function createRPCMethod(
      methodName: string,
      baseArgs: callTypes[]
    ): (
      ...args: (string | { toString: () => string })[]
    ) => Promise<object | string | number | undefined> | void {
      let fixedArgs: (string | number | boolean | object)[] = []
      return function (...args: { toString: () => string }[] | string[]) {
        if (baseArgs === ['int', 'int'] || baseArgs === ['int']) {
          for (let i = 0; i < args.length; i++) {
            fixedArgs[i] = types.int(args[i] as string)
          }
        } else {
          for (let i = 0; i < args.length; i++) {
            fixedArgs[i] = types.str(args[i] as { toString: () => string })
          }
        }
        if (self.batchedCalls) {
          self.batchedCalls.push({
            jsonrpc: '2.0',
            method: methodName,
            params: fixedArgs,
            id: getRandomId(),
          })
        } else {
          return self.rpc({
            method: methodName,
            params: fixedArgs,
            id: getRandomId(),
          }) as Promise<object | string | number | undefined>
        }
      }
    }

    let types: typeConvert = {
      str: (arg: { toString: () => string }) => arg.toString(),
      int: (arg: string) => Number.parseFloat(arg),
      float: (arg: string) => Number.parseFloat(arg),
      bool: (arg: string | number | boolean) =>
        [true, 1, '1'].includes(arg) || arg.toString().toLowerCase() === 'true',
      obj: (arg: any) => (typeof arg === 'string' ? JSON.parse(arg) : arg),
    }

    for (let [key, value] of Object.entries(callspec)) {
      let spec: callTypes[] = value.split(' ') as callTypes[]
      self.rpcMethods[key as callspecTypes] = createRPCMethod(key, spec)
    }
  }
}

const callspec: { [key in callspecTypes]: string } = {
  callcontract: 'str',
  estimatesmartfee: 'int',
  getcontractcode: 'str',
  getdgpinfo: 'str',
  getstorage: 'str',
  gettransactionreceipt: 'str',
  listcontracts: 'int int',
  sendrawtransaction: 'str',
}

function getRandomId(): number {
  return Math.floor(Math.random() * 100000)
}

export default RpcClient
