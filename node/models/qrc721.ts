import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import Contract from '@/node/models/contract'

export interface Qrc721ModelAttributes {
  contractAddress: Buffer
  name: Buffer
  symbol: Buffer
  _totalSupply: Buffer
  totalSupply: bigint | null
  contract: Contract
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Qrc721 extends Model<Qrc721ModelAttributes> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.BLOB)
  name!: Buffer

  @Column(DataType.BLOB)
  symbol!: Buffer

  @Column(DataType.STRING(32).BINARY)
  _totalSupply!: Buffer

  get totalSupply(): bigint | null {
    let totalSupply = this.getDataValue('_totalSupply')
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

  @BelongsTo(() => Contract)
  contract!: Contract
}
