/**
 * TitanChain区块同步协议
 * Block Synchronization Protocol for TitanChain
 * 
 * 功能特性 / Features:
 * - 批量区块同步 / Batch block synchronization
 * - 区块验证和冲突解决 / Block validation and conflict resolution
 * - 最长链规则 / Longest chain rule
 * - 分叉检测和处理 / Fork detection and handling
 * - 增量同步和全量同步 / Incremental and full synchronization
 */

import { Block, Transaction } from '../../shared/types/blockchain.js';
import { BlockValidator } from './block-validator.js';
import { EventEmitter } from 'events';

// 同步状态枚举 / Sync status enum
export enum SyncStatus {
  IDLE = 'idle',                    // 空闲 / Idle
  SYNCING = 'syncing',             // 同步中 / Syncing
  CATCHING_UP = 'catching_up',     // 追赶中 / Catching up
  SYNCHRONIZED = 'synchronized',    // 已同步 / Synchronized
  ERROR = 'error'                  // 错误 / Error
}

// 同步请求类型 / Sync request type
export interface SyncRequest {
  fromHeight: number;              // 起始高度 / Start height
  toHeight?: number;               // 结束高度 / End height
  maxBlocks?: number;              // 最大区块数 / Max blocks
  peerId: string;                  // 请求节点ID / Requesting peer ID
}

// 同步响应类型 / Sync response type
export interface SyncResponse {
  blocks: Block[];                 // 区块列表 / Block list
  fromHeight: number;              // 起始高度 / Start height
  toHeight: number;                // 结束高度 / End height
  hasMore: boolean;                // 是否有更多 / Has more blocks
}

// 区块冲突信息 / Block conflict info
export interface BlockConflict {
  height: number;                  // 冲突高度 / Conflict height
  localBlock: Block;               // 本地区块 / Local block
  remoteBlock: Block;              // 远程区块 / Remote block
  resolution: 'local' | 'remote' | 'pending'; // 解决方案 / Resolution
}

// 同步统计信息 / Sync statistics
export interface SyncStats {
  status: SyncStatus;              // 同步状态 / Sync status
  currentHeight: number;           // 当前高度 / Current height
  targetHeight: number;            // 目标高度 / Target height
  syncedBlocks: number;            // 已同步区块数 / Synced blocks
  syncSpeed: number;               // 同步速度(块/秒) / Sync speed (blocks/sec)
  startTime: number;               // 开始时间 / Start time
  lastSyncTime: number;            // 最后同步时间 / Last sync time
  errors: number;                  // 错误次数 / Error count
}

// 同步配置 / Sync configuration
export interface SyncConfig {
  maxBatchSize: number;            // 最大批量大小 / Max batch size
  syncTimeout: number;             // 同步超时时间 / Sync timeout
  maxRetries: number;              // 最大重试次数 / Max retries
  conflictResolutionTimeout: number; // 冲突解决超时 / Conflict resolution timeout
  enableForkDetection: boolean;    // 启用分叉检测 / Enable fork detection
  maxForkDepth: number;            // 最大分叉深度 / Max fork depth
}

// 默认同步配置 / Default sync configuration
const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxBatchSize: 100,               // 每批最多100个区块 / Max 100 blocks per batch
  syncTimeout: 30000,              // 30秒超时 / 30 seconds timeout
  maxRetries: 3,                   // 最多重试3次 / Max 3 retries
  conflictResolutionTimeout: 10000, // 10秒冲突解决超时 / 10 seconds conflict resolution timeout
  enableForkDetection: true,       // 启用分叉检测 / Enable fork detection
  maxForkDepth: 10                 // 最大分叉深度10 / Max fork depth 10
};

/**
 * 区块同步协议实现
 * Block synchronization protocol implementation
 */
