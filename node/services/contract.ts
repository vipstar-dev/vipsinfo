import { ModelCtor, Op, Sequelize } from 'sequelize'

import {
  IEventABI,
  IEVMContractCreateBySenderScript,
  IEVMContractCreateScript,
  IMethodABI,
  IOutputScript,
  ITransaction,
  sha256,
} from '@/lib'
import Address from '@/lib/address'
import OutputScript from '@/lib/script/output'
import { qrc20ABIs, qrc721ABIs } from '@/lib/solidity/abi'
import AddressModel from '@/node/models/address'
import ContractModel from '@/node/models/contract'
import ContractCodeModel from '@/node/models/contract-code'
import ContractTagModel from '@/node/models/contract-tag'
import EvmReceiptModel from '@/node/models/evm-receipt'
import EvmReceiptLogModel from '@/node/models/evm-receipt-log'
import Qrc20Model from '@/node/models/qrc20'
import Qrc20BalanceModel, {
  Qrc20BalanceCreationAttributes,
} from '@/node/models/qrc20-balance'
import Qrc721Model from '@/node/models/qrc721'
import Qrc721TokenModel, {
  Qrc721TokenCreationAttributes,
} from '@/node/models/qrc721-token'
import TransactionModel from '@/node/models/transaction'
import TransactionInputModel from '@/node/models/transaction-input'
import { Services } from '@/node/node'
import Service, { IService } from '@/node/services/base'
import { BlockObject } from '@/node/services/block'
import { ITip } from '@/node/services/db'
import { sql } from '@/node/utils'
import { CallContractResult, ListContractsResult } from '@/rpc'

const { ne: $ne, gt: $gt, in: $in } = Op

const totalSupplyABI = qrc20ABIs.find(
  (abi: IMethodABI | IEventABI) => abi.name === 'totalSupply'
) as IMethodABI
const balanceOfABI = qrc20ABIs.find(
  (abi: IMethodABI | IEventABI) => abi.name === 'balanceOf'
) as IMethodABI
const ownerOfABI = qrc721ABIs.find(
  (abi: IMethodABI | IEventABI) => abi.name === 'ownerOf'
) as IMethodABI
const transferABI = qrc20ABIs.find(
  (abi: IMethodABI | IEventABI) => abi.name === 'transfer'
) as IMethodABI
const TransferABI = qrc20ABIs.find(
  (abi: IMethodABI | IEventABI) => abi.name === 'Transfer'
) as IEventABI

export interface IContractService extends IService {
  _syncContracts(): Promise<void>
  _createContract(
    address: Buffer,
    vm: 'evm' | 'x86'
  ): Promise<ContractModel | void>
  _callMethod(
    address: Buffer,
    abi: IMethodABI,
    ...args: any[]
  ): Promise<any[] | undefined>
  _batchCallMethods(
    callList: {
      address: Buffer
      abi: IMethodABI
      args?: string[]
    }[]
  ): Promise<Promise<any[]>[] | undefined>
  _processReceipts(block: BlockObject): Promise<void>
  _updateBalances(balanceChanges: Set<string>): Promise<void>
  _updateTokenHolders(transfers: Map<string, Buffer>): Promise<void>
}

class ContractService extends Service implements IContractService {
  private tip: ITip | undefined
  private db: Sequelize | undefined
  private Address: ModelCtor<AddressModel> | undefined
  private Transaction: ModelCtor<TransactionModel> | undefined
  private TransactionInput: ModelCtor<TransactionInputModel> | undefined
  private EVMReceipt: ModelCtor<EvmReceiptModel> | undefined
  private EVMReceiptLog: ModelCtor<EvmReceiptLogModel> | undefined
  private Contract: ModelCtor<ContractModel> | undefined
  private ContractCode: ModelCtor<ContractCodeModel> | undefined
  private ContractTag: ModelCtor<ContractTagModel> | undefined
  private QRC20: ModelCtor<Qrc20Model> | undefined
  private QRC20Balance: ModelCtor<Qrc20BalanceModel> | undefined
  private QRC721: ModelCtor<Qrc721Model> | undefined
  private QRC721Token: ModelCtor<Qrc721TokenModel> | undefined

