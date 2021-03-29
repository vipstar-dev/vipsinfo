import { Optional } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import Contract from '@/node/models/contract'

export interface Qrc20ModelAttributes {
  contractAddress: Buffer
  name: Buffer
  symbol: Buffer
  decimals: number
  _totalSupply: Buffer
  totalSupply: bigint | null
  version: Buffer | null
  contract: Contract
}

export interface Qrc20CreationAttributes
  extends Optional<Qrc20ModelAttributes, '_totalSupply' | 'contract'> {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Qrc20 extends Model<
  Qrc20ModelAttributes,
  Qrc20CreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.BLOB)
  name!: Buffer

  @Column(DataType.BLOB)
  symbol!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  decimals!: number

  @Column(DataType.STRING(32).BINARY)
  _totalSupply!: Buffer

  get totalSupply(): bigint | null {
    const totalSupply = this.getDataValue('_totalSupply')
    return totalSupply == null
      ? null
      : BigInt(`0x${totalSupply.toString('hex')}`)
  }

  set totalSupply(totalSupply: bigint | null) {
    if (totalSupply != null) {
      this.setDataValue(
        '_totalSupply',
        Buffer.from(totalSupply.toString(16).padStart(64, '0'), 'hex')
      )
    }
  }

  @AllowNull
  @Column(DataType.BLOB)
  version!: Buffer | null

  @BelongsTo(() => Contract)
  contract!: Contract
}
