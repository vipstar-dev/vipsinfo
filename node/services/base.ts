import EventEmitter from 'events'

import { IChain } from '@/lib/chain'
import { IBus } from '@/node/bus'
import { ILogger } from '@/node/logger'
import Node, { Services } from '@/node/node'

export interface BaseConfig {
  node?: Node
  name?: string
}

export interface Subscriptions {
  [key: string]: IBus[]
}

export interface IService extends EventEmitter {
  options: BaseConfig
  node: Node | undefined
  name: string | undefined
  chain: IChain | undefined
  logger: ILogger | undefined
  subscriptions: Subscriptions
  APIMethods: object
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
  subscribe: (emitter: IBus) => void
  unsubscribe: (emitter: IBus) => void
}

class Service extends EventEmitter implements IService {
  public options: BaseConfig
  public node: Node | undefined
  public name: string | undefined
  public chain: IChain | undefined
  public logger: ILogger | undefined
  public subscriptions: Subscriptions = {}

  constructor(options: BaseConfig) {
    super()
    this.options = options
    this.node = options.node
    this.name = options.name
    this.chain = options.node?.chain
    this.logger = options.node?.logger
  }

  static get dependencies(): Services[] {
    return []
  }

  get APIMethods(): object {
    return {}
  }

  get publishEvents(): Event[] {
    if (!this.subscriptions) {
      return []
    }
    return Object.keys(this.subscriptions).map((name: string) => ({
      name: `${this.name}/${name}`,
      // subscribe: this.subscribe.bind(this, name),
      // unsubscribe: this.unsubscribe.bind(this, name),
      subscribe: (emitter: IBus) => {
        this.subscribe(name, emitter)
      },
      unsubscribe: (emitter: IBus) => {
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

  subscribe(name: string, emitter: IBus): void {
    let subscription = this.subscriptions[name]
    subscription.push(emitter)
    this.logger?.info(
      'Subscribe:',
      `${this.name}/${name},`,
      'total:',
      subscription.length
    )
  }

  unsubscribe(name: string, emitter: IBus): void {
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
