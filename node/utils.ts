export type errCallback = (...err: (string | number | null)[]) => void

export interface IAsyncQueue<T> {
  length: number
  push(data: T, callback: errCallback): void
  process(): void
}

class AsyncQueue<T, K> implements IAsyncQueue<T> {
  private fn: ((K: T) => Promise<void>) | null = null
  private waiting: { data: T; callback: errCallback }[] = []
  private running: boolean = false

  constructor(fn: (K: T) => Promise<void>) {
    this.fn = fn
  }

  get length(): number {
    return this.waiting.length
  }

  push(data: T, callback: errCallback): void {
    this.waiting.push({ data, callback })
    if (!this.running) {
      this.process()
    }
  }

  process(): void {
    this.running = true
    const wating = this.waiting.pop()
    if (wating) {
      const { data, callback } = wating
      this.fn?.(data).then((data: any) => {
        callback(null, data)
        if (this.waiting.length) {
          this.process()
        } else {
          this.running = false
        }
      }, callback)
    }
  }
}

type sqlArgs = string | number | bigint | Buffer | any[] | Object

export function sql(strings: string[], ...args: sqlArgs[]): string {
  const buffer: string[] = []
  for (let i = 0; i < args.length; ++i) {
    buffer.push(strings[i].replace(/\s+/g, ' '), transformSQLArg(args[i]))
  }
  buffer.push(strings[args.length].replace(/\s+/g, ' '))
  return buffer.join('')
}

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
    return (arg as { raw: string; [key: string]: any }).raw
  }
  return arg.toString()
}

export default AsyncQueue
