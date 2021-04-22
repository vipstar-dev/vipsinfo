import { Optional } from 'sequelize'
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import Contract from '@/node/models/contract'
import EvmReceiptLog from '@/node/models/evm-receipt-log'

export interface Qrc721ModelAttributes {
  contractAddress: Buffer
  name: string
  symbol: string
  totalSupply: bigint | null
  contract: Contract
  logs: EvmReceiptLog[]
}

export interface Qrc721CreationAttributes
  extends Optional<Qrc721ModelAttributes, 'contract' | 'logs'> {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Qrc721 extends Model<
  Qrc721ModelAttributes,
  Qrc721CreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.BLOB)
  get name(): string {
    return this.getDataValue('name').toString()
  }

  set name(name: string) {
    // @ts-ignore
    this.setDataValue('name', Buffer.from(name))
  }

  @Column(DataType.BLOB)
  get symbol(): string {
    return this.getDataValue('symbol').toString()
  }

  set symbol(symbol: string) {
    // @ts-ignore
    this.setDataValue('symbol', Buffer.from(symbol))
  }

  @Column(DataType.STRING(32).BINARY)
  get totalSupply(): bigint | null {
    const totalSupply = this.getDataValue('totalSupply')
    return totalSupply == null
      ? null // @ts-ignore
      : BigInt(`0x${totalSupply.toString('hex')}`)
  }

  set totalSupply(totalSupply: bigint | null) {
    if (totalSupply != null) {
      this.setDataValue(
        'totalSupply',
        // @ts-ignore
        Buffer.from(totalSupply.toString(16).padStart(64, '0'), 'hex')
      )
    }
  }

  @BelongsTo(() => Contract)
  contract!: Contract

  @HasMany(() => EvmReceiptLog, { sourceKey: 'contractAddress' })
  logs!: EvmReceiptLog[]
}
