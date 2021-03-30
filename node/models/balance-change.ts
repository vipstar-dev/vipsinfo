import { Optional } from 'sequelize'
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
import Transaction from '@/node/models/transaction'

export interface BalanceChangeModelAttributes {
  transactionId: bigint
  blockHeight: number
  indexInBlock: number
  addressId: number
  value: bigint
  transaction: Transaction
  address: Address
}

export interface BalanceChangeCreationAttributes
  extends Optional<BalanceChangeModelAttributes, 'transaction' | 'address'> {}

@Table({
  tableName: 'balance_change',
  freezeTableName: true,
  underscored: true,
  timestamps: false,
})
export default class BalanceChange extends Model<
  BalanceChangeModelAttributes,
  BalanceChangeCreationAttributes
> {
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
