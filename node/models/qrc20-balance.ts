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

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Qrc20Balance extends Model<Qrc20Balance> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(32).BINARY)
  contractAddress!: Buffer

  @PrimaryKey
  @Column(DataType.STRING(20).BINARY)
  address!: Buffer

  @Column(DataType.STRING(32).BINARY)
  _balance!: Buffer

  get balance(): bigint | null {
    let balance = this.getDataValue('_balance')
    return balance == null ? null : BigInt(`0x${balance.toString('hex')}`)
  }

  set balance(balance: bigint | null) {
    if (balance != null) {
      this.setDataValue(
        '_balance',
        Buffer.from(balance.toString(16).padStart(64, '0'), 'hex')
      )
    }
  }

  @BelongsTo(() => Contract)
  contract!: Contract
}
