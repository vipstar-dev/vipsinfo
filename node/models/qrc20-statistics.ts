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

import Qrc20 from '@/node/models/qrc20'

export interface Qrc20StatisticsModelAttributes {
  contractAddress: Buffer
  holders: number
  transactions: number
  qrc20: Qrc20
}

export interface Qrc20StatisticsCreationAttributes
  extends Optional<Qrc20StatisticsModelAttributes, 'qrc20'> {}

@Table({
  tableName: 'qrc20_statistics',
  freezeTableName: true,
  underscored: true,
  timestamps: false,
})
export default class Qrc20Statistics extends Model<
  Qrc20StatisticsModelAttributes,
  Qrc20StatisticsCreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => Qrc20)
  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  holders!: number

  @Column(DataType.INTEGER.UNSIGNED)
  transactions!: number

  @BelongsTo(() => Qrc20)
  qrc20!: Qrc20
}
