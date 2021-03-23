import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

export interface TipModelAttributes {
  service: string
  height: number
  hash: Buffer
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Tip extends Model<TipModelAttributes> {
  @PrimaryKey
  @Column(DataType.STRING)
  service!: string

  @Column(DataType.INTEGER.UNSIGNED)
  height!: number

  @Column(DataType.STRING(32).BINARY)
  hash!: Buffer
}
