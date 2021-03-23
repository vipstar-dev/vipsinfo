import Message, { MessageOptions } from '@/p2p/commands/commands/message'

class MempoolMessage extends Message {
  constructor(options: MessageOptions) {
    super('mempool', options)
  }

  static fromBuffer(payload: Buffer, options: MessageOptions): MempoolMessage {
    let message = new MempoolMessage(options)
    message.payload = payload
    return message
  }
}

export default MempoolMessage
