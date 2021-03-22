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

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class GasRefund extends Model<GasRefund> {
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
