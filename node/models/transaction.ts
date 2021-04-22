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
import ContractSpend from '@/node/models/contract-spend'
import EvmReceipt from '@/node/models/evm-receipt'
import GasRefund from '@/node/models/gas-refund'
import Header from '@/node/models/header'
import TransactionInput from '@/node/models/transaction-input'
import TransactionOutput from '@/node/models/transaction-output'
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
  inputs: TransactionInput[]
  outputs: TransactionOutput[]
  block: Block
  witnesses: Witness[]
  balanceChanges: BalanceChange[]
  refunds: GasRefund[]
  contractSpendSource: ContractSpend
  contractSpendDests: ContractSpend[]
  evmReceipts: EvmReceipt[]
  refundToTransaction: GasRefund
  header: Header
}

export interface TransactionCreationAttributes
  extends Optional<
    TransactionModelAttributes,
    | '_id'
    | 'inputs'
    | 'outputs'
    | 'block'
    | 'witnesses'
    | 'balanceChanges'
    | 'refunds'
    | 'contractSpendSource'
    | 'contractSpendDests'
    | 'evmReceipts'
    | 'refundToTransaction'
    | 'header'
  > {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Transaction extends Model<
  TransactionModelAttributes,
  TransactionCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, field: '_id' })
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

  @ForeignKey(() => Header)
  @ForeignKey(() => Block)
  @Column(DataType.INTEGER.UNSIGNED)
  blockHeight!: number

  @Column(DataType.INTEGER.UNSIGNED)
  indexInBlock!: number

  @Column(DataType.INTEGER.UNSIGNED)
  size!: number

  @Column(DataType.INTEGER.UNSIGNED)
  weight!: number

  @HasMany(() => TransactionInput, 'transactionId')
  inputs!: TransactionInput[]

  @HasMany(() => TransactionOutput, 'transactionId')
  outputs!: TransactionOutput[]

  @BelongsTo(() => Block)
  block!: Block

  @HasMany(() => Witness, { sourceKey: 'id' })
  witnesses!: Witness[]

  @HasMany(() => BalanceChange)
  balanceChanges!: BalanceChange[]

  @HasMany(() => GasRefund, 'transactionId')
  refunds!: GasRefund[]

  @HasOne(() => ContractSpend, 'sourceId')
  contractSpendSource!: ContractSpend

  @HasMany(() => ContractSpend, 'destId')
  contractSpendDests!: ContractSpend[]

  @HasMany(() => EvmReceipt)
  evmReceipts!: EvmReceipt[]

  @HasOne(() => GasRefund, 'refundId')
  refundToTransaction!: GasRefund

  @BelongsTo(() => Header)
  header!: Header
}