export class BlockSyncProtocol extends EventEmitter {
  private blockValidator: BlockValidator;
  private config: SyncConfig;
  private stats: SyncStats;
  private conflicts: Map<number, BlockConflict> = new Map();
  private syncRequests: Map<string, SyncRequest> = new Map();
  private blockchain: Block[] = [];
  private currentBlock: Block | null = null;

  constructor(blockValidator: BlockValidator, config?: Partial<SyncConfig>) {
    super();
    this.blockValidator = blockValidator;
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    
    // 初始化统计信息 / Initialize statistics
    this.stats = {
      status: SyncStatus.IDLE,
      currentHeight: 0,
      targetHeight: 0,
      syncedBlocks: 0,
      syncSpeed: 0,
      startTime: 0,
      lastSyncTime: 0,
      errors: 0
    };
  }

  /**
   * 设置区块链状态 / Set blockchain state
   */
  setBlockchainState(blockchain: Block[], currentBlock: Block | null): void {
    this.blockchain = [...blockchain];
    this.currentBlock = currentBlock;
    this.stats.currentHeight = currentBlock?.number || 0;
  }

  /**
   * 请求区块同步 / Request block synchronization
   */
  async requestSync(fromHeight: number, toHeight?: number, peerId?: string): Promise<SyncResponse> {
    const request: SyncRequest = {
      fromHeight,
      toHeight,
      maxBlocks: this.config.maxBatchSize,
      peerId: peerId || 'unknown'
    };

    console.log(`🔄 请求同步区块 / Requesting sync blocks: ${fromHeight} -> ${toHeight || 'latest'}`);
    
    try {
      // 更新同步状态 / Update sync status
      this.updateSyncStatus(SyncStatus.SYNCING);
      
      // 获取区块 / Get blocks
      const blocks = this.getBlocksInRange(fromHeight, toHeight);
      
      const response: SyncResponse = {
        blocks,
        fromHeight,
        toHeight: blocks.length > 0 ? blocks[blocks.length - 1].number : fromHeight,
        hasMore: toHeight ? false : (blocks.length === this.config.maxBatchSize)
      };

      console.log(`✅ 同步响应 / Sync response: ${response.blocks.length} blocks`);
      return response;
      
    } catch (error) {
      console.error('❌ 同步请求失败 / Sync request failed:', error);
      this.stats.errors++;
      this.updateSyncStatus(SyncStatus.ERROR);
      throw error;
    }
  }

  /**
   * 处理同步响应 / Handle sync response
   */
  async handleSyncResponse(response: SyncResponse, peerId: string): Promise<boolean> {
    console.log(`📥 处理同步响应 / Handling sync response: ${response.blocks.length} blocks from ${peerId}`);
    
    try {
      let successCount = 0;
      
      for (const block of response.blocks) {
        const success = await this.processIncomingBlock(block, peerId);
        if (success) {
          successCount++;
        }
      }

      // 更新统计信息 / Update statistics
      this.stats.syncedBlocks += successCount;
      this.stats.lastSyncTime = Date.now();
      this.calculateSyncSpeed();

      // 检查是否完成同步 / Check if sync is complete
      if (!response.hasMore && successCount === response.blocks.length) {
        this.updateSyncStatus(SyncStatus.SYNCHRONIZED);
      }

      console.log(`✅ 同步处理完成 / Sync processing complete: ${successCount}/${response.blocks.length} blocks`);
      return successCount > 0;
      
    } catch (error) {
      console.error('❌ 处理同步响应失败 / Failed to handle sync response:', error);
      this.stats.errors++;
      this.updateSyncStatus(SyncStatus.ERROR);
      return false;
    }
  }

