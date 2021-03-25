import dns from 'dns'
import EventEmitter from 'events'
import { Socket } from 'net'

import { IChain } from '@/lib'
import messageList from '@/p2p/commands/commands'
import { AddressData } from '@/p2p/commands/commands/utils'
import Peer, { status as PeerStatus } from '@/p2p/peer'
import ErrnoException = NodeJS.ErrnoException

const MAX_CONNECTED_PEERS = 8
const RETRY_SECONDS = 30

export interface PoolConstructor {
  chain: IChain
  addresses?: Partial<AddressData>[]
  dnsSeed?: boolean
  maxSize?: number
}

class Pool extends EventEmitter {
  private readonly chain: IChain
  private keepAlive: boolean = false
  private connectedPeers: Map<string, Peer> = new Map()
  private addresses: AddressData[] = []
  private readonly dnsSeed: boolean = false
  private readonly maxSize: number = MAX_CONNECTED_PEERS

  constructor({
    chain,
    addresses = [],
    dnsSeed,
    maxSize = MAX_CONNECTED_PEERS,
  }: PoolConstructor) {
    super()
    this.chain = chain
    this.connectedPeers = new Map()
    this.dnsSeed = dnsSeed || this.dnsSeed
    this.maxSize = maxSize
    for (let address of addresses) {
      this.addAddress(address)
    }

    this.on('seed', (ips: string[]) => {
      for (let ip of ips) {
        this.addAddress({ ip: { v4: ip } })
      }
      if (this.keepAlive) {
        this.fillConnections()
      }
    })
    this.on('peerdisconnect', (_peer: Peer, address: AddressData) => {
      this.deprioritizeAddress(address)
      this.removeConnectedPeer(address)
      if (this.keepAlive) {
        this.fillConnections()
      }
    })
  }

  connect(): void {
    this.keepAlive = true
    if (this.dnsSeed) {
      this.addAddressesFromSeeds()
    } else {
      this.fillConnections()
    }
  }

  disconnect(): void {
    this.keepAlive = false
    for (let peer of this.connectedPeers.values()) {
      peer.disconnect()
    }
  }

  get connections(): number {
    return this.connectedPeers.size
  }

  fillConnections(): void {
    for (let address of this.addresses) {
      if (this.connections >= this.maxSize) {
        break
      }
      if (
        !address?.retryTime ||
        Math.floor(Date.now() / 1000) > address.retryTime
      ) {
        this.connectPeer(address)
      }
    }
  }

  removeConnectedPeer(address: AddressData): void {
    if (
      this.connectedPeers.get(address.id as string)?.status ===
      PeerStatus.DISCONNECTED
    ) {
      this.connectedPeers.delete(address.id as string)
    } else {
      this.connectedPeers.get(address.id as string)?.disconnect()
    }
  }

  connectPeer(address: AddressData): void {
    if (!this.connectedPeers.has(address.id as string)) {
      let port = address.port || this.chain.port
      let ip = address.ip.v4 || address.ip.v6
      let peer = new Peer({ host: ip, port, chain: this.chain })
      peer.on('connect', () => this.emit('peerconnect', peer, address))
      this.addPeerEventHandlers(peer, address)
      peer.connect()
      this.connectedPeers.set(address.id as string, peer)
    }
  }

  addConnectedPeer(socket: Socket, address: AddressData): void {
    if (!this.connectedPeers.has(address.id as string)) {
      let peer = new Peer({ socket, chain: this.chain })
      this.addPeerEventHandlers(peer, address)
      this.connectedPeers.set(address.id as string, peer)
      this.emit('peerconnect', peer, address)
    }
  }

  addPeerEventHandlers(peer: Peer, address: AddressData): void {
    peer.on('disconnect', () => this.emit('peerdisconnect', peer, address))
    peer.on('ready', () => this.emit('peerready', peer, address))
    for (let event of messageList) {
      peer.on(event, (message: AddressData) =>
        this.emit(`peer${event}`, peer, message)
      )
    }
  }

  deprioritizeAddress(address: AddressData): void {
    let index = this.addresses.findIndex(
      (item: AddressData) => item.id === address.id
    )
    if (index >= 0) {
      let [item] = this.addresses.splice(index, 1)
      item.retryTime = Math.floor(Date.now() / 1000) + RETRY_SECONDS
      this.addresses.push(item)
    }
  }

  addAddress(address: Partial<AddressData>): AddressData {
    address.port = address.port || this.chain.port
    address.id = `${address.ip?.v6 || address.ip?.v4 || ''}:${address.port}`
    if (!this.addresses.find((item: AddressData) => item.id === address.id)) {
      this.addresses.unshift(address as AddressData)
    }
    return address as AddressData
  }

  addAddressesFromSeed(seed: string) {
    dns.resolve(seed, (err: ErrnoException | null, ips: string[]) => {
      if (err) {
        this.emit('seederror', err)
      } else {
        this.emit('seed', ips)
      }
    })
  }

  addAddressesFromSeeds() {
    if (this.chain.dnsSeeds) {
      for (let seed of this.chain.dnsSeeds) {
        this.addAddressesFromSeed(seed)
      }
    }
  }
}

export default Pool
