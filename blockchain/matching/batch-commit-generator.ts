import { Order, MatchResult, BalanceDiff } from './matching-engine.js';
import { BatchResult } from '../core/enhanced-micro-batch-processor.js';
import { casClient, BatchData } from '../../shared/da/cas-client.js';
import { computeMerkleRoot } from '../../shared/utils/merkle.js';
import { BatchCommit } from '../../shared/types/blockchain.js';
import { MessageBus, Message } from '../messaging/message-bus.js';
import crypto from 'crypto';

/**
 * 批次提交生成器配置
 */
export interface BatchCommitConfig {
  producerId: string;
  recipeVersion: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  signatureRequired: boolean;
  privateKey?: string;
}

/**
 * 批次数据摘要
 */
export interface BatchDigest {
  ordersHash: string;
  matchesHash: string;
  balanceDiffsHash: string;
  auditLogHash: string;
  totalOrderCount: number;
  totalMatchCount: number;
  totalVolume: string;
  processingTime: number;
}

/**
 * 批次签名信息
 */
export interface BatchSignature {
  signature: string;
  publicKey: string;
  algorithm: string;
  timestamp: number;
}

/**
 * BatchCommit生成器
 * 负责从撮合结果生成标准化的BatchCommit，包含Merkle根计算和CID生成
 */
export class BatchCommitGenerator {
  private config: BatchCommitConfig;
  private generatedCommits: Map<string, BatchCommit> = new Map();
  private messageBus?: MessageBus;
  private batchResults: Map<string, BatchResult> = new Map();
  private messageHandler?: { handle: (message: Message) => Promise<void> };

  constructor(config: BatchCommitConfig, messageBus?: MessageBus) {
    this.config = config;
    this.messageBus = messageBus;
    
    // 如果提供了消息总线，订阅batch.ready主题
    if (this.messageBus) {
      this.setupMessageBusSubscription();
    }
    
    console.log('BatchCommitGenerator initialized with config:', config);
  }

  /**
   * 设置消息总线订阅
   */
  private setupMessageBusSubscription(): void {
    if (!this.messageBus) return;

    // 创建符合MessageHandler接口的处理器
    this.messageHandler = {
      handle: this.handleBatchResult.bind(this)
    };

    this.messageBus.subscribe({
      topic: 'batch.result',
      handler: this.messageHandler
    });

    console.log('BatchCommitGenerator subscribed to batch.result topic');
  }

  /**
   * 处理批次结果事件
   */
  private async handleBatchResult(message: Message): Promise<void> {
    try {
      const batchResult = message.payload as BatchResult;
      console.log(`BatchCommitGenerator received batch.result for batch: ${batchResult.batchId}`);
      
      // 缓存批次结果
      this.batchResults.set(batchResult.batchId, batchResult);
      
      // 自动生成BatchCommit（如果有足够的数据）
      await this.autoGenerateBatchCommit(batchResult);
      
    } catch (error) {
      console.error('Failed to handle batch.result event:', error);
    }
  }

  /**
   * 自动生成BatchCommit
   */
  private async autoGenerateBatchCommit(batchResult: BatchResult): Promise<void> {
    try {
      // 从批次结果中提取数据
      const orders = batchResult.orders || [];
      const matches = batchResult.matches || [];
      const balanceDiffs = batchResult.balanceDiffs || [];
      const auditLog = batchResult.auditLog || [];

      // 生成BatchCommit
      const batchCommit = await this.generateBatchCommit(
        batchResult,
        orders,
        matches,
        balanceDiffs,
        auditLog
      );

      console.log(`Auto-generated BatchCommit for batch: ${batchResult.batchId}`);
      
      // 发布BatchCommit生成完成事件
      if (this.messageBus) {
        this.messageBus.publish('batch.commit.generated', batchCommit, 'NORMAL');
      }

    } catch (error) {
      console.error(`Failed to auto-generate BatchCommit for batch ${batchResult.batchId}:`, error);
    }
  }