  static get dependencies(): Services[] {
    return ['block', 'db', 'transaction']
  }

  get dependencies(): Services[] {
    return Service.dependencies
  }

  async start(): Promise<void> {
    this.db = this.node.addedMethods.getDatabase?.()
    const getModel = this.node.addedMethods.getModel
    if (getModel) {
      this.Address = getModel('address') as ModelCtor<AddressModel>
      this.Transaction = getModel('transaction') as ModelCtor<TransactionModel>
      this.TransactionInput = getModel(
        'transaction_input'
      ) as ModelCtor<TransactionInputModel>
      this.EVMReceipt = getModel('evm_receipt') as ModelCtor<EvmReceiptModel>
      this.EVMReceiptLog = getModel(
        'evm_receipt_log'
      ) as ModelCtor<EvmReceiptLogModel>
      this.Contract = getModel('contract') as ModelCtor<ContractModel>
      this.ContractCode = getModel(
        'contract_code'
      ) as ModelCtor<ContractCodeModel>
      this.ContractTag = getModel('contract_tag') as ModelCtor<ContractTagModel>
      this.QRC20 = getModel('qrc20') as ModelCtor<Qrc20Model>
      this.QRC20Balance = getModel(
        'qrc20_balance'
      ) as ModelCtor<Qrc20BalanceModel>
      this.QRC721 = getModel('qrc721') as ModelCtor<Qrc721Model>
      this.QRC721Token = getModel('qrc721_token') as ModelCtor<Qrc721TokenModel>
    }
    this.tip = await this.node.addedMethods.getServiceTip?.(this.name)
    const blockTip = await this.node.addedMethods.getBlockTip?.()
    if (this.tip) {
      if (blockTip && this.tip.height > blockTip.height) {
        this.tip = { height: blockTip.height, hash: blockTip.hash }
      }
      await this.onReorg(this.tip.height)
      await this.node.addedMethods.updateServiceTip?.(this.name, this.tip)
    }
  }

  async onBlock(block: BlockObject): Promise<void> {
    if (block.height === 0) {
      for (const x of [0x80, 0x81, 0x82, 0x83, 0x84]) {
        const dgpAddress = Buffer.alloc(20)
        dgpAddress[19] = x
        if (this.node.addedMethods.getRpcClient?.()?.rpcMethods) {
          const baseCode = await this.node.addedMethods
            .getRpcClient()
            .rpcMethods.getcontractcode?.(dgpAddress.toString('hex'))
          if (baseCode) {
            const code = Buffer.from(baseCode, 'hex')
            const sha256sum = sha256(code)
            await this.Contract?.create({
              address: dgpAddress,
              addressString: new Address({
                type: Address.EVM_CONTRACT,
                data: dgpAddress,
                chain: this.chain,
              }).toString() as string,
              vm: 'evm',
              type: 'dgp',
              bytecodeSha256sum: sha256sum,
              // createHeight: 0,
            })
            await this.ContractCode?.bulkCreate([{ sha256sum, code }], {
              ignoreDuplicates: true,
            })
            await this.ContractTag?.create({
              contractAddress: dgpAddress,
              tag: 'dgp',
            })
          }
        }
      }
      return
    }
    for (const transaction of block.transactions as (
      | TransactionModel
      | ITransaction
    )[]) {
      for (let i = 0; i < transaction.outputs.length; ++i) {
        const output = transaction.outputs[i]
        if (output && output.scriptPubKey) {
          let scriptPubKey: IOutputScript
          if (Buffer.isBuffer(output.scriptPubKey)) {
            scriptPubKey = OutputScript.fromBuffer(output.scriptPubKey)
          } else {
            scriptPubKey = output.scriptPubKey
          }
          if (scriptPubKey.type === OutputScript.EVM_CONTRACT_CREATE) {
            const address: Buffer = Address.fromScript(
              scriptPubKey as IEVMContractCreateScript,
              this.chain,
              transaction.id,
              i
            )?.data as Buffer
            const findOneOfAddress:
              | {
                  address: Pick<AddressModel, 'data'>
                }
              | null
              | undefined = await this.TransactionInput?.findOne({
              where: { inputIndex: 0 },
              attributes: [],
              include: [
                {
                  model: this.Transaction,
                  as: 'transaction',
                  required: true,
                  where: { id: transaction.id },
                  attributes: [],
                },
                {
                  model: this.Address,
                  as: 'address',
                  required: true,
                  attributes: ['data'],
                },
              ],
            })
            if (findOneOfAddress) {
              const owner = findOneOfAddress.address
              const contract = await this._createContract(address, 'evm')
              if (contract && contract.type === 'qrc20') {
                await this._updateBalances(
                  new Set([
                    `${address.toString('hex')}:${owner.data.toString('hex')}`,
                  ])
                )
              }
            }
          } else if (
            scriptPubKey.type === OutputScript.EVM_CONTRACT_CREATE_SENDER
          ) {
            const address = Address.fromScript(
              scriptPubKey as IEVMContractCreateBySenderScript,
              this.chain,
              transaction.id,
              i
            )?.data as Buffer
            const owner = new Address({
              type: [
                null,
                Address.PAY_TO_PUBLIC_KEY_HASH,
                Address.PAY_TO_SCRIPT_HASH,
                Address.PAY_TO_WITNESS_SCRIPT_HASH,
                Address.PAY_TO_WITNESS_KEY_HASH,
              ][
                (scriptPubKey as IEVMContractCreateBySenderScript)
                  .senderType as number
              ],
              data: (scriptPubKey as IEVMContractCreateBySenderScript)
                .senderData,
              chain: this.chain,
            })
            const contract = await this._createContract(address, 'evm')
            if (contract && contract.type === 'qrc20') {
              await this._updateBalances(
                new Set([
                  `${address.toString('hex')}:${owner.data?.toString('hex')}`,
                ])
              )
            }
          }
        }
      }
    }
    await this._processReceipts(block)
    if (this.node.addedMethods.isSynced?.()) {
      await this._syncContracts()
    }
    if (this.tip && block.height) {
      this.tip.height = block.height
      this.tip.hash = block.hash
      await this.node.addedMethods.updateServiceTip?.(this.name, this.tip)
    }
  }

