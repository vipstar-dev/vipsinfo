import {
  Table,
  Column,
  Model,
  PrimaryKey,
  Default,
  DataType,
  Index,
  Unique,
  HasOne,
  ForeignKey,
} from 'sequelize-typescript'
import { FindOptions } from 'sequelize'
import { Block } from '@/node/models/block'

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class Header extends Model<Header> {
  @Unique
  @Column(DataType.STRING(32).BINARY)
  hash!: Buffer

  @PrimaryKey
  @ForeignKey(() => Block)
  @Column(DataType.INTEGER.UNSIGNED)
  height!: number

  @Column(DataType.INTEGER)
  version!: number

  @Column(DataType.STRING(32).BINARY)
  @Default(Buffer.alloc(32))
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

  @Index('hash_utxo_root')
  @Column(DataType.STRING(32).BINARY)
  hashUTXORoot!: Buffer

  @Index('stake_prev_transaction_id')
  @Column(DataType.STRING(32).BINARY)
  stakePrevTxId!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  stakeOutputIndex!: number

  @Column(DataType.BLOB)
  signature!: Buffer

  @Column(DataType.STRING(32).BINARY)
  _chainwork!: Buffer

  @HasOne(() => Block)
  block!: Block

  get chainwork(): bigint {
    return BigInt(`0x${this.getDataValue('_chainwork').toString('hex')}`)
  }

  set chainwork(value: bigint) {
    this.setDataValue(
      '_chainwork',
      Buffer.from(value.toString(16).padStart(64, '0'), 'hex')
    )
  }

  findByHeight(
    height: number,
    options: FindOptions = {}
  ): Promise<Header | null> {
    return Header.findOne({ where: { height }, ...options })
  }

  findByHash(hash: Buffer, options: FindOptions = {}): Promise<Header | null> {
    return Header.findOne({ where: { hash }, ...options })
  }

  isProofOfStake(): boolean {
    return (
      Buffer.compare(this.stakePrevTxId, Buffer.alloc(32)) !== 0 &&
      this.stakeOutputIndex !== 0xffffffff
    )
  }

  get difficulty(): number {
    function getTargetDifficulty(bits: number): number {
      return (bits & 0xffffff) * 2 ** (((bits >>> 24) - 3) << 3)
    }
    return getTargetDifficulty(0x1d00ffff) / getTargetDifficulty(this.bits)
  }
}
