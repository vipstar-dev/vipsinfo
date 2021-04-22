import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import Address from '@/node/models/address'

export interface RichListModelAttributes {
  addressId: bigint
  balance: bigint
}

@Table({
  tableName: 'rich_list',
  freezeTableName: true,
  underscored: true,
  timestamps: false,
})
export default class RichList extends Model<RichListModelAttributes> {
  @PrimaryKey
  @ForeignKey(() => Address)
  @Column(DataType.BIGINT.UNSIGNED)
  addressId!: bigint

  @Column(DataType.BIGINT)
  balance!: bigint

  @BelongsTo(() => Address)
  address!: Address
}
