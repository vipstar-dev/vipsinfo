import { Optional } from 'sequelize'
import {
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  HasOne,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript'

import BalanceChange from '@/node/models/balance-change'
import Block from '@/node/models/block'
import Contract from '@/node/models/contract'
import RichList from '@/node/models/rich-rist'
import TransactionInput from '@/node/models/transaction-input'
import TransactionOutput from '@/node/models/transaction-output'

/* eslint-disable camelcase */
export const addressTypes: { [key: string]: number } = {
  pubkeyhash: 1,
  scripthash: 2,
  witness_v0_keyhash: 3,
  witness_v0_scripthash: 4,
  contract: 0x80,
  evm_contract: 0x81,
  x86_contract: 0x82,
}
/* eslint-enable camelcase*/

export const addressTypeMap: { [key: number]: string } = {
  1: 'pubkeyhash',
  2: 'scripthash',
  3: 'witness_v0_keyhash',
  4: 'witness_v0_scripthash',
  0x80: 'contract',
  0x81: 'evm_contract',
  0x82: 'x86_contract',
}

export interface AddressModelAttributes {
  _id: bigint
  type: string | null
  data: Buffer
  string: string
  createHeight: number
  minedBlocks: Block[]
  balanceChanges: BalanceChange
  contract: Contract
  balance: RichList
  inputTxos: TransactionInput[]
  outputTxos: TransactionOutput[]
}

export interface AddressCreationAttributes
  extends Optional<
    AddressModelAttributes,
    | '_id'
    | 'minedBlocks'
    | 'balanceChanges'
    | 'contract'
    | 'balance'
    | 'inputTxos'
    | 'outputTxos'
  > {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Address extends Model<
  AddressModelAttributes,
  AddressCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, field: '_id' })
  _id!: bigint

  @Unique('address')
  @Column(DataType.INTEGER.UNSIGNED)
  get type(): string | null {
    const type = this.getDataValue('type')
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return addressTypeMap[type] || null
  }

  set type(type: string | null) {
    if (type != null) {
      // @ts-ignore
      this.setDataValue('type', addressTypes[type] || 0)
    }
  }

  @Unique('address')
  @Column(DataType.STRING(32).BINARY)
  @ForeignKey(() => Contract)
  data!: Buffer

  @Column(DataType.STRING(64))
  string!: string

  @Column(DataType.INTEGER.UNSIGNED)
  createHeight!: number

  /*
  This is code whose original I(y-chan) reproduced which was written by JavaScript.
  But I thought this code was wrong...
  @HasOne(() => Block)
  minedBlocks!: Block
   */

  // I think that true code which this code author wanted to write.
  @HasMany(() => Block)
  minedBlocks!: Block[]

  @HasOne(() => BalanceChange)
  balanceChanges!: BalanceChange

  @BelongsTo(() => Contract)
  contract!: Contract

  @HasOne(() => RichList)
  balance!: RichList

  @HasMany(() => TransactionInput)
  inputTxos!: TransactionInput[]

  @HasMany(() => TransactionOutput)
  outputTxos!: TransactionOutput[]

  static getType(type: number): string | null {
    return addressTypeMap[type] || null
  }

  static parseType(type: string): number {
    return addressTypes[type] || 0
  }
}
