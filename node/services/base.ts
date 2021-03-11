import Node from '~/node/node'
import { IChain } from '~/lib/chain'
import Logger from '~/node/logger'

const EventEmitter = require('events')

export interface BaseConfig {
  node?: Node
  name?: string
}

interface Subscriptions {
  [key: string]: any[]
}

interface IService {
  options: BaseConfig
  node: Node | undefined
  name: string | undefined
  chain: IChain | undefined
  logger: Logger | undefined
  subscriptions: Subscriptions
}

interface Event {
  name: string
  subscribe: () => void
  unsubscribe: () => void
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

  static get dependencies(): any[] {
    return []
  }

  get APIMethods(): any[] {
    return []
  }

  get publishEvents(): any[] | Event[] {
    if (!this.subscriptions) {
      return []
    }
    return Object.keys(this.subscriptions).map((name: string) => ({
      name: `${this.name}/${name}`,
      subscribe: this.subscribe.bind(this, name),
      unsubscribe: this.unsubscribe.bind(this, name),
    }))
  }

  get routePrefix() {
    return null
  }

  async start() {}

  async stop() {}

  async onHeaders() {}

  async onBlock() {}

  async onSynced() {}

  async onReorg() {}

  subscribe(name: string, emitter: any) {
    let subscription = this.subscriptions[name]
    subscription.push(emitter)
    this.logger?.info(
      'Subscribe:',
      `${this.name}/${name},`,
      'total:',
      subscription.length
    )
  }

  unsubscribe(name: string, emitter: any) {
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