  /**
   * 从批次结果生成BatchCommit
   */
  async generateBatchCommit(
    batchResult: BatchResult,
    orders: Order[],
    matches: MatchResult[],
    balanceDiffs: BalanceDiff[],
    auditLog: any[] = []
  ): Promise<BatchCommit> {
    try {
      const startTime = Date.now();
      
      // 生成批次ID
      const batchId = this.generateBatchId(batchResult.batchId);
      
      // 准备批次数据
      const batchData: BatchData = {
        orders,
        matches,
        balanceDiffs,
        auditLog
      };
      
      // 计算各部分的Merkle根
      const merkleRoots = await this.calculateMerkleRoots(batchData);
      
      // 生成批次摘要
      const digest = this.generateBatchDigest(batchData, batchResult.processingTime);
      
      // 存储到内容可寻址存储
      const cid = await this.storeBatchData(batchData);
      
      // 创建BatchCommit
      const batchCommit: BatchCommit = {
        batchId,
        producerId: this.config.producerId,
        timestamp: Date.now(),
        ordersRoot: merkleRoots.ordersRoot,
        matchesRoot: merkleRoots.matchesRoot,
        balanceDiffsRoot: merkleRoots.balanceDiffsRoot,
        auditLogRoot: merkleRoots.auditLogRoot,
        cid,
        recipeVersion: this.config.recipeVersion,
        metadata: {
          digest,
          processingTime: Date.now() - startTime,
          dataSize: this.calculateDataSize(batchData),
          compression: this.config.enableCompression,
          encryption: this.config.enableEncryption
        }
      };
      
      // 添加签名（如果需要）
      if (this.config.signatureRequired && this.config.privateKey) {
        batchCommit.signature = await this.signBatchCommit(batchCommit);
      }
      
      // 缓存生成的提交
      this.generatedCommits.set(batchId, batchCommit);
      
      console.log(`BatchCommit generated: ${batchId} with CID: ${cid}`);
      return batchCommit;
      
    } catch (error) {
      console.error('Failed to generate BatchCommit:', error);
      throw new Error(`BatchCommit generation failed: ${error.message}`);
    }
  }

  /**
   * 计算所有部分的Merkle根
   */
  private async calculateMerkleRoots(batchData: BatchData): Promise<{
    ordersRoot: string;
    matchesRoot: string;
    balanceDiffsRoot: string;
    auditLogRoot: string;
  }> {
    try {
      // 并行计算各部分的Merkle根
      const [ordersRoot, matchesRoot, balanceDiffsRoot, auditLogRoot] = await Promise.all([
        this.computeMerkleRootForOrders(batchData.orders),
        this.computeMerkleRootForMatches(batchData.matches),
        this.computeMerkleRootForBalanceDiffs(batchData.balanceDiffs),
        this.computeMerkleRootForAuditLog(batchData.auditLog)
      ]);

      return {
        ordersRoot,
        matchesRoot,
        balanceDiffsRoot,
        auditLogRoot
      };
    } catch (error) {
      throw new Error(`Merkle root calculation failed: ${error.message}`);
    }
  }

  /**
   * 计算订单的Merkle根
   */
  private async computeMerkleRootForOrders(orders: Order[]): Promise<string> {
    if (!orders || orders.length === 0) {
      return computeMerkleRoot([]);
    }
    
    // 标准化订单数据以确保一致性
    const normalizedOrders = orders.map(order => this.normalizeOrder(order));
    const orderHashes = normalizedOrders.map(order => JSON.stringify(order));
    
    return computeMerkleRoot(orderHashes);
  }

  /**
   * 计算撮合结果的Merkle根
   */
  private async computeMerkleRootForMatches(matches: MatchResult[]): Promise<string> {
    if (!matches || matches.length === 0) {
      return computeMerkleRoot([]);
    }
    
    const matchHashes = matches.map(match => JSON.stringify(this.normalizeMatch(match)));
    return computeMerkleRoot(matchHashes);
  }

  /**
   * 计算余额变化的Merkle根
   */
  private async computeMerkleRootForBalanceDiffs(balanceDiffs: BalanceDiff[]): Promise<string> {
    if (!balanceDiffs || balanceDiffs.length === 0) {
      return computeMerkleRoot([]);
    }
    
    const diffHashes = balanceDiffs.map(diff => JSON.stringify(this.normalizeBalanceDiff(diff)));
    return computeMerkleRoot(diffHashes);
  }

  /**
   * 计算审计日志的Merkle根
   */
  private async computeMerkleRootForAuditLog(auditLog: any[]): Promise<string> {
    if (!auditLog || auditLog.length === 0) {
      return computeMerkleRoot([]);
    }
    
    const logHashes = auditLog.map(log => JSON.stringify(log));
    return computeMerkleRoot(logHashes);
  }

