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

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class EvmReceiptLog extends Model<EvmReceiptLog> {
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
  address!: string

  @Column(DataType.STRING(32).BINARY)
  topic1!: string

  @Column(DataType.STRING(32).BINARY)
  topic2!: string

  @Column(DataType.STRING(32).BINARY)
  topic3!: string

  @Column(DataType.STRING(32).BINARY)
  topic4!: string

  @Column(DataType.BLOB)
  data!: Buffer

  @BelongsTo(() => EvmReceipt)
  receipt!: EvmReceipt
}
