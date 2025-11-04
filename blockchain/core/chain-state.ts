/**
 * TitanChain区块链状态管理
 * Blockchain State Management for TitanChain
 * 
 * 功能特性 / Features:
 * - 统一的区块链状态管理 / Unified blockchain state management
 * - 从其他节点同步状态 / Sync state from other nodes
 * - 创世区块检查机制 / Genesis block verification mechanism
 * - 链重组和分叉处理 / Chain reorganization and fork handling
 * - 状态持久化和恢复 / State persistence and recovery
 */

import { Block, Transaction, Validator } from '../../shared/types/blockchain.js';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

// 链状态枚举 / Chain state enum
export enum ChainState {
  UNINITIALIZED = 'uninitialized',    // 未初始化 / Uninitialized
  INITIALIZING = 'initializing',      // 初始化中 / Initializing
  SYNCING = 'syncing',                // 同步中 / Syncing
  SYNCHRONIZED = 'synchronized',       // 已同步 / Synchronized
  FORKED = 'forked',                  // 分叉状态 / Forked
  ERROR = 'error'                     // 错误状态 / Error state
}

// 创世区块配置 / Genesis block configuration
export interface GenesisConfig {
  chainId: number;                    // 链ID / Chain ID
  timestamp: number;                  // 创世时间戳 / Genesis timestamp
  difficulty: number;                 // 初始难度 / Initial difficulty
  gasLimit: bigint;                   // Gas限制 / Gas limit
  validators: Validator[];            // 初始验证者 / Initial validators
  extraData?: string;                 // 额外数据 / Extra data
}

// 链状态快照 / Chain state snapshot
export interface ChainSnapshot {
  height: number;                     // 链高度 / Chain height
  lastBlockHash: string;              // 最后区块哈希 / Last block hash
  totalDifficulty: bigint;            // 总难度 / Total difficulty
  stateRoot: string;                  // 状态根 / State root
  timestamp: number;                  // 快照时间戳 / Snapshot timestamp
  validators: Validator[];            // 验证者列表 / Validators list
}

// 分叉信息 / Fork information
export interface ForkInfo {
  forkHeight: number;                 // 分叉高度 / Fork height
  mainChain: Block[];                 // 主链 / Main chain
  forkChain: Block[];                 // 分叉链 / Fork chain
  commonAncestor: Block;              // 共同祖先 / Common ancestor
  resolution: 'main' | 'fork' | 'pending'; // 解决方案 / Resolution
}

// 状态管理配置 / State management configuration
export interface ChainStateConfig {
  dataDir: string;                    // 数据目录 / Data directory
  enablePersistence: boolean;         // 启用持久化 / Enable persistence
  snapshotInterval: number;           // 快照间隔 / Snapshot interval
  maxForkDepth: number;               // 最大分叉深度 / Max fork depth
  pruneOldBlocks: boolean;            // 修剪旧区块 / Prune old blocks
  pruneThreshold: number;             // 修剪阈值 / Prune threshold
}

// 默认配置 / Default configuration
const DEFAULT_CONFIG: ChainStateConfig = {
  dataDir: './data/blockchain',
  enablePersistence: true,
  snapshotInterval: 100,              // 每100个区块快照一次 / Snapshot every 100 blocks
  maxForkDepth: 10,
  pruneOldBlocks: false,
  pruneThreshold: 10000               // 保留最近10000个区块 / Keep recent 10000 blocks
};

/**
 * 区块链状态管理器
 * Blockchain State Manager
 */
export class ChainStateManager extends EventEmitter {
  private config: ChainStateConfig;
  private state: ChainState = ChainState.UNINITIALIZED;
  private blockchain: Block[] = [];
  private currentBlock: Block | null = null;
  private genesisBlock: Block | null = null;
  private genesisConfig: GenesisConfig | null = null;
  private forks: Map<number, ForkInfo> = new Map();
  private snapshots: Map<number, ChainSnapshot> = new Map();
  private totalDifficulty: bigint = BigInt(0);
  private stateRoot: string = '';

  constructor(config?: Partial<ChainStateConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 确保数据目录存在 / Ensure data directory exists
    this.ensureDataDirectory();
  }

  /**
   * 初始化链状态 / Initialize chain state
   */
  async initialize(genesisConfig?: GenesisConfig): Promise<void> {
    console.log('🔧 初始化区块链状态管理器 / Initializing blockchain state manager...');
    
    try {
      this.setState(ChainState.INITIALIZING);
      
      // 尝试从持久化存储加载状态 / Try to load state from persistent storage
      const loaded = await this.loadPersistedState();
      
      if (!loaded) {
        // 如果没有持久化状态，创建新的创世区块 / If no persisted state, create new genesis
        if (genesisConfig) {
          await this.createGenesisBlock(genesisConfig);
        } else {
          throw new Error('需要创世区块配置来初始化新链 / Genesis config required to initialize new chain');
        }
      } else {
        console.log('✅ 从持久化存储加载状态成功 / Successfully loaded state from persistent storage');
      }
      
      // 验证链完整性 / Validate chain integrity
      await this.validateChainIntegrity();
      
      this.setState(ChainState.SYNCHRONIZED);
      console.log('✅ 区块链状态管理器初始化完成 / Blockchain state manager initialized');
      
      // 发出初始化完成事件 / Emit initialization complete event
      this.emit('initialized', {
        height: this.getHeight(),
        genesisHash: this.genesisBlock?.hash,
        currentHash: this.currentBlock?.hash
      });
      
    } catch (error) {
      console.error('❌ 初始化区块链状态管理器失败 / Failed to initialize blockchain state manager:', error);
      this.setState(ChainState.ERROR);
      throw error;
    }
  }

  /**
   * 创建创世区块 / Create genesis block
   */
  async createGenesisBlock(config: GenesisConfig): Promise<Block> {
    console.log('🌱 创建创世区块 / Creating genesis block...');
    
    this.genesisConfig = config;
    
    // 创建创世区块 / Create genesis block
    const genesisBlock: Block = {
      number: 0,
      hash: this.calculateGenesisHash(config),
      parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: config.timestamp,
      validator: 'genesis',
      transactions: [],
      gasLimit: config.gasLimit,
      gasUsed: BigInt(0),
      difficulty: config.difficulty,
      nonce: 0,
      extraData: config.extraData || '',
      stateRoot: this.calculateInitialStateRoot(config),
      transactionsRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
      receiptsRoot: '0x0000000000000000000000000000000000000000000000000000000000000000'
    };
    
    // 设置创世区块 / Set genesis block
    this.genesisBlock = genesisBlock;
    this.blockchain = [genesisBlock];
    this.currentBlock = genesisBlock;
    this.totalDifficulty = BigInt(config.difficulty);
    this.stateRoot = genesisBlock.stateRoot;
    
    // 持久化创世区块 / Persist genesis block
    if (this.config.enablePersistence) {
      await this.persistGenesisBlock(genesisBlock, config);
    }
    
    console.log(`✅ 创世区块创建成功 / Genesis block created: ${genesisBlock.hash}`);
    
    // 发出创世区块创建事件 / Emit genesis block created event
    this.emit('genesisCreated', genesisBlock);
    
    return genesisBlock;
  }