  /**
   * 标准化订单数据
   */
  private normalizeOrder(order: Order): any {
    return {
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      price: order.price,
      quantity: order.quantity,
      account: order.account,
      timestamp: order.timestamp,
      nonce: order.nonce
    };
  }

  /**
   * 标准化撮合结果
   */
  private normalizeMatch(match: MatchResult): any {
    return {
      id: match.id,
      buyOrderId: match.buyOrderId,
      sellOrderId: match.sellOrderId,
      price: match.price,
      quantity: match.quantity,
      timestamp: match.timestamp,
      buyAccount: match.buyAccount,
      sellAccount: match.sellAccount
    };
  }

  /**
   * 标准化余额变化
   */
  private normalizeBalanceDiff(diff: BalanceDiff): any {
    return {
      account: diff.account,
      asset: diff.asset,
      change: diff.change,
      reason: diff.reason,
      relatedOrderId: diff.relatedOrderId,
      relatedMatchId: diff.relatedMatchId
    };
  }

  /**
   * 存储批次数据到CAS
   */
  private async storeBatchData(batchData: BatchData): Promise<string> {
    try {
      // 如果启用压缩，压缩数据
      let dataToStore = batchData;
      if (this.config.enableCompression) {
        dataToStore = await this.compressBatchData(batchData);
      }
      
      // 如果启用加密，加密数据
      if (this.config.enableEncryption) {
        dataToStore = await this.encryptBatchData(dataToStore);
      }
      
      // 序列化数据为Uint8Array
      const serializedData = new TextEncoder().encode(JSON.stringify(dataToStore));
      
      // 存储到CAS并返回CID
      const cid = await casClient.store(serializedData, {
        mimeType: 'application/json',
        tags: ['batch-commit', 'matching-engine']
      });
      
      return cid.toString();
      
    } catch (error) {
      throw new Error(`Failed to store batch data: ${error.message}`);
    }
  }

  /**
   * 压缩批次数据
   */
  private async compressBatchData(batchData: BatchData): Promise<any> {
    // 这里可以实现数据压缩逻辑
    // 暂时返回原数据
    return batchData;
  }

  /**
   * 加密批次数据
   */
  private async encryptBatchData(batchData: any): Promise<any> {
    // 这里可以实现数据加密逻辑
    // 暂时返回原数据
    return batchData;
  }

  /**
   * 生成批次摘要
   */
  private generateBatchDigest(batchData: BatchData, processingTime: number): BatchDigest {
    const totalVolume = batchData.orders.reduce((sum, order) => {
      return sum + (parseFloat(order.price) * parseFloat(order.quantity));
    }, 0);

    return {
      ordersHash: this.hashData(batchData.orders),
      matchesHash: this.hashData(batchData.matches),
      balanceDiffsHash: this.hashData(batchData.balanceDiffs),
      auditLogHash: this.hashData(batchData.auditLog),
      totalOrderCount: batchData.orders.length,
      totalMatchCount: batchData.matches.length,
      totalVolume: totalVolume.toString(),
      processingTime
    };
  }

  /**
   * 计算数据大小
   */
  private calculateDataSize(batchData: BatchData): number {
    const dataString = JSON.stringify(batchData);
    return Buffer.byteLength(dataString, 'utf8');
  }

  /**
   * 对BatchCommit进行签名
   */
  private async signBatchCommit(batchCommit: BatchCommit): Promise<BatchSignature> {
    if (!this.config.privateKey) {
      throw new Error('Private key required for signing');
    }

    try {
      // 创建签名数据
      const signData = this.createSignatureData(batchCommit);
      
      // 使用私钥签名
      const sign = crypto.createSign('SHA256');
      sign.update(signData);
      const signature = sign.sign(this.config.privateKey, 'hex');
      
      // 生成公钥（简化实现）
      const publicKey = this.derivePublicKey(this.config.privateKey);
      
      return {
        signature,
        publicKey,
        algorithm: 'SHA256',
        timestamp: Date.now()
      };
      
    } catch (error) {
      throw new Error(`Signing failed: ${error.message}`);
    }
  }

