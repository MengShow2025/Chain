#!/usr/bin/env tsx

import { TitanChain } from './core/blockchain.js';
import { ValidatorManager } from './consensus/validator-manager.js';
import { P2PNode } from '../network/p2p-node.js';
import { CONSENSUS_CONFIG, NETWORK_CONFIG, PERFORMANCE_CONFIG } from '../shared/constants/blockchain.js';
import { Validator } from '../shared/types/blockchain.js';
import { blockchainInstance } from '../shared/blockchain-instance';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// 加载环境变量
dotenv.config();

/**
 * TitanChain 区块链节点启动器
 */
class TitanChainNode {
  private blockchain: TitanChain;
  private validatorManager: ValidatorManager;
  private isRunning: boolean = false;
  private p2pNode?: P2PNode;

  constructor() {
    console.log('🚀 Initializing TitanChain Node...');
    this.blockchain = new TitanChain();
    this.validatorManager = new ValidatorManager();
    
    // 注册全局区块链实例
    blockchainInstance.setBlockchain(this.blockchain);
  }

  /**
   * 启动区块链节点
   */
  async start(): Promise<void> {
    try {
      console.log('🔧 Starting TitanChain blockchain node...');
      console.log(`📊 Network: ${NETWORK_CONFIG.NETWORK_NAME} (Chain ID: ${NETWORK_CONFIG.CHAIN_ID})`);
      console.log(`⚡ Target TPS: ${PERFORMANCE_CONFIG.TARGET_TPS || 200000}`);
      console.log(`👥 Max Validators: ${CONSENSUS_CONFIG.MAX_VALIDATORS}`);
      console.log(`⏱️  Block Time: ${CONSENSUS_CONFIG.BLOCK_TIME}s`);

      // 获取创世验证节点
      const genesisValidators = await this.getGenesisValidators();
      console.log(`🏛️  Genesis validators: ${genesisValidators.length}`);

      // 初始化验证节点管理器
      await this.validatorManager.initialize(genesisValidators);

      // 启动区块链
      await this.blockchain.start(genesisValidators);

      this.isRunning = true;
      console.log('✅ TitanChain node started successfully!');
      console.log(`🌐 RPC URL: ${NETWORK_CONFIG.RPC_URL}`);
      console.log(`🔍 Explorer: ${NETWORK_CONFIG.EXPLORER_URL}`);

      // 设置优雅关闭
      this.setupGracefulShutdown();

      // 启动状态监控
      this.startStatusMonitoring();

      // 启动P2P网络
      try {
        this.p2pNode = new P2PNode(this.blockchain, {
          port: Number(process.env.P2P_PORT || 4001),
          host: process.env.P2P_HOST || '0.0.0.0',
          bootnodes: (process.env.BOOTNODES || '').split(',').map(s => s.trim()).filter(Boolean)
        });
        await this.p2pNode.start();
        console.log('🕸️ P2P networking layer started');
      } catch (p2pError) {
        console.warn('⚠️ Failed to start P2P networking layer:', p2pError);
      }

      // 在同一进程中启动API服务，确保能够访问全局blockchain实例
      try {
        const { default: app } = await import('../api/app.js');
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
          console.log(`API Server ready on port ${PORT}`);
        });
      } catch (apiError) {
        console.warn('⚠️ Failed to start API server within node process:', apiError);
      }

    } catch (error) {
      console.error('❌ Failed to start TitanChain node:', error);
      process.exit(1);
    }
  }

  /**
   * 获取创世验证节点
   */
  private async getGenesisValidators(): Promise<Validator[]> {
    // 从验证节点管理器获取活跃验证节点
    const validators = await this.validatorManager.getActiveValidators();
    
    if (validators.length === 0) {
      console.log('⚠️  No existing validators found, creating genesis validators...');
      // 如果没有现有验证节点，创建创世验证节点
      return this.createGenesisValidators();
    }

    return validators;
  }

  /**
   * 创建创世验证节点
   */
  private createGenesisValidators(): Validator[] {
    const validators: Validator[] = [];

    // 支持从文件加载创世验证者：默认 ./genesis-wallets.json 或环境变量 GENESIS_WALLETS_FILE
    const defaultFile = path.resolve(process.cwd(), 'genesis-wallets.json');
    const filePath = process.env.GENESIS_WALLETS_FILE
      ? path.resolve(process.cwd(), process.env.GENESIS_WALLETS_FILE)
      : defaultFile;

    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const wallets: Array<{ address: string; publicKey: string }> = JSON.parse(raw);
        const maxCount = Math.min(CONSENSUS_CONFIG.MAX_VALIDATORS, wallets.length);
        for (let i = 0; i < maxCount; i++) {
          const { address, publicKey } = wallets[i];
          const stake = CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE * BigInt(2);
          const validator: Validator = {
            address,
            publicKey,
            stake,
            delegatedStake: BigInt(0),
            totalStake: stake,
            commission: 5,
            status: 'active',
            performance: {
              blocksProduced: 0,
              blocksExpected: 0,
              uptime: 100,
              missedBlocks: 0,
              slashingEvents: 0,
              averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
              score: 100
            },
            metadata: {
              name: `Genesis Validator ${i + 1}`,
              description: 'Genesis validator node',
              website: `https://validator${i + 1}.titanchain.io`
            },
            joinedAt: Date.now(),
            lastActiveBlock: 0
          };
          validators.push(validator);
        }
        console.log(`🏛️  Loaded ${validators.length} genesis validators from ${filePath}`);
        return validators;
      } catch (e) {
        console.warn(`⚠️  Failed to load genesis wallets from ${filePath}:`, e);
      }
    }

    // 回退：生成占位创世验证者
    const validatorCount = Math.min(CONSENSUS_CONFIG.MAX_VALIDATORS, 21);
    for (let i = 0; i < validatorCount; i++) {
      const address = `0x${i.toString(16).padStart(40, '0')}`;
      const publicKey = `0x${(i + 1000).toString(16).padStart(128, '0')}`;
      const stake = CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE * BigInt(2);
      const validator: Validator = {
        address,
        publicKey,
        stake,
        delegatedStake: BigInt(0),
        totalStake: stake,
        commission: 5,
        status: 'active',
        performance: {
          blocksProduced: 0,
          blocksExpected: 0,
          uptime: 100,
          missedBlocks: 0,
          slashingEvents: 0,
          averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
          score: 100
        },
        metadata: {
          name: `Genesis Validator ${i + 1}`,
          description: 'Genesis validator node',
          website: `https://validator${i + 1}.titanchain.io`
        },
        joinedAt: Date.now(),
        lastActiveBlock: 0
      };
      validators.push(validator);
    }
    console.log(`🏗️  Created ${validators.length} default genesis validators`);
    return validators;
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      if (this.isRunning) {
        this.isRunning = false;
        
        try {
          if (this.p2pNode) {
            await this.p2pNode.stop();
          }
          await this.blockchain.stop();
          console.log('✅ TitanChain node stopped successfully');
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
        }
      }
      
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  }

  /**
   * 启动状态监控
   */
  private startStatusMonitoring(): void {
    setInterval(() => {
      if (!this.isRunning) return;

      try {
        const stats = this.blockchain.getNetworkStats();
        const poolStats = this.blockchain.getTransactionPoolStats();
        
        console.log(
          `📊 Network Stats - Blocks: ${stats.blockHeight}, TXs: ${stats.totalTransactions}, TPS: ${stats.currentTPS}, Pool: ${poolStats.pendingTransactions}`
        );
      } catch (error) {
        console.error('❌ Error getting network stats:', error);
      }
    }, 30000); // 每30秒输出一次状态
  }

  /**
   * 停止节点
   */
  async stop(): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false;
      if (this.p2pNode) {
        await this.p2pNode.stop();
      }
      await this.blockchain.stop();
      console.log('🛑 TitanChain node stopped');
    }
  }
}

// 主函数
async function main() {
  console.log('🌟 TitanChain Blockchain Node');
  console.log('================================');
  
  const node = new TitanChainNode();
  await node.start();
}

// 启动节点 - 直接执行主函数
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

export { TitanChainNode };