import {
  Table,
  Column,
  Model,
  PrimaryKey,
  DataType,
  BelongsTo,
  ForeignKey,
  AllowNull,
} from 'sequelize-typescript'
import { Contract } from '@/node/models/contract'

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class Qrc20 extends Model<Qrc20> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.BLOB)
  name!: Buffer

  @Column(DataType.BLOB)
  symbol!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  decimals!: number

  @Column(DataType.STRING(32).BINARY)
  _totalSupply!: Buffer

  get totalSupply(): bigint | null {
    let totalSupply = this.getDataValue('_totalSupply')
    return totalSupply == null ? null : BigInt(`0x${totalSupply.toString('hex')}`)
  }

  set totalSupply(totalSupply: bigint | null) {
    if (totalSupply != null) {
      this.setDataValue(
        '_totalSupply',
        Buffer.from(totalSupply.toString(16).padStart(64, '0'), 'hex')
      )
    }
  }

  @AllowNull
  @Column(DataType.BLOB)
  version!: Buffer

  @BelongsTo(() => Contract)
  contract!: Contract
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class Qrc20Balance extends Model<Qrc20Balance> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(32).BINARY)
  contractAddress!: Buffer

  @PrimaryKey
  @Column(DataType.STRING(20).BINARY)
  address!: Buffer

  @Column(DataType.STRING(32).BINARY)
  _balance!: Buffer

  get balance(): bigint | null {
    let balance = this.getDataValue('_balance')
    return balance == null ? null : BigInt(`0x${balance.toString('hex')}`)
  }

  set balance(balance: bigint | null) {
    if (balance != null) {
      this.setDataValue(
        '_balance',
        Buffer.from(balance.toString(16).padStart(64, '0'), 'hex')
      )
    }
  }

  @BelongsTo(() => Contract)
  contract!: Contract
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class Qrc721 extends Model<Qrc721> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.BLOB)
  name!: Buffer

  @Column(DataType.BLOB)
  symbol!: Buffer

  @Column(DataType.STRING(32).BINARY)
  _totalSupply!: Buffer

  get totalSupply(): bigint | null {
    let totalSupply = this.getDataValue('_totalSupply')
    return totalSupply == null ? null : BigInt(`0x${totalSupply.toString('hex')}`)
  }

  set totalSupply(totalSupply: bigint | null) {
    if (totalSupply != null) {
      this.setDataValue(
        '_totalSupply',
        Buffer.from(totalSupply.toString(16).padStart(64, '0'), 'hex')
      )
    }
  }

  @BelongsTo(() => Contract)
  contract!: Contract
}

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export class Qrc721Token extends Model<Qrc721Token> {
  @PrimaryKey
  @ForeignKey(() => Contract)
  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @PrimaryKey
  @Column(DataType.STRING(32).BINARY)
  tokenId!: Buffer

  @Column(DataType.STRING(20).BINARY)
  holder!: Buffer

  @BelongsTo(() => Contract)
  contract!: Contract
}
