import Message, {
  IMessage,
  MessageOptions,
} from '@p2p/commands/commands/message'
import Transaction from 'vipsinfo-lib/transaction'

export interface TxMessageOptions extends MessageOptions {
  transaction?: Transaction
}

export interface ITxMessage extends TxMessageOptions, IMessage {}

class TxMessage extends Message implements ITxMessage {
  public transaction: Transaction | undefined

  constructor({ transaction, ...options }: TxMessageOptions) {
    super('tx', options)
    this.transaction = transaction
  }

  get payload(): Buffer {
    return this.transaction?.toBuffer() || Buffer.alloc(0)
  }

  set payload(payload: Buffer) {
    this.transaction = Transaction.fromBuffer(payload)
  }
}

export default TxMessage
