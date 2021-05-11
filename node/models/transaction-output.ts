import { Optional } from 'sequelize'
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

import Address from '@/node/models/address'
import EvmReceipt from '@/node/models/evm-receipt'
import GasRefund from '@/node/models/gas-refund'
import Transaction from '@/node/models/transaction'
import TransactionInput from '@/node/models/transaction-input'

export interface TransactionOutputModelAttributes {
  transactionId: bigint
  outputIndex: number
  scriptPubKey: Buffer
  blockHeight: number
  value: bigint
  addressId: bigint
  isStake: boolean
  inputId: bigint
  inputIndex: number
  inputHeight: number | null
  transaction: Transaction
  refund: GasRefund
  refundTo: GasRefund
  outputTransaction: Transaction
  inputTransaction: Transaction
  input: TransactionInput
  address: Address
  evmReceipt: EvmReceipt
}

export interface TransactionOutputCreationAttributes
  extends Optional<
    TransactionOutputModelAttributes,
    | 'transaction'
    | 'refund'
    | 'refundTo'
    | 'outputTransaction'
    | 'inputTransaction'
    | 'input'
    | 'address'
    | 'evmReceipt'
  > {}

@Table({
  tableName: 'transaction_output',
  freezeTableName: true,
  underscored: true,
  timestamps: false,
})
export default class TransactionOutput extends Model<
  TransactionOutputModelAttributes,
  TransactionOutputCreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => Transaction)
  @Column(DataType.BIGINT.UNSIGNED)
  transactionId!: bigint

  @PrimaryKey
  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number

  @Column({ type: DataType.BLOB('medium'), field: 'scriptpubkey' })
  scriptPubKey!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  blockHeight!: number

  @Column(DataType.BIGINT)
  get value(): bigint {
    const value = this.getDataValue('value')
    return BigInt(value)
  }

  set value(value: bigint) {
    // @ts-ignore
    this.setDataValue('value', value.toString())
  }

  @ForeignKey(() => Address)
  @Column(DataType.BIGINT.UNSIGNED)
  addressId!: bigint

  @Column(DataType.BOOLEAN)
  isStake!: boolean

  @ForeignKey(() => Transaction)
  @ForeignKey(() => TransactionInput)
  @Column(DataType.BIGINT.UNSIGNED)
  inputId!: bigint

  @Column(DataType.INTEGER.UNSIGNED)
  inputIndex!: number

  @AllowNull
  @Column(DataType.INTEGER.UNSIGNED)
  inputHeight!: number | null

  @BelongsTo(() => Transaction, 'transactionId')
  transaction!: Transaction

  @HasOne(() => GasRefund, 'refundId')
  refundTo!: GasRefund

  @HasOne(() => GasRefund, 'transactionId')
  refund!: GasRefund

  @BelongsTo(() => Transaction, 'transactionId')
  outputTransaction!: Transaction

  @BelongsTo(() => Transaction, 'inputId')
  inputTransaction!: Transaction

  @BelongsTo(() => TransactionInput, 'inputId')
  input!: TransactionInput

  @BelongsTo(() => Address, 'addressId')
  address!: Address

  @HasOne(() => EvmReceipt)
  evmReceipt!: EvmReceipt
}
