import {
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  HasOne,
  Index,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript'

import BalanceChange from '@/node/models/balance-change'
import Block from '@/node/models/block'
import ContractSpend from '@/node/models/contract-spend'
import EvmReceipt from '@/node/models/evm-receipt'
import GasRefund from '@/node/models/gas-refund'
import Witness from '@/node/models/witness'

export interface TransactionModelAttributes {
  _id: bigint
  id: Buffer
  hash: Buffer
  version: number
  flag: number
  lockTime: number
  blockHeight: number
  indexInBlock: number
  size: number
  weight: number
  block: Block
  witnesses: Witness[]
  balanceChanges: BalanceChange[]
  refunds: GasRefund[]
  contractSpendSource: ContractSpend
  contractSpendDests: ContractSpend[]
  evmReceipts: EvmReceipt[]
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Transaction extends Model<TransactionModelAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Index('_id')
  @Column(DataType.BIGINT.UNSIGNED)
  _id!: bigint

  @Unique
  @Column(DataType.STRING(32).BINARY)
  id!: Buffer

  @Column(DataType.STRING(32).BINARY)
  hash!: Buffer

  @Column(DataType.INTEGER)
  version!: number

  @Column(DataType.INTEGER.UNSIGNED)
  flag!: number

  @Column(DataType.INTEGER.UNSIGNED)
  lockTime!: number

  @ForeignKey(() => Block)
  @Column(DataType.INTEGER.UNSIGNED)
  blockHeight!: number

  @Column(DataType.INTEGER.UNSIGNED)
  indexInBlock!: number

  @Column(DataType.INTEGER.UNSIGNED)
  size!: number

  @Column(DataType.INTEGER.UNSIGNED)
  weight!: number

  @BelongsTo(() => Block)
  block!: Block

  @HasMany(() => Witness, { sourceKey: 'id' })
  witnesses!: Witness[]

  @HasMany(() => BalanceChange)
  balanceChanges!: BalanceChange[]

  @HasMany(() => GasRefund)
  refunds!: GasRefund[]

  @HasOne(() => ContractSpend, 'sourceId')
  contractSpendSource!: ContractSpend

  @HasMany(() => ContractSpend, 'destId')
  contractSpendDests!: ContractSpend[]

  @HasMany(() => EvmReceipt)
  evmReceipts!: EvmReceipt[]
}
