import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  HasOne,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import { Qrc20, Qrc20Balance, Qrc721, Qrc721Token } from '@/node/models/token'

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class Contract extends Model<Contract> {
  @PrimaryKey
  @Column(DataType.STRING(20).BINARY)
  address!: Buffer

  @Column(DataType.STRING(34))
  addressString!: string

  @Column(DataType.ENUM)
  vm: string[] = ['evm', 'x86']

  @AllowNull
  @Column(DataType.ENUM)
  type: string[] = ['dgp', 'qrc20', 'qrc721']

  @Column(DataType.STRING(32).BINARY)
  bytecodeSha256sum!: Buffer

  @Default('')
  @Column(new DataType.TEXT('long'))
  description!: string

  @HasOne(() => ContractCode)
  code!: ContractCode

  @HasMany(() => ContractTag)
  tag!: ContractTag[]

  @HasOne(() => Qrc20)
  qrc20!: Qrc20

  @HasMany(() => Qrc20Balance)
  qrc20Balances!: Qrc20Balance[]

  @HasOne(() => Qrc721)
  qrc721!: Qrc721

  @HasMany(() => Qrc721Token)
  qrc721Tokens!: Qrc721Token[]
}

Table({ freezeTableName: true, underscored: true, timestamps: false })
export class ContractCode extends Model<ContractCode> {
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

Table({ freezeTableName: true, underscored: true, timestamps: false })
export class ContractTag extends Model<ContractTag> {
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
