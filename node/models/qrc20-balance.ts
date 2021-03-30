import { Optional } from 'sequelize'
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

export interface Qrc20BalanceModelAttributes {
  contractAddress: Buffer
  address: Buffer
  balance: bigint | null
  contract: Contract
}

export interface Qrc20BalanceCreationAttributes
  extends Optional<Qrc20BalanceModelAttributes, 'contract'> {}

@Table({
  tableName: 'qrc20_balance',
  freezeTableName: true,
  underscored: true,
  timestamps: false,
})
export default class Qrc20Balance extends Model<
  Qrc20BalanceModelAttributes,
  Qrc20BalanceCreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(32).BINARY)
  contractAddress!: Buffer

  @PrimaryKey
  @Column(DataType.STRING(20).BINARY)
  address!: Buffer

  @Column(DataType.STRING(32).BINARY)
  get balance(): bigint | null {
    const balance = this.getDataValue('balance')
    // @ts-ignore
    return balance == null ? null : BigInt(`0x${balance.toString('hex')}`)
  }

  set balance(balance: bigint | null) {
    if (balance != null) {
      this.setDataValue(
        'balance',
        // @ts-ignore
        Buffer.from(balance.toString(16).padStart(64, '0'), 'hex')
      )
    }
  }

  @BelongsTo(() => Contract)
  contract!: Contract
}
