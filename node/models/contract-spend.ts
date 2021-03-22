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

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class ContractSpend extends Model<ContractSpend> {
  @PrimaryKey
  @ForeignKey(() => Transaction)
  @Column(DataType.BIGINT.UNSIGNED)
  sourceId!: bigint

  @ForeignKey(() => Transaction)
  @Column(DataType.BIGINT.UNSIGNED)
  destId!: bigint

  @BelongsTo(() => Transaction, 'sourceId')
  sourceTransaction!: Transaction

  @BelongsTo(() => Transaction, 'destId')
  destTransaction!: Transaction
}