  /**
   * 处理传入区块 / Process incoming block
   */
  async processIncomingBlock(block: Block, peerId: string): Promise<boolean> {
    try {
      // 检查区块是否已存在 / Check if block already exists
      const existingBlock = this.getBlockByNumber(block.number);
      if (existingBlock) {
        // 检查是否为相同区块 / Check if it's the same block
        if (existingBlock.hash === block.hash) {
          console.log(`⚠️ 区块已存在 / Block already exists: #${block.number}`);
          return true;
        } else {
          // 检测到分叉 / Fork detected
          console.warn(`🔀 检测到分叉 / Fork detected at height #${block.number}`);
          return await this.handleFork(existingBlock, block, peerId);
        }
      }

      // 验证区块 / Validate block
      const parentBlock = this.getBlockByNumber(block.number - 1);
      const isValid = await this.blockValidator.validateBlock(block, parentBlock || undefined);
      
      if (!isValid) {
        console.error(`❌ 区块验证失败 / Block validation failed: #${block.number}`);
        return false;
      }

      // 添加区块到链 / Add block to chain
      await this.addBlockToChain(block);
      
      console.log(`✅ 区块同步成功 / Block synced successfully: #${block.number} (${block.hash.substring(0, 10)}...)`);
      
      // 发出区块同步事件 / Emit block sync event
      this.emit('blockSynced', { block, peerId });
      
      return true;
      
    } catch (error) {
      console.error(`❌ 处理区块失败 / Failed to process block #${block.number}:`, error);
      return false;
    }
  }

  /**
   * 处理分叉 / Handle fork
   */
  private async handleFork(localBlock: Block, remoteBlock: Block, peerId: string): Promise<boolean> {
    console.log(`🔀 处理分叉 / Handling fork at height #${localBlock.number}`);
    
    if (!this.config.enableForkDetection) {
      console.log('⚠️ 分叉检测已禁用 / Fork detection disabled');
      return false;
    }

    // 创建冲突记录 / Create conflict record
    const conflict: BlockConflict = {
      height: localBlock.number,
      localBlock,
      remoteBlock,
      resolution: 'pending'
    };

    this.conflicts.set(localBlock.number, conflict);

    // 应用最长链规则 / Apply longest chain rule
    const resolution = await this.resolveForkConflict(conflict, peerId);
    
    if (resolution === 'remote') {
      // 接受远程区块 / Accept remote block
      await this.replaceBlock(localBlock.number, remoteBlock);
      console.log(`✅ 分叉解决：接受远程区块 / Fork resolved: accepted remote block #${localBlock.number}`);
      
      // 发出分叉解决事件 / Emit fork resolution event
      this.emit('forkResolved', { conflict, resolution: 'remote', peerId });
      
      return true;
    } else {
      // 保持本地区块 / Keep local block
      console.log(`✅ 分叉解决：保持本地区块 / Fork resolved: kept local block #${localBlock.number}`);
      
      // 发出分叉解决事件 / Emit fork resolution event
      this.emit('forkResolved', { conflict, resolution: 'local', peerId });
      
      return false;
    }
  }

  /**
   * 解决分叉冲突 / Resolve fork conflict
   */
  private async resolveForkConflict(conflict: BlockConflict, peerId: string): Promise<'local' | 'remote'> {
    // 简化的最长链规则：比较区块时间戳和哈希 / Simplified longest chain rule
    const { localBlock, remoteBlock } = conflict;
    
    // 优先选择时间戳较早的区块 / Prefer block with earlier timestamp
    if (localBlock.timestamp < remoteBlock.timestamp) {
      return 'local';
    } else if (remoteBlock.timestamp < localBlock.timestamp) {
      return 'remote';
    }
    
    // 时间戳相同时，选择哈希值较小的区块 / If timestamps are equal, choose block with smaller hash
    return localBlock.hash < remoteBlock.hash ? 'local' : 'remote';
  }

  /**
   * 替换区块 / Replace block
   */
  private async replaceBlock(height: number, newBlock: Block): Promise<void> {
    const index = this.blockchain.findIndex(block => block.number === height);
    if (index !== -1) {
      this.blockchain[index] = newBlock;
      
      // 如果替换的是当前区块，更新当前区块 / If replacing current block, update current block
      if (this.currentBlock && this.currentBlock.number === height) {
        this.currentBlock = newBlock;
      }
    }
  }

