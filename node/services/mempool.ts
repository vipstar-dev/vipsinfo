import { ModelCtor, Op, QueryTypes, Sequelize } from 'sequelize'

import { ITransactionInput } from '@/lib'
import { IBus } from '@/node/bus'
import TransactionModel from '@/node/models/transaction'
import TransactionInputModel from '@/node/models/transaction-input'
import WitnessModel from '@/node/models/witness'
import { Services } from '@/node/node'
import Service, {
  BaseConfig,
  IService,
  Subscriptions,
} from '@/node/services/base'
import {
  ITransactionAndModelSetting,
  ITransactionService,
} from '@/node/services/transaction'
import AsyncQueue, { sql } from '@/node/utils'

const { in: $in } = Op

export interface IMempoolService extends IService {
  _startSubscriptions(): void
  enable(): void
  _queueTransaction(tx: TransactionModel | ITransactionAndModelSetting): void
  _handleError(err: string | number): void
  _onTransaction(
    tx: TransactionModel | ITransactionAndModelSetting
  ): Promise<void>
  _validate(
    tx: TransactionModel | ITransactionAndModelSetting
  ): Promise<boolean | void>
}

class MempoolService extends Service implements IMempoolService {
  public subscriptions: Subscriptions = { transaction: [] }
  private readonly transaction: ITransactionService | undefined
  private subscribed: boolean = false
  private enabled: boolean = false
  private transactionProcessor:
    | AsyncQueue<TransactionModel | ITransactionAndModelSetting, 'tx'>
    | undefined
  private bus: IBus | undefined
  private db: Sequelize | undefined
  private Transaction: ModelCtor<TransactionModel> | undefined
  private Witness: ModelCtor<WitnessModel> | undefined

  constructor(options: BaseConfig) {
    super(options)
    this.transaction = this.node.services.get(
      'transaction'
    ) as ITransactionService
  }

  static get dependencies(): Services[] {
    return ['db', 'p2p', 'transaction']
  }

  get dependencies(): Services[] {
    return MempoolService.dependencies
  }

  async start() {
    this.db = this.node.addedMethods.getDatabase?.()
    const getModel = this.node.addedMethods.getModel
    if (getModel) {
      this.Transaction = getModel('transaction') as ModelCtor<TransactionModel>
      this.Witness = getModel('witness') as ModelCtor<WitnessModel>
    }
    this.transactionProcessor = new AsyncQueue(this._onTransaction.bind(this))
  }

  _startSubscriptions(): void {
    if (this.subscribed) {
      return
    }
    this.subscribed = true
    if (!this.bus) {
      // this.bus = this.node.openBus({ remoteAddress: 'localhost-mempool' })
      this.bus = this.node.openBus()
    }
    this.bus.on(
      'p2p/transaction',
      (tx: TransactionModel | ITransactionAndModelSetting) =>
        this._queueTransaction(tx)
    )
    this.bus.subscribe('p2p/transaction')
  }

  enable(): void {
    this.logger.info('Mempool Service: mempool enabled')
    this._startSubscriptions()
    this.enabled = true
  }

  async onSynced(): Promise<void> {
    this.enable()
  }

  _queueTransaction(tx: TransactionModel | ITransactionAndModelSetting): void {
    this.transactionProcessor?.push(tx, (err) => {
      if (err) {
        this._handleError(err)
      }
    })
  }

  _handleError(err: string | number): void {
    if (!this.node.stopping) {
      this.logger.error('Mempool Service: handle error', err)
      this.node.stop().then()
    }
  }

  async _onTransaction(
    tx: TransactionModel | ITransactionAndModelSetting
  ): Promise<void> {
    tx.blockHeight = 0xffffffff
    tx.indexInBlock = 0xffffffff
    try {
      if (!(await this._validate(tx))) {
        return
      }
      if (this.transaction && this.Transaction && this.Witness) {
        await this.transaction.removeReplacedTransactions(tx)
        tx._id = (
          await this.Transaction.create({
            id: tx.id,
            hash: tx.hash,
            version: tx.version as number,
            flag: tx.flag as number,
            lockTime: tx.lockTime as number,
            blockHeight: 0xffffffff,
            indexInBlock: 0xffffffff,
            size: tx.size,
            weight: tx.weight,
          })
        )._id
        const witnesses = this.transaction.groupWitnesses(tx)
        await Promise.all([
          this.Witness.bulkCreate(witnesses, { validate: false }),
          this.transaction.processTxos([tx]),
        ])
        await this.transaction.processBalanceChanges({ transactions: [tx] })
        await this.transaction.processReceipts([tx])

        for (const subscription of this.subscriptions.transaction) {
          subscription.emit('mempool/transaction', tx)
        }
      }
    } catch (err) {
      this._handleError(err)
    }
  }

  async _validate(
    tx: TransactionModel | ITransactionAndModelSetting
  ): Promise<boolean | void> {
    if (this.Transaction && this.db) {
      const prevTxs: Pick<
        TransactionModel,
        '_id' | 'id'
      >[] = await this.Transaction.findAll({
        where: {
          id: {
            [$in]: tx.inputs.map(
              (input: TransactionInputModel | ITransactionInput | undefined) =>
                input && 'prevTxId' in input ? input.prevTxId : undefined
            ),
          },
        },
        attributes: ['_id', 'id'],
      })
      const txos = []
      for (const input of tx.inputs) {
        const prevTxId = (input as ITransactionInput).prevTxId || undefined
        const item = prevTxs.find(
          (tx: Pick<TransactionModel, '_id' | 'id'>) =>
            Buffer.compare(tx.id, prevTxId || Buffer.alloc(0)) === 0
        )
        if (!item) {
          return false
        }
        txos.push([item._id, input?.outputIndex as number])
      }
      const [{ count }] = await this.db.query(
        sql([
          `SELECT COUNT(*) AS count FROM transaction_output WHERE (transaction_id, output_index) IN ${txos}`,
        ]),
        { type: QueryTypes.SELECT }
      )
      return Number(count) === tx.inputs.length
    }
  }
}

export default MempoolService
