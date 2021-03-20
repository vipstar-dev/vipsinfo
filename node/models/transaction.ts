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

import { BalanceChange } from '@/node/models/balance-change'
import { Block } from '@/node/models/block'
import { ContractSpend, GasRefund } from '@/node/models/contract-transaction'
import { EvmReceipt } from '@/node/models/transaction-receipt'

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class Transaction extends Model<Transaction> {
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

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class Witness extends Model<Witness> {
  @PrimaryKey
  @ForeignKey(() => Transaction)
  @Column(DataType.STRING(32).BINARY)
  transactionId!: Buffer

  @PrimaryKey
  @Column(DataType.INTEGER.UNSIGNED)
  inputIndex!: number

  @PrimaryKey
  @Column(DataType.INTEGER.UNSIGNED)
  witnessIndex!: number

  @Column(DataType.BLOB)
  script!: Buffer

  @BelongsTo(() => Transaction, { targetKey: 'id' })
  transaction!: Transaction
}
