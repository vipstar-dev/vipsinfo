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
import Header from '@/node/models/header'
import Transaction from '@/node/models/transaction'

export interface BalanceChangeModelAttributes {
  transactionId: bigint
  blockHeight: number
  indexInBlock: number
  addressId: number
  value: bigint
  transaction: Transaction
  address: Address
  header: Header
}

export interface BalanceChangeCreationAttributes
  extends Optional<
    BalanceChangeModelAttributes,
    'transaction' | 'address' | 'header'
  > {}

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

  @ForeignKey(() => Header)
  @Column(DataType.INTEGER.UNSIGNED)
  blockHeight!: number

  @Column(DataType.BIGINT.UNSIGNED)
  indexInBlock!: number

  @PrimaryKey
  @ForeignKey(() => Address)
  @Column(DataType.INTEGER.UNSIGNED)
  addressId!: number

  @Column(DataType.BIGINT)
  get value(): bigint {
    const value = this.getDataValue('value') || 0
    return BigInt(value)
  }

  set value(value: bigint) {
    // @ts-ignore
    this.setDataValue('value', value.toString())
  }

  @BelongsTo(() => Transaction)
  transaction!: Transaction

  @BelongsTo(() => Address)
  address!: Address

  @BelongsTo(() => Header)
  header!: Header
}
