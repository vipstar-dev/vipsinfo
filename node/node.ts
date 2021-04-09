import assert from 'assert'
import EventEmitter from 'events'
import { Optional } from 'sequelize'

import { Chain, chainType, IChain } from '@/lib'
import Bus, { IBus } from '@/node/bus'
import Logger, { ILogger } from '@/node/logger'
import Base, {
  APIMethods,
  BaseConfig,
  Event,
  IService,
} from '@/node/services/base'
import { DbConfig } from '@/node/services/db'
import { P2pConfig } from '@/node/services/p2p'
import { ServerConfig } from '@/node/services/server'

export type Services =
  | 'db'
  | 'p2p'
  | 'header'
  | 'block'
  | 'transaction'
  | 'contract'
  | 'mempool'
  | 'server'

type ServiceConfigType = Optional<
  BaseConfig | DbConfig | P2pConfig | ServerConfig,
  'name' | 'node'
>

export interface ServiceObject {
  name: Services
  config?: ServiceConfigType
  module?: typeof Base
}

type ServicesConfigBase = {
  [key in Services]?: BaseConfig
}

export type ServicesConfig = ServicesConfigBase & {
  db?: DbConfig
  p2p?: P2pConfig
  server?: ServerConfig
}

export type ServiceByName = { [key in Services]?: IService }
export type ServiceObjectByName = { [key in Services]?: ServiceObject }

export interface ConfigFile {
  version: string
  chain: chainType
  services: Services[]
  servicesConfig: ServicesConfig
  formatLogs: boolean
}

interface ServiceAnyConfig extends ConfigFile {
  services: any[]
}

interface NodeConfig extends ServiceAnyConfig {
  services: ServiceObject[]
  path: string
}

class Node extends EventEmitter {
  private readonly configPath: string
  public logger: ILogger
  public chain: IChain
  public unloadedServices: ServiceObject[]
  public services: Map<Services, IService>
  public stopping: boolean = false
  public addedMethods: Partial<APIMethods> = {}

  constructor(config: NodeConfig) {
    super()
    this.configPath = config.path
    this.logger = new Logger({ formatting: config.formatLogs })
    this.chain = Chain.get(config.chain)
    this.unloadedServices = config.services || []
    this.services = new Map<Services, IService>()
  }

  openBus(): IBus {
    return new Bus({ node: this })
  }

  getAllAPIMethods(): object {
    const methods = {}
    for (const service of this.services.values()) {
      Object.assign(methods, service.APIMethods)
    }
    return methods
  }

  getAllPublishEvents(): Event[] {
    const events: Event[] = []
    for (const service of this.services.values()) {
      events.push(...service.publishEvents)
    }
    return events
  }

  static getServiceOrder(services: ServiceObject[]): ServiceObject[] {
    const names: Services[] = []
    const servicesByName: ServiceObjectByName = {}
    for (const service of services) {
      names.push(service.name)
      servicesByName[service.name] = service
    }
    const stack: ServiceObject[] = []
    const stackNames: Set<Services> = new Set()
    function addToStack(names: Services[]): void {
      for (const name of names) {
        const service: ServiceObject | undefined = servicesByName[name]
        if (service) {
          addToStack(service.module?.dependencies || [])
          if (!stackNames.has(name)) {
            stack.push(service)
            stackNames.add(name)
          }
        }
      }
    }
    addToStack(names)
    return stack
  }

  getServicesByOrder(): IService[] {
    const names: Services[] = []
    const servicesByName: ServiceByName = {}
    for (const [name, service] of this.services) {
      names.push(name)
      servicesByName[name] = service
    }
    const stack: IService[] = []
    const stackNames: Set<Services> = new Set()
    function addToStack(names: Services[]) {
      for (const name of names) {
        const service: IService | undefined = servicesByName[name]
        if (service) {
          addToStack(service.dependencies)
          if (!stackNames.has(name)) {
            stack.push(service)
            stackNames.add(name)
          }
        }
      }
    }
    addToStack(names)
    return stack
  }

  async startService(serviceInfo: ServiceObject) {
    if (serviceInfo.module) {
      this.logger.info('Starting', serviceInfo.name)
      const config: Required<ServiceConfigType> = Object.assign(
        serviceInfo.config || {},
        {
          node: this,
          name: serviceInfo.name,
        } as BaseConfig
      )
      const service: IService = new serviceInfo.module(config)
      this.services.set(serviceInfo.name, service)
      await service.start()
      const methodNames = new Set<string>()
      for (const name of Object.keys(service.APIMethods)) {
        const has: boolean = methodNames.has(name)
        assert(!has, `API method name conflicts: ${name}`)
        if (has) {
          methodNames.add(name)
          // this[name] = method
        }
      }
      Object.assign(this.addedMethods, service.APIMethods)
    }
  }

  async start(): Promise<void> {
    this.logger.info('Using config:', this.configPath)
    this.logger.info('Using chain:', this.chain?.name)
    for (const service of Node.getServiceOrder(this.unloadedServices)) {
      await this.startService(service)
    }
    this.emit('ready')
  }

  async stop() {
    if (this.stopping) {
      return
    }
    try {
      this.logger.info('Beginning shutdown')
      const services = Node.getServiceOrder(this.unloadedServices).reverse()
      this.stopping = true
      this.emit('stopping')
      for (const service of services) {
        if (this.services.has(service.name)) {
          this.logger.info('Stopping', service.name)
          await this.services.get(service.name)?.stop()
        } else {
          this.logger.info('Stopping', service.name, '(not started)')
        }
      }
      this.logger.info('Halted')
      process.exit(0)
    } catch (err) {
      this.logger.error('Failed to stop services:', err)
      process.exit(1)
    }
  }
}

export default Node
