import { ModelCtor } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

import Header from '@/lib/block/header'
import Address from '@/node/models/address'
import BalanceChange from '@/node/models/balance-change'
import Block from '@/node/models/block'
import Contract from '@/node/models/contract'
import ContractCode from '@/node/models/contract-code'
import ContractSpend from '@/node/models/contract-spend'
import ContractTag from '@/node/models/contract-tag'
import EvmReceipt from '@/node/models/evm-receipt'
import EvmReceiptLog from '@/node/models/evm-receipt-log'
import EvmReceiptMapping from '@/node/models/evm-receipt-mapping'
import GasRefund from '@/node/models/gas-refund'
import HeaderModel from '@/node/models/header'
import Qrc20 from '@/node/models/qrc20'
import Qrc20Balance from '@/node/models/qrc20-balance'
import Qrc721 from '@/node/models/qrc721'
import Qrc721Token from '@/node/models/qrc721-token'
import Tip from '@/node/models/tip'
import { TipModelAttributes } from '@/node/models/tip'
import Transaction from '@/node/models/transaction'
import TransactionInput from '@/node/models/transaction-input'
import TransactionOutput from '@/node/models/transaction-output'
import TransactionOutputMapping from '@/node/models/transaction-output-mapping'
import Witness from '@/node/models/witness'
import Service, { BaseConfig, IService } from '@/node/services/base'
import Rpc, { RpcClientConfig } from '@/rpc'

export interface IDBService extends IService, DBAPIMethods {
  APIMethods: DBAPIMethods
}

export interface ITip extends Omit<TipModelAttributes, 'service'> {}

export interface DBAPIMethods {
  getRpcClient: () => Rpc
  getDatabase: () => Sequelize | undefined
  getModel: (name: StringModelTypes) => ModelCtor<ModelTypes>
  getServiceTip: (serviceName: string) => Promise<ITip | undefined>
  updateServiceTip: (serviceName: string, tip: ITip) => Promise<void>
}

export interface DbConfig extends BaseConfig {
  mysql: {
    uri: string
  }
  rpc: {
    protocol: string
    host: string
    port: number
    user: string
    password: string
  }
}

export type ModelTypes =
  | Address
  | BalanceChange
  | Block
  | Contract
  | ContractCode
  | ContractSpend
  | ContractTag
  | EvmReceipt
  | EvmReceiptLog
  | EvmReceiptMapping
  | GasRefund
  | HeaderModel
  | Qrc20
  | Qrc20Balance
  | Qrc721
  | Qrc721Token
  | Tip
  | Transaction
  | TransactionInput
  | TransactionOutput
  | TransactionOutputMapping
  | Witness

export type StringModelTypes =
  | 'address'
  | 'balance_change'
  | 'block'
  | 'contract'
  | 'contract_code'
  | 'contract_spend'
  | 'contract_tag'
  | 'evm_receipt'
  | 'evm_receipt_log'
  | 'evm_receipt_mapping'
  | 'gas_refund'
  | 'header'
  | 'qrc20'
  | 'qrc20_balance'
  | 'qrc721'
  | 'qrc721_token'
  | 'tip'
  | 'transaction'
  | 'transaction_input'
  | 'transaction_output'
  | 'transaction_output_mapping'
  | 'witness'

class DBService extends Service implements IDBService {
  public options: DbConfig
  private readonly genesisHash: Buffer | undefined
  private readonly rpcOptions: RpcClientConfig = {
    protocol: 'http',
    host: 'localhost',
    port: 3889,
    user: 'user',
    password: 'password',
  }
  private sequelize: Sequelize | undefined
  private Tip: ModelCtor<Tip> | undefined

  constructor(options: DbConfig) {
    super(options)
    this.options = options
    if (this.chain) {
      this.genesisHash = Header.fromBuffer(this.chain.genesis).hash
    }
    this.rpcOptions = Object.assign(this.rpcOptions, options.rpc)
    this.node?.on('stopping', () => {
      this.logger?.warn(
        'DB Service: node is stopping, gently closing the database. Please wait, this could take a while'
      )
    })
  }

