import Message, { MessageOptions } from '@p2p/commands/commands/message'

class VerackMessage extends Message {
  constructor(options: MessageOptions) {
    super('verack', options)
  }

  static fromBuffer(payload: Buffer, options: MessageOptions): VerackMessage {
    const message = new VerackMessage(options)
    message.payload = payload
    return message
  }
}

export default VerackMessage
