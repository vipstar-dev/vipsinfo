import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  HasOne,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript'

import Address from '@/node/models/address'
import Header from '@/node/models/header'
import Transaction from '@/node/models/transaction'

export interface BlockModelAttributes {
  hash: Buffer
  height: number
  size: number
  weight: number
  minerId: bigint
  transactionsCount: number
  contractTransactionsCount: number
  header: Header
  miner: Address
  transactions: Transaction[]
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Block extends Model<BlockModelAttributes> {
  @Unique
  @Column(DataType.STRING(32).BINARY)
  hash!: Buffer

  @PrimaryKey
  @ForeignKey(() => Header)
  @Column(DataType.INTEGER.UNSIGNED)
  height!: number

  @Column(DataType.INTEGER.UNSIGNED)
  size!: number

  @Column(DataType.INTEGER.UNSIGNED)
  weight!: number

  @ForeignKey(() => Address)
  @Column(DataType.BIGINT.UNSIGNED)
  minerId!: bigint

  @Column(DataType.INTEGER.UNSIGNED)
  transactionsCount!: number

  @Column(DataType.INTEGER.UNSIGNED)
  contractTransactionsCount!: number

  @BelongsTo(() => Header)
  header!: Header

  @HasOne(() => Address)
  miner!: Address

  @HasMany(() => Transaction)
  transactions!: Transaction[]
}
