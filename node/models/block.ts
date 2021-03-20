import {
  Table,
  Column,
  Model,
  PrimaryKey,
  DataType,
  Unique,
  HasOne,
  HasMany,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript'
import Header from '@/node/models/header'
import Address from '@/node/models/address'
import { Transaction } from '@/node/models/transaction'

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class Block extends Model<Block> {
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
