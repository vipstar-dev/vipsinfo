import { Optional } from 'sequelize'
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript'

import Transaction from '@/node/models/transaction'
import TransactionOutput from '@/node/models/transaction-output'

export interface GasRefundModelAttributes {
  transactionId: bigint
  outputIndex: number
  refundId: bigint
  refundIndex: number
  transaction: Transaction
  refundTo: TransactionOutput
}

export interface GasRefundCreationAttributes
  extends Optional<GasRefundModelAttributes, 'transaction' | 'refundTo'> {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class GasRefund extends Model<
  GasRefundModelAttributes,
  GasRefundCreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => Transaction)
  @Column(DataType.BIGINT.UNSIGNED)
  transactionId!: bigint

  @PrimaryKey
  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number

  @Unique('refund')
  @ForeignKey(() => TransactionOutput)
  @Column(DataType.BIGINT.UNSIGNED)
  refundId!: bigint

  @Unique('refund')
  @Column(DataType.INTEGER.UNSIGNED)
  refundIndex!: number

  @BelongsTo(() => Transaction)
  transaction!: Transaction

  @BelongsTo(() => TransactionOutput)
  refundTo!: TransactionOutput
}
