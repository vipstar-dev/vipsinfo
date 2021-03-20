import {
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript'

import { Transaction } from '@/node/models/transaction'

/* eslint-disable camelcase */
const addressTypes: { [key: string]: number } = {
  pubkeyhash: 1,
  scripthash: 2,
  witness_v0_keyhash: 3,
  witness_v0_scripthash: 4,
  contract: 0x80,
  evm_contract: 0x81,
  x86_contract: 0x82,
}
/* eslint-enable camelcase*/

const addressTypeMap: { [key: number]: string } = {
  1: 'pubkeyhash',
  2: 'scripthash',
  3: 'witness_v0_keyhash',
  4: 'witness_v0_scripthash',
  0x80: 'contract',
  0x81: 'evm_contract',
  0x82: 'x86_contract',
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class EvmReceipt extends Model<EvmReceipt> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, field: '_id' })
  _id!: bigint

  @ForeignKey(() => Transaction)
  @Unique('transaction')
  @Column(DataType.BIGINT.UNSIGNED)
  transactionId!: bigint

  @Unique('transaction')
  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number

  @Column(DataType.INTEGER.UNSIGNED)
  blockHeight!: number

  @Column(DataType.INTEGER.UNSIGNED)
  indexInBlock!: number

  @Column(DataType.INTEGER.UNSIGNED)
  _senderType!: number

  get senderType(): string | null {
    let senderType = this.getDataValue('_senderType')
    return addressTypeMap[senderType] || null
  }

  set senderType(senderType: string | null) {
    if (senderType != null) {
      this.setDataValue('_senderType', addressTypes[senderType] || 0)
    }
  }

  @Column(DataType.STRING(32).BINARY)
  senderData!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  gasUsed!: number

  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.STRING(32))
  excepted!: string

  @Column(DataType.TEXT)
  exceptedMessage!: string

  @BelongsTo(() => Transaction)
  transaction!: Transaction

  @HasMany(() => EvmReceiptLog)
  logs!: EvmReceiptLog[]
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class EvmReceiptLog extends Model<EvmReceiptLog> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, field: '_id'})
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

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class EvmReceiptMapping extends Model<EvmReceiptMapping> {
  @PrimaryKey
  @Column(DataType.BIGINT.UNSIGNED)
  transactionId!: bigint

  @PrimaryKey
  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number

  @Column(DataType.INTEGER.UNSIGNED)
  indexInBlock!: number

  @Column(DataType.INTEGER.UNSIGNED)
  gasUsed!: number

  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.STRING(32))
  excepted!: string

  @Column(DataType.TEXT)
  exceptedMessage!: string
}
