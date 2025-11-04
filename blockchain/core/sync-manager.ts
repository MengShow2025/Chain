/**
 * TitanChain Synchronization Manager / TitanChain同步管理器
 * Manages blockchain synchronization across multiple nodes / 管理多节点间的区块链同步
 * 
 * Features / 功能:
 * - Sync progress tracking / 同步进度跟踪
 * - Conflict resolution / 冲突解决
 * - Performance monitoring / 性能监控
 * - Error handling and recovery / 错误处理和恢复
 * - Incremental and full sync / 增量和全量同步
 */

import { EventEmitter } from 'events';
import { Block, Transaction } from '../../shared/types/blockchain.js';
import { TitanChain } from './blockchain.js';
import { EnhancedP2PNode } from '../../network/p2p-enhanced.js';
import { BlockSyncProtocol } from './block-sync.js';
import { ChainStateManager } from './chain-state.js';

// Sync status enumeration / 同步状态枚举
export enum SyncManagerStatus {
  IDLE = 'idle',                    // 空闲 / Idle
  SYNCING = 'syncing',             // 同步中 / Syncing
  PAUSED = 'paused',               // 暂停 / Paused
  ERROR = 'error',                 // 错误 / Error
  COMPLETED = 'completed'          // 完成 / Completed
}

// Sync mode enumeration / 同步模式枚举
export enum SyncMode {
  FULL = 'full',                   // 全量同步 / Full sync
  INCREMENTAL = 'incremental',     // 增量同步 / Incremental sync
  FAST = 'fast',                   // 快速同步 / Fast sync
  SELECTIVE = 'selective'          // 选择性同步 / Selective sync
}

// Sync statistics interface / 同步统计接口
export interface SyncManagerStats {
  status: SyncManagerStatus;
  mode: SyncMode;
  startTime: number;
  endTime?: number;
  duration?: number;
  totalBlocks: number;
  syncedBlocks: number;
  failedBlocks: number;
  progress: number;
  speed: number; // blocks per second / 每秒区块数
  estimatedTimeRemaining?: number;
  errors: SyncError[];
  peersUsed: string[];
  bytesTransferred: number;
}

// Sync error interface / 同步错误接口
export interface SyncError {
  timestamp: number;
  type: string;
  message: string;
  blockHeight?: number;
  peerId?: string;
  retryCount: number;
}

// Sync configuration interface / 同步配置接口
export interface SyncManagerConfig {
  maxConcurrentSyncs: number;      // 最大并发同步数
  batchSize: number;               // 批处理大小
  timeout: number;                 // 超时时间
  maxRetries: number;              // 最大重试次数
  retryDelay: number;              // 重试延迟
  enableProgressReporting: boolean; // 启用进度报告
  progressReportInterval: number;   // 进度报告间隔
  enableAutoRecovery: boolean;     // 启用自动恢复
  maxErrorThreshold: number;       // 最大错误阈值
  syncMode: SyncMode;              // 同步模式
}

// Default configuration / 默认配置
const DEFAULT_CONFIG: SyncManagerConfig = {
  maxConcurrentSyncs: 3,
  batchSize: 100,
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  enableProgressReporting: true,
  progressReportInterval: 5000,
  enableAutoRecovery: true,
  maxErrorThreshold: 10,
  syncMode: SyncMode.INCREMENTAL
};

/**
 * Synchronization Manager Class / 同步管理器类
 */
export class SyncManager extends EventEmitter {
  private blockchain: TitanChain;
  private p2pNode: EnhancedP2PNode;
  private blockSync: BlockSyncProtocol;
  private chainState: ChainStateManager;
  private config: SyncManagerConfig;
  
  private status: SyncManagerStatus = SyncManagerStatus.IDLE;
  private stats: SyncManagerStats;
  private activeSyncs: Map<string, Promise<void>> = new Map();
  private errors: SyncError[] = [];
  private progressTimer?: NodeJS.Timeout;
  private recoveryTimer?: NodeJS.Timeout;

  constructor(
    blockchain: TitanChain,
    p2pNode: EnhancedP2PNode,
    blockSync: BlockSyncProtocol,
    chainState: ChainStateManager,
    config: Partial<SyncManagerConfig> = {}
  ) {
    super();
    
    this.blockchain = blockchain;
    this.p2pNode = p2pNode;
    this.blockSync = blockSync;
    this.chainState = chainState;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.stats = this.initializeStats();
    
    // Setup event listeners / 设置事件监听器
    this.setupEventListeners();
    
    console.log('🔄 Sync Manager initialized / 同步管理器已初始化');
  }