  get APIMethods(): DBAPIMethods {
    /*
    return {
      getRpcClient: this.getRpcClient.bind(this),
      getDatabase: this.getDatabase.bind(this),
      getModel: this.getModel.bind(this),
      getServiceTip: this.getServiceTip.bind(this),
      updateServiceTip: this.updateServiceTip.bind(this)
    }
     */
    return {
      getRpcClient: () => this.getRpcClient(),
      getDatabase: () => this.getDatabase(),
      getModel: (name: StringModelTypes) => this.getModel(name),
      getServiceTip: (serviceName: string) => this.getServiceTip(serviceName),
      updateServiceTip: (serviceName: string, tip: ITip) =>
        this.updateServiceTip(serviceName, tip),
    }
  }

  getRpcClient(): Rpc {
    return new Rpc(this.rpcOptions)
  }

  getDatabase(): Sequelize | undefined {
    return this.sequelize
  }

  getModel(name: StringModelTypes): ModelCtor<ModelTypes> {
    switch (name) {
      case 'address':
        return Address.scope()
      case 'balance_change':
        return BalanceChange.scope()
      case 'block':
        return Block.scope()
      case 'contract':
        return Contract.scope()
      case 'contract_code':
        return ContractCode.scope()
      case 'contract_spend':
        return ContractSpend.scope()
      case 'contract_tag':
        return ContractTag.scope()
      case 'evm_receipt':
        return EvmReceipt.scope()
      case 'evm_receipt_log':
        return EvmReceiptLog.scope()
      case 'evm_receipt_mapping':
        return EvmReceiptMapping.scope()
      case 'gas_refund':
        return GasRefund.scope()
      case 'header':
        return HeaderModel.scope()
      case 'qrc20':
        return Qrc20.scope()
      case 'qrc20_balance':
        return Qrc20Balance.scope()
      case 'qrc721':
        return Qrc721.scope()
      case 'qrc721_token':
        return Qrc721Token.scope()
      case 'tip':
        return Tip.scope()
      case 'transaction':
        return Transaction.scope()
      case 'transaction_input':
        return TransactionInput.scope()
      case 'transaction_output':
        return TransactionOutput.scope()
      case 'transaction_output_mapping':
        return TransactionOutputMapping.scope()
      case 'witness':
        return Witness.scope()
    }
  }

  async getServiceTip(serviceName: string): Promise<ITip | undefined> {
    const tip = await this.Tip?.findByPk(serviceName)
    if (tip) {
      return { height: tip.height, hash: tip.hash }
    } else if (this.genesisHash) {
      return { height: 0, hash: this.genesisHash }
    }
  }

  async updateServiceTip(serviceName: string, tip: ITip): Promise<void> {
    await this.Tip?.upsert(
      new Tip({
        service: serviceName,
        height: tip.height,
        hash: tip.hash,
      })
    )
  }

  async start() {
    this.sequelize = new Sequelize(this.options.mysql.uri, {
      // databaseVersion: 1,
      dialectOptions: {
        supportBigNumbers: true,
        bigNumberStrings: true,
      },
      logging: false,
      models: [
        Address,
        BalanceChange,
        Block,
        Contract,
        ContractCode,
        ContractSpend,
        ContractTag,
        EvmReceipt,
        EvmReceiptLog,
        EvmReceiptMapping,
        GasRefund,
        HeaderModel,
        Qrc20,
        Qrc20Balance,
        Qrc721,
        Qrc721Token,
        Tip,
        Transaction,
        TransactionInput,
        TransactionOutput,
        TransactionOutputMapping,
        Witness,
      ],
    })
    this.Tip = Tip.scope()
  }

  async stop() {
    if (this.sequelize) {
      await this.sequelize.close()
      this.sequelize = undefined
    }
  }
}

export default DBService
