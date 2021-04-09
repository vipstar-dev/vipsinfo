import Message, { MessageOptions } from '@p2p/commands/commands/message'

class GetAddrMessage extends Message {
  constructor(options: MessageOptions) {
    super('getaddr', options)
  }

  static fromBuffer(payload: Buffer, options: MessageOptions): GetAddrMessage {
    const message = new GetAddrMessage(options)
    message.payload = payload
    return message
  }
}

export default GetAddrMessage