  async onReorg(height: number): Promise<void> {
    const balanceChanges: Set<string> = new Set()
    const balanceChangeResults:
      | Pick<EvmReceiptLogModel, 'address' | 'topic2' | 'topic3'>[]
      | undefined = await this.EVMReceiptLog?.findAll({
      where: { topic1: TransferABI.id, topic3: { [$ne]: null }, topic4: null },
      attributes: ['address', 'topic2', 'topic3'],
      include: [
        {
          model: this.EVMReceipt,
          as: 'receipt',
          required: true,
          where: { blockHeight: { [$gt]: height } },
          attributes: [],
        },
      ],
    })
    if (balanceChangeResults) {
      for (const { address, topic2, topic3 } of balanceChangeResults) {
        if (Buffer.compare(topic2, Buffer.alloc(32)) !== 0) {
          balanceChanges.add(
            `${address.toString('hex')}:${topic2.slice(12).toString('hex')}`
          )
        }
        if (Buffer.compare(topic3, Buffer.alloc(32)) !== 0) {
          balanceChanges.add(
            `${address.toString('hex')}:${topic3.slice(12).toString('hex')}`
          )
        }
      }
    }
    if (balanceChanges.size) {
      await this._updateBalances(balanceChanges)
    }
    await this.db?.query(
      sql([
        `INSERT INTO qrc721_token
         SELECT log.address AS contract_address, log.topic4 AS token_id, RIGHT(log.topic2, 20) AS holder
         FROM evm_receipt receipt, evm_receipt_log log
         INNER JOIN (
           SELECT address, topic4, MIN(_id) AS _id FROM evm_receipt_log
           WHERE topic4 IS NOT NULL AND topic1 = ${TransferABI.id}
           GROUP BY address, topic4
         ) results ON log._id = results._id
         WHERE receipt._id = log.receipt_id AND receipt.block_height > ${height} AND log.topic2 != ${Buffer.alloc(
          32
        )}
        ON DUPLICATE KEY UPDATE holder = VALUES(holder)`,
      ])
    )
  }

  async onSynced(): Promise<void> {
    await this._syncContracts()
  }

