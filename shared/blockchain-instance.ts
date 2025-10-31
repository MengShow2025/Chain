import { TitanChain } from '../blockchain/core/blockchain.js';

/**
 * 全局区块链实例管理器
 * 用于在不同服务间共享同一个区块链实例
 */
class BlockchainInstanceManager {
  private static instance: BlockchainInstanceManager;
  private blockchain: TitanChain | null = null;

  private constructor() {}

  static getInstance(): BlockchainInstanceManager {
    if (!BlockchainInstanceManager.instance) {
      BlockchainInstanceManager.instance = new BlockchainInstanceManager();
    }
    return BlockchainInstanceManager.instance;
  }

  setBlockchain(blockchain: TitanChain): void {
    this.blockchain = blockchain;
  }

  getBlockchain(): TitanChain | null {
    return this.blockchain;
  }

  hasBlockchain(): boolean {
    return this.blockchain !== null;
  }
}

export const blockchainInstance = BlockchainInstanceManager.getInstance();