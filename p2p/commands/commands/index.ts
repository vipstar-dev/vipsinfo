import AddrMessage, { AddrMessageOptions } from '@/p2p/commands/commands/addr'
import BlockMessage, {
  BlockMessageOptions,
} from '@/p2p/commands/commands/block'
import FeeFilterMessage, {
  FeeFilterMessageOptions,
} from '@/p2p/commands/commands/feefilter'
import GetAddrMessage from '@/p2p/commands/commands/getaddr'
import GetBlocksMessage, {
  GetBlocksMessageOptions,
} from '@/p2p/commands/commands/getblocks'
import GetDataMessage, {
  GetDataMessageOptions,
} from '@/p2p/commands/commands/getdata'
import GetHeadersMessage, {
  GetHeadersMessageOptions,
} from '@/p2p/commands/commands/getheaders'
import HeadersMessage, {
  HeadersMessageOptions,
} from '@/p2p/commands/commands/headers'
import InvMessage, { InvMessageOptions } from '@/p2p/commands/commands/inv'
import MempoolMessage from '@/p2p/commands/commands/mempool'
import { MessageOptions } from '@/p2p/commands/commands/message'
import PingMessage, { PingMessageOptions } from '@/p2p/commands/commands/ping'
import PongMessage, { PongMessageOptions } from '@/p2p/commands/commands/pong'
import RejectMessage, {
  RejectMessageOptions,
} from '@/p2p/commands/commands/reject'
import SendCmpctMessage from '@/p2p/commands/commands/sendcmpct'
import SendHeadersMessage from '@/p2p/commands/commands/sendheaders'
import TxMessage, { TxMessageOptions } from '@/p2p/commands/commands/tx'
import VerackMessage from '@/p2p/commands/commands/verack'
import VersionMessage, {
  VersionMessageOptions,
} from '@/p2p/commands/commands/version'

export type CommandNames =
  | 'addr'
  | 'block'
  | 'feefilter'
  | 'getaddr'
  | 'getblocks'
  | 'getdata'
  | 'getheaders'
  | 'headers'
  | 'inv'
  | 'mempool'
  | 'ping'
  | 'pong'
  | 'reject'
  | 'sendcmpct'
  | 'sendheaders'
  | 'tx'
  | 'verack'
  | 'version'

export type CommandsTypes =
  | typeof AddrMessage
  | typeof BlockMessage
  | typeof FeeFilterMessage
  | typeof GetAddrMessage
  | typeof GetBlocksMessage
  | typeof GetDataMessage
  | typeof GetHeadersMessage
  | typeof HeadersMessage
  | typeof InvMessage
  | typeof MempoolMessage
  | typeof PingMessage
  | typeof PongMessage
  | typeof RejectMessage
  | typeof SendCmpctMessage
  | typeof SendHeadersMessage
  | typeof TxMessage
  | typeof VerackMessage
  | typeof VersionMessage

export type Commands<command extends CommandNames> = command extends 'addr'
  ? AddrMessage
  : command extends 'block'
  ? BlockMessage
  : command extends 'feefilter'
  ? FeeFilterMessage
  : command extends 'getaddr'
  ? GetAddrMessage
  : command extends 'getblocks'
  ? GetBlocksMessage
  : command extends 'getdata'
  ? GetDataMessage
  : command extends 'getheaders'
  ? GetHeadersMessage
  : command extends 'headers'
  ? HeadersMessage
  : command extends 'inv'
  ? InvMessage
  : command extends 'mempool'
  ? MempoolMessage
  : command extends 'ping'
  ? PingMessage
  : command extends 'pong'
  ? PongMessage
  : command extends 'reject'
  ? RejectMessage
  : command extends 'sendcmpct'
  ? SendCmpctMessage
  : command extends 'sendheaders'
  ? SendHeadersMessage
  : command extends 'tx'
  ? TxMessage
  : command extends 'verack'
  ? VerackMessage
  : VersionMessage

export type MessageOptionsType<
  command extends CommandNames
> = command extends 'addr'
  ? AddrMessageOptions
  : command extends 'block'
  ? BlockMessageOptions
  : command extends 'feefilter'
  ? FeeFilterMessageOptions
  : command extends 'getblocks'
  ? GetBlocksMessageOptions
  : command extends 'getdata'
  ? GetDataMessageOptions
  : command extends 'getheaders'
  ? GetHeadersMessageOptions
  : command extends 'headers'
  ? HeadersMessageOptions
  : command extends 'inv'
  ? InvMessageOptions
  : command extends 'ping'
  ? PingMessageOptions
  : command extends 'pong'
  ? PongMessageOptions
  : command extends 'reject'
  ? RejectMessageOptions
  : command extends 'tx'
  ? TxMessageOptions
  : command extends 'version'
  ? VersionMessageOptions
  : MessageOptions

export type MessageOptionsTypes =
  | AddrMessageOptions
  | BlockMessageOptions
  | FeeFilterMessageOptions
  | GetBlocksMessageOptions
  | GetDataMessageOptions
  | GetHeadersMessageOptions
  | HeadersMessageOptions
  | InvMessageOptions
  | MessageOptions
  | PingMessageOptions
  | PongMessageOptions
  | RejectMessageOptions
  | TxMessageOptions
  | VersionMessageOptions

const messageList: CommandNames[] = [
  'addr',
  'block',
  'feefilter',
  'getaddr',
  'getblocks',
  'getdata',
  'getheaders',
  'headers',
  'inv',
  'mempool',
  'ping',
  'pong',
  'reject',
  'sendcmpct',
  'sendheaders',
  'tx',
  'verack',
  'version',
]

export default messageList
