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
import PingMessage from '@/p2p/commands/commands/ping'
import PongMessage from '@/p2p/commands/commands/pong'
import RejectMessage from '@/p2p/commands/commands/reject'
import SendCmpctMessage from '@/p2p/commands/commands/sendcmpct'
import SendHeadersMessage from '@/p2p/commands/commands/sendheaders'
import TxMessage from '@/p2p/commands/commands/tx'
import VerackMessage from '@/p2p/commands/commands/verack'
import VersionMessage from '@/p2p/commands/commands/version'

export default {
  addr: AddrMessage,
  block: BlockMessage,
  feefilter: FeeFilterMessage,
  getaddr: GetAddrMessage,
  getblocks: GetBlocksMessage,
  getdata: GetDataMessage,
  getheaders: GetHeadersMessage,
  headers: HeadersMessage,
  inv: InvMessage,
  mempool: MempoolMessage,
  ping: PingMessage,
  pong: PongMessage,
  reject: RejectMessage,
  sendcmpct: SendCmpctMessage,
  sendheaders: SendHeadersMessage,
  tx: TxMessage,
  verack: VerackMessage,
  version: VersionMessage,
}
