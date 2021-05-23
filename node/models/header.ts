import { FindOptions, Optional } from 'sequelize'
import {
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  HasOne,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript'

import Block from '@/node/models/block'
import Transaction from '@/node/models/transaction'

export interface HeaderModelAttributes {
  hash: Buffer
  height: number
  version: number
  prevHash: Buffer
  merkleRoot: Buffer
  timestamp: number
  bits: number
  nonce: number
  hashStateRoot: Buffer
  hashUTXORoot: Buffer
  stakePrevTxId: Buffer
  stakeOutputIndex: number
  signature: Buffer
  block: Block
  transactions: Transaction[]
  chainwork: bigint
  isProofOfStake: boolean
  difficulty: number
}

export interface HeaderCreationAttributes
  extends Optional<
    HeaderModelAttributes,
    'prevHash' | 'block' | 'transactions' | 'isProofOfStake' | 'difficulty'
  > {}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Header extends Model<
  HeaderModelAttributes,
  HeaderCreationAttributes
> {
  @Unique
  @Column(DataType.STRING(32).BINARY)
  hash!: Buffer

  @PrimaryKey
  @ForeignKey(() => Block)
  @Column(DataType.INTEGER.UNSIGNED)
  height!: number

  @Column(DataType.INTEGER)
  version!: number

  @Default(Buffer.alloc(32).toString('hex'))
  @Column(DataType.STRING(32).BINARY)
  prevHash!: Buffer

  @Column(DataType.STRING(32).BINARY)
  merkleRoot!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  timestamp!: number

  @Column(DataType.INTEGER.UNSIGNED)
  bits!: number

  @Column(DataType.INTEGER.UNSIGNED)
  nonce!: number

  @Column(DataType.STRING(32).BINARY)
  hashStateRoot!: Buffer

  @Column({ type: DataType.STRING(32).BINARY, field: 'hash_utxo_root' })
  hashUTXORoot!: Buffer

  @Column({
    type: DataType.STRING(32).BINARY,
    field: 'stake_prev_transaction_id',
  })
  stakePrevTxId!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  stakeOutputIndex!: number

  @Column(DataType.BLOB)
  signature!: Buffer

  @Column(DataType.STRING(32).BINARY)
  get chainwork(): bigint {
    // @ts-ignore
    return BigInt(`0x${this.getDataValue('chainwork').toString('hex')}`)
  }

  set chainwork(value: bigint) {
    this.setDataValue(
      'chainwork',
      // @ts-ignore
      Buffer.from(value.toString(16).padStart(64, '0'), 'hex')
    )
  }

  @HasOne(() => Block)
  block!: Block

  @HasMany(() => Transaction)
  transactions!: Transaction[]

  static findByHeight<M extends Header>(
    height: number,
    options: FindOptions = {}
  ): Promise<Header | null> {
    return Header.findOne({ where: { height }, ...options })
  }

  static findByHash<M extends Header>(
    hash: Buffer,
    options: FindOptions = {}
  ): Promise<Header | null> {
    return Header.findOne({ where: { hash }, ...options })
  }

  get isProofOfStake(): boolean {
    return (
      Buffer.compare(this.stakePrevTxId, Buffer.alloc(32)) !== 0 &&
      this.stakeOutputIndex !== 0xffffffff
    )
  }

  get difficulty(): number {
    let nShift = (this.bits >> 24) & 0xff
    let dDiff = 0x0000ffff / (this.bits & 0x00ffffff)

    while (nShift < 29) {
      dDiff *= 256.0
      nShift++
    }
    while (nShift > 29) {
      dDiff /= 256.0
      nShift--
    }

    return dDiff
  }
}
