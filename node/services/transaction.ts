import {
  Op,
  QueryTypes,
  Sequelize,
  Transaction as SequelizeTransaction,
} from 'sequelize'
import { v4 as uuidv4 } from 'uuid'

import {
  Address,
  IContractOutputScript,
  IEVMContractCallBySenderScript,
  IEVMContractCallScript,
  IEVMContractCreateBySenderScript,
  IEVMContractCreateScript,
  IMultisigOutputScript,
  IOutputScript,
  IPublicKeyHashOutputScript,
  IPublicKeyOutputScript,
  IScriptHashOutputScript,
  ITransaction,
  ITransactionInput,
  ITransactionOutput,
  IWitnessV0KeyHashOutputScript,
  IWitnessV0ScriptHashOut,
  Opcode,
  OutputScript,
} from '@/lib'
import AddressModel, {
  AddressCreationAttributes,
  AddressModelAttributes,
} from '@/node/models/address'
import BalanceChangeModel from '@/node/models/balance-change'
import ContractSpendModel, {
  ContractSpendCreationAttributes,
} from '@/node/models/contract-spend'
import EvmReceiptModel, {
  EvmReceiptCreationAttributes,
} from '@/node/models/evm-receipt'
import EvmReceiptLogModel, {
  EvmReceiptLogCreationAttributes,
} from '@/node/models/evm-receipt-log'
import EvmReceiptMappingModel, {
  EvmReceiptMappingModelAttributes,
} from '@/node/models/evm-receipt-mapping'
import GasRefundModel, {
  GasRefundCreationAttributes,
} from '@/node/models/gas-refund'
import TransactionModel, {
  TransactionCreationAttributes,
} from '@/node/models/transaction'
import TransactionInputModel, {
  TransactionInputCreationAttributes,
} from '@/node/models/transaction-input'
import TransactionOutputModel, {
  TransactionOutputCreationAttributes,
} from '@/node/models/transaction-output'
import TransactionOutputMappingModel from '@/node/models/transaction-output-mapping'
import WitnessModel, { WitnessCreationAttributes } from '@/node/models/witness'
import { Services } from '@/node/node'
import Service, { IService } from '@/node/services/base'
import { BlockObject } from '@/node/services/block'
import { ITip } from '@/node/services/db'
import { sleep, sql } from '@/node/utils'
import { GetTransactionReceiptResult, Log } from '@/rpc'

const { gt: $gt, in: $in } = Op

export interface ITransactionAndModelSetting
  extends ITransaction,
    Partial<Pick<TransactionModel, 'blockHeight' | 'indexInBlock'>> {}

export interface ITransactionService extends IService {
  _processBlock(
    block: BlockObject
  ): Promise<(TransactionModel | ITransactionAndModelSetting)[]>
  processTxos(
    transactions: (TransactionModel | ITransactionAndModelSetting)[]
  ): Promise<void>
  processBalanceChanges({
    block,
    transactions,
  }: {
    block?: BlockObject
    transactions?: (TransactionModel | ITransactionAndModelSetting)[]
  }): Promise<void>
  processReceipts(
    transactions: (TransactionModel | ITransactionAndModelSetting)[]
  ): Promise<void>
  _processContracts(block: BlockObject): Promise<void>
  removeReplacedTransactions(
    tx: TransactionModel | ITransactionAndModelSetting
  ): Promise<boolean | void>
  _removeMempoolTransaction(id: bigint): Promise<void>
  groupWitnesses(
    tx: TransactionModel | ITransactionAndModelSetting
  ): WitnessCreationAttributes[]
}

class TransactionService extends Service implements ITransactionService {
  private tip: ITip | undefined
  private synced: boolean = false
  private db: Sequelize | undefined

  static get dependencies(): Services[] {
    return ['block', 'db']
  }

  get dependencies(): Services[] {
    return TransactionService.dependencies
  }

  async start(): Promise<void> {
    this.db = this.node.addedMethods.getDatabase?.()
    this.tip = await this.node.addedMethods.getServiceTip?.(this.name)
    const blockTip = this.node.addedMethods.getBlockTip?.()
    if (this.tip && blockTip && this.tip.height > blockTip.height) {
      this.tip = { height: blockTip.height, hash: blockTip.hash } as ITip
    }
    if (this.tip) {
      await TransactionOutputModel.destroy({
        where: { blockHeight: { [$gt]: this.tip?.height } },
      })
      await this.db?.query(
        sql`UPDATE transaction_output output, transaction_input input
         SET output.input_id = 0, output.input_index = 0xffffffff, output.input_height = NULL
         WHERE output.transaction_id = input.output_id AND output.output_index = input.output_index AND input.block_height > ${this.tip?.height}`
      )
      await TransactionInputModel.destroy({
        where: { blockHeight: { [$gt]: this.tip.height } },
      })
      await this.db?.query(
        sql`DELETE tx, witness, receipt, log, refund, contract_spend, balance
         FROM transaction tx
         LEFT JOIN witness ON witness.transaction_id = tx.id
         LEFT JOIN evm_receipt receipt ON receipt.transaction_id = tx._id
         LEFT JOIN evm_receipt_log log ON log.receipt_id = receipt._id
         LEFT JOIN gas_refund refund ON refund.transaction_id = tx.id
         LEFT JOIN contract_spend ON contract_spend.source_id = tx.id
         LEFT JOIN balance_change balance ON balance.transaction_id = tx._id
         WHERE tx.block_height > ${this.tip.height}`
      )
      await AddressModel.destroy({
        where: { createHeight: { [$gt]: this.tip.height } },
      })
      await TransactionOutputMappingModel.destroy({ truncate: true })
      await EvmReceiptMappingModel.destroy({ truncate: true })
      await this.node.addedMethods.updateServiceTip?.(this.name, this.tip)
    }
  }

