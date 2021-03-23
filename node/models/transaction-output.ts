import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasOne,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import GasRefund from '@/node/models/gas-refund'
import Transaction from '@/node/models/transaction'

export interface TransactionOutputModelAttributes {
  transactionId: bigint
  outputIndex: number
  scriptPubkey: Buffer
  blockHeight: number
  value: bigint
  addressId: bigint
  isStake: boolean
  inputId: bigint
  inputIndex: number
  inputHeight: number
  transaction: Transaction
  refund: GasRefund
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class TransactionOutput extends Model<TransactionOutputModelAttributes> {
  @PrimaryKey
  @ForeignKey(() => Transaction)
  @Column(DataType.BIGINT.UNSIGNED)
  transactionId!: bigint

  @PrimaryKey
  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number

  @Column({ type: DataType.BLOB('medium'), field: 'scriptpubkey' })
  scriptPubkey!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  blockHeight!: number

  @Column(DataType.BIGINT)
  value!: bigint

  @Column(DataType.BIGINT.UNSIGNED)
  addressId!: bigint

  @Column(DataType.BOOLEAN)
  isStake!: boolean

  @Column(DataType.BIGINT.UNSIGNED)
  inputId!: bigint

  @Column(DataType.INTEGER.UNSIGNED)
  inputIndex!: number

  @AllowNull
  @Column(DataType.INTEGER.UNSIGNED)
  inputHeight!: number

  @BelongsTo(() => Transaction)
  transaction!: Transaction

  @HasOne(() => GasRefund)
  refund!: GasRefund
}
