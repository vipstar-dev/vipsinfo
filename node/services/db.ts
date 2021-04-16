import { ModelCtor } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

import { Header } from '@/lib'
import Tip from '@/node/models/tip'
import { TipModelAttributes } from '@/node/models/tip'
import Service, { BaseConfig, IService } from '@/node/services/base'
import Rpc, { RpcClientConfig } from '@/rpc'

export interface IDBService extends IService, DBAPIMethods {
  APIMethods: DBAPIMethods
}

export interface ITip extends Omit<TipModelAttributes, 'service'> {}

export interface DBAPIMethods {
  getRpcClient: () => Rpc
  getDatabase: () => Sequelize | undefined
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
      getServiceTip: this.getServiceTip.bind(this),
      updateServiceTip: this.updateServiceTip.bind(this)
    }
     */
    return {
      getRpcClient: () => this.getRpcClient(),
      getDatabase: () => this.getDatabase(),
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

  async getServiceTip(serviceName: string): Promise<ITip | undefined> {
    const tip = await this.Tip?.findByPk(serviceName)
    if (tip) {
      return { height: tip.height, hash: tip.hash }
    } else if (this.genesisHash) {
      return { height: 0, hash: this.genesisHash }
    }
  }

  async updateServiceTip(serviceName: string, tip: ITip): Promise<void> {
    await this.Tip?.upsert({
      service: serviceName,
      height: tip.height,
      hash: tip.hash,
    })
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async start() {
    this.sequelize = new Sequelize(this.options.mysql.uri, {
      // databaseVersion: 1,
      dialectOptions: {
        supportBigNumbers: true,
        bigNumberStrings: true,
      },
      logging: false,
      models: [__dirname + '/../models/*.ts'],
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
