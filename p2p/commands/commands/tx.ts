import Transaction from '@/lib/transaction'
import Message, {
  IMessage,
  MessageOptions,
} from '@/p2p/commands/commands/message'

export interface TxMessageOptions extends MessageOptions {
  transaction: Transaction
}

export interface ITxMessage extends TxMessageOptions, IMessage {}

class TxMessage extends Message implements ITxMessage {
  public transaction: Transaction

  constructor({ transaction, ...options }: TxMessageOptions) {
    super('tx', options)
    this.transaction = transaction
  }

  get payload(): Buffer {
    return this.transaction.toBuffer()
  }

  set payload(payload: Buffer) {
    this.transaction = Transaction.fromBuffer(payload)
  }
}

export default TxMessage
