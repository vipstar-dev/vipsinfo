import { Optional } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  HasOne,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import Contract from '@/node/models/contract'
import EvmReceiptLog from '@/node/models/evm-receipt-log'
import Qrc20Statistics from '@/node/models/qrc20-statistics'

export interface Qrc20ModelAttributes {
  contractAddress: Buffer
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint | null
  version: string | null
  contract: Contract
  logs: EvmReceiptLog[]
  statistics: Qrc20Statistics
}

export interface Qrc20CreationAttributes
  extends Optional<Qrc20ModelAttributes, 'contract' | 'logs' | 'statistics'> {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Qrc20 extends Model<
  Qrc20ModelAttributes,
  Qrc20CreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.BLOB)
  get name(): string {
    return this.getDataValue('name').toString()
  }

  set name(name: string) {
    // @ts-ignore
    this.setDataValue('name', Buffer.from(name))
  }

  @Column(DataType.BLOB)
  get symbol(): string {
    return this.getDataValue('symbol').toString()
  }

  set symbol(symbol: string) {
    // @ts-ignore
    this.setDataValue('symbol', Buffer.from(symbol))
  }

  @Column(DataType.INTEGER.UNSIGNED)
  decimals!: number

  @Column(DataType.STRING(32).BINARY)
  get totalSupply(): bigint | null {
    const totalSupply = this.getDataValue('totalSupply')
    return totalSupply == null
      ? null // @ts-ignore
      : BigInt(`0x${totalSupply.toString('hex')}`)
  }

  set totalSupply(totalSupply: bigint | null) {
    if (totalSupply != null) {
      this.setDataValue(
        'totalSupply',
        // @ts-ignore
        Buffer.from(totalSupply.toString(16).padStart(64, '0'), 'hex')
      )
    }
  }

  @AllowNull
  @Column(DataType.BLOB) // @ts-ignore
  get version(): string | null {
    const version = this.getDataValue('version')
    return version == null ? null : version.toString()
  }

  set version(version: string | null) {
    if (version != null) {
      // @ts-ignore
      this.setDataValue('version', Buffer.from(version))
    }
  }

  @BelongsTo(() => Contract)
  contract!: Contract

  @HasMany(() => EvmReceiptLog, { sourceKey: 'contractAddress' })
  logs!: EvmReceiptLog[]

  @HasOne(() => Qrc20Statistics)
  statistics!: Qrc20Statistics
}
