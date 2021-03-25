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

export interface TransactionInputModelAttributes {
  transactionId: bigint
  inputIndex: number
  scriptSig: Buffer
  sequence: number
  blockHeight: number
  value: bigint
  addressId: bigint
  outputId: bigint
  outputIndex: number
  transaction: Transaction
  address: Address
}

export interface TransactionInputCreationAttributes
  extends Optional<
    TransactionInputModelAttributes,
    'transaction' | 'address'
  > {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class TransactionInput extends Model<
  TransactionInputModelAttributes,
  TransactionInputCreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => Transaction)
  @Column(DataType.BIGINT.UNSIGNED)
  transactionId!: bigint

  @PrimaryKey
  @Column(DataType.INTEGER.UNSIGNED)
  inputIndex!: number

  @Column({ type: DataType.BLOB('medium'), field: 'scriptsig' })
  scriptSig!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  sequence!: number

  @Column(DataType.INTEGER.UNSIGNED)
  blockHeight!: number

  @Column(DataType.BIGINT)
  value!: bigint

  @ForeignKey(() => Address)
  @Column(DataType.BIGINT.UNSIGNED)
  addressId!: bigint

  @Column(DataType.BIGINT.UNSIGNED)
  outputId!: bigint

  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number

  @BelongsTo(() => Transaction)
  transaction!: Transaction

  @BelongsTo(() => Address)
  address!: Address
}
