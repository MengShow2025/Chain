import { Transaction, ExchangeBatch, ContractCall } from '../../shared/types/blockchain.js';
import { ZERO_GAS_CONFIG, PERFORMANCE_CONFIG } from '../../shared/constants/blockchain.js';

/**
 * 0-gas费交易处理引擎
 * 实现交易所批量处理和智能合约分层收费机制
 */
export class ZeroGasEngine {
  private exchangeBatches: Map<string, ExchangeBatch> = new Map();
  private contractTierUsage: Map<number, number> = new Map();
  private dailyLimits: Map<string, { used: bigint; resetTime: number }> = new Map();
  
  // 性能统计
  private stats = {
    totalZeroGasTransactions: 0,
    batchTransactions: 0,
    contractTierTransactions: 0,
    savedGasFees: BigInt(0),
    averageProcessingTime: 0
  };
  
  constructor() {
    console.log('Initializing Zero Gas Engine');
    
    // 初始化合约层级使用统计
    for (let tier = 1; tier <= 3; tier++) {
      this.contractTierUsage.set(tier, 0);
    }
    
    // 定期重置每日限额
    setInterval(() => this.resetDailyLimits(), 24 * 60 * 60 * 1000);
  }
  
  /**
   * 处理0-gas费交易
   */
  async processZeroGasTransaction(tx: Transaction): Promise<{ success: boolean; reason?: string }> {
    const startTime = Date.now();
    
    try {
      // 验证0-gas费交易条件
      if (!this.validateZeroGasConditions(tx)) {
        return { success: false, reason: 'Invalid zero-gas conditions' };
      }
      
      // 处理交易所批量交易
      if (tx.exchangeBatch) {
        const result = await this.processExchangeBatch(tx);
        if (result.success) {
          this.stats.batchTransactions++;
        }
        return result;
      }
      
      // 处理智能合约分层交易
      if (tx.contractTier) {
        const result = await this.processContractTier(tx);
        if (result.success) {
          this.stats.contractTierTransactions++;
        }
        return result;
      }
      
      return { success: false, reason: 'No valid zero-gas mechanism specified' };
      
    } catch (error) {
      console.error('Error processing zero-gas transaction:', error);
      return { success: false, reason: 'Processing error' };
    } finally {
      // 更新性能统计
      const processingTime = Date.now() - startTime;
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * this.stats.totalZeroGasTransactions + processingTime) / 
        (this.stats.totalZeroGasTransactions + 1);
      
      this.stats.totalZeroGasTransactions++;
    }
  }
  
  /**
   * 处理交易所批量交易
   */
  private async processExchangeBatch(tx: Transaction): Promise<{ success: boolean; reason?: string }> {
    if (!tx.exchangeBatch) {
      return { success: false, reason: 'No exchange batch information' };
    }
    
    const { batchId, exchangeId } = tx.exchangeBatch;
    
    // 验证交易所权限
    if (!this.validateExchangePermission(exchangeId)) {
      return { success: false, reason: 'Exchange not authorized for zero-gas transactions' };
    }
    
    // 获取或创建批量记录
    let batch = this.exchangeBatches.get(batchId);
    if (!batch) {
      batch = {
        batchId,
        exchangeId,
        transactions: [],
        totalVolume: BigInt(0),
        createdAt: Date.now(),
        status: 'pending'
      };
      this.exchangeBatches.set(batchId, batch);
    }
    
    // 验证批量限制
    if (batch.transactions.length >= ZERO_GAS_CONFIG.MAX_BATCH_SIZE) {
      return { success: false, reason: 'Batch size limit exceeded' };
    }
    
    // 验证交易量限制
    const newTotalVolume = batch.totalVolume + tx.value;
    if (newTotalVolume > ZERO_GAS_CONFIG.MAX_BATCH_VOLUME) {
      return { success: false, reason: 'Batch volume limit exceeded' };
    }
    
    // 验证每日限额
    if (!this.checkDailyLimit(exchangeId, tx.value)) {
      return { success: false, reason: 'Daily limit exceeded' };
    }
    
    // 添加交易到批量
    batch.transactions.push(tx);
    batch.totalVolume = newTotalVolume;
    
    // 更新每日使用量
    this.updateDailyUsage(exchangeId, tx.value);
    
    // 检查是否达到批量处理阈值
    if (batch.transactions.length >= ZERO_GAS_CONFIG.BATCH_SIZE_THRESHOLD ||
        batch.totalVolume >= ZERO_GAS_CONFIG.BATCH_VOLUME_THRESHOLD) {
      batch.status = 'ready';
      console.log(`Exchange batch ${batchId} is ready for processing`);
    }
    
    // 计算节省的gas费用
    const savedGas = tx.gas * tx.gasPrice;
    this.stats.savedGasFees += savedGas;
    
    console.log(`Processed exchange batch transaction ${tx.hash} for exchange ${exchangeId}`);
    return { success: true };
  }
  
  /**
   * 处理智能合约分层交易
   */
  private async processContractTier(tx: Transaction): Promise<{ success: boolean; reason?: string }> {
    if (!tx.contractTier) {
      return { success: false, reason: 'No contract tier specified' };
    }
    
    const tier = tx.contractTier;
    
    // 验证层级范围
    if (tier < 1 || tier > 3) {
      return { success: false, reason: 'Invalid contract tier' };
    }
    
    // 获取层级配置
    const tierConfig = ZERO_GAS_CONFIG.CONTRACT_TIER_FEES[tier];
    if (!tierConfig) {
      return { success: false, reason: 'Tier configuration not found' };
    }
    
    // 验证gas限制
    if (tx.gas > tierConfig.maxGas) {
      return { success: false, reason: `Gas limit ${tx.gas} exceeds tier ${tier} maximum ${tierConfig.maxGas}` };
    }
    
    // 验证合约调用复杂度
    if (!this.validateContractComplexity(tx, tier)) {
      return { success: false, reason: 'Contract call too complex for tier' };
    }
    
    // 验证层级使用限制
    const currentUsage = this.contractTierUsage.get(tier) || 0;
    if (currentUsage >= tierConfig.dailyLimit) {
      return { success: false, reason: `Tier ${tier} daily limit exceeded` };
    }
    
    // 更新层级使用统计
    this.contractTierUsage.set(tier, currentUsage + 1);
    
    // 计算节省的gas费用
    const savedGas = tx.gas * tx.gasPrice;
    this.stats.savedGasFees += savedGas;
    
    console.log(`Processed tier-${tier} contract transaction ${tx.hash}`);
    return { success: true };
  }
  
  /**
   * 验证0-gas费交易条件
   */
  private validateZeroGasConditions(tx: Transaction): boolean {
    // 必须标记为0-gas费交易
    if (!tx.isZeroGas) {
      return false;
    }
    
    // 必须有批量ID或合约层级
    if (!tx.exchangeBatch && !tx.contractTier) {
      return false;
    }
    
    // 验证交易基本信息
    if (!tx.hash || !tx.from || !tx.to) {
      return false;
    }
    
    // 验证gas价格为0
    if (tx.gasPrice !== BigInt(0)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 验证交易所权限
   */
  private validateExchangePermission(exchangeId: string): boolean {
    // 检查交易所是否在白名单中
    const authorizedExchanges = ZERO_GAS_CONFIG.AUTHORIZED_EXCHANGES || [];
    return authorizedExchanges.includes(exchangeId);
  }
  
  /**
   * 验证合约调用复杂度
   */
  private validateContractComplexity(tx: Transaction, tier: number): boolean {
    // 根据层级验证合约调用复杂度
    const dataSize = tx.data.length;
    
    switch (tier) {
      case 1: // 基础层：简单转账和基础合约调用
        return dataSize <= 1024; // 1KB数据限制
        
      case 2: // 标准层：中等复杂度合约调用
        return dataSize <= 4096; // 4KB数据限制
        
      case 3: // 高级层：复杂合约调用
        return dataSize <= 16384; // 16KB数据限制
        
      default:
        return false;
    }
  }
  
  /**
   * 检查每日限额
   */
  private checkDailyLimit(exchangeId: string, amount: bigint): boolean {
    const limit = this.dailyLimits.get(exchangeId);
    const maxDaily = ZERO_GAS_CONFIG.DAILY_VOLUME_LIMIT;
    
    if (!limit) {
      return amount <= maxDaily;
    }
    
    // 检查是否需要重置
    if (Date.now() > limit.resetTime) {
      this.dailyLimits.set(exchangeId, {
        used: amount,
        resetTime: this.getNextResetTime()
      });
      return true;
    }
    
    return limit.used + amount <= maxDaily;
  }
  
  /**
   * 更新每日使用量
   */
  private updateDailyUsage(exchangeId: string, amount: bigint): void {
    const limit = this.dailyLimits.get(exchangeId);
    
    if (!limit || Date.now() > limit.resetTime) {
      this.dailyLimits.set(exchangeId, {
        used: amount,
        resetTime: this.getNextResetTime()
      });
    } else {
      limit.used += amount;
    }
  }
  
  /**
   * 获取下次重置时间
   */
  private getNextResetTime(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }
  
  /**
   * 重置每日限额
   */
  private resetDailyLimits(): void {
    const now = Date.now();
    
    for (const [exchangeId, limit] of this.dailyLimits) {
      if (now > limit.resetTime) {
        this.dailyLimits.set(exchangeId, {
          used: BigInt(0),
          resetTime: this.getNextResetTime()
        });
      }
    }
    
    // 重置合约层级使用统计
    for (let tier = 1; tier <= 3; tier++) {
      this.contractTierUsage.set(tier, 0);
    }
    
    console.log('Daily limits reset');
  }
  
  /**
   * 获取批量处理状态
   */
  getBatchStatus(batchId: string): ExchangeBatch | null {
    return this.exchangeBatches.get(batchId) || null;
  }
  
  /**
   * 获取就绪的批量
   */
  getReadyBatches(): ExchangeBatch[] {
    return Array.from(this.exchangeBatches.values())
      .filter(batch => batch.status === 'ready');
  }
  
  /**
   * 标记批量为已处理
   */
  markBatchProcessed(batchId: string): void {
    const batch = this.exchangeBatches.get(batchId);
    if (batch) {
      batch.status = 'processed';
      
      // 清理旧批量记录
      setTimeout(() => {
        this.exchangeBatches.delete(batchId);
      }, 60000); // 1分钟后清理
    }
  }
  
  /**
   * 获取合约层级使用统计
   */
  getTierUsageStats(): Map<number, number> {
    return new Map(this.contractTierUsage);
  }
  
  /**
   * 获取每日限额使用情况
   */
  getDailyLimitUsage(exchangeId: string): { used: bigint; limit: bigint; resetTime: number } | null {
    const limit = this.dailyLimits.get(exchangeId);
    if (!limit) {
      return null;
    }
    
    return {
      used: limit.used,
      limit: ZERO_GAS_CONFIG.DAILY_VOLUME_LIMIT,
      resetTime: limit.resetTime
    };
  }
  
  /**
   * 获取引擎统计信息
   */
  getEngineStats() {
    return {
      ...this.stats,
      activeBatches: this.exchangeBatches.size,
      readyBatches: this.getReadyBatches().length,
      tierUsage: Object.fromEntries(this.contractTierUsage),
      dailyLimitsCount: this.dailyLimits.size
    };
  }
  
  /**
   * 估算gas费用节省
   */
  estimateGasSavings(transactions: Transaction[]): bigint {
    let totalSavings = BigInt(0);
    
    for (const tx of transactions) {
      if (tx.isZeroGas) {
        totalSavings += tx.gas * tx.gasPrice;
      }
    }
    
    return totalSavings;
  }
  
  /**
   * 验证交易是否符合0-gas费条件
   */
  canProcessAsZeroGas(tx: Transaction): { eligible: boolean; reason?: string } {
    if (!tx.isZeroGas) {
      return { eligible: false, reason: 'Transaction not marked as zero-gas' };
    }
    
    if (tx.exchangeBatch) {
      const exchangeId = tx.exchangeBatch.exchangeId;
      
      if (!this.validateExchangePermission(exchangeId)) {
        return { eligible: false, reason: 'Exchange not authorized' };
      }
      
      if (!this.checkDailyLimit(exchangeId, tx.value)) {
        return { eligible: false, reason: 'Daily limit exceeded' };
      }
      
      return { eligible: true };
    }
    
    if (tx.contractTier) {
      const tier = tx.contractTier;
      const tierConfig = ZERO_GAS_CONFIG.CONTRACT_TIER_FEES[tier];
      
      if (!tierConfig) {
        return { eligible: false, reason: 'Invalid tier configuration' };
      }
      
      if (tx.gas > tierConfig.maxGas) {
        return { eligible: false, reason: 'Gas limit exceeds tier maximum' };
      }
      
      const currentUsage = this.contractTierUsage.get(tier) || 0;
      if (currentUsage >= tierConfig.dailyLimit) {
        return { eligible: false, reason: 'Tier daily limit exceeded' };
      }
      
      return { eligible: true };
    }
    
    return { eligible: false, reason: 'No valid zero-gas mechanism' };
  }
}