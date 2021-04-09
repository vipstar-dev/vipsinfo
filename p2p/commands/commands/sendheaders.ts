import Message, { MessageOptions } from '@p2p/commands/commands/message'

class SendHeadersMessage extends Message {
  constructor(options: MessageOptions) {
    super('sendheaders', options)
  }

  static fromBuffer(
    payload: Buffer,
    options: MessageOptions
  ): SendHeadersMessage {
    const message = new SendHeadersMessage(options)
    message.payload = payload
    return message
  }
}

export default SendHeadersMessage