  /**
   * Initialize statistics / 初始化统计信息
   */
  private initializeStats(): SyncManagerStats {
    return {
      status: SyncManagerStatus.IDLE,
      mode: this.config.syncMode,
      startTime: 0,
      totalBlocks: 0,
      syncedBlocks: 0,
      failedBlocks: 0,
      progress: 0,
      speed: 0,
      errors: [],
      peersUsed: [],
      bytesTransferred: 0
    };
  }

  /**
   * Setup event listeners / 设置事件监听器
   */
  private setupEventListeners(): void {
    // Listen to blockchain events / 监听区块链事件
    this.blockchain.on('blockAdded', (block: Block) => {
      this.onBlockAdded(block);
    });

    // Listen to P2P events / 监听P2P事件
    this.p2pNode.on('peerConnected', (peerId: string) => {
      this.onPeerConnected(peerId);
    });

    this.p2pNode.on('peerDisconnected', (peerId: string) => {
      this.onPeerDisconnected(peerId);
    });

    // Listen to block sync events / 监听区块同步事件
    this.blockSync.on('syncProgress', (progress: any) => {
      this.onSyncProgress(progress);
    });

    this.blockSync.on('syncError', (error: any) => {
      this.onSyncError(error);
    });
  }

  /**
   * Start synchronization / 开始同步
   */
  async startSync(mode: SyncMode = this.config.syncMode): Promise<boolean> {
    if (this.status === SyncManagerStatus.SYNCING) {
      console.warn('⚠️ Sync already in progress / 同步已在进行中');
      return false;
    }

    console.log(`🔄 Starting sync in ${mode} mode / 开始${mode}模式同步`);
    
    try {
      this.status = SyncManagerStatus.SYNCING;
      this.config.syncMode = mode;
      this.stats = this.initializeStats();
      this.stats.status = SyncManagerStatus.SYNCING;
      this.stats.mode = mode;
      this.stats.startTime = Date.now();
      
      // Start progress reporting / 开始进度报告
      if (this.config.enableProgressReporting) {
        this.startProgressReporting();
      }

      // Perform sync based on mode / 根据模式执行同步
      const success = await this.performSync(mode);
      
      if (success) {
        this.status = SyncManagerStatus.COMPLETED;
        this.stats.status = SyncManagerStatus.COMPLETED;
        this.stats.endTime = Date.now();
        this.stats.duration = this.stats.endTime - this.stats.startTime;
        
        console.log(`✅ Sync completed successfully / 同步成功完成`);
        this.emit('syncCompleted', this.stats);
      } else {
        this.status = SyncManagerStatus.ERROR;
        this.stats.status = SyncManagerStatus.ERROR;
        
        console.error('❌ Sync failed / 同步失败');
        this.emit('syncFailed', this.stats);
      }

      return success;

    } catch (error) {
      this.status = SyncManagerStatus.ERROR;
      this.stats.status = SyncManagerStatus.ERROR;
      
      console.error('❌ Sync error / 同步错误:', error);
      this.addError('SYNC_ERROR', error instanceof Error ? error.message : String(error));
      this.emit('syncError', error);
      
      return false;
    } finally {
      this.stopProgressReporting();
    }
  }

  /**
   * Perform synchronization based on mode / 根据模式执行同步
   */
  private async performSync(mode: SyncMode): Promise<boolean> {
    switch (mode) {
      case SyncMode.FULL:
        return this.performFullSync();
      case SyncMode.INCREMENTAL:
        return this.performIncrementalSync();
      case SyncMode.FAST:
        return this.performFastSync();
      case SyncMode.SELECTIVE:
        return this.performSelectiveSync();
      default:
        throw new Error(`Unsupported sync mode: ${mode} / 不支持的同步模式: ${mode}`);
    }
  }

