import path from 'path'

import Logger from '@/node/logger'
import Node, {
  ConfigFile,
  ServiceObject,
  Services,
  ServicesConfig,
} from '@/node/node'

class VipsNode {
  private readonly path: string
  private readonly config: ConfigFile
  private node: Node | undefined
  private shuttingDown: boolean = false

  constructor(options: { path: string; config: ConfigFile }) {
    this.path = options.path
    this.config = options.config
  }

  get logger(): Logger | undefined {
    return this.node?.logger
  }

  async start(): Promise<void> {
    let services: ServiceObject[] = (await this.setupServices()) || []
    this.node = new Node({
      ...this.config,
      path: path.resolve(this.path, 'vipsinfo-node.json'),
      services,
    })
    this.registerExitHandlers()
    this.node.on('ready', () =>
      this.logger?.info('VIPSTARCOIN Info Node ready.')
    )
    this.node.on('error', (err: Error) => this.logger?.error(err))
    this.node.start().catch((err: Error) => {
      this.logger?.error('Failed to start services')
      if (err.stack) {
        this.logger?.error(err.stack)
      }
      // this.cleanShutdown()
    })
  }

  async setupServices(): Promise<ServiceObject[]> {
    const services: Services[] = this.config?.services || []
    const servicesConfig: ServicesConfig = this.config?.servicesConfig || {}
    let result: ServiceObject[] = []
    for (let serviceName of services) {
      let service: ServiceObject = {
        name: serviceName,
      }
      if (servicesConfig[serviceName]) {
        service.config = servicesConfig[serviceName]
      }
      service.module = require(`@/node/services/${service.name}`).default
      result.push(service)
    }
    return result
  }

  exitHandler({ sigint }: { [key: string]: any }, err: Error): void {
    if (sigint && !this.shuttingDown) {
      this.shuttingDown = true
      this.node?.stop()
    } else if (err) {
      this.logger?.error('Uncaught exception:', err)
      if (err.stack) {
        this.logger?.error(err.stack)
      }
      this.node?.stop()
    }
  }

  registerExitHandlers(): void {
    process.on('uncaughtException', (err: Error) =>
      this.exitHandler({ exit: true }, err)
    )
    process.on('SIGINT', (err: Error) =>
      this.exitHandler({ sigint: true }, err)
    )
  }
}

export default VipsNode