  async _syncContracts(): Promise<void> {
    const result:
      | ListContractsResult
      | void
      | undefined = await this.node.addedMethods
      .getRpcClient?.()
      ?.rpcMethods.listcontracts?.('1', (1e8).toString())
    if (result && this.Contract) {
      const contractsToCreate: Set<string> = new Set(Object.keys(result))
      const originalContracts: string[] = (
        await this.Contract.findAll({
          where: {},
          attributes: ['address'],
        })
      ).map((contract: Pick<ContractModel, 'address'>) =>
        contract.address.toString('hex')
      )
      const contractsToRemove: string[] = []
      for (const address of originalContracts) {
        if (contractsToCreate.has(address)) {
          contractsToCreate.delete(address)
        } else {
          contractsToRemove.push(address)
        }
      }
      if (contractsToRemove.length) {
        await this.db?.query(
          sql([
            `DELETE contract, tag, qrc20, qrc20_balance, qrc721, qrc721_token
             FROM contract
             LEFT JOIN contract_tag tag ON tag.contract_address = contract.address
             LEFT JOIN qrc20 ON qrc20.contract_address = contract.address
             LEFT JOIN qrc20_balance ON qrc20_balance.contract_address = contract.address
             LEFT JOIN qrc721 ON qrc721.contract_address = contract.address
             LEFT JOIN qrc721_token ON qrc721_token.contract_address = contract.address
             WHERE contract.address IN ${contractsToRemove}`,
          ])
        )
      }
      for (const address of contractsToCreate) {
        await this._createContract(Buffer.from(address, 'hex'), 'evm')
      }
    }
  }

  async _createContract(
    address: Buffer,
    vm: 'evm' | 'x86'
  ): Promise<ContractModel | void> {
    let contract = await this.Contract?.findOne({ where: { address } })
    if (contract) {
      return contract
    }
    let code: Buffer
    try {
      const baseCode = await this.node.addedMethods
        .getRpcClient?.()
        .rpcMethods.getcontractcode?.(address.toString('hex'))
      if (baseCode) {
        code = Buffer.from(baseCode, 'hex')
      } else {
        throw null
      }
    } catch (err) {
      return
    }
    const sha256sum = sha256(code)
    contract = new ContractModel({
      address,
      addressString: new Address({
        type: Address.EVM_CONTRACT,
        data: address,
        chain: this.chain,
      }).toString() as string,
      vm,
      bytecodeSha256sum: sha256sum,
    })
    if (isQRC721(code)) {
      const results = await this._batchCallMethods([
        {
          address,
          abi: qrc721ABIs.find(
            (abi: IMethodABI | IEventABI) => abi.name === 'name'
          ) as IMethodABI,
        },
        {
          address,
          abi: qrc721ABIs.find(
            (abi: IMethodABI | IEventABI) => abi.name === 'symbol'
          ) as IMethodABI,
        },
        {
          address,
          abi: qrc721ABIs.find(
            (abi: IMethodABI | IEventABI) => abi.name === 'totalSupply'
          ) as IMethodABI,
        },
      ])
      if (results) {
        const [nameResult, symbolResult, totalSupplyResult] = results
        try {
          const [name, symbol, totalSupply] = await Promise.all([
            nameResult.then((x) => x[0]),
            symbolResult.then((x) => x[0]),
            totalSupplyResult.then((x) => BigInt(x[0].toString())),
          ])
          contract.type = 'qrc721'
          await contract.save()
          await this.ContractCode?.bulkCreate([{ sha256sum, code }], {
            ignoreDuplicates: true,
          })
          await this.ContractTag?.create({
            contractAddress: address,
            tag: 'qrc721',
          })
          await this.QRC721?.create({
            contractAddress: address,
            name,
            symbol,
            totalSupply,
          })
        } catch (err) {
          await contract.save()
        }
      }
    } else if (isQRC20(code)) {
      const results = await this._batchCallMethods([
        {
          address,
          abi: qrc20ABIs.find(
            (abi: IMethodABI | IEventABI) => abi.name === 'name'
          ) as IMethodABI,
        },
        {
          address,
          abi: qrc20ABIs.find(
            (abi: IMethodABI | IEventABI) => abi.name === 'symbol'
          ) as IMethodABI,
        },
        {
          address,
          abi: qrc20ABIs.find(
            (abi: IMethodABI | IEventABI) => abi.name === 'decimals'
          ) as IMethodABI,
        },
        {
          address,
          abi: qrc20ABIs.find(
            (abi: IMethodABI | IEventABI) => abi.name === 'totalSupply'
          ) as IMethodABI,
        },
        {
          address,
          abi: qrc20ABIs.find(
            (abi: IMethodABI | IEventABI) => abi.name === 'version'
          ) as IMethodABI,
        },
      ])
      if (results) {
        const [
          nameResult,
          symbolResult,
          decimalsResult,
          totalSupplyResult,
          versionResult,
        ] = results
        try {
          let version
          try {
            version = (await versionResult)[0]
          } catch (err) {}
          const [name, symbol, decimals, totalSupply] = await Promise.all([
            nameResult.then((x) => x[0]),
            symbolResult.then((x) => x[0]),
            decimalsResult.then((x) => x[0].toString()),
            totalSupplyResult.then((x) => BigInt(x[0].toString())),
          ])
          contract.type = 'qrc20'
          await contract.save()
          await this.ContractCode?.bulkCreate([{ sha256sum, code }], {
            ignoreDuplicates: true,
          })
          await this.ContractTag?.create({
            contractAddress: address,
            tag: 'qrc20',
          })
          await this.QRC20?.create({
            contractAddress: address,
            name,
            symbol,
            decimals,
            totalSupply,
            version,
          })
        } catch (err) {
          await contract.save()
        }
      }
    } else {
      await contract.save()
      await this.ContractCode?.bulkCreate([{ sha256sum, code }], {
        ignoreDuplicates: true,
      })
    }
    return contract
  }

