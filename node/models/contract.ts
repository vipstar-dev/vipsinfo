import {
  Table,
  Column,
  Model,
  PrimaryKey,
  DataType,
  HasOne,
  HasMany,
  BelongsTo,
  ForeignKey,
  AllowNull,
  Default,
} from 'sequelize-typescript'

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
