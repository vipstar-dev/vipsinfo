import { Optional } from 'sequelize'
import {
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import EvmReceipt from '@/node/models/evm-receipt'

export interface EvmReceiptLogModelAttributes {
  _id: bigint
  receiptId: bigint
  logIndex: number
  blockHeight: number
  address: Buffer
  topic1: Buffer
  topic2: Buffer
  topic3: Buffer
  topic4: Buffer
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

  @Column(DataType.STRING(32).BINARY)
  topic1!: Buffer

  @Column(DataType.STRING(32).BINARY)
  topic2!: Buffer

  @Column(DataType.STRING(32).BINARY)
  topic3!: Buffer

  @Column(DataType.STRING(32).BINARY)
  topic4!: Buffer

  @Column(DataType.BLOB)
  data!: Buffer

  @BelongsTo(() => EvmReceipt)
  receipt!: EvmReceipt
}
