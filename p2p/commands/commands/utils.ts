import { randomBytes } from 'crypto'

import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'

export interface Ipv6Address {
  v6: string
}

export interface AddressData {
  services: bigint
  ip: Ipv6Address
  port: number | undefined
  timestamp?: number
}

export interface Inventory {
  type: number | undefined
  data: Buffer | undefined
}

export function getNonce(): Buffer {
  return randomBytes(8)
}

export function parseIP(reader: BufferReader): Ipv6Address {
  let ipv6: (string | undefined)[] = []
  for (let i = 0; i < 8; ++i) {
    let word = reader.read(2)
    ipv6.push(word?.toString('hex'))
  }
  return { v6: ipv6.join(':') }
}

export function writeIP(writer: BufferWriter, ip: Ipv6Address) {
  for (let word of ip.v6.split(':')) {
    writer.write(Buffer.from(word, 'hex'))
  }
}

export function parseAddress(reader: BufferReader): AddressData {
  let services = reader.readUInt64LE()
  let ip = parseIP(reader)
  let port = reader.readUInt16BE()
  return { services, ip, port }
}

export function writeAddress(writer: BufferWriter, address: AddressData): void {
  if (address) {
    writer.writeUInt64LE(address.services)
    writeIP(writer, address.ip)
    writer.writeUInt16BE(address.port as number)
  } else {
    writer.write(Buffer.alloc(26))
  }
}

export function parseInventories(reader: BufferReader): Inventory[] {
  let inventories: Inventory[] = []
  let count = reader.readVarintNumber()
  if (count) {
    for (let i = 0; i < count; ++i) {
      let type = reader.readUInt32LE()
      let data = reader.read(32)
      inventories.push({ type, data })
    }
  }
  return inventories
}

export function writeInventories(
  writer: BufferWriter,
  inventories: Inventory[]
): void {
  writer.writeVarintNumber(inventories.length)
  for (let inventory of inventories) {
    if (inventory.type && inventory.data) {
      writer.writeUInt32LE(inventory.type)
      writer.write(inventory.data)
    }
  }
}