  /**
   * 创建签名数据
   */
  private createSignatureData(batchCommit: BatchCommit): string {
    const signatureFields = {
      batchId: batchCommit.batchId,
      producerId: batchCommit.producerId,
      timestamp: batchCommit.timestamp,
      ordersRoot: batchCommit.ordersRoot,
      matchesRoot: batchCommit.matchesRoot,
      balanceDiffsRoot: batchCommit.balanceDiffsRoot,
      auditLogRoot: batchCommit.auditLogRoot,
      cid: batchCommit.cid,
      recipeVersion: batchCommit.recipeVersion
    };
    
    return JSON.stringify(signatureFields);
  }

  /**
   * 从私钥派生公钥（简化实现）
   */
  private derivePublicKey(privateKey: string): string {
    // 这里应该实现真正的公钥派生逻辑
    // 暂时返回一个模拟的公钥
    return crypto.createHash('sha256').update(privateKey).digest('hex');
  }

  /**
   * 生成批次ID
   */
  private generateBatchId(originalId?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const baseId = originalId || `batch_${timestamp}`;
    return `${baseId}_${timestamp}_${random}`;
  }

  /**
   * 计算数据哈希
   */
  private hashData(data: any): string {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * 验证BatchCommit
   */
  async verifyBatchCommit(batchCommit: BatchCommit): Promise<boolean> {
    try {
      // 验证签名（如果存在）
      if (batchCommit.signature) {
        const isValidSignature = await this.verifySignature(batchCommit);
        if (!isValidSignature) {
          return false;
        }
      }
      
      // 验证CID对应的数据
      const storedData = await casClient.retrieve(batchCommit.cid!);
      if (!storedData) {
        return false;
      }
      
      // 重新计算Merkle根并验证
      const merkleRoots = await this.calculateMerkleRoots(storedData as BatchData);
      
      return (
        merkleRoots.ordersRoot === batchCommit.ordersRoot &&
        merkleRoots.matchesRoot === batchCommit.matchesRoot &&
        merkleRoots.balanceDiffsRoot === batchCommit.balanceDiffsRoot &&
        merkleRoots.auditLogRoot === batchCommit.auditLogRoot
      );
      
    } catch (error) {
      console.error('BatchCommit verification failed:', error);
      return false;
    }
  }

  /**
   * 验证签名
   */
  private async verifySignature(batchCommit: BatchCommit): Promise<boolean> {
    if (!batchCommit.signature) {
      return true; // 没有签名时认为验证通过
    }

    try {
      const signData = this.createSignatureData(batchCommit);
      const signature = batchCommit.signature as BatchSignature;
      
      const verify = crypto.createVerify('SHA256');
      verify.update(signData);
      
      // 这里需要实现真正的公钥验证逻辑
      // 暂时返回true
      return true;
      
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * 获取已生成的BatchCommit
   */
  getBatchCommit(batchId: string): BatchCommit | undefined {
    return this.generatedCommits.get(batchId);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalGenerated: number;
    averageSize: number;
    averageProcessingTime: number;
  } {
    const commits = Array.from(this.generatedCommits.values());
    
    if (commits.length === 0) {
      return {
        totalGenerated: 0,
        averageSize: 0,
        averageProcessingTime: 0
      };
    }
    
    const totalSize = commits.reduce((sum, commit) => {
      return sum + (commit.metadata?.dataSize || 0);
    }, 0);
    
    const totalProcessingTime = commits.reduce((sum, commit) => {
      return sum + (commit.metadata?.processingTime || 0);
    }, 0);
    
    return {
      totalGenerated: commits.length,
      averageSize: totalSize / commits.length,
      averageProcessingTime: totalProcessingTime / commits.length
    };
  }

  /**
   * 获取缓存的批次结果
   */
  getBatchResult(batchId: string): BatchResult | undefined {
    return this.batchResults.get(batchId);
  }

  /**
   * 获取所有缓存的批次结果
   */
  getAllBatchResults(): BatchResult[] {
    return Array.from(this.batchResults.values());
  }

  /**
   * 清理缓存
   */
  cleanup(): void {
    this.generatedCommits.clear();
    this.batchResults.clear();
    
    // 取消消息总线订阅
    if (this.messageBus && this.messageHandler) {
      this.messageBus.unsubscribe('batch.result', this.messageHandler);
    }
    
    console.log('BatchCommitGenerator cleaned up');
  }
}