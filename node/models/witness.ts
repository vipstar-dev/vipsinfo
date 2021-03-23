import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import Transaction from '@/node/models/transaction'

export interface WitnessModelAttributes {
  transactionId: Buffer
  inputIndex: number
  witnessIndex: number
  script: Buffer
  transaction: Transaction
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Witness extends Model<WitnessModelAttributes> {
  @PrimaryKey
  @ForeignKey(() => Transaction)
  @Column(DataType.STRING(32).BINARY)
  transactionId!: Buffer

  @PrimaryKey
  @Column(DataType.INTEGER.UNSIGNED)
  inputIndex!: number

  @PrimaryKey
  @Column(DataType.INTEGER.UNSIGNED)
  witnessIndex!: number

  @Column(DataType.BLOB)
  script!: Buffer

  @BelongsTo(() => Transaction, { targetKey: 'id' })
  transaction!: Transaction
}