  async _callMethod(
    address: Buffer,
    abi: IMethodABI,
    ...args: any[]
  ): Promise<any[] | undefined> {
    const callContractResult = await this.node.addedMethods
      .getRpcClient?.()
      ?.rpcMethods.callcontract?.(
        address.toString('hex'),
        Buffer.concat([abi.id, abi.encodeInputs(args)]).toString('hex')
      )
    if (callContractResult) {
      const { executionResult } = callContractResult
      if (executionResult.excepted === 'None') {
        return abi.decodeOutputs(Buffer.from(executionResult.output, 'hex'))
      } else {
        throw executionResult.excepted
      }
    }
  }

  async _batchCallMethods(
    callList: {
      address: Buffer
      abi: IMethodABI
      args?: string[]
    }[]
  ): Promise<Promise<any[]>[] | undefined> {
    const client = this.node.addedMethods.getRpcClient?.()
    const results = await client?.batch<CallContractResult>(() => {
      for (const { address, abi, args = [] } of callList) {
        if (client) {
          client.rpcMethods.callcontract?.(
            address.toString('hex'),
            Buffer.concat([abi.id, abi.encodeInputs(args)]).toString('hex')
          )
        }
      }
    })
    return results?.map(async (result, index) => {
      const { abi } = callList[index]
      const { executionResult } = await result
      if (executionResult.excepted === 'None') {
        return abi.decodeOutputs(Buffer.from(executionResult.output, 'hex'))
      } else {
        throw executionResult.excepted
      }
    })
  }

