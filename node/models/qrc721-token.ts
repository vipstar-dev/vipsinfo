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

export interface Qrc721TokenModelAttributes {
  contractAddress: Buffer
  tokenId: Buffer
  holder: Buffer
  contract: Contract
}

export interface Qrc721TokenCreationAttributes
  extends Optional<Qrc721TokenModelAttributes, 'contract'> {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Qrc721Token extends Model<
  Qrc721TokenModelAttributes,
  Qrc721TokenCreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @PrimaryKey
  @Column(DataType.STRING(32).BINARY)
  tokenId!: Buffer

  @Column(DataType.STRING(20).BINARY)
  holder!: Buffer

  @BelongsTo(() => Contract)
  contract!: Contract
}
