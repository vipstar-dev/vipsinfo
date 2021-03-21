import EventEmitter from 'events'

import Node from '@/node/node'

export interface BusConstructor {
  node: Node
}

export interface IBus {
  subscribe(name: string, ...args: string[]): void
  unsubscribe(name: string, ...args: string[]): void
  close(): void
}

class Bus extends EventEmitter implements IBus {
  private readonly node: Node | null = null

  constructor({ node }: BusConstructor) {
    super()
    this.node = node
  }

  subscribe(name: string, ...args: string[]): void {
    if (this.node) {
      for (let service of this.node.services.values()) {
        for (let event of service.publishEvents) {
          if (name === event.name) {
            event.subscribe(this, ...args)
          }
        }
      }
    }
  }

  unsubscribe(name: string, ...args: string[]): void {
    if (this.node) {
      for (let service of this.node.services.values()) {
        for (let event of service.publishEvents) {
          if (name === event.name) {
            event.unsubscribe(this, ...args)
          }
        }
      }
    }
  }

  close(): void {
    if (this.node) {
      for (let service of this.node.services.values()) {
        for (let event of service.publishEvents) {
          event.unsubscribe(this)
        }
      }
    }
  }
}

export default Bus
