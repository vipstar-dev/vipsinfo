import colors from 'colors/safe'

interface LoggerConstructor {
  formatting?: boolean
}

type colorTypes = 'blue' | 'red' | 'green' | 'yellow'
type levelTypes = 'info' | 'error' | 'debug' | 'warn'

export interface ILogger extends LoggerConstructor {
  formatting: boolean
  info(...args: (number | string)[]): void
  warn(...args: (number | string)[]): void
  error(...args: (number | string)[]): void
  debug(...args: (number | string)[]): void
  _log(color: colorTypes, level: levelTypes, ...args: (number | string)[]): void
}

class Logger implements ILogger {
  public formatting: boolean = true

  constructor({ formatting = true }: LoggerConstructor = {}) {
    this.formatting = formatting
  }

  info(...args: (number | string)[]): void {
    this._log('blue', 'info', ...args)
  }

  error(...args: (number | string)[]): void {
    this._log('red', 'error', ...args)
  }

  debug(...args: (number | string)[]): void {
    if (process.env.QTUMINFO_ENV === 'debug') {
      this._log('green', 'debug', ...args)
    }
  }

  warn(...args: (number | string)[]): void {
    this._log('yellow', 'warn', ...args)
  }

  _log(
    color: colorTypes,
    level: levelTypes,
    ...args: (number | string)[]
  ): void {
    if (this.formatting) {
      let date = new Date()
      let typeString = colors[color](`${level}:`)
      args.unshift(`[${date.toISOString()}]`, typeString)
    }
    console[level === 'error' ? 'error' : 'log'](...args)
  }
}

export default Logger
