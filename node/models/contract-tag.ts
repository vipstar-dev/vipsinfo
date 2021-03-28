import { Optional } from 'sequelize'
import {
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import Contract from '@/node/models/contract'

export interface ContractTagModelAttributes {
  _id: bigint
  contractAddress: Buffer
  tag: string
  contract: Contract
}

export interface ContractTagCreationAttributes
  extends Optional<ContractTagModelAttributes, '_id' | 'contract'> {}

Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class ContractTag extends Model<
  ContractTagModelAttributes,
  ContractTagCreationAttributes
> {
  @AutoIncrement
  @PrimaryKey
  @Column({ type: DataType.BIGINT.UNSIGNED, field: '_id' })
  _id!: bigint

  @ForeignKey(() => Contract)
  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.STRING(32))
  tag!: string

  @BelongsTo(() => Contract)
  contract!: Contract
}
