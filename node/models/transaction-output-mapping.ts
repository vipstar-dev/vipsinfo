import { Column, DataType, Model, Table } from 'sequelize-typescript'

export interface TransactionOutputMappingModelAttributes {
  _id: string
  inputTxId: Buffer
  inputIndex: number
  outputTxId: Buffer
  outputIndex: number
}

@Table({
  tableName: 'transaction_output_mapping',
  freezeTableName: true,
  underscored: true,
  timestamps: false,
})
export default class TransactionOutputMapping extends Model<TransactionOutputMappingModelAttributes> {
  @Column({ type: DataType.STRING(32), field: '_id' })
  _id!: string

  @Column({ type: DataType.STRING(32).BINARY, field: 'input_transaction_id' })
  inputTxId!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  inputIndex!: number

  @Column({ type: DataType.STRING(32).BINARY, field: 'output_transaction_id' })
  outputTxId!: Buffer

  @Column(DataType.INTEGER.UNSIGNED)
  outputIndex!: number
}
