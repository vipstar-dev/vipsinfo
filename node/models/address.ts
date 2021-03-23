import {
  AutoIncrement,
  // ForeignKey,
  BelongsTo,
  Column,
  DataType,
  HasOne,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript'

import BalanceChange from '@/node/models/balance-change'
import Block from '@/node/models/block'

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
  _type: number
  type: string | null
  data: Buffer
  string: string
  createHeight: number
  minedBlocks: Block
  balanceChanges: BalanceChange
}

export interface AddressCreationAttributes extends AddressModelAttributes {
  getType(type: number): string | null
  parseType(type: string): number
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Address extends Model<
  AddressModelAttributes,
  AddressCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT.UNSIGNED)
  _id!: bigint

  @Unique('address')
  @Column(DataType.INTEGER.UNSIGNED)
  _type!: number

  get type(): string | null {
    let type = this.getDataValue('_type')
    return addressTypeMap[type] || null
  }

  set type(type: string | null) {
    if (type != null) {
      this.setDataValue('_type', addressTypes[type] || 0)
    }
  }

  @Unique('address')
  @Column(DataType.STRING(32).BINARY)
  data!: Buffer

  @Column(DataType.STRING(64))
  string!: string

  @Column(DataType.INTEGER.UNSIGNED)
  createHeight!: number

  /*
  This is code whose original I(y-chan) reproduced which was written by JavaScript.
  But I thought this code was wrong...
  @ForeignKey(() => Block)
  minerId!: bigint

  @HasOne(() => Block)
  minedBlocks!: Block
   */

  // I think that true code which this code author wanted to write.
  @BelongsTo(() => Block)
  minedBlocks!: Block

  @HasOne(() => BalanceChange)
  balanceChanges!: BalanceChange

  getType(type: number): string | null {
    return addressTypeMap[type] || null
  }

  parseType(type: string): number {
    return addressTypes[type] || 0
  }
}
