import { Optional } from 'sequelize'
import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import Contract from '@/node/models/contract'
import EvmReceipt from '@/node/models/evm-receipt'
import Qrc20 from '@/node/models/qrc20'
import Qrc721 from '@/node/models/qrc721'

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
  contract: Contract
  qrc20: Qrc20
  qrc721: Qrc721
}

export interface EvmReceiptLogCreationAttributes
  extends Optional<
    EvmReceiptLogModelAttributes,
    '_id' | 'receipt' | 'contract' | 'qrc20' | 'qrc721'
  > {}

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

  @ForeignKey(() => Qrc20)
  @ForeignKey(() => Qrc721)
  @ForeignKey(() => Contract)
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

  @BelongsTo(() => Contract)
  contract!: Contract

  @BelongsTo(() => Qrc20, { targetKey: 'contractAddress' })
  qrc20!: Qrc20

  @BelongsTo(() => Qrc721, { targetKey: 'contractAddress' })
  qrc721!: Qrc721
}
