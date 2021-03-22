import { Column, DataType, Model, Table } from 'sequelize-typescript'

@Table({ freezeTableName: true, underscored: true, timestamps: false })
export default class TransactionOutputMapping extends Model<TransactionOutputMapping> {
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
