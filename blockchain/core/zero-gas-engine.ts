import { Transaction } from '../../shared/types/blockchain.js';
import { ZERO_GAS_CONFIG, PERFORMANCE_CONFIG, ZERO_GAS_LIMITS } from '../../shared/constants/blockchain.js';
import { adaptiveBatchController } from '../../shared/utils/adaptive-batch.js';
import { SponsorPoolService } from './sponsor-pool.js';

/**
 * 0-gas费交易处理引擎
 * 实现智能合约分层收费机制和原生代币0-gas费处理
 */
export class ZeroGasEngine {
  private contractTierUsage: Map<number, number> = new Map();
  
  // 性能统计
  private stats = {
    totalZeroGasTransactions: 0,
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
    
    // 定期重置层级使用统计
    setInterval(() => this.resetTierUsage(), 3600000); // 每小时重置一次 // 英文 /中文
  }
  
  /**
   * 处理0-gas费交易
   */
  async processZeroGasTransaction(tx: Transaction): Promise<{ success: boolean; reason?: string }> {
    const startTime = Date.now();
    
    try {
      // 验证0-gas费交易条件 // 英文 /中文
      if (!this.validateZeroGasConditions(tx)) {
        return { success: false, reason: 'Invalid zero-gas conditions' };
      }
      
      // 处理智能合约分层交易 // 英文 /中文
      if (tx.contractTier) {
        const result = await this.processContractTier(tx);
        if (result.success) {
          this.stats.contractTierTransactions++;
        }
        return result;
      }
      
      // 处理原生代币交易（完全免费） // 英文 /中文
      if (this.isNativeTokenTransaction(tx)) {
        return { success: true, reason: 'Native token transaction - zero gas' };
      }
      
      return { success: false, reason: 'No valid zero-gas mechanism specified' };
      
    } catch (error) {
      console.error('Error processing zero-gas transaction:', error);
      return { success: false, reason: 'Processing error' };
    } finally {
      // 更新性能统计 // 英文 /中文
      const processingTime = Date.now() - startTime;
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * this.stats.totalZeroGasTransactions + processingTime) / 
        (this.stats.totalZeroGasTransactions + 1);
      
      this.stats.totalZeroGasTransactions++;
    }
  }
  
  /**
   * 检查是否为原生代币交易
   */
  private isNativeTokenTransaction(tx: Transaction): boolean {
    // 原生代币交易的特征： // 英文 /中文
    // 1. data字段为空或只包含简单数据
    // 2. to地址不是合约地址
    // 3. 交易类型为简单转账
    return tx.data === '0x' || tx.data === '' || tx.data.length <= 10;
  }
  
  /**
   * 处理智能合约分层交易
   */
  private async processContractTier(tx: Transaction): Promise<{ success: boolean; reason?: string }> {
    if (!tx.contractTier) {
      return { success: false, reason: 'No contract tier specified' };
    }
    
    const tier = tx.contractTier;
    
    // 验证层级范围 // 英文 /中文
    if (tier < 1 || tier > 3) {
      return { success: false, reason: 'Invalid contract tier' };
    }
    
    // 获取层级配置 // 英文 /中文
    const tierConfig = ZERO_GAS_CONFIG.CONTRACT_TIER_FEES[tier];
    if (!tierConfig) {
      return { success: false, reason: 'Tier configuration not found' };
    }
    
    // 验证gas限制 // 英文 /中文
    if (tx.gas > tierConfig.maxGas) {
      return { success: false, reason: `Gas limit ${tx.gas} exceeds tier ${tier} maximum ${tierConfig.maxGas}` };
    }
    
    // 验证合约调用复杂度 // 英文 /中文
    if (!this.validateContractComplexity(tx, tier)) {
      return { success: false, reason: 'Contract call too complex for tier' };
    }
    
    // 验证层级使用限制 // 英文 /中文
    const currentUsage = this.contractTierUsage.get(tier) || 0;
    if (currentUsage >= tierConfig.dailyLimit) {
      return { success: false, reason: `Tier ${tier} daily limit exceeded` };
    }

    // 赞助池扣费资格检查与扣费：按目标合约地址作为赞助账户 // 英文 /中文
    const sponsorAccount = tx.to;
    const sponsorCheck = SponsorPoolService.canSponsor(sponsorAccount, tx.gas);
    if (!sponsorCheck.ok) {
      return { success: false, reason: `Sponsor rejected: ${sponsorCheck.reason}` };
    }
    const sponsorDeduct = SponsorPoolService.deduct(sponsorAccount, tx.gas);
    if (!sponsorDeduct.ok) {
      return { success: false, reason: `Sponsor deduct failed: ${sponsorDeduct.reason}` };
    }
    
    // 更新层级使用统计 // 英文 /中文
    this.contractTierUsage.set(tier, currentUsage + 1);
    
    // 计算节省的gas费用 // 英文 /中文
    const savedGas = tx.gas * tx.gasPrice;
    this.stats.savedGasFees += savedGas;
    
    console.log(`Processed tier-${tier} contract transaction ${tx.hash}`);
    return { success: true };
  }
  
  /**
   * 验证0-gas费交易条件
   */
  private validateZeroGasConditions(tx: Transaction): boolean {
    // 必须标记为0-gas费交易 // 英文 /中文
    if (!tx.isZeroGas) {
      return false;
    }
    
    // 必须有合约层级或为原生代币交易 // 英文 /中文
    if (!tx.contractTier && !this.isNativeTokenTransaction(tx)) {
      return false;
    }
    
    // 验证交易基本信息 // 英文 /中文
    if (!tx.hash || !tx.from || !tx.to) {
      return false;
    }
    
    // 验证gas价格为0 // 英文 /中文
    if (tx.gasPrice !== BigInt(0)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 验证合约调用复杂度
   */
  private validateContractComplexity(tx: Transaction, tier: number): boolean {
    // 根据层级验证合约调用复杂度 // 英文 /中文
    const dataSize = tx.data.length;
    
    switch (tier) {
      case 1: // 基础层：简单转账和基础合约调用
        return dataSize <= 1024; // 1KB数据限制 // 英文 /中文
        
      case 2: // 标准层：中等复杂度合约调用
        return dataSize <= 4096; // 4KB数据限制 // 英文 /中文
        
      case 3: // 高级层：复杂合约调用
        return dataSize <= 16384; // 16KB数据限制 // 英文 /中文
        
      default:
        return false;
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
   * 重置合约层级使用统计
   */
  private resetTierUsage(): void {
    // 重置合约层级使用统计 // 英文 /中文
    for (let tier = 1; tier <= 3; tier++) {
      this.contractTierUsage.set(tier, 0);
    }
    
    console.log('Tier usage reset');
  }
  
  /**
   * 获取合约层级使用统计
   */
  getTierUsageStats(): Map<number, number> {
    return new Map(this.contractTierUsage);
  }
  
  /**
   * 获取引擎统计信息
   */
  getEngineStats() {
    return {
      ...this.stats,
      tierUsage: Object.fromEntries(this.contractTierUsage)
    };
  }
  
  /**
   * 获取每日限额使用情况（与赞助池联动） // 英文 /中文
   */
  getDailyLimitUsage(exchangeId: string) {
    // 从赞助池读取账户的每日使用情况 // 英文 /中文
    const pool = SponsorPoolService.getPool(exchangeId);
    return {
      exchangeId: exchangeId.toLowerCase(),
      tierUsage: Object.fromEntries(this.contractTierUsage),
      sponsorUsage: {
        dailyGasUsed: pool.dailyGasUsed,
        dailyTxCount: pool.dailyTxCount,
        resetTime: pool.resetTime
      },
      limits: {
        maxDailyGas: ZERO_GAS_LIMITS.MAX_SPONSORED_GAS_PER_DAY,
        maxDailyTx: ZERO_GAS_LIMITS.MAX_SPONSORED_TX_PER_DAY
      }
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
    
    // 检查原生代币交易 // 英文 /中文
    if (this.isNativeTokenTransaction(tx)) {
      // 赞助池资格检查 // 英文 /中文
      const sponsorCheck = SponsorPoolService.canSponsor(tx.from, tx.gas);
      if (!sponsorCheck.ok) {
        return { eligible: false, reason: `Sponsor rejected: ${sponsorCheck.reason}` };
      }
      
      return { eligible: true };
    }
    
    // 检查合约层级交易 // 英文 /中文
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
      
      // 赞助池资格检查：以合约地址作为赞助账户 // 英文 /中文
      const sponsorCheck = SponsorPoolService.canSponsor(tx.to, tx.gas);
      if (!sponsorCheck.ok) {
        return { eligible: false, reason: `Sponsor rejected: ${sponsorCheck.reason}` };
      }
      
      return { eligible: true };
    }
    
    return { eligible: false, reason: 'No valid zero-gas condition found' };
  }
}