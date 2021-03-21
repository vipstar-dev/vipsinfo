export interface IAsyncQueue {
  length: number
  push(data: any, callback: any): void
  process(): void
}

class AsyncQueue implements IAsyncQueue {
  private fn: Function | null = null
  private waiting: { data: any; callback: any }[] = []
  private running: boolean = false

  constructor(fn: Function) {
    this.fn = fn
  }

  get length(): number {
    return this.waiting.length
  }

  push(data: any, callback: any): void {
    this.waiting.push({ data, callback })
    if (!this.running) {
      this.process()
    }
  }

  process(): void {
    this.running = true
    let { data, callback }: any = this.waiting.pop()
    this.fn?.(data).then((data: any) => {
      callback(null, data)
      if (this.waiting.length) {
        this.process()
      } else {
        this.running = false
      }
    }, callback)
  }

  static sql(strings: string[], ...args: sqlArgs[]): string {
    let buffer: string[] = []
    for (let i = 0; i < args.length; ++i) {
      buffer.push(strings[i].replace(/\s+/g, ' '), transformSQLArg(args[i]))
    }
    buffer.push(strings[args.length].replace(/\s+/g, ' '))
    return buffer.join('')
  }
}

type sqlArgs = string | number | bigint | Buffer | any[] | Object

function transformSQLArg(arg: sqlArgs): string {
  if (typeof arg === 'string') {
    return `'${arg}'`
  } else if (['number', 'bigint'].includes(typeof arg)) {
    return arg.toString()
  } else if (Buffer.isBuffer(arg)) {
    return `X'${arg.toString('hex')}'`
  } else if (Array.isArray(arg)) {
    return arg.length === 0
      ? '(NULL)'
      : `(${arg.map(transformSQLArg).join(', ')})`
  } else if (arg && 'raw' in (arg as Object)) {
    return (arg as { raw: any; [key: string]: any }).raw
  }
  return arg.toString()
}

export default AsyncQueue
