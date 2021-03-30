import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

export interface EvmReceiptMappingModelAttributes {
  transactionId: bigint
  outputIndex: number
  indexInBlock: number
  gasUsed: number
  contractAddress: Buffer
  excepted: string
  exceptedMessage: string
}

@Table({
  tableName: 'evm_receipt_mapping',
  freezeTableName: true,
  underscored: true,
  timestamps: false,
})
export default class EvmReceiptMapping extends Model<EvmReceiptMappingModelAttributes> {
  @PrimaryKey
  @Column(DataType.BIGINT.UNSIGNED)
  transactionId!: bigint

  @PrimaryKey
  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number

  @Column(DataType.INTEGER.UNSIGNED)
  indexInBlock!: number

  @Column(DataType.INTEGER.UNSIGNED)
  gasUsed!: number

  @Column(DataType.STRING(20).BINARY)
  contractAddress!: Buffer

  @Column(DataType.STRING(32))
  excepted!: string

  @Column(DataType.TEXT)
  exceptedMessage!: string
}
