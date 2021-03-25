import { Optional } from 'sequelize'
import {
  AllowNull,
  Column,
  DataType,
  Default,
  HasMany,
  HasOne,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import ContractCode from '@/node/models/contract-code'
import ContractTag from '@/node/models/contract-tag'
import Qrc20 from '@/node/models/qrc20'
import Qrc20Balance from '@/node/models/qrc20-balance'
import Qrc721 from '@/node/models/qrc721'
import Qrc721Token from '@/node/models/qrc721-token'

export interface ContractModelAttributes {
  address: Buffer
  addressString: string
  vm: string[]
  type: string[]
  bytecodeSha256sum: Buffer
  description: string
  code: ContractCode
  tag: ContractTag[]
  qrc20: Qrc20
  qrc20Balances: Qrc20Balance[]
  qrc721: Qrc721
  qrc721Tokens: Qrc721Token[]
}

export interface ContractCreationAttributes
  extends Optional<
    ContractModelAttributes,
    'code' | 'tag' | 'qrc20' | 'qrc20Balances' | 'qrc721' | 'qrc721Tokens'
  > {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Contract extends Model<
  ContractModelAttributes,
  ContractCreationAttributes
> {
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
