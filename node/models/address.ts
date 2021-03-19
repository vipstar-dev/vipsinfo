import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  Unique,
  Length,
} from 'sequelize-typescript'

/* eslint-disable camelcase */
const addressTypes: { [key: string]: number } = {
  pubkeyhash: 1,
  scripthash: 2,
  witness_v0_keyhash: 3,
  witness_v0_scripthash: 4,
  contract: 0x80,
  evm_contract: 0x81,
  x86_contract: 0x82,
}
/* eslint-enable camelcase*/

const addressTypeMap: { [key: number]: string } = {
  1: 'pubkeyhash',
  2: 'scripthash',
  3: 'witness_v0_keyhash',
  4: 'witness_v0_scripthash',
  0x80: 'contract',
  0x81: 'evm_contract',
  0x82: 'x86_contract',
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Address extends Model<Address> {
  @PrimaryKey
  @AutoIncrement
  @Column
  _id!: bigint

  @Unique('address')
  @Column
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
  @Length({ max: 32 })
  @Column
  data!: string

  @Length({ max: 64 })
  @Column
  string!: string

  @Column
  createHeight!: number

  getType(type: number): string | null {
    return addressTypeMap[type] || null
  }

  parseType(type: string): number {
    return addressTypes[type] || 0
  }
}
