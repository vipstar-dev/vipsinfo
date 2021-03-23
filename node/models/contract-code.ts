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

export interface ContractCodeModelAttributes {
  sha256sum: Buffer
  code: Buffer
  source: string
  contractAddress: Buffer
  contract: Contract
}

Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class ContractCode extends Model<ContractCodeModelAttributes> {
  @PrimaryKey
  @Column(DataType.STRING(20).BINARY)
  sha256sum!: Buffer

  @Column(DataType.BLOB)
  code!: Buffer

  @AllowNull
  @Column(DataType.TEXT)
  source!: string

  @ForeignKey(() => Contract)
  contractAddress!: Buffer

  @BelongsTo(() => Contract)
  contract!: Contract
}
