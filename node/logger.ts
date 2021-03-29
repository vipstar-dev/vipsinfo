import colors from 'colors/safe'

interface LoggerConstructor {
  formatting?: boolean
}

type colorTypes = 'blue' | 'red' | 'green' | 'yellow'
type levelTypes = 'info' | 'error' | 'debug' | 'warn'

export interface ILogger extends LoggerConstructor {
  formatting: boolean
  info(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void
  debug(...args: any[]): void
  _log(color: colorTypes, level: levelTypes, ...args: any[]): void
}

class Logger implements ILogger {
  public formatting: boolean = true

  constructor({ formatting = true }: LoggerConstructor = {}) {
    this.formatting = formatting
  }

  info(...args: any[]): void {
    this._log('blue', 'info', ...args)
  }

  error(...args: any[]): void {
    this._log('red', 'error', ...args)
  }

  debug(...args: any[]): void {
    if (process.env.QTUMINFO_ENV === 'debug') {
      this._log('green', 'debug', ...args)
    }
  }

  warn(...args: any[]): void {
    this._log('yellow', 'warn', ...args)
  }

  _log(color: colorTypes, level: levelTypes, ...args: any[]): void {
    if (this.formatting) {
      const date = new Date()
      const typeString = colors[color](`${level}:`)
      args.unshift(`[${date.toISOString()}]`, typeString)
    }
    console[level === 'error' ? 'error' : 'log'](...args)
  }
}

export default Logger