  async _processReceipts(block: BlockObject): Promise<void> {
    const balanceChanges: Set<string> = new Set()
    const tokenHolders: Map<string, Buffer> = new Map()
    const totalSupplyChanges: Set<string> = new Set()
    // This is not used in here...
    // let contractsToCreate: Set<string> = new Set()
    // for (let { contractAddress, logs } of block.receipts || []) {
    for (const { logs } of block.receipts || []) {
      for (const { address, topics } of logs) {
        /* if (Buffer.compare(address, contractAddress) !== 0) {
          contractsToCreate.add(address.toString('hex'))
        } */
        if (
          topics.length >= 3 &&
          Buffer.compare(topics[0], TransferABI.id) === 0
        ) {
          const sender = topics[1].slice(12)
          const receiver = topics[2].slice(12)
          if (topics.length === 3) {
            if (Buffer.compare(sender, Buffer.alloc(20)) !== 0) {
              balanceChanges.add(
                `${address.toString('hex')}:${sender.toString('hex')}`
              )
            }
            if (Buffer.compare(receiver, Buffer.alloc(20)) !== 0) {
              balanceChanges.add(
                `${address.toString('hex')}:${receiver.toString('hex')}`
              )
            }
          } else if (topics.length === 4) {
            if (Buffer.compare(receiver, Buffer.alloc(20)) !== 0) {
              tokenHolders.set(
                `${address.toString('hex')}:${topics[3].toString('hex')}`,
                receiver
              )
            }
          }
          if (
            Buffer.compare(sender, Buffer.alloc(20)) === 0 ||
            Buffer.compare(receiver, Buffer.alloc(20)) === 0
          ) {
            totalSupplyChanges.add(address.toString('hex'))
          }
        }
      }
    }
    if (balanceChanges.size) {
      await this._updateBalances(balanceChanges)
    }
    if (tokenHolders.size) {
      await this._updateTokenHolders(tokenHolders)
    }
    for (const addressString of totalSupplyChanges) {
      const address = Buffer.from(addressString, 'hex')
      const contract = await this.Contract?.findOne({
        where: {
          address,
          type: { [$in]: ['qrc20', 'qrc721'] },
        },
      })
      if (contract) {
        let totalSupply
        try {
          totalSupply = BigInt(
            (await this._callMethod(address, totalSupplyABI))?.toString()
          )
        } catch (err) {
          continue
        }
        if (contract.type === 'qrc20') {
          await this.QRC20?.update(
            { totalSupply },
            { where: { contractAddress: address } }
          )
        } else {
          await this.QRC721?.update(
            { totalSupply },
            { where: { contractAddress: address } }
          )
        }
      }
    }
  }

  async _updateBalances(balanceChanges: Set<string>): Promise<void> {
    const newBalanceChanges: { contract: string; address: string }[] = [
      ...balanceChanges,
    ].map((item) => {
      const [contract, address] = item.split(':')
      return { contract, address }
    })
    const batchCalls = newBalanceChanges.map(({ contract, address }) => ({
      address: Buffer.from(contract, 'hex'),
      abi: balanceOfABI,
      args: [`0x${address}`],
    }))
    const result = await this._batchCallMethods(batchCalls)
    const operations: (
      | Qrc20BalanceCreationAttributes
      | undefined
    )[] = await Promise.all(
      newBalanceChanges.map(async ({ contract, address }, index) => {
        try {
          if (result) {
            const [balance] = await result[index]
            return {
              contractAddress: Buffer.from(contract, 'hex'),
              address: Buffer.from(address, 'hex'),
              balance: BigInt(balance.toString()),
            }
          }
        } catch (err) {}
      })
    )
    const filteredOperations: Qrc20BalanceCreationAttributes[] = operations.filter(
      Boolean
    ) as Qrc20BalanceCreationAttributes[]
    if (filteredOperations.length) {
      await this.QRC20Balance?.bulkCreate(filteredOperations, {
        updateOnDuplicate: ['balance'],
        validate: false,
      })
    }
  }

  async _updateTokenHolders(transfers: Map<string, Buffer>): Promise<void> {
    const operations: Qrc721TokenCreationAttributes[] = []
    for (const [key, holder] of transfers.entries()) {
      const [contract, tokenId] = key.split(':')
      operations.push({
        contractAddress: Buffer.from(contract, 'hex'),
        tokenId: Buffer.from(tokenId, 'hex'),
        holder,
      })
    }
    await this.QRC721Token?.bulkCreate(operations, {
      updateOnDuplicate: ['holder'],
      validate: false,
    })
  }
}

function isQRC20(code: Buffer): boolean {
  return (
    code.includes(balanceOfABI.id) &&
    code.includes(transferABI.id) &&
    code.includes(TransferABI.id)
  )
}

function isQRC721(code: Buffer): boolean {
  return (
    code.includes(balanceOfABI.id) &&
    code.includes(ownerOfABI.id) &&
    code.includes(TransferABI.id)
  )
}

export default ContractService