  async onReorg(height: number): Promise<void> {
    await this.db?.query(
      sql`UPDATE transaction tx, transaction_output output, transaction_input input
         SET output.input_id = 0, output.input_index = 0xffffffff, output.input_height = NULL
         WHERE input.transaction_id = tx._id AND tx.block_height > ${height} AND tx.index_in_block = 1
         AND output.transaction_id = input.output_id AND output.output_index = input.output_index`
    )
    await this.db?.query(
      sql`DELETE refund, contract_spend
         FROM transaction tx
         LEFT JOIN gas_refund refund ON refund.transaction_id = tx._id
         LEFT JOIN contract_spend ON contract_spend.source_id = tx._id
         WHERE tx.block_height > ${height}`
    )
    await this.db?.query(
      sql`DELETE tx, witness, output, input, balance
         FROM transaction tx
         LEFT JOIN witness ON witness.transaction_id = tx.id
         LEFT JOIN transaction_output output ON output.transaction_id = tx._id
         LEFT JOIN transaction_input input ON input.transaction_id = tx._id
         LEFT JOIN balance_change balance ON balance.transaction_id = tx._id
         WHERE tx.block_height > ${height} AND tx.index_in_block < 2
         AND tx.index_in_block = 0`
    )
    await TransactionModel.update(
      { blockHeight: 0xffffffff, indexInBlock: 0xffffffff },
      { where: { blockHeight: { [$gt]: height } } }
    )
    await TransactionOutputModel.update(
      { blockHeight: 0xffffffff },
      { where: { blockHeight: { [$gt]: height } } }
    )
    await EvmReceiptModel.update(
      { blockHeight: 0xffffffff, indexInBlock: 0xffffffff },
      { where: { blockHeight: { [$gt]: height } } }
    )
    await EvmReceiptLogModel.destroy({
      where: { blockHeight: { [$gt]: height } },
    })
    await this.db?.query(
      sql`UPDATE transaction_output output, transaction_input input
         SET output.input_height = 0xffffffff, input.block_height = 0xffffffff
         WHERE input.block_height > ${height} AND output.transaction_id = input.output_id AND output.output_index = input.output_index`
    )
    await this.db?.query(
      sql`UPDATE balance_change balance, transaction tx
         SET balance.block_height = 0xffffffff, balance.index_in_block = 0xffffffff
         WHERE balance.transaction_id = tx._id AND tx.block_height > ${height}`
    )
    await AddressModel.update(
      { createHeight: 0xffffffff },
      { where: { createHeight: { [$gt]: height } } }
    )
  }

