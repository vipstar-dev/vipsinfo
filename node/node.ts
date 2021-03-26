import assert from 'assert'
import EventEmitter from 'events'

import Chain, { chainType, IChain } from '@/lib/chain'
import Bus, { IBus } from '@/node/bus'
import Logger, { ILogger } from '@/node/logger'
import Base, { BaseConfig, Event, IService } from '@/node/services/base'
import { DBAPIMethods, DbConfig } from '@/node/services/db'
import { P2PAPIMethods, P2pConfig } from '@/node/services/p2p'
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

type ServiceConfigType = BaseConfig | DbConfig | P2pConfig | ServerConfig

export interface ServiceObject {
  name: Services
  config: ServiceConfigType
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

interface AddedMethods extends P2PAPIMethods, DBAPIMethods {}

class Node extends EventEmitter {
  private readonly configPath: string
  public logger: ILogger
  public chain: IChain
  public unloadedServices: ServiceObject[]
  public services: Map<Services, IService>
  public stopping: boolean = false
  public addedMethods: Partial<AddedMethods> = {}

  constructor(config: NodeConfig) {
    super()
    this.configPath = config.path
    this.logger = new Logger({ formatting: config.formatLogs })
    this.chain = Chain.get(config.chain)
    this.unloadedServices = config.services || []
    this.services = new Map()
  }

  openBus(): IBus {
    return new Bus({ node: this })
  }

  getAllAPIMethods(): object {
    let methods = {}
    for (let service of this.services.values()) {
      Object.assign(methods, service.APIMethods)
    }
    return methods
  }

  getAllPublishEvents(): Event[] {
    let events: Event[] = []
    for (let service of this.services.values()) {
      events.push(...service.publishEvents)
    }
    return events
  }

  static getServiceOrder(services: ServiceObject[]): ServiceObject[] {
    let names: Services[] = []
    let servicesByName: ServiceObjectByName = {}
    for (let service of services) {
      names.push(service.name)
      servicesByName[service.name] = service
    }
    let stack: ServiceObject[] = []
    let stackNames: Set<Services> = new Set()
    function addToStack(names: Services[]): void {
      for (let name of names) {
        let service: ServiceObject | undefined = servicesByName[name]
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
    let names: Services[] = []
    let servicesByName: ServiceByName = {}
    for (let [name, service] of this.services) {
      names.push(name)
      servicesByName[name] = service
    }
    let stack: IService[] = []
    let stackNames: Set<Services> = new Set()
    function addToStack(names: Services[]) {
      for (let name of names) {
        let service: IService | undefined = servicesByName[name]
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
      let config: ServiceConfigType = serviceInfo.config || {}
      config.node = this
      config.name = serviceInfo.name
      let service: IService = new serviceInfo.module(config)
      this.services.set(serviceInfo.name, service)
      await service.start()
      let methodNames = new Set()
      for (let [name, method] of Object.entries(service.APIMethods)) {
        assert(!methodNames.has(name), `API method name conflicts: ${name}`)
        methodNames.add(name)
        this.addedMethods[name as keyof AddedMethods] = method
        // this[name] = method
      }
    }
  }

  async start(): Promise<void> {
    this.logger.info('Using config:', this.configPath)
    this.logger.info('Using chain:', this.chain?.name)
    for (let service of Node.getServiceOrder(this.unloadedServices)) {
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
      let services = Node.getServiceOrder(this.unloadedServices).reverse()
      this.stopping = true
      this.emit('stopping')
      for (let service of services) {
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
