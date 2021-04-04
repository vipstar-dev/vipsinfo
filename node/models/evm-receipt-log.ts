import { Optional } from 'sequelize'
import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'

import EvmReceipt from '@/node/models/evm-receipt'

export interface EvmReceiptLogModelAttributes {
  _id: bigint
  receiptId: bigint
  logIndex: number
  blockHeight: number
  address: Buffer
  topic1: Buffer | null
  topic2: Buffer | null
  topic3: Buffer | null
  topic4: Buffer | null
  data: Buffer
  receipt: EvmReceipt
}

export interface EvmReceiptLogCreationAttributes
  extends Optional<EvmReceiptLogModelAttributes, '_id' | 'receipt'> {}

@Table({
  tableName: 'evm_receipt_log',
  freezeTableName: true,
  underscored: true,
  timestamps: false,
})
export default class EvmReceiptLog extends Model<
  EvmReceiptLogModelAttributes,
  EvmReceiptLogCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, field: '_id' })
  _id!: bigint

  @ForeignKey(() => EvmReceipt)
  @Column(DataType.BIGINT.UNSIGNED)
  receiptId!: bigint

  @Column(DataType.INTEGER.UNSIGNED)
  logIndex!: number

  @Column(DataType.INTEGER.UNSIGNED)
  blockHeight!: number

  @Column(DataType.STRING(32).BINARY)
  address!: Buffer

  @AllowNull
  @Column(DataType.STRING(32).BINARY)
  topic1!: Buffer | null

  @AllowNull
  @Column(DataType.STRING(32).BINARY)
  topic2!: Buffer | null

  @AllowNull
  @Column(DataType.STRING(32).BINARY)
  topic3!: Buffer | null

  @AllowNull
  @Column(DataType.STRING(32).BINARY)
  topic4!: Buffer | null

  @Column(DataType.BLOB)
  data!: Buffer

  @BelongsTo(() => EvmReceipt)
  receipt!: EvmReceipt
}