  async onBlock(block: BlockObject): Promise<void> {
    if (this.node.stopping) {
      return
    }
    try {
      const newTransactions: (
        | TransactionModel
        | ITransactionAndModelSetting
      )[] = await this._processBlock(block)
      // await this.processTxos(newTransactions, block)
      await this.processTxos(newTransactions)
      if (this.synced) {
        await this.processBalanceChanges({
          block,
          transactions: newTransactions,
        })
      } else {
        await this.processBalanceChanges({ block })
      }
      await this.processReceipts(newTransactions)
      await this._processContracts(block)
      if (block.height !== undefined) {
        this.tip = { height: block.height, hash: block.hash }
      }
      if (this.tip) {
        await this.node.addedMethods.updateServiceTip?.(this.name, this.tip)
      }
    } catch (err) {
      this.logger.error('Transaction Service:', err)
      await this.node.stop()
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onSynced(): Promise<void> {
    this.synced = true
  }

  async _processBlock(
    block: BlockObject
  ): Promise<(TransactionModel | ITransactionAndModelSetting)[]> {
    const newTransactions: (
      | TransactionModel
      | ITransactionAndModelSetting
    )[] = []
    const txs: TransactionCreationAttributes[] = []
    const witnesses: WitnessCreationAttributes[] = []
    if (
      this.synced &&
      block.transactions &&
      block.header &&
      block.height !== undefined
    ) {
      const mempoolTransactions: Pick<TransactionModel, '_id' | 'id'>[] =
        (await TransactionModel.findAll({
          where: {
            id: {
              /*
              [$in]: block.transactions
                .slice(block.height > this.chain.lastPoWBlockHeight ? 2 : 1)
                .map((tx) => tx.id),
               */
              [$in]: block.transactions
                .slice(block.header.isProofOfStake ? 2 : 1)
                .map((tx: TransactionModel | ITransaction) => tx.id),
            },
          },
          attributes: ['_id', 'id'],
        })) || []
      let mempoolTransactionsSet: Set<string> = new Set()
      if (mempoolTransactions.length) {
        const ids: Buffer[] = mempoolTransactions.map(
          (tx: Pick<TransactionModel, '_id' | 'id'>) => tx.id
        )
        const _ids: bigint[] = mempoolTransactions.map(
          (tx: Pick<TransactionModel, '_id' | 'id'>) => tx._id
        )
        mempoolTransactionsSet = new Set(
          ids.map((id: Buffer) => id.toString('hex'))
        )
        await Promise.all([
          TransactionOutputModel.update(
            { blockHeight: block.height },
            { where: { transactionId: { [$in]: _ids } } }
          ),
          TransactionInputModel.update(
            { blockHeight: block.height },
            { where: { transactionId: { [$in]: _ids } } }
          ),
        ])
        await this.db?.query(
          sql`UPDATE transaction_output output, transaction_input input
             SET output.input_height = ${block.height}
             WHERE input.transaction_id IN ${_ids} AND output.transaction_id = input.output_id AND output.output_index = input.output_index`
        )
        await this.db?.query(
          sql`UPDATE address, transaction_output output
             SET address.create_height = LEAST(address.create_height, ${block.height})
             WHERE address._id = output.address_id AND output.transaction_id IN ${_ids}`
        )
      }

      for (let index = 0; index < block.transactions.length; ++index) {
        const tx: TransactionModel | ITransactionAndModelSetting =
          block.transactions[index]
        tx.blockHeight = block.height
        tx.indexInBlock = index
        txs.push({
          id: tx.id,
          hash: tx.hash,
          version: tx.version as number,
          flag: tx.flag as number,
          lockTime: tx.lockTime as number,
          blockHeight: block.height,
          indexInBlock: index,
          size: tx.size,
          weight: tx.weight,
        })
        if (mempoolTransactionsSet.has(tx.id.toString('hex'))) {
          continue
        }
        if (index > 0) {
          await this.removeReplacedTransactions(tx)
        }
        newTransactions.push(tx)
        witnesses.push(...this.groupWitnesses(tx))
      }
      await TransactionModel.bulkCreate(txs, {
        updateOnDuplicate: ['blockHeight', 'indexInBlock'],
        validate: false,
      })
    } else if (
      block.transactions &&
      block.header &&
      block.height !== undefined
    ) {
      for (let index = 0; index < block.transactions.length; ++index) {
        const tx: TransactionModel | ITransactionAndModelSetting =
          block.transactions[index]
        tx.blockHeight = block.height
        tx.indexInBlock = index
        newTransactions.push(tx)
        txs.push({
          id: tx.id,
          hash: tx.hash,
          version: tx.version as number,
          flag: tx.flag as number,
          lockTime: tx.lockTime as number,
          blockHeight: block.height,
          indexInBlock: index,
          size: tx.size,
          weight: tx.weight,
        })
        witnesses.push(...this.groupWitnesses(tx))
      }
      await TransactionModel.bulkCreate(txs, { validate: false })
    }
    for (const witness of witnesses) {
      try {
        await WitnessModel.create(witness, { validate: false })
      } catch (e) {}
    }
    const ids = (
      await TransactionModel.findAll({
        where: {
          id: {
            [$in]: newTransactions.map(
              (tx: TransactionModel | ITransactionAndModelSetting) => tx.id
            ),
          },
        },
        attributes: ['_id'],
        order: [['_id', 'ASC']],
      })
    ).map((tx: Pick<TransactionModel, '_id'>) => tx._id)
    for (let i = 0; i < newTransactions.length; ++i) {
      newTransactions[i]._id = ids[i]
    }
    return newTransactions
  }

  async processTxos(
    transactions: (TransactionModel | ITransactionAndModelSetting)[]
  ): Promise<void> {
    const addressMap = new Map<
      string,
      {
        type: string
        data: Buffer
        string: string
        createHeight: number
        indices: number[][]
      }
    >()
    const addressIds: bigint[][] = []
    for (let index = 0; index < transactions.length; ++index) {
      addressIds.push([])
      const tx: TransactionModel | ITransactionAndModelSetting =
        transactions[index]
      for (
        let outputIndex = 0;
        outputIndex < tx.outputs.length;
        ++outputIndex
      ) {
        addressIds[index].push(BigInt(0))
        const address = Address.fromScript(
          (Buffer.isBuffer(
            (tx as TransactionModel).outputs[outputIndex].scriptPubKey
          )
            ? OutputScript.fromBuffer(
                (tx as TransactionModel).outputs[outputIndex].scriptPubKey
              )
            : (tx as ITransactionAndModelSetting).outputs?.[outputIndex]
                ?.scriptPubKey) as
            | IPublicKeyOutputScript
            | IPublicKeyHashOutputScript
            | IScriptHashOutputScript
            | IMultisigOutputScript
            | IWitnessV0KeyHashOutputScript
            | IWitnessV0ScriptHashOut
            | IEVMContractCreateScript
            | IEVMContractCreateBySenderScript
            | IEVMContractCallScript
            | IEVMContractCallBySenderScript
            | IContractOutputScript,
          this.chain,
          tx.id,
          outputIndex
        )
        if (address && address.data) {
          const key = `${address.data.toString('hex')}/${address.type}`
          const addressItem = addressMap.get(key)
          if (addressItem) {
            addressItem.indices.push([index, outputIndex])
          } else {
            addressMap.set(key, {
              type: address.type as string,
              data: address.data,
              string: address.toString() as string,
              createHeight: tx.blockHeight as number,
              indices: [[index, outputIndex]],
            })
          }
        }
      }
    }
    const addressItems = []
    for (const { type, data } of addressMap.values()) {
      addressItems.push([AddressModel.parseType(type), data])
    }
    if (addressItems.length && this.db) {
      let addressHistory: (Pick<AddressModelAttributes, '_id' | 'data'> & {
        type: number
      })[]
      try {
        addressHistory = await this.db.query<
          Pick<AddressModelAttributes, '_id' | 'data'> & { type: number }
        >(
          sql`SELECT _id, type, data FROM address
             WHERE (type, data) IN ${addressItems}`,
          { type: QueryTypes.SELECT }
        )
      } catch (e) {
        this.logger.debug('Get address history is failed...')
        addressHistory = []
      }
      for (const { _id, type, data } of addressHistory) {
        const key = `${data.toString('hex')}/${AddressModel.getType(type)}`
        const item = addressMap.get(key)
        if (item) {
          for (const [index, outputIndex] of item.indices) {
            addressIds[index][outputIndex] = _id
          }
        }
        addressMap.delete(key)
      }
    }
    const newAddressItems: AddressCreationAttributes[] = []
    for (const { type, data, string, createHeight } of addressMap.values()) {
      newAddressItems.push({ type, data, string, createHeight })
    }

    for (const { _id, type, data } of await AddressModel.bulkCreate(
      newAddressItems,
      {
        validate: false,
      }
    )) {
      const key = `${data.toString('hex')}/${type}`
      const item = addressMap.get(key)
      if (item) {
        for (const [index, outputIndex] of item.indices) {
          addressIds[index][outputIndex] = _id
        }
      }
    }

    const outputTxos: TransactionOutputCreationAttributes[] = []
    const inputTxos: TransactionInputCreationAttributes[] = []
    const mappings: string[] = []
    const mappingId: string = uuidv4().replace(/-/g, '')
    for (let index = 0; index < transactions.length; ++index) {
      const tx = transactions[index]
      for (
        let outputIndex = 0;
        outputIndex < tx.outputs.length;
        ++outputIndex
      ) {
        const output = tx.outputs[outputIndex]
        outputTxos.push({
          transactionId: tx._id as bigint,
          outputIndex,
          scriptPubKey: Buffer.isBuffer(
            (output as TransactionOutputModel).scriptPubKey
          )
            ? (output as TransactionOutputModel).scriptPubKey
            : ((output as ITransactionOutput).scriptPubKey?.toBuffer() as Buffer),
          blockHeight: tx.blockHeight as number,
          value: output?.value || BigInt(0),
          addressId: addressIds[index][outputIndex],
          isStake:
            tx.inputs.length > 0 &&
            tx.outputs.length >= 2 &&
            !tx.outputs[0]?.scriptPubKey,
          inputId: BigInt(0),
          inputIndex: 0xffffffff,
          inputHeight: null,
        })
      }
      for (let inputIndex = 0; inputIndex < tx.inputs.length; ++inputIndex) {
        const input = tx.inputs[inputIndex]
        if (
          Buffer.compare(
            (tx.inputs[0] as ITransactionInput | undefined)?.prevTxId ||
              Buffer.alloc(0),
            Buffer.alloc(32)
          ) !== 0 ||
          tx.inputs[0]?.outputIndex !== 0xffffffff
        ) {
          mappings.push(
            sql`${[
              mappingId,
              tx.id,
              inputIndex,
              (input as ITransactionInput | undefined)?.prevTxId ||
                Buffer.alloc(32),
              input?.outputIndex as number,
            ]}`
          )
        }
        inputTxos.push({
          transactionId: tx._id as bigint,
          inputIndex,
          scriptSig: input?.scriptSig as Buffer,
          sequence: input?.sequence as number,
          blockHeight: tx.blockHeight as number,
          value: BigInt(0),
          addressId: BigInt(0),
          outputId: BigInt(0),
          outputIndex: 0xffffffff,
        })
      }
    }
    if (this.db) {
      for (const outputTxo of outputTxos) {
        try {
          await TransactionOutputModel.create(outputTxo, { validate: false })
        } catch (e) {}
      }
      for (const inputTxo of inputTxos) {
        try {
          await TransactionInputModel.create(inputTxo, { validate: false })
        } catch (e) {}
      }
      if (mappings.length) {
        await this.db.query(
          sql`INSERT INTO transaction_output_mapping (_id, input_transaction_id, input_index, output_transaction_id, output_index) VALUES ${{
            raw: mappings.join(', '),
          }}`
        )
      }
      if (mappings.length) {
        await this.db.query(
          sql`UPDATE transaction_output output, transaction_input input, transaction_output_mapping mapping, transaction tx1, transaction tx2
             SET input.value = output.value, input.address_id = output.address_id,
               input.output_id = output.transaction_id, input.output_index = output.output_index,
               output.input_id = input.transaction_id, output.input_index = input.input_index, output.input_height = input.block_height
             WHERE tx1.id = mapping.input_transaction_id AND input.transaction_id = tx1._id AND input.input_index = mapping.input_index
               AND tx2.id = mapping.output_transaction_id AND output.transaction_id = tx2._id AND output.output_index = mapping.output_index
               AND mapping._id = ${mappingId}`
        )
      }
      const t = await this.db.transaction({
        isolationLevel: SequelizeTransaction.ISOLATION_LEVELS.READ_UNCOMMITTED,
      })
      try {
        await TransactionOutputMappingModel.destroy({
          where: { _id: mappingId },
          transaction: t,
        })
        await t.commit()
      } catch (err) {
        await t.rollback()
        throw err
      }
    }
  }

  async processBalanceChanges({
    block,
    transactions,
  }: {
    block?: BlockObject
    transactions?: (TransactionModel | ITransactionAndModelSetting)[]
  }): Promise<void> {
    let filter: string = ''
    if (transactions) {
      if (transactions.length === 0) {
        return
      }
      if (block?.height) {
        await this.db?.query(
          sql`UPDATE balance_change balance, transaction tx
             SET balance.block_height = ${block.height}, balance.index_in_block = tx.index_in_block
             WHERE tx._id = balance.transaction_id AND tx.block_height = ${block.height}`
        )
      }
      filter = sql`transaction_id BETWEEN ${
        transactions[0]._id as bigint
      } and ${transactions[transactions.length - 1]._id as bigint}`
    } else if (block?.height) {
      filter = sql`block_height = ${block.height}`
    }

    try {
      await this.db?.query(
        sql`INSERT INTO balance_change (transaction_id, block_height, index_in_block, address_id, value)
           SELECT
             tx._id AS transactionId,
             tx.block_height AS blockHeight,
             tx.index_in_block AS indexInBlock,
             list.address_id AS addressId,
             list.value AS value
           FROM (
             SELECT transaction_id, address_id, SUM(value) AS value
             FROM (
               SELECT transaction_id, address_id, value FROM transaction_output WHERE ${{
                 raw: filter,
               }} UNION ALL
               SELECT transaction_id, address_id, -value AS value FROM transaction_input WHERE ${{
                 raw: filter,
               }}
             ) AS block_balance
             GROUP BY transaction_id, address_id
           ) AS list
           LEFT JOIN transaction tx ON tx._id = list.transaction_id`
      )
    } catch (e) {}
  }

  async processReceipts(
    transactions: (TransactionModel | ITransactionAndModelSetting)[]
  ): Promise<void> {
    const receipts: EvmReceiptCreationAttributes[] = []
    for (const tx of transactions) {
      for (
        let outputIndex = 0;
        outputIndex < tx.outputs.length;
        ++outputIndex
      ) {
        const output = tx.outputs[outputIndex]
        const outputScriptPubKey: IOutputScript | undefined = Buffer.isBuffer(
          output?.scriptPubKey
        )
          ? OutputScript.fromBuffer(output?.scriptPubKey as Buffer)
          : output?.scriptPubKey
        if (outputScriptPubKey) {
          if (
            [
              OutputScript.EVM_CONTRACT_CREATE,
              OutputScript.EVM_CONTRACT_CREATE_SENDER,
              OutputScript.EVM_CONTRACT_CALL,
              OutputScript.EVM_CONTRACT_CALL_SENDER,
            ].includes(outputScriptPubKey.type)
          ) {
            let senderType: string | null = null
            let senderData: Buffer | undefined
            const hasOpSender = [
              OutputScript.EVM_CONTRACT_CREATE_SENDER,
              OutputScript.EVM_CONTRACT_CALL_SENDER,
            ].includes(outputScriptPubKey.type)
            if (hasOpSender) {
              senderType = AddressModel.getType(
                (outputScriptPubKey as
                  | IEVMContractCallBySenderScript
                  | IEVMContractCreateBySenderScript).senderType as number
              )
              senderData = (outputScriptPubKey as
                | IEVMContractCallBySenderScript
                | IEVMContractCreateBySenderScript).senderData
            } else {
              const transactionInput = await TransactionInputModel.findOne({
                // @ts-ignore
                where: { transactionId: tx._id, inputIndex: 0 },
                attributes: [],
                include: [
                  {
                    model: AddressModel.scope(),
                    as: 'address',
                    required: true,
                    attributes: ['type', 'data'],
                  },
                ],
              })
              if (transactionInput) {
                const { address: refunder } = transactionInput
                senderType = refunder.type
                senderData = refunder.data
              }
            }
            if (senderData) {
              receipts.push({
                transactionId: tx._id as bigint,
                outputIndex,
                blockHeight: tx.blockHeight as number,
                indexInBlock: tx.indexInBlock as number,
                senderType,
                senderData,
                gasUsed: 0,
                contractAddress: Buffer.alloc(20),
                excepted: '',
                exceptedMessage: '',
              })
            }
          }
        }
      }
    }
    if (receipts.length) {
      await EvmReceiptModel.bulkCreate(receipts, { validate: false })
    }
  }

  async _processContracts(block: BlockObject): Promise<void> {
    if (block.header) {
      const transactionIds: bigint[] = (
        await TransactionModel.findAll({
          where: { blockHeight: block.height },
          attributes: ['_id'],
          order: [['indexInBlock', 'ASC']],
        })
      ).map((tx: Pick<TransactionModel, '_id'>) => tx._id)
      const contractSpends: ContractSpendCreationAttributes[] = []
      const receiptIndices: number[] = []
      let lastTransactionIndex = 0
      if (block.transactions) {
        for (let i = 0; i < block.transactions.length; ++i) {
          const tx = block.transactions[i]
          if (
            Buffer.compare(
              (tx.inputs[0] as ITransactionInput | undefined)?.prevTxId ||
                Buffer.alloc(0),
              Buffer.alloc(32)
            ) === 0 &&
            tx.inputs[0]?.outputIndex === 0xffffffff
          ) {
            continue
          }
          if (
            tx.inputs[0]?.scriptSig?.length === 1 &&
            tx.inputs[0]?.scriptSig[0] === Opcode.OP_SPEND
          ) {
            contractSpends.push({
              sourceId: transactionIds[i],
              destId: transactionIds[lastTransactionIndex],
            })
          } else {
            lastTransactionIndex = i
            if (
              tx.outputs.some(
                (
                  output:
                    | TransactionOutputModel
                    | ITransactionOutput
                    | undefined
                ) =>
                  [
                    OutputScript.EVM_CONTRACT_CREATE,
                    OutputScript.EVM_CONTRACT_CREATE_SENDER,
                    OutputScript.EVM_CONTRACT_CALL,
                    OutputScript.EVM_CONTRACT_CALL_SENDER,
                  ].includes(
                    (Buffer.isBuffer(output?.scriptPubKey)
                      ? OutputScript.fromBuffer(output?.scriptPubKey as Buffer)
                          .type
                      : output?.scriptPubKey?.type) as string
                  )
              )
            ) {
              receiptIndices.push(i)
            }
          }
        }
        if (contractSpends.length) {
          await ContractSpendModel.bulkCreate(contractSpends, {
            validate: false,
          })
        }
        block.transactionsCount =
          block.transactions.length -
          (block.header.isProofOfStake ? 2 : 1) -
          contractSpends.length
        block.contractTransactionsCount = receiptIndices.length
        if (receiptIndices.length === 0) {
          return
        }
        const gasRefunds: GasRefundCreationAttributes[] = []
        const receipts: EvmReceiptMappingModelAttributes[] = []
        const receiptLogs: EvmReceiptLogCreationAttributes[] = []
        const client = this.node.addedMethods.getRpcClient?.()
        if (client) {
          const batchFunc = () =>
            client.batch<GetTransactionReceiptResult[]>(() => {
              const transactions:
                | TransactionModel[]
                | ITransaction[]
                | undefined = block.transactions
              if (
                transactions &&
                client &&
                client.rpcMethods.gettransactionreceipt
              ) {
                for (const index of receiptIndices) {
                  void client.rpcMethods.gettransactionreceipt(
                    transactions[index].id.toString('hex')
                  )
                }
              }
            })
          const blockReceipts: GetTransactionReceiptResult[][] = await Promise.all(
            batchFunc()
          ).catch((reason) => {
            this.logger.error(
              'getransactionreceipt rpc call is failed.',
              `${reason}`
            )
            void sleep(5000)
            this.logger.info('Retry getransactionreceipt rpc call...(one)')
            return Promise.all(batchFunc()).catch((reason) => {
              this.logger.error(
                'getransactionreceipt rpc call is failed.',
                `${reason}`
              )
              void sleep(10000)
              this.logger.info('Retry getransactionreceipt rpc call...(two)')
              return Promise.all(batchFunc())
            })
          })
          block.receipts = []
          blockReceipts.map((receipts: GetTransactionReceiptResult[]) => {
            receipts.map(
              ({ contractAddress, log: logs }: GetTransactionReceiptResult) => {
                block.receipts?.push({
                  contractAddress: Buffer.from(contractAddress, 'hex'),
                  logs: logs.map(({ address, topics, data }: Log<string>) => ({
                    address: Buffer.from(address, 'hex'),
                    topics: topics.map((topic: string) =>
                      Buffer.from(topic, 'hex')
                    ),
                    data: Buffer.from(data, 'hex'),
                  })),
                })
              }
            )
          })
          const refundTxos = await TransactionOutputModel.findAll({
            where: {
              outputIndex: { [$gt]: block.header.isProofOfStake ? 1 : 0 },
            },
            attributes: ['outputIndex', 'value', 'addressId'],
            include: {
              model: TransactionModel.scope(),
              as: 'transaction',
              required: true,
              where: {
                id: block.transactions[block.header.isProofOfStake ? 1 : 0].id,
              },
              attributes: [],
            },
          })
          const refunderMap: Map<
            string,
            Pick<AddressCreationAttributes, '_id' | 'type' | 'data'>
          > = new Map(
            (
              await TransactionInputModel.findAll({
                where: { inputIndex: 0 },
                attributes: [],
                include: [
                  {
                    model: TransactionModel.scope(),
                    as: 'transaction',
                    required: true,
                    where: {
                      id: {
                        [$in]: receiptIndices.map(
                          (index: number) => block.transactions?.[index].id
                        ),
                      },
                    },
                    attributes: ['id'],
                  },
                  {
                    model: AddressModel.scope(),
                    as: 'address',
                    required: true,
                    attributes: ['_id', 'type', 'data'],
                  },
                ],
              })
            ).map(
              (
                item: Pick<TransactionInputModel, 'transaction' | 'address'>
              ) => [
                item.transaction.id.toString('hex'),
                {
                  _id: item.address._id,
                  type: item.address.type,
                  data: item.address.data,
                },
              ]
            )
          )
          let receiptIndex = -1
          for (let index = 0; index < receiptIndices.length; ++index) {
            const indexInBlock = receiptIndices[index]
            const tx: TransactionModel | ITransaction =
              block.transactions[indexInBlock]
            const indices = []
            for (
              let i = 0;
              i <
              (tx.outputs as (TransactionOutputModel | ITransactionOutput)[])
                .length;
              ++i
            ) {
              if (
                [
                  OutputScript.EVM_CONTRACT_CREATE,
                  OutputScript.EVM_CONTRACT_CREATE_SENDER,
                  OutputScript.EVM_CONTRACT_CALL,
                  OutputScript.EVM_CONTRACT_CALL_SENDER,
                ].includes(
                  (Buffer.isBuffer(
                    (tx as TransactionModel).outputs[i].scriptPubKey
                  )
                    ? OutputScript.fromBuffer(
                        (tx as TransactionModel).outputs[i].scriptPubKey
                      ).type
                    : (tx as ITransaction).outputs?.[i]?.scriptPubKey
                        ?.type) as string
                )
              ) {
                indices.push(i)
              }
            }
            for (let i = 0; i < indices.length; ++i) {
              const output = tx.outputs[indices[i]]
              const refunder = refunderMap.get(tx.id.toString('hex'))
              const {
                gasUsed,
                contractAddress,
                excepted,
                exceptedMessage,
                log: logs,
              } = blockReceipts[index][i]
              if (gasUsed) {
                const { gasLimit, gasPrice } = (Buffer.isBuffer(
                  output?.scriptPubKey
                )
                  ? OutputScript.fromBuffer(output?.scriptPubKey as Buffer)
                  : output?.scriptPubKey) as
                  | IEVMContractCreateScript
                  | IEVMContractCreateBySenderScript
                  | IEVMContractCallScript
                  | IEVMContractCallBySenderScript
                const refundValue = BigInt(
                  Number(gasPrice) * (Number(gasLimit) - gasUsed)
                )
                if (refundValue) {
                  const txoIndex = refundTxos.findIndex(
                    (txo) =>
                      txo.value == refundValue || txo.addressId == refunder?._id
                  )
                  if (txoIndex === -1) {
                    this.logger.error(
                      `Contract Service: cannot find refund output: ${tx.id.toString(
                        'hex'
                      )}`
                    )
                  } else {
                    gasRefunds.push({
                      transactionId: transactionIds[indexInBlock],
                      outputIndex: indices[i],
                      refundId:
                        transactionIds[block.header.isProofOfStake ? 1 : 0],
                      refundIndex: refundTxos[txoIndex].outputIndex,
                    })
                    refundTxos.splice(txoIndex, 1)
                  }
                }
              }
              ++receiptIndex
              receipts.push({
                transactionId: transactionIds[indexInBlock],
                outputIndex: indices[i],
                indexInBlock,
                gasUsed,
                contractAddress: Buffer.from(contractAddress, 'hex'),
                excepted,
                exceptedMessage: exceptedMessage || '',
              })
              for (let j = 0; j < logs.length; ++j) {
                const { address, topics, data } = logs[j]
                receiptLogs.push({
                  receiptId: BigInt(receiptIndex),
                  logIndex: j,
                  blockHeight: block.height as number,
                  address: Buffer.from(address, 'hex'),
                  topic1: topics[0] ? Buffer.from(topics[0], 'hex') : null,
                  topic2: topics[1] ? Buffer.from(topics[1], 'hex') : null,
                  topic3: topics[2] ? Buffer.from(topics[2], 'hex') : null,
                  topic4: topics[3] ? Buffer.from(topics[3], 'hex') : null,
                  data: Buffer.from(data, 'hex'),
                })
              }
            }
          }
        }
        await Promise.all([
          GasRefundModel.bulkCreate(gasRefunds, { validate: false }),
          EvmReceiptMappingModel.bulkCreate(receipts, { validate: false }),
        ])
        await this.db?.query(
          sql`UPDATE evm_receipt receipt, evm_receipt_mapping mapping
             SET receipt.block_height = ${
               block.height as number
             }, receipt.index_in_block = mapping.index_in_block,
               receipt.gas_used = mapping.gas_used, receipt.contract_address = mapping.contract_address,
               receipt.excepted = mapping.excepted, receipt.excepted_message = mapping.excepted_message
             WHERE receipt.transaction_id = mapping.transaction_id AND receipt.output_index = mapping.output_index`
        )
        await EvmReceiptMappingModel.destroy({ truncate: true })
        const receiptIds = (
          await EvmReceiptModel.findAll({
            where: { blockHeight: block.height },
            attributes: ['_id'],
            order: [
              ['indexInBlock', 'ASC'],
              ['transactionId', 'ASC'],
              ['outputIndex', 'ASC'],
            ],
          })
        ).map((receipt) => receipt._id)
        for (const log of receiptLogs) {
          log.receiptId = receiptIds[Number(log.receiptId)]
        }
        await EvmReceiptLogModel.bulkCreate(receiptLogs, { validate: false })
      }
    }
  }

  async removeReplacedTransactions(
    tx: TransactionModel | ITransactionAndModelSetting
  ): Promise<boolean | void> {
    const prevTxs: Pick<
      TransactionModel,
      '_id' | 'id'
    >[] = await TransactionModel.findAll({
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
    const inputTxos: (bigint | number)[][] = []
    for (const input of tx.inputs) {
      const prevTxId = (input as ITransactionInput).prevTxId || undefined
      const item = prevTxs.find((tx) => {
        return Buffer.compare(tx.id, prevTxId || Buffer.alloc(0)) === 0
      })
      if (!item) {
        return false
      }
      if (input) {
        inputTxos.push([item._id, input.outputIndex as number])
      }
    }
    if (this.db) {
      const transactionsToRemove: bigint[] = (
        await this.db.query<{ id: bigint }>(
          sql`SELECT DISTINCT(input_id) AS id FROM transaction_output
             WHERE (transaction_id, output_index) IN ${inputTxos} AND input_id > 0`,
          { type: QueryTypes.SELECT }
        )
      ).map((tx: { id: bigint }) => tx.id)
      for (const id of transactionsToRemove) {
        await this._removeMempoolTransaction(id)
      }
    }
  }

  async _removeMempoolTransaction(id: bigint): Promise<void> {
    if (this.db) {
      const transactionsToRemove: bigint[] = (
        await TransactionOutputModel.findAll({
          where: { transactionId: Number(id) },
          attributes: ['inputId'],
        })
      ).map((tx: Pick<TransactionOutputModel, 'inputId'>) => tx.inputId)
      for (const subId of transactionsToRemove) {
        await this._removeMempoolTransaction(subId)
      }
      await this.db.query(
        sql`UPDATE transaction_output output, transaction_input input
           SET output.input_id = 0, output.input_index = 0xffffffff
           WHERE input.transaction_id = ${id} AND output.transaction_id = input.output_id AND output.output_index = input.output_index`
      )
      await Promise.all([
        TransactionOutputModel.destroy({
          where: { transactionId: Number(id) },
        }),
        TransactionInputModel.destroy({ where: { transactionId: Number(id) } }),
        BalanceChangeModel.destroy({ where: { transactionId: Number(id) } }),
      ])
      await this.db.query(
        sql`DELETE tx, witness FROM transaction tx
           LEFT JOIN witness ON witness.transaction_id = tx.id
           WHERE tx._id = ${id}`
      )
    }
  }

  groupWitnesses(
    tx: TransactionModel | ITransactionAndModelSetting
  ): WitnessCreationAttributes[] {
    const witnesses: WitnessCreationAttributes[] = []
    for (let i = 0; i < tx.inputs.length; ++i) {
      const input = tx.inputs[i]
      if (input) {
        if ('witness' in input) {
          for (let j = 0; j < input.witness.length; ++j) {
            witnesses.push({
              transactionId: tx.id,
              inputIndex: i,
              witnessIndex: j,
              script: input.witness[j] as Buffer,
            })
          }
        } else if ('witnesses' in tx) {
          return tx.witnesses
        }
      }
    }
    return witnesses
  }
}

export default TransactionService
