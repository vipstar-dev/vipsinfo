import { IChain } from '@/lib'
import { sha256d } from '@/lib/crypto/hash'
import BufferReader from '@/lib/encoding/buffer-reader'
import messageList, {
  CommandNames,
  Commands,
  MessageOptionsType,
} from '@/p2p/commands/commands'
import AddrMessage from '@/p2p/commands/commands/addr'
import BlockMessage from '@/p2p/commands/commands/block'
import FeeFilterMessage from '@/p2p/commands/commands/feefilter'
import GetAddrMessage from '@/p2p/commands/commands/getaddr'
import GetBlocksMessage from '@/p2p/commands/commands/getblocks'
import GetDataMessage from '@/p2p/commands/commands/getdata'
import GetHeadersMessage from '@/p2p/commands/commands/getheaders'
import HeadersMessage from '@/p2p/commands/commands/headers'
import InvMessage from '@/p2p/commands/commands/inv'
import MempoolMessage from '@/p2p/commands/commands/mempool'
import { MessageOptions } from '@/p2p/commands/commands/message'
import PingMessage from '@/p2p/commands/commands/ping'
import PongMessage from '@/p2p/commands/commands/pong'
import RejectMessage from '@/p2p/commands/commands/reject'
import SendCmpctMessage from '@/p2p/commands/commands/sendcmpct'
import SendHeadersMessage from '@/p2p/commands/commands/sendheaders'
import TxMessage from '@/p2p/commands/commands/tx'
import VerackMessage from '@/p2p/commands/commands/verack'
import VersionMessage from '@/p2p/commands/commands/version'

const MINIMUM_LENGTH = 20
const PAYLOAD_START = 16

class Messages {
  chain: IChain
  commands: {
    [key in CommandNames]?: (args: MessageOptionsType<key>) => Commands<key>
  }

  constructor(options: MessageOptions) {
    this.chain = options.chain
    this.commands = {}
    for (const command of messageList) {
      switch (command) {
        case 'addr':
          this.commands[command] = (args: MessageOptionsType<'addr'>) => {
            return new AddrMessage({ ...args, ...options })
          }
          break
        case 'block':
          this.commands[command] = (args: MessageOptionsType<'block'>) => {
            return new BlockMessage({ ...args, ...options })
          }
          break
        case 'feefilter':
          this.commands[command] = (args: MessageOptionsType<'feefilter'>) => {
            return new FeeFilterMessage({ ...args, ...options })
          }
          break
        case 'getaddr':
          this.commands[command] = (args: MessageOptionsType<'getaddr'>) => {
            return new GetAddrMessage({ ...args, ...options })
          }
          break
        case 'getblocks':
          this.commands[command] = (args: MessageOptionsType<'getblocks'>) => {
            return new GetBlocksMessage({ ...args, ...options })
          }
          break
        case 'getdata':
          this.commands[command] = (args: MessageOptionsType<'getdata'>) => {
            return new GetDataMessage({ ...args, ...options })
          }
          break
        case 'getheaders':
          this.commands[command] = (args: MessageOptionsType<'getheaders'>) => {
            return new GetHeadersMessage({ ...args, ...options })
          }
          break
        case 'headers':
          this.commands[command] = (args: MessageOptionsType<'headers'>) => {
            return new HeadersMessage({ ...args, ...options })
          }
          break
        case 'inv':
          this.commands[command] = (args: MessageOptionsType<'inv'>) => {
            return new InvMessage({ ...args, ...options })
          }
          break
        case 'mempool':
          this.commands[command] = (args: MessageOptionsType<'mempool'>) => {
            return new MempoolMessage({ ...args, ...options })
          }
          break
        case 'ping':
          this.commands[command] = (args: MessageOptionsType<'ping'>) => {
            return new PingMessage({ ...args, ...options })
          }
          break
        case 'pong':
          this.commands[command] = (args: MessageOptionsType<'pong'>) => {
            return new PongMessage({ ...args, ...options })
          }
          break
        case 'reject':
          this.commands[command] = (args: MessageOptionsType<'reject'>) => {
            return new RejectMessage({ ...args, ...options })
          }
          break
        case 'sendcmpct':
          this.commands[command] = (args: MessageOptionsType<'sendcmpct'>) => {
            return new SendCmpctMessage({ ...args, ...options })
          }
          break
        case 'sendheaders':
          this.commands[command] = (
            args: MessageOptionsType<'sendheaders'>
          ) => {
            return new SendHeadersMessage({ ...args, ...options })
          }
          break
        case 'tx':
          this.commands[command] = (args: MessageOptionsType<'tx'>) => {
            return new TxMessage({ ...args, ...options })
          }
          break
        case 'verack':
          this.commands[command] = (args: MessageOptionsType<'verack'>) => {
            return new VerackMessage({ ...args, ...options })
          }
          break
        case 'version':
          this.commands[command] = (args: MessageOptionsType<'version'>) => {
            return new VersionMessage({ ...args, ...options })
          }
          break
      }
    }
  }

  parseBuffer(reader: BufferReader) {
    if (
      Number(reader.length) < MINIMUM_LENGTH ||
      !this._discardUntilNextMessage(reader)
    ) {
      return
    }
    const payloadLength = reader.slice(PAYLOAD_START)?.readUInt32LE(0)
    const messageLength = Number(payloadLength) + 24
    if (Number(reader.length) < messageLength) {
      return
    }
    const command: CommandNames = reader
      .slice(4, 16)
      ?.toString('ascii')
      .replace(/\0+$/, '') as CommandNames
    const checksum = reader.slice(20, 24)
    const payload = reader.slice(24, messageLength)
    reader.skip(messageLength)
    if (
      Buffer.compare(
        checksum || Buffer.alloc(0),
        sha256d(payload || Buffer.alloc(0)).slice(0, 4)
      ) === 0
    ) {
      return this._buildFromBuffer(command, payload || Buffer.alloc(0))
    }
  }

  _discardUntilNextMessage(reader: BufferReader) {
    for (let i = 0; ; ++i) {
      if (
        Buffer.compare(
          reader.slice(0, 4) || Buffer.alloc(0),
          this.chain.networkMagic
        ) === 0
      ) {
        reader.skip(i)
        return true
      } else if (i > Number(reader.length) - 4) {
        reader.skip(i)
        return false
      }
    }
  }

  _buildFromBuffer(command: CommandNames, payload: Buffer) {
    const executableCommand = this.commands[command]
    if (executableCommand !== undefined) {
      const message = executableCommand({ chain: this.chain })
      if (message) {
        message.payload = payload
        return message
      } else {
        throw new Error(`Unsupported message command: ${command}`)
      }
    }
  }
}

export default Messages