  /**
   * 添加区块到链 / Add block to chain
   */
  private async addBlockToChain(block: Block): Promise<void> {
    // 确保区块按顺序添加 / Ensure blocks are added in order
    const expectedHeight = this.blockchain.length;
    
    if (block.number === expectedHeight) {
      this.blockchain.push(block);
      this.currentBlock = block;
      this.stats.currentHeight = block.number;
    } else if (block.number < expectedHeight) {
      // 插入到正确位置 / Insert at correct position
      const index = this.blockchain.findIndex(b => b.number > block.number);
      if (index === -1) {
        this.blockchain.push(block);
      } else {
        this.blockchain.splice(index, 0, block);
      }
    } else {
      console.warn(`⚠️ 区块高度不连续 / Non-consecutive block height: expected ${expectedHeight}, got ${block.number}`);
      // 可以选择缓存该区块，等待前面的区块 / Could cache this block and wait for previous blocks
    }
  }

  /**
   * 获取指定范围的区块 / Get blocks in range
   */
  private getBlocksInRange(fromHeight: number, toHeight?: number): Block[] {
    const endHeight = toHeight || Math.min(fromHeight + this.config.maxBatchSize - 1, this.stats.currentHeight);
    
    return this.blockchain.filter(block => 
      block.number >= fromHeight && block.number <= endHeight
    ).slice(0, this.config.maxBatchSize);
  }

  /**
   * 根据高度获取区块 / Get block by number
   */
  private getBlockByNumber(height: number): Block | null {
    return this.blockchain.find(block => block.number === height) || null;
  }

  /**
   * 更新同步状态 / Update sync status
   */
  private updateSyncStatus(status: SyncStatus): void {
    const oldStatus = this.stats.status;
    this.stats.status = status;
    
    if (status === SyncStatus.SYNCING && oldStatus !== SyncStatus.SYNCING) {
      this.stats.startTime = Date.now();
    }
    
    // 发出状态变化事件 / Emit status change event
    this.emit('statusChanged', { oldStatus, newStatus: status });
  }

  /**
   * 计算同步速度 / Calculate sync speed
   */
  private calculateSyncSpeed(): void {
    const now = Date.now();
    const elapsed = (now - this.stats.startTime) / 1000; // 秒 / seconds
    
    if (elapsed > 0) {
      this.stats.syncSpeed = this.stats.syncedBlocks / elapsed;
    }
  }

  /**
   * 获取同步统计信息 / Get sync statistics
   */
  getSyncStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * 获取冲突信息 / Get conflicts
   */
  getConflicts(): BlockConflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * 清理已解决的冲突 / Clean resolved conflicts
   */
  cleanResolvedConflicts(): void {
    for (const [height, conflict] of this.conflicts.entries()) {
      if (conflict.resolution !== 'pending') {
        this.conflicts.delete(height);
      }
    }
  }

  /**
   * 重置同步状态 / Reset sync state
   */
  reset(): void {
    this.stats = {
      status: SyncStatus.IDLE,
      currentHeight: this.currentBlock?.number || 0,
      targetHeight: 0,
      syncedBlocks: 0,
      syncSpeed: 0,
      startTime: 0,
      lastSyncTime: 0,
      errors: 0
    };
    
    this.conflicts.clear();
    this.syncRequests.clear();
  }

  /**
   * 检查是否需要同步 / Check if sync is needed
   */
  needsSync(remoteHeight: number): boolean {
    return remoteHeight > this.stats.currentHeight;
  }

  /**
   * 获取同步进度 / Get sync progress
   */
  getSyncProgress(): number {
    if (this.stats.targetHeight === 0) return 1;
    return Math.min(this.stats.currentHeight / this.stats.targetHeight, 1);
  }
}