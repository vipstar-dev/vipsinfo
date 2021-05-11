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
import TransactionOutput from '@/node/models/transaction-output'

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
  inputTransaction: Transaction
  outputTransaction: Transaction
  output: TransactionOutput
}

export interface TransactionInputCreationAttributes
  extends Optional<
    TransactionInputModelAttributes,
    | 'transaction'
    | 'address'
    | 'inputTransaction'
    | 'outputTransaction'
    | 'output'
  > {}

@Table({
  tableName: 'transaction_input',
  freezeTableName: true,
  underscored: true,
  timestamps: false,
})
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
  get value(): bigint {
    const value = this.getDataValue('value') || 0
    return BigInt(value)
  }

  set value(value: bigint) {
    // @ts-ignore
    this.setDataValue('value', value.toString())
  }

  @ForeignKey(() => Address)
  @Column(DataType.BIGINT.UNSIGNED)
  addressId!: bigint

  @ForeignKey(() => Transaction)
  @ForeignKey(() => TransactionOutput)
  @Column(DataType.BIGINT.UNSIGNED)
  outputId!: bigint

  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number

  @BelongsTo(() => Transaction, 'transactionId')
  transaction!: Transaction

  @BelongsTo(() => Address)
  address!: Address

  @BelongsTo(() => Transaction, 'transactionId')
  inputTransaction!: Transaction

  @BelongsTo(() => Transaction, 'outputId')
  outputTransaction!: Transaction

  @BelongsTo(() => TransactionOutput, 'outputId')
  output!: TransactionOutput
}
