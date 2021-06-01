export type chainType = 'mainnet' | 'testnet' | 'regtest'

export interface BIP32 {
  public: number
  private: number
}

export interface IChain {
  name: chainType
  type: chainType
  port: number
  networkMagic: Buffer
  bip32: {
    standard: BIP32
    segwitP2SH: BIP32
    segwitNative: BIP32
  }
  slip44?: number
  pubkeyhash: number
  privatekey: number
  scripthash: number
  witnesshrp: string
  evm: number
  genesis: Buffer
  dnsSeeds?: string[]
}

const chains = new Map<chainType, IChain>()

class Chain implements IChain {
  name: chainType
  type: chainType
  port: number
  networkMagic: Buffer
  bip32: {
    standard: BIP32
    segwitP2SH: BIP32
    segwitNative: BIP32
  }
  slip44?: number
  pubkeyhash: number
  privatekey: number
  scripthash: number
  witnesshrp: string
  evm: number
  genesis: Buffer
  dnsSeeds: string[]

  constructor({
    name,
    type,
    port,
    networkMagic,
    bip32,
    slip44,
    pubkeyhash,
    privatekey,
    scripthash,
    witnesshrp,
    evm,
    genesis,
    dnsSeeds,
  }: IChain) {
    this.name = name
    this.type = type
    this.port = port
    this.networkMagic = networkMagic
    this.bip32 = bip32
    this.slip44 = slip44
    this.pubkeyhash = pubkeyhash
    this.privatekey = privatekey
    this.scripthash = scripthash
    this.witnesshrp = witnesshrp
    this.evm = evm
    this.genesis = genesis
    this.dnsSeeds = dnsSeeds || []
  }

  static add(options: IChain): void {
    const chain = new Chain(options)
    chains.set(chain.name, chain)
  }

  static get(name: chainType): IChain {
    return chains.get(name) as IChain
  }
}

Chain.add({
  name: 'mainnet',
  type: 'mainnet',
  port: 31915,
  networkMagic: Buffer.from([0x01, 0x2c, 0xe7, 0xb5]),
  bip32: {
    standard: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
    segwitP2SH: {
      public: 0x049d7cb2,
      private: 0x049d7878,
    },
    segwitNative: {
      public: 0x04b24746,
      private: 0x04b2430c,
    },
  },
  slip44: 1919,
  pubkeyhash: 70,
  privatekey: 0x80,
  scripthash: 50,
  witnesshrp: 'vips',
  evm: 0x21,
  genesis: Buffer.from(
    '01000000000000000000000000000000000000000000000000000000000000000000000025b61b421f9efb0b6e4a44ce6aa465c310930cae6c57898324264663e4b121386448bb5affff001f65100200e965ffd002cd6ad0e2dc402b8044de833e06b23127ea8c3d80aec9141077149556e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b4210000000000000000000000000000000000000000000000000000000000000000ffffffff000101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff230004bf91221d01041a766970207175616c697479206f6e2074686520776f726c642121ffffffff0100e1f505000000004341766970207175616c697479206f6e2074686520776f726c642121766970207175616c697479206f6e2074686520776f726c642121766970207175616c697479206fac00000000',
    'hex'
  ),
  dnsSeeds: [
    'dnsseed.vips.y-chan.dev',
    'dnsseed.vips.takana.me',
    'seed.nezirin.net',
  ],
})

Chain.add({
  name: 'testnet',
  type: 'testnet',
  port: 13888,
  networkMagic: Buffer.from([0x0d, 0x22, 0x15, 0x06]),
  bip32: {
    standard: {
      public: 0x043587cf,
      private: 0x04358394,
    },
    segwitP2SH: {
      public: 0x044a5262,
      private: 0x044a4e28,
    },
    segwitNative: {
      public: 0x045f1cf6,
      private: 0x045f18bc,
    },
  },
  pubkeyhash: 0x78,
  privatekey: 0xef,
  scripthash: 0x6e,
  witnesshrp: 'tq',
  evm: 0x5c,
  genesis: Buffer.from(
    '0100000000000000000000000000000000000000000000000000000000000000000000006db905142382324db417761891f2d2f355ea92f27ab0fc35e59e90b50e0534edf5d2af59ffff001fc1257000e965ffd002cd6ad0e2dc402b8044de833e06b23127ea8c3d80aec9141077149556e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b4210000000000000000000000000000000000000000000000000000000000000000ffffffff000101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff420004bf91221d0104395365702030322c203230313720426974636f696e20627265616b732024352c30303020696e206c6174657374207072696365206672656e7a79ffffffff0100f2052a010000004341040d61d8653448c98731ee5fffd303c15e71ec2057b77f11ab3601979728cdaff2d68afbba14e4fa0bc44f2072b0b23ef63717f8cdfbe58dcd33f32b6afe98741aac00000000',
    'hex'
  ),
})

Chain.add({
  name: 'regtest',
  type: 'regtest',
  port: 23888,
  networkMagic: Buffer.from([0xfd, 0xdd, 0xc6, 0xe1]),
  bip32: {
    standard: {
      public: 0x043587cf,
      private: 0x04358394,
    },
    segwitP2SH: {
      public: 0x044a5262,
      private: 0x044a4e28,
    },
    segwitNative: {
      public: 0x045f1cf6,
      private: 0x045f18bc,
    },
  },
  pubkeyhash: 0x78,
  privatekey: 0xef,
  scripthash: 0x6e,
  witnesshrp: 'qcrt',
  evm: 0x5c,
  genesis: Buffer.from(
    '0100000000000000000000000000000000000000000000000000000000000000000000006db905142382324db417761891f2d2f355ea92f27ab0fc35e59e90b50e0534edf5d2af59ffff7f2011000000e965ffd002cd6ad0e2dc402b8044de833e06b23127ea8c3d80aec9141077149556e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b4210000000000000000000000000000000000000000000000000000000000000000ffffffff000101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff420004bf91221d0104395365702030322c203230313720426974636f696e20627265616b732024352c30303020696e206c6174657374207072696365206672656e7a79ffffffff0100f2052a010000004341040d61d8653448c98731ee5fffd303c15e71ec2057b77f11ab3601979728cdaff2d68afbba14e4fa0bc44f2072b0b23ef63717f8cdfbe58dcd33f32b6afe98741aac00000000',
    'hex'
  ),
})

export default Chain
