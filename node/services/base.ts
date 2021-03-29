import EventEmitter from 'events'

import { IChain } from '@/lib/chain'
import { IBus } from '@/node/bus'
import { ILogger } from '@/node/logger'
import Node, { Services } from '@/node/node'
import { BlockAPIMethods, BlockObject } from '@/node/services/block'
import { DBAPIMethods } from '@/node/services/db'
import { HeaderAPIMethods } from '@/node/services/header'
import { P2PAPIMethods } from '@/node/services/p2p'

export interface BaseConfig {
  node: Node
  name: string
}

export interface Subscriptions {
  [key: string]: IBus[]
}

export interface APIMethods
  extends P2PAPIMethods,
    DBAPIMethods,
    HeaderAPIMethods,
    BlockAPIMethods {}

export interface IService extends EventEmitter {
  options: BaseConfig
  node: Node | undefined
  name: string | undefined
  chain: IChain | undefined
  logger: ILogger | undefined
  subscriptions: Subscriptions
  dependencies: Services[]
  APIMethods: Partial<APIMethods>
  publishEvents: Event[]
  routePrefix: any
  start(): Promise<void>
  stop(): Promise<void>
  onHeaders(): Promise<void>
  onBlock(block: BlockObject): Promise<void>
  onSynced(): Promise<void>
  onReorg(height: number): Promise<void>
  subscribe(name: string, emitter: IBus): void
  unsubscribe(name: string, emitter: IBus): void
}

export interface Event {
  name: string
  subscribe: (emitter: IBus) => void
  unsubscribe: (emitter: IBus) => void
}

class Service extends EventEmitter implements IService {
  public options: BaseConfig
  public node: Node
  public name: string
  public chain: IChain
  public logger: ILogger
  public subscriptions: Subscriptions = {}

  constructor(options: BaseConfig) {
    super()
    this.options = options
    this.node = options.node
    this.name = options.name
    this.chain = options.node.chain
    this.logger = options.node.logger
  }

  static get dependencies(): Services[] {
    return []
  }

  get dependencies(): Services[] {
    return Service.dependencies
  }

  get APIMethods(): Partial<APIMethods> {
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

  async onBlock(block: BlockObject) {}

  async onSynced() {}

  async onReorg(height: number) {}

  subscribe(name: string, emitter: IBus): void {
    const subscription = this.subscriptions[name]
    subscription.push(emitter)
    this.logger?.info(
      'Subscribe:',
      `${this.name}/${name},`,
      'total:',
      subscription.length
    )
  }

  unsubscribe(name: string, emitter: IBus): void {
    const subscription = this.subscriptions[name]
    const index = subscription.indexOf(emitter)
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
