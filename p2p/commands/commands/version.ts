import BufferReader from '@/lib/encoding/buffer-reader'
import BufferWriter from '@/lib/encoding/buffer-writer'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'
import {
  AddressData,
  getNonce,
  parseAddress,
  writeAddress,
} from '@/p2p/commands/commands/utils'
import packageInfo from '@/package.json'

export interface VersionMessageOptions extends MessageOptions {
  protocolVersion?: number
  services?: bigint
  nonce?: Buffer
  timestamp?: number
  subversion?: string
  startHeight?: number
  relay?: boolean
}

export interface IVersionMessage extends IMessage {
  version: number
  services: bigint
  nonce: Buffer
  timestamp: number
  subversion: string
  startHeight: number
  relay: boolean
  myAddress: AddressData | undefined
  yourAddress: AddressData | undefined
}

class VersionMessage extends Message implements IVersionMessage {
  public version: number
  public services: bigint
  public nonce: Buffer
  public timestamp: number
  public subversion: string
  public startHeight: number
  public relay: boolean
  public myAddress: AddressData | undefined
  public yourAddress: AddressData | undefined

  constructor({
    services = BigInt(13),
    nonce = getNonce(),
    timestamp = Math.floor(Date.now() / 1000),
    subversion = `/qtuminfo:${packageInfo.version}/`,
    startHeight = 0,
    relay = true,
    ...options
  }: VersionMessageOptions) {
    super('version', options)
    this.version = options.protocolVersion || 70018
    this.nonce = nonce
    this.services = services
    this.timestamp = timestamp
    this.subversion = subversion
    this.startHeight = startHeight
    this.relay = relay
  }

  get payload(): Buffer {
    let writer = new BufferWriter()
    if (this.myAddress && this.yourAddress) {
      writer.writeUInt32LE(this.version)
      writer.writeUInt64LE(this.services)
      writer.writeUInt32LE(this.timestamp)
      writer.write(Buffer.alloc(4))
      writeAddress(writer, this.myAddress)
      writeAddress(writer, this.yourAddress)
      writer.write(this.nonce)
      writer.writeVarLengthBuffer(Buffer.from(this.subversion, 'ascii'))
      writer.writeUInt32LE(this.startHeight)
      writer.writeUInt8(Number(this.relay))
    }
    return writer.toBuffer()
  }

  set payload(payload) {
    let reader = new BufferReader(payload)
    let version = reader.readUInt32LE()
    let services = reader.readUInt64LE()
    let timestamp = reader.readUInt32LE()
    reader.read(4)
    let myAddress = parseAddress(reader)
    let yourAddress = parseAddress(reader)
    let nonce = reader.read(8)
    let subversion = reader.readVarLengthBuffer()?.toString()
    let startHeight = reader.readUInt32LE()
    if (
      version &&
      services &&
      timestamp &&
      myAddress &&
      yourAddress &&
      nonce &&
      subversion &&
      startHeight
    ) {
      this.version = version
      this.services = services
      this.timestamp = timestamp
      this.myAddress = myAddress
      this.yourAddress = yourAddress
      this.nonce = nonce
      this.subversion = subversion
      this.startHeight = startHeight
    }
    this.relay = reader.finished ? true : Boolean(reader.readUInt8())
    Message.checkFinished(reader)
  }
}

export default VersionMessage