  /**
   * 添加区块到链 / Add block to chain
   */
  async addBlock(block: Block): Promise<boolean> {
    try {
      console.log(`📦 添加区块到链 / Adding block to chain: #${block.number}`);
      
      // 验证区块 / Validate block
      if (!await this.validateBlock(block)) {
        console.error(`❌ 区块验证失败 / Block validation failed: #${block.number}`);
        return false;
      }
      
      // 检查是否为分叉 / Check if it's a fork
      const existingBlock = this.getBlockByNumber(block.number);
      if (existingBlock && existingBlock.hash !== block.hash) {
        console.warn(`🔀 检测到分叉 / Fork detected at height #${block.number}`);
        return await this.handleFork(existingBlock, block);
      }
      
      // 添加区块 / Add block
      if (block.number === this.blockchain.length) {
        // 正常顺序添加 / Normal sequential addition
        this.blockchain.push(block);
        this.currentBlock = block;
        this.totalDifficulty += BigInt(block.difficulty);
        
        // 更新状态根 / Update state root
        this.stateRoot = block.stateRoot;
        
        console.log(`✅ 区块添加成功 / Block added successfully: #${block.number} (${block.hash.substring(0, 10)}...)`);
        
        // 创建快照 / Create snapshot
        if (block.number % this.config.snapshotInterval === 0) {
          await this.createSnapshot(block.number);
        }
        
        // 持久化区块 / Persist block
        if (this.config.enablePersistence) {
          await this.persistBlock(block);
        }
        
        // 修剪旧区块 / Prune old blocks
        if (this.config.pruneOldBlocks && this.blockchain.length > this.config.pruneThreshold) {
          await this.pruneOldBlocks();
        }
        
        // 发出区块添加事件 / Emit block added event
        this.emit('blockAdded', { block, height: this.getHeight() });
        
        return true;
      } else {
        console.warn(`⚠️ 区块高度不连续 / Non-sequential block height: expected ${this.blockchain.length}, got ${block.number}`);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ 添加区块失败 / Failed to add block #${block.number}:`, error);
      return false;
    }
  }

  /**
   * 处理分叉 / Handle fork
   */
  private async handleFork(localBlock: Block, remoteBlock: Block): Promise<boolean> {
    console.log(`🔀 处理分叉 / Handling fork at height #${localBlock.number}`);
    
    // 创建分叉信息 / Create fork info
    const forkInfo: ForkInfo = {
      forkHeight: localBlock.number,
      mainChain: [localBlock],
      forkChain: [remoteBlock],
      commonAncestor: this.getBlockByNumber(localBlock.number - 1)!,
      resolution: 'pending'
    };
    
    this.forks.set(localBlock.number, forkInfo);
    this.setState(ChainState.FORKED);
    
    // 应用最长链规则 / Apply longest chain rule
    const resolution = await this.resolveFork(forkInfo);
    
    if (resolution === 'fork') {
      // 切换到分叉链 / Switch to fork chain
      await this.switchToFork(forkInfo);
      console.log(`✅ 分叉解决：切换到分叉链 / Fork resolved: switched to fork chain`);
      
      // 发出分叉解决事件 / Emit fork resolved event
      this.emit('forkResolved', { forkInfo, resolution: 'fork' });
      
      return true;
    } else {
      // 保持主链 / Keep main chain
      console.log(`✅ 分叉解决：保持主链 / Fork resolved: kept main chain`);
      
      // 发出分叉解决事件 / Emit fork resolved event
      this.emit('forkResolved', { forkInfo, resolution: 'main' });
      
      return false;
    }
  }

  /**
   * 解决分叉 / Resolve fork
   */
  private async resolveFork(forkInfo: ForkInfo): Promise<'main' | 'fork'> {
    // 简化的最长链规则：比较总难度 / Simplified longest chain rule: compare total difficulty
    const mainDifficulty = this.calculateChainDifficulty(forkInfo.mainChain);
    const forkDifficulty = this.calculateChainDifficulty(forkInfo.forkChain);
    
    if (forkDifficulty > mainDifficulty) {
      return 'fork';
    } else if (mainDifficulty > forkDifficulty) {
      return 'main';
    } else {
      // 难度相同时，选择哈希值较小的 / If difficulty is same, choose smaller hash
      return forkInfo.mainChain[0].hash < forkInfo.forkChain[0].hash ? 'main' : 'fork';
    }
  }

  /**
   * 切换到分叉链 / Switch to fork
   */
  private async switchToFork(forkInfo: ForkInfo): Promise<void> {
    console.log(`🔄 切换到分叉链 / Switching to fork chain at height #${forkInfo.forkHeight}`);
    
    // 回滚到共同祖先 / Rollback to common ancestor
    const rollbackHeight = forkInfo.commonAncestor.number;
    this.blockchain = this.blockchain.slice(0, rollbackHeight + 1);
    
    // 应用分叉链的区块 / Apply fork chain blocks
    for (const block of forkInfo.forkChain) {
      this.blockchain.push(block);
      this.currentBlock = block;
    }
    
    // 重新计算总难度 / Recalculate total difficulty
    this.totalDifficulty = this.calculateChainDifficulty(this.blockchain);
    
    // 更新状态 / Update state
    this.setState(ChainState.SYNCHRONIZED);
    
    // 发出链重组事件 / Emit chain reorganization event
    this.emit('chainReorganized', {
      oldHeight: forkInfo.forkHeight,
      newHeight: this.getHeight(),
      rollbackHeight
    });
  }

  /**
   * 计算链难度 / Calculate chain difficulty
   */
  private calculateChainDifficulty(chain: Block[]): bigint {
    return chain.reduce((total, block) => total + BigInt(block.difficulty), BigInt(0));
  }

  /**
   * 验证区块 / Validate block
   */
  private async validateBlock(block: Block): Promise<boolean> {
    try {
      // 基本验证 / Basic validation
      if (block.number < 0) {
        console.error('区块号不能为负数 / Block number cannot be negative');
        return false;
      }
      
      if (block.number === 0) {
        // 验证创世区块 / Validate genesis block
        return this.validateGenesisBlock(block);
      }
      
      // 验证父区块 / Validate parent block
      const parentBlock = this.getBlockByNumber(block.number - 1);
      if (!parentBlock) {
        console.error(`父区块不存在 / Parent block not found: #${block.number - 1}`);
        return false;
      }
      
      if (block.parentHash !== parentBlock.hash) {
        console.error('父区块哈希不匹配 / Parent block hash mismatch');
        return false;
      }
      
      // 验证时间戳 / Validate timestamp
      if (block.timestamp <= parentBlock.timestamp) {
        console.error('区块时间戳必须大于父区块 / Block timestamp must be greater than parent');
        return false;
      }
      
      // 验证区块哈希 / Validate block hash
      const expectedHash = this.calculateBlockHash(block);
      if (block.hash !== expectedHash) {
        console.error('区块哈希不匹配 / Block hash mismatch');
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('验证区块时出错 / Error validating block:', error);
      return false;
    }
  }

  /**
   * 验证创世区块 / Validate genesis block
   */
  private validateGenesisBlock(block: Block): boolean {
    if (!this.genesisBlock) {
      return true; // 如果没有创世区块，接受第一个 / If no genesis block, accept first one
    }
    
    return block.hash === this.genesisBlock.hash;
  }

  /**
   * 验证链完整性 / Validate chain integrity
   */
  private async validateChainIntegrity(): Promise<boolean> {
    console.log('🔍 验证链完整性 / Validating chain integrity...');
    
    try {
      if (this.blockchain.length === 0) {
        console.warn('⚠️ 区块链为空 / Blockchain is empty');
        return false;
      }
      
      // 验证创世区块 / Validate genesis block
      if (!this.validateGenesisBlock(this.blockchain[0])) {
        console.error('❌ 创世区块验证失败 / Genesis block validation failed');
        return false;
      }
      
      // 验证链连续性 / Validate chain continuity
      for (let i = 1; i < this.blockchain.length; i++) {
        const currentBlock = this.blockchain[i];
        const parentBlock = this.blockchain[i - 1];
        
        if (currentBlock.parentHash !== parentBlock.hash) {
          console.error(`❌ 链连续性验证失败 / Chain continuity validation failed at block #${i}`);
          return false;
        }
        
        if (currentBlock.number !== parentBlock.number + 1) {
          console.error(`❌ 区块号不连续 / Block number not sequential at block #${i}`);
          return false;
        }
      }
      
      console.log('✅ 链完整性验证通过 / Chain integrity validation passed');
      return true;
      
    } catch (error) {
      console.error('❌ 验证链完整性时出错 / Error validating chain integrity:', error);
      return false;
    }
  }

  /**
   * 创建快照 / Create snapshot
   */
  private async createSnapshot(height: number): Promise<void> {
    try {
      const snapshot: ChainSnapshot = {
        height,
        lastBlockHash: this.currentBlock?.hash || '',
        totalDifficulty: this.totalDifficulty,
        stateRoot: this.stateRoot,
        timestamp: Date.now(),
        validators: this.genesisConfig?.validators || []
      };
      
      this.snapshots.set(height, snapshot);
      
      // 持久化快照 / Persist snapshot
      if (this.config.enablePersistence) {
        await this.persistSnapshot(snapshot);
      }
      
      console.log(`📸 创建快照 / Created snapshot at height #${height}`);
      
      // 发出快照创建事件 / Emit snapshot created event
      this.emit('snapshotCreated', snapshot);
      
    } catch (error) {
      console.error(`❌ 创建快照失败 / Failed to create snapshot at height #${height}:`, error);
    }
  }

  /**
   * 从快照恢复 / Restore from snapshot
   */
  async restoreFromSnapshot(height: number): Promise<boolean> {
    try {
      console.log(`🔄 从快照恢复 / Restoring from snapshot at height #${height}`);
      
      const snapshot = this.snapshots.get(height) || await this.loadSnapshot(height);
      if (!snapshot) {
        console.error(`❌ 快照不存在 / Snapshot not found at height #${height}`);
        return false;
      }
      
      // 恢复状态 / Restore state
      this.totalDifficulty = snapshot.totalDifficulty;
      this.stateRoot = snapshot.stateRoot;
      
      // 截断区块链到快照高度 / Truncate blockchain to snapshot height
      this.blockchain = this.blockchain.slice(0, height + 1);
      this.currentBlock = this.blockchain[this.blockchain.length - 1];
      
      console.log(`✅ 从快照恢复成功 / Successfully restored from snapshot at height #${height}`);
      
      // 发出快照恢复事件 / Emit snapshot restored event
      this.emit('snapshotRestored', { height, snapshot });
      
      return true;
      
    } catch (error) {
      console.error(`❌ 从快照恢复失败 / Failed to restore from snapshot at height #${height}:`, error);
      return false;
    }
  }

  /**
   * 修剪旧区块 / Prune old blocks
   */
  private async pruneOldBlocks(): Promise<void> {
    try {
      const pruneHeight = this.blockchain.length - this.config.pruneThreshold;
      if (pruneHeight <= 0) return;
      
      console.log(`✂️ 修剪旧区块 / Pruning old blocks up to height #${pruneHeight}`);
      
      // 保留最近的区块 / Keep recent blocks
      this.blockchain = this.blockchain.slice(pruneHeight);
      
      // 删除旧快照 / Remove old snapshots
      for (const [height] of this.snapshots.entries()) {
        if (height < pruneHeight) {
          this.snapshots.delete(height);
        }
      }
      
      console.log(`✅ 修剪完成 / Pruning completed, kept ${this.blockchain.length} blocks`);
      
      // 发出修剪事件 / Emit pruning event
      this.emit('blocksPruned', { pruneHeight, remainingBlocks: this.blockchain.length });
      
    } catch (error) {
      console.error('❌ 修剪旧区块失败 / Failed to prune old blocks:', error);
    }
  }

  /**
   * 持久化相关方法 / Persistence related methods
   */
  
  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.dataDir, { recursive: true });
    } catch (error) {
      console.warn('创建数据目录失败 / Failed to create data directory:', error);
    }
  }

  private async loadPersistedState(): Promise<boolean> {
    if (!this.config.enablePersistence) return false;
    
    try {
      // 加载创世区块 / Load genesis block
      const genesisPath = path.join(this.config.dataDir, 'genesis.json');
      const genesisData = await fs.readFile(genesisPath, 'utf-8');
      const { block: genesisBlock, config: genesisConfig } = JSON.parse(genesisData);
      
      this.genesisBlock = this.parseBlock(genesisBlock);
      this.genesisConfig = genesisConfig;
      
      // 加载区块链 / Load blockchain
      const chainPath = path.join(this.config.dataDir, 'blockchain.json');
      const chainData = await fs.readFile(chainPath, 'utf-8');
      const chainInfo = JSON.parse(chainData);
      
      this.blockchain = chainInfo.blocks.map((block: any) => this.parseBlock(block));
      this.currentBlock = this.blockchain[this.blockchain.length - 1];
      this.totalDifficulty = BigInt(chainInfo.totalDifficulty);
      this.stateRoot = chainInfo.stateRoot;
      
      return true;
      
    } catch (error) {
      console.log('加载持久化状态失败，将创建新状态 / Failed to load persisted state, will create new state');
      return false;
    }
  }

  private async persistGenesisBlock(block: Block, config: GenesisConfig): Promise<void> {
    if (!this.config.enablePersistence) return;
    
    try {
      const genesisPath = path.join(this.config.dataDir, 'genesis.json');
      const data = {
        block: this.normalizeBlock(block),
        config
      };
      
      await fs.writeFile(genesisPath, JSON.stringify(data, null, 2));
      
    } catch (error) {
      console.error('持久化创世区块失败 / Failed to persist genesis block:', error);
    }
  }

  private async persistBlock(block: Block): Promise<void> {
    if (!this.config.enablePersistence) return;
    
    try {
      const chainPath = path.join(this.config.dataDir, 'blockchain.json');
      const data = {
        blocks: this.blockchain.map(b => this.normalizeBlock(b)),
        totalDifficulty: this.totalDifficulty.toString(),
        stateRoot: this.stateRoot,
        lastUpdated: Date.now()
      };
      
      await fs.writeFile(chainPath, JSON.stringify(data, null, 2));
      
    } catch (error) {
      console.error('持久化区块失败 / Failed to persist block:', error);
    }
  }

  private async persistSnapshot(snapshot: ChainSnapshot): Promise<void> {
    if (!this.config.enablePersistence) return;
    
    try {
      const snapshotPath = path.join(this.config.dataDir, `snapshot-${snapshot.height}.json`);
      await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
      
    } catch (error) {
      console.error('持久化快照失败 / Failed to persist snapshot:', error);
    }
  }

  private async loadSnapshot(height: number): Promise<ChainSnapshot | null> {
    if (!this.config.enablePersistence) return null;
    
    try {
      const snapshotPath = path.join(this.config.dataDir, `snapshot-${height}.json`);
      const data = await fs.readFile(snapshotPath, 'utf-8');
      return JSON.parse(data);
      
    } catch (error) {
      return null;
    }
  }

  /**
   * 工具方法 / Utility methods
   */
  
  private calculateGenesisHash(config: GenesisConfig): string {
    const data = `${config.chainId}${config.timestamp}${config.difficulty}${config.gasLimit}${config.extraData || ''}`;
    return '0x' + Buffer.from(data).toString('hex').substring(0, 64).padStart(64, '0');
  }

  private calculateInitialStateRoot(config: GenesisConfig): string {
    // 简化的状态根计算 / Simplified state root calculation
    const data = config.validators.map(v => v.address).join('');
    return '0x' + Buffer.from(data).toString('hex').substring(0, 64).padStart(64, '0');
  }

  private calculateBlockHash(block: Block): string {
    const data = `${block.number}${block.parentHash}${block.timestamp}${block.validator}${block.stateRoot}`;
    return '0x' + Buffer.from(data).toString('hex').substring(0, 64).padStart(64, '0');
  }

  private parseBlock(block: any): Block {
    return {
      ...block,
      number: Number(block.number),
      timestamp: Number(block.timestamp),
      gasLimit: BigInt(block.gasLimit || 0),
      gasUsed: BigInt(block.gasUsed || 0),
      difficulty: Number(block.difficulty),
      nonce: Number(block.nonce)
    };
  }

  private normalizeBlock(block: Block): any {
    return {
      ...block,
      gasLimit: block.gasLimit.toString(),
      gasUsed: block.gasUsed.toString()
    };
  }

  private setState(newState: ChainState): void {
    const oldState = this.state;
    this.state = newState;
    
    console.log(`🔄 链状态变化 / Chain state changed: ${oldState} -> ${newState}`);
    
    // 发出状态变化事件 / Emit state change event
    this.emit('stateChanged', { oldState, newState });
  }

  // 公共方法 / Public methods

  /**
   * 获取链状态 / Get chain state
   */
  getState(): ChainState {
    return this.state;
  }

  /**
   * 获取链高度 / Get chain height
   */
  getHeight(): number {
    return this.blockchain.length - 1;
  }

  /**
   * 获取当前区块 / Get current block
   */
  getCurrentBlock(): Block | null {
    return this.currentBlock;
  }

  /**
   * 获取创世区块 / Get genesis block
   */
  getGenesisBlock(): Block | null {
    return this.genesisBlock;
  }

  /**
   * 根据高度获取区块 / Get block by number
   */
  getBlockByNumber(height: number): Block | null {
    return this.blockchain[height] || null;
  }

  /**
   * 根据哈希获取区块 / Get block by hash
   */
  getBlockByHash(hash: string): Block | null {
    return this.blockchain.find(block => block.hash === hash) || null;
  }

  /**
   * 获取区块链 / Get blockchain
   */
  getBlockchain(): Block[] {
    return [...this.blockchain]; // 返回副本 / Return copy
  }

  /**
   * 获取总难度 / Get total difficulty
   */
  getTotalDifficulty(): bigint {
    return this.totalDifficulty;
  }

  /**
   * 获取状态根 / Get state root
   */
  getStateRoot(): string {
    return this.stateRoot;
  }

  /**
   * 获取分叉信息 / Get fork info
   */
  getForks(): ForkInfo[] {
    return Array.from(this.forks.values());
  }

  /**
   * 获取快照 / Get snapshots
   */
  getSnapshots(): ChainSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * 检查是否已初始化 / Check if initialized
   */
  isInitialized(): boolean {
    return this.state !== ChainState.UNINITIALIZED && this.state !== ChainState.ERROR;
  }

  /**
   * 检查是否已同步 / Check if synchronized
   */
  isSynchronized(): boolean {
    return this.state === ChainState.SYNCHRONIZED;
  }

  /**
   * 检查是否存在分叉 / Check if forked
   */
  isForked(): boolean {
    return this.state === ChainState.FORKED;
  }

  /**
   * 重置状态 / Reset state
   */
  async reset(): Promise<void> {
    console.log('🔄 重置区块链状态 / Resetting blockchain state...');
    
    this.blockchain = [];
    this.currentBlock = null;
    this.genesisBlock = null;
    this.genesisConfig = null;
    this.forks.clear();
    this.snapshots.clear();
    this.totalDifficulty = BigInt(0);
    this.stateRoot = '';
    this.setState(ChainState.UNINITIALIZED);
    
    // 发出重置事件 / Emit reset event
    this.emit('reset');
    
    console.log('✅ 区块链状态已重置 / Blockchain state reset');
  }
}