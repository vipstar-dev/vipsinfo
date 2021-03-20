import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import Address from '@/node/models/address'
import { Transaction } from '@/node/models/transaction'

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class BalanceChange extends Model<BalanceChange> {
  @PrimaryKey
  @ForeignKey(() => Transaction)
  @Column(DataType.BIGINT.UNSIGNED)
  transactionId!: bigint

  @Column(DataType.INTEGER.UNSIGNED)
  blockHeight!: number

  @Column(DataType.BIGINT.UNSIGNED)
  indexInBlock!: number

  @PrimaryKey
  @ForeignKey(() => Address)
  @Column(DataType.INTEGER.UNSIGNED)
  addressId!: number

  @Column(DataType.BIGINT)
  value!: bigint

  @BelongsTo(() => Transaction)
  transaction!: Transaction

  @BelongsTo(() => Address)
  address!: Address
}
