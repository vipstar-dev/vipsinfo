import { randomBytes } from 'crypto'

import { BufferReader, BufferWriter } from '@/lib'
import { InventoryConstructor } from '@/p2p/commands/inventory'

export interface IpAddress {
  v4?: string
  v6?: string
}

export interface AddressData {
  id?: string
  services: bigint
  ip: IpAddress
  port: number | undefined
  timestamp?: number
  retryTime?: number
}

export function getNonce(): Buffer {
  return randomBytes(8)
}

export function parseIP(reader: BufferReader): IpAddress {
  const ipv6: (string | undefined)[] = []
  for (let i = 0; i < 8; ++i) {
    const word = reader.read(2)
    ipv6.push(word?.toString('hex'))
  }
  return { v6: ipv6.join(':') }
}

export function writeIP(writer: BufferWriter, ip: IpAddress) {
  if (ip.v6) {
    for (const word of ip.v6.split(':')) {
      writer.write(Buffer.from(word, 'hex'))
    }
  }
}

export function parseAddress(reader: BufferReader): AddressData {
  const services = reader.readUInt64LE()
  const ip = parseIP(reader)
  const port = reader.readUInt16BE()
  return { services, ip, port }
}

export function writeAddress(
  writer: BufferWriter,
  address?: AddressData
): void {
  if (address) {
    writer.writeUInt64LE(address.services)
    writeIP(writer, address.ip)
    writer.writeUInt16BE(address.port as number)
  } else {
    writer.write(Buffer.alloc(26))
  }
}

export function parseInventories(reader: BufferReader): InventoryConstructor[] {
  const inventories: InventoryConstructor[] = []
  const count = reader.readVarintNumber()
  if (count) {
    for (let i = 0; i < count; ++i) {
      const type = reader.readUInt32LE()
      const data = reader.read(32)
      inventories.push({ type, data })
    }
  }
  return inventories
}

export function writeInventories(
  writer: BufferWriter,
  inventories: InventoryConstructor[]
): void {
  writer.writeVarintNumber(inventories.length)
  for (const inventory of inventories) {
    if (inventory.type && inventory.data) {
      writer.writeUInt32LE(inventory.type)
      writer.write(inventory.data)
    }
  }
}