  /**
   * Perform full synchronization / 执行全量同步
   */
  private async performFullSync(): Promise<boolean> {
    console.log('🔄 Performing full sync / 执行全量同步...');
    
    try {
      // Get chain status from peers / 从对等节点获取链状态
      const chainStatus = await this.p2pNode.requestChainStatus();
      if (!chainStatus) {
        throw new Error('Failed to get chain status from peers / 从对等节点获取链状态失败');
      }

      this.stats.totalBlocks = chainStatus.blockHeight;
      
      // Reset local chain / 重置本地链
      await this.chainState.reset();
      
      // Sync all blocks / 同步所有区块
      const syncResult = await this.blockSync.syncBlocks(0, chainStatus.blockHeight);
      
      this.stats.syncedBlocks = syncResult.blocksSynced || 0;
      this.stats.failedBlocks = (syncResult.errors || []).length;
      
      return syncResult.success;

    } catch (error) {
      console.error('❌ Full sync failed / 全量同步失败:', error);
      this.addError('FULL_SYNC_ERROR', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Perform incremental synchronization / 执行增量同步
   */
  private async performIncrementalSync(): Promise<boolean> {
    console.log('🔄 Performing incremental sync / 执行增量同步...');
    
    try {
      // Get current local height / 获取当前本地高度
      const localHeight = await this.chainState.getCurrentHeight();
      
      // Get chain status from peers / 从对等节点获取链状态
      const chainStatus = await this.p2pNode.requestChainStatus();
      if (!chainStatus) {
        throw new Error('Failed to get chain status from peers / 从对等节点获取链状态失败');
      }

      const remoteHeight = chainStatus.blockHeight;
      
      if (localHeight >= remoteHeight) {
        console.log('✅ Local chain is up to date / 本地链已是最新');
        return true;
      }

      this.stats.totalBlocks = remoteHeight - localHeight;
      
      // Sync missing blocks / 同步缺失的区块
      const syncResult = await this.blockSync.syncBlocks(localHeight + 1, remoteHeight);
      
      this.stats.syncedBlocks = syncResult.blocksSynced || 0;
      this.stats.failedBlocks = (syncResult.errors || []).length;
      
      return syncResult.success;

    } catch (error) {
      console.error('❌ Incremental sync failed / 增量同步失败:', error);
      this.addError('INCREMENTAL_SYNC_ERROR', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Perform fast synchronization / 执行快速同步
   */
  private async performFastSync(): Promise<boolean> {
    console.log('🔄 Performing fast sync / 执行快速同步...');
    
    try {
      // Fast sync uses state snapshots instead of full block history
      // 快速同步使用状态快照而不是完整区块历史
      
      // Get latest state snapshot / 获取最新状态快照
      const snapshot = await this.p2pNode.requestStateSnapshot();
      if (!snapshot) {
        console.warn('⚠️ No state snapshot available, falling back to incremental sync / 无状态快照可用，回退到增量同步');
        return this.performIncrementalSync();
      }

      // Apply state snapshot / 应用状态快照
      await this.chainState.applySnapshot(snapshot);
      
      // Sync recent blocks for verification / 同步最近的区块进行验证
      const recentBlocks = 100; // Last 100 blocks / 最近100个区块
      const chainStatus = await this.p2pNode.requestChainStatus();
      if (chainStatus) {
        const startHeight = Math.max(0, chainStatus.blockHeight - recentBlocks);
        const syncResult = await this.blockSync.syncBlocks(startHeight, chainStatus.blockHeight);
        
        this.stats.syncedBlocks = syncResult.blocksSynced || 0;
        this.stats.totalBlocks = recentBlocks;
        
        return syncResult.success;
      }

      return true;

    } catch (error) {
      console.error('❌ Fast sync failed / 快速同步失败:', error);
      this.addError('FAST_SYNC_ERROR', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Perform selective synchronization / 执行选择性同步
   */
  private async performSelectiveSync(): Promise<boolean> {
    console.log('🔄 Performing selective sync / 执行选择性同步...');
    
    try {
      // Selective sync only syncs specific blocks or ranges
      // 选择性同步只同步特定的区块或范围
      
      // This is a placeholder implementation
      // 这是一个占位符实现
      return this.performIncrementalSync();

    } catch (error) {
      console.error('❌ Selective sync failed / 选择性同步失败:', error);
      this.addError('SELECTIVE_SYNC_ERROR', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Pause synchronization / 暂停同步
   */
  async pauseSync(): Promise<void> {
    if (this.status !== SyncManagerStatus.SYNCING) {
      return;
    }

    console.log('⏸️ Pausing sync / 暂停同步...');
    this.status = SyncManagerStatus.PAUSED;
    this.stats.status = SyncManagerStatus.PAUSED;
    
    // Pause block sync / 暂停区块同步
    await this.blockSync.pause();
    
    this.emit('syncPaused', this.stats);
  }

  /**
   * Resume synchronization / 恢复同步
   */
  async resumeSync(): Promise<void> {
    if (this.status !== SyncManagerStatus.PAUSED) {
      return;
    }

    console.log('▶️ Resuming sync / 恢复同步...');
    this.status = SyncManagerStatus.SYNCING;
    this.stats.status = SyncManagerStatus.SYNCING;
    
    // Resume block sync / 恢复区块同步
    await this.blockSync.resume();
    
    this.emit('syncResumed', this.stats);
  }

  /**
   * Stop synchronization / 停止同步
   */
  async stopSync(): Promise<void> {
    console.log('🛑 Stopping sync / 停止同步...');
    
    this.status = SyncManagerStatus.IDLE;
    this.stats.status = SyncManagerStatus.IDLE;
    
    // Stop block sync / 停止区块同步
    await this.blockSync.stop();
    
    // Clear active syncs / 清除活跃同步
    this.activeSyncs.clear();
    
    this.stopProgressReporting();
    this.emit('syncStopped', this.stats);
  }

  /**
   * Start progress reporting / 开始进度报告
   */
  private startProgressReporting(): void {
    this.progressTimer = setInterval(() => {
      this.updateProgress();
      this.emit('syncProgress', this.stats);
    }, this.config.progressReportInterval);
  }

  /**
   * Stop progress reporting / 停止进度报告
   */
  private stopProgressReporting(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = undefined;
    }
  }

  /**
   * Update progress statistics / 更新进度统计
   */
  private updateProgress(): void {
    if (this.stats.totalBlocks > 0) {
      this.stats.progress = Math.round((this.stats.syncedBlocks / this.stats.totalBlocks) * 100);
    }

    // Calculate sync speed / 计算同步速度
    const elapsed = Date.now() - this.stats.startTime;
    if (elapsed > 0) {
      this.stats.speed = (this.stats.syncedBlocks / elapsed) * 1000; // blocks per second / 每秒区块数
      
      // Estimate remaining time / 估算剩余时间
      if (this.stats.speed > 0) {
        const remainingBlocks = this.stats.totalBlocks - this.stats.syncedBlocks;
        this.stats.estimatedTimeRemaining = Math.round(remainingBlocks / this.stats.speed);
      }
    }
  }

  /**
   * Add error to error list / 添加错误到错误列表
   */
  private addError(type: string, message: string, blockHeight?: number, peerId?: string): void {
    const error: SyncError = {
      timestamp: Date.now(),
      type,
      message,
      blockHeight,
      peerId,
      retryCount: 0
    };

    this.errors.push(error);
    this.stats.errors = this.errors;

    // Check error threshold / 检查错误阈值
    if (this.errors.length >= this.config.maxErrorThreshold) {
      console.error(`❌ Error threshold exceeded (${this.errors.length}/${this.config.maxErrorThreshold}) / 错误阈值超出`);
      this.emit('errorThresholdExceeded', this.errors);
    }
  }

  /**
   * Event handlers / 事件处理器
   */
  private onBlockAdded(block: Block): void {
    this.stats.syncedBlocks++;
    this.updateProgress();
  }

  private onPeerConnected(peerId: string): void {
    if (!this.stats.peersUsed.includes(peerId)) {
      this.stats.peersUsed.push(peerId);
    }
  }

  private onPeerDisconnected(peerId: string): void {
    // Handle peer disconnection during sync / 处理同步期间的对等节点断开
    console.warn(`⚠️ Peer disconnected during sync: ${peerId} / 同步期间对等节点断开: ${peerId}`);
  }

  private onSyncProgress(progress: any): void {
    // Update stats based on sync progress / 根据同步进度更新统计
    if (progress.syncedBlocks !== undefined) {
      this.stats.syncedBlocks = progress.syncedBlocks;
    }
    if (progress.totalBlocks !== undefined) {
      this.stats.totalBlocks = progress.totalBlocks;
    }
    this.updateProgress();
  }

  private onSyncError(error: any): void {
    this.addError('SYNC_PROTOCOL_ERROR', error.message, error.blockHeight, error.peerId);
  }

  /**
   * Get current synchronization statistics / 获取当前同步统计
   */
  getSyncStats(): SyncManagerStats {
    return { ...this.stats };
  }

  /**
   * Get synchronization status / 获取同步状态
   */
  getStatus(): SyncManagerStatus {
    return this.status;
  }

  /**
   * Check if synchronization is active / 检查同步是否活跃
   */
  isActive(): boolean {
    return this.status === SyncManagerStatus.SYNCING;
  }

  /**
   * Get configuration / 获取配置
   */
  getConfig(): SyncManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration / 更新配置
   */
  updateConfig(newConfig: Partial<SyncManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Sync manager configuration updated / 同步管理器配置已更新');
  }

  /**
   * Reset statistics / 重置统计
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    this.errors = [];
    console.log('🔄 Sync statistics reset / 同步统计已重置');
  }

  /**
   * Cleanup resources / 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up sync manager / 清理同步管理器...');
    
    await this.stopSync();
    
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }
    
    this.removeAllListeners();
  }
}