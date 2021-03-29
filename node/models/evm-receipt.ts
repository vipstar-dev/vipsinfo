import { Optional } from 'sequelize'
import {
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript'

import { addressTypeMap, addressTypes } from '@/node/models/address'
import EvmReceiptLog from '@/node/models/evm-receipt-log'
import Transaction from '@/node/models/transaction'

export interface EvmReceiptModelAttributes {
  _id: bigint
  transactionId: bigint
  outputIndex: number
  blockHeight: number
  indexInBlock: number
  senderType: string | null
  senderData: Buffer
  gasUsed: number
  contractAddress: Buffer
  excepted: string
  exceptedMessage: string
  transaction: Transaction
  logs: EvmReceiptLog[]
}

export interface EvmReceiptCreationAttributes
  extends Optional<EvmReceiptModelAttributes, '_id' | 'transaction' | 'logs'> {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class EvmReceipt extends Model<
  EvmReceiptModelAttributes,
  EvmReceiptCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, field: '_id' })
  _id!: bigint

  @ForeignKey(() => Transaction)
  @Unique('transaction')
  @Column(DataType.BIGINT.UNSIGNED)
  transactionId!: bigint

  @Unique('transaction')
  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number

  @Column(DataType.INTEGER.UNSIGNED)
  blockHeight!: number

  @Column(DataType.INTEGER.UNSIGNED)
  indexInBlock!: number

  @Column(DataType.INTEGER.UNSIGNED)
  get senderType(): string | null {
    const senderType = this.getDataValue('senderType')
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return addressTypeMap[senderType] || null
  }

  set senderType(senderType: string | null) {
    if (senderType != null) {
      // @ts-ignore
      this.setDataValue('senderType', addressTypes[senderType] || 0)
    }
  }

  @Column(DataType.STRING(32).BINARY)
  senderData!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  gasUsed!: number

  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.STRING(32))
  excepted!: string

  @Column(DataType.TEXT)
  exceptedMessage!: string

  @BelongsTo(() => Transaction)
  transaction!: Transaction

  @HasMany(() => EvmReceiptLog)
  logs!: EvmReceiptLog[]
}
