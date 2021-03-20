import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AllowNull,
  DataType,
  BelongsTo,
  ForeignKey, HasOne,
} from 'sequelize-typescript'
import { Transaction } from '@/node/models/transaction'
import Address from '~/node/models/address'
import {GasRefund} from "~/node/models/contract-transaction";

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class TransactionOutput extends Model<TransactionOutput> {
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

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class TransactionInput extends Model<TransactionInput> {
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

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class TransactionOutputMapping extends Model<TransactionOutputMapping> {
  @Column({ type: DataType.STRING(32), field: '_id' })
  _id!: string

  @Column({ type: DataType.STRING(32).BINARY, field: 'input_transaction_id' })
  inputTxId!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  inputIndex!: number

  @Column({ type: DataType.STRING(32).BINARY, field: 'output_transaction_id' })
  outputTxId!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number
}
