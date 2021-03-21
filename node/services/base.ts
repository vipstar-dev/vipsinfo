import { IChain } from '@/lib/chain'
import Logger from '@/node/logger'
import Node, { Services } from '@/node/node'

const EventEmitter = require('events')

export interface BaseConfig {
  node?: Node
  name?: string
}

export interface Subscriptions {
  [key: string]: any[]
}

export interface IService {
  options: BaseConfig
  node: Node | undefined
  name: string | undefined
  chain: IChain | undefined
  logger: Logger | undefined
  subscriptions: Subscriptions
  APIMethods: any[]
  publishEvents: Event[]
  routePrefix: any
  start(): void
  stop(): void
  onHeaders(): void
  onBlock(): void
  onSynced(): void
  onReorg(): void
  subscribe(name: string, emitter: any): void
  unsubscribe(name: string, emitter: any): void
}

export interface Event {
  name: string
  subscribe: (emitter: any) => void
  unsubscribe: (emitter: any) => void
}

class Service extends EventEmitter implements IService {
  options: BaseConfig
  node: Node | undefined
  name: string | undefined
  chain: IChain | undefined
  logger: Logger | undefined
  subscriptions: Subscriptions

  constructor(options: BaseConfig) {
    super()
    this.options = options
    this.node = options.node
    this.name = options.name
    this.chain = options.node?.chain
    this.logger = options.node?.logger
    this.subscriptions = {}
  }

  static get dependencies(): Services[] {
    return []
  }

  get APIMethods(): any[] {
    return []
  }

  get publishEvents(): Event[] {
    if (!this.subscriptions) {
      return []
    }
    return Object.keys(this.subscriptions).map((name: string) => ({
      name: `${this.name}/${name}`,
      // subscribe: this.subscribe.bind(this, name),
      // unsubscribe: this.unsubscribe.bind(this, name),
      subscribe: (emitter: any) => {
        this.subscribe(name, emitter)
      },
      unsubscribe: (emitter: any) => {
        this.unsubscribe(name, emitter)
      },
    }))
  }

  get routePrefix(): any {
    return null
  }

  async start() {}

  async stop() {}

  async onHeaders() {}

  async onBlock() {}

  async onSynced() {}

  async onReorg() {}

  subscribe(name: string, emitter: any): void {
    let subscription = this.subscriptions[name]
    subscription.push(emitter)
    this.logger?.info(
      'Subscribe:',
      `${this.name}/${name},`,
      'total:',
      subscription.length
    )
  }

  unsubscribe(name: string, emitter: any): void {
    let subscription = this.subscriptions[name]
    let index = subscription.indexOf(emitter)
    if (index >= 0) {
      subscription.splice(index, 1)
      this.logger?.info(
        'Unsubscribe:',
        `${this.name}/${name},`,
        'total:',
        subscription.length
      )
    }
  }
}

export default Service
