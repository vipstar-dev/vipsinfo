import {
  Table,
  Column,
  Model,
  PrimaryKey,
  DataType,
  Unique,
  HasOne,
  BelongsTo,
} from 'sequelize-typescript'
import Header from '@/node/models/header'
import Address from '@/node/models/address'

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class Block extends Model<Block> {
  @Unique
  @Column(DataType.STRING(32).BINARY)
  hash!: Buffer

  @PrimaryKey
  @BelongsTo(() => Header, 'height')
  @Column(DataType.INTEGER.UNSIGNED)
  height!: number

  @Column(DataType.INTEGER.UNSIGNED)
  size!: number

  @Column(DataType.INTEGER.UNSIGNED)
  weight!: number

  @HasOne(() => Address, { as: 'miner', foreignKey: 'minerId' })
  @Column(DataType.BIGINT.UNSIGNED)
  minerId!: bigint

  @Column(DataType.INTEGER.UNSIGNED)
  transactionsCount!: number

  @Column(DataType.INTEGER.UNSIGNED)
  contractTransactionsCount!: number
}
