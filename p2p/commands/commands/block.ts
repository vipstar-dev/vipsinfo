import { Block, IBlock } from '@/lib'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'

export interface BlockMessageOptions extends MessageOptions {
  block?: IBlock
}

export interface IBlockMessage extends BlockMessageOptions, IMessage {}

class BlockMessage extends Message implements IBlockMessage {
  public block: IBlock | undefined

  constructor({ block, ...options }: BlockMessageOptions) {
    super('block', options)
    this.block = block
  }

  static fromBuffer(
    payload: Buffer,
    options: BlockMessageOptions
  ): BlockMessage {
    const message = new BlockMessage(options)
    message.payload = payload
    return message
  }

  get payload(): Buffer {
    return this.block?.toBuffer() || Buffer.alloc(0)
  }

  set payload(payload: Buffer) {
    this.block = Block.fromBuffer(payload)
  }
}

export default BlockMessage
