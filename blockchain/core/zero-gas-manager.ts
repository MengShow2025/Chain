import { Transaction } from '../../shared/types/blockchain.js';
import { CONTRACT_TIER_FEES, ZERO_GAS_CONFIG, ERROR_CODES } from '../../shared/constants/blockchain.js';

/**
 * 0-gas费管理器
 * 实现TitanChain的0-gas费交易机制
 */
export class ZeroGasManager {
  private contractTierUsage: Map<string, { tier: number; dailyUsage: number; lastReset: number }> = new Map();
  private dailyLimits = {
    1: 100,  // Tier 1: 100次/天
    2: 50,   // Tier 2: 50次/天
    3: 20    // Tier 3: 20次/天
  };
  
  constructor() {
    // 定期清理过期数据
    setInterval(() => this.cleanupExpiredData(), 60 * 60 * 1000); // 每小时清理一次
  }
  
  /**
   * 检查交易是否符合0-gas费条件
   */
  async isZeroGasEligible(tx: Transaction): Promise<{
    eligible: boolean;
    reason?: string;
    tier?: number;
  }> {
    try {
      // 1. 检查智能合约分层收费
      const tierCheck = await this.checkContractTierEligibility(tx);
      if (tierCheck.eligible) {
        return { eligible: true, reason: 'Contract tier eligible', tier: tierCheck.tier };
      }
      
      // 2. 检查其他0-gas费条件
      const specialCheck = await this.checkSpecialConditions(tx);
      if (specialCheck.eligible) {
        return { eligible: true, reason: specialCheck.reason };
      }
      
      return { eligible: false, reason: 'No zero-gas conditions met' };
      
    } catch (error) {
      console.error('Error checking zero-gas eligibility:', error);
      return { eligible: false, reason: 'Eligibility check failed' };
    }
  }
  
  /**
   * 处理0-gas费交易
   */
  async processZeroGasTransaction(tx: Transaction): Promise<{
    success: boolean;
    actualGasFee: bigint;
    subsidized: bigint;
    error?: string;
  }> {
    try {
      const eligibility = await this.isZeroGasEligible(tx);
      
      if (!eligibility.eligible) {
        return {
          success: false,
          actualGasFee: tx.gas * tx.gasPrice,
          subsidized: BigInt(0),
          error: eligibility.reason
        };
      }
      
      // 根据不同类型处理
      if (eligibility.reason === 'Contract tier eligible') {
        return await this.processContractTier(tx, eligibility.tier!);
      } else {
        return await this.processSpecialCondition(tx);
      }
      
    } catch (error) {
      console.error('Error processing zero-gas transaction:', error);
      return {
        success: false,
        actualGasFee: tx.gas * tx.gasPrice,
        subsidized: BigInt(0),
        error: 'Processing failed'
      };
    }
  }
  

  
  /**
   * 检查智能合约分层收费资格
   */
  private async checkContractTierEligibility(tx: Transaction): Promise<{
    eligible: boolean;
    tier?: number;
  }> {
    // 检查是否为合约调用
    if (!tx.to || !this.isContractAddress(tx.to)) {
      return { eligible: false };
    }
    
    // 获取合约等级
    const contractTier = await this.getContractTier(tx.to);
    if (!contractTier) {
      return { eligible: false };
    }
    
    // 检查用户的每日使用限额
    const usage = this.getContractTierUsage(tx.from, contractTier);
    if (usage.dailyUsage >= this.dailyLimits[contractTier as keyof typeof this.dailyLimits]) {
      return { eligible: false };
    }
    
    return { eligible: true, tier: contractTier };
  }
  
  /**
   * 检查特殊条件
   */
  private async checkSpecialConditions(tx: Transaction): Promise<{
    eligible: boolean;
    reason?: string;
  }> {
    // 1. 新用户首次交易免费
    if (await this.isFirstTimeUser(tx.from)) {
      return { eligible: true, reason: 'First-time user bonus' };
    }
    
    // 2. 质押用户优惠
    if (await this.isStakingUser(tx.from)) {
      return { eligible: true, reason: 'Staking user benefit' };
    }
    
    // 3. 治理投票交易免费
    if (this.isGovernanceTransaction(tx)) {
      return { eligible: true, reason: 'Governance transaction' };
    }
    
    // 4. 小额交易免费（低于阈值）
    if (tx.value < BigInt(1000000000000000)) { // 0.001 TTN
      return { eligible: true, reason: 'Micro transaction' };
    }
    
    return { eligible: false };
  }
  

  
  /**
   * 处理智能合约分层收费
   */
  private async processContractTier(tx: Transaction, tier: number): Promise<{
    success: boolean;
    actualGasFee: bigint;
    subsidized: bigint;
    error?: string;
  }> {
    const originalGasFee = tx.gas * tx.gasPrice;
    const tierFee = BigInt(CONTRACT_TIER_FEES[`TIER_${tier}` as keyof typeof CONTRACT_TIER_FEES] || 0);
    
    // 更新用户使用次数
    this.updateContractTierUsage(tx.from, tier);
    
    return {
      success: true,
      actualGasFee: tierFee,
      subsidized: originalGasFee - tierFee
    };
  }
  
  /**
   * 处理特殊条件交易
   */
  private async processSpecialCondition(tx: Transaction): Promise<{
    success: boolean;
    actualGasFee: bigint;
    subsidized: bigint;
    error?: string;
  }> {
    const originalGasFee = tx.gas * tx.gasPrice;
    
    // 特殊条件交易完全免费
    return {
      success: true,
      actualGasFee: BigInt(0),
      subsidized: originalGasFee
    };
  }
  

  
  /**
   * 检查是否为合约地址
   */
  private isContractAddress(address: string): boolean {
    // 简化实现：检查地址格式
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  
  /**
   * 获取合约等级
   */
  private async getContractTier(contractAddress: string): Promise<number | null> {
    // 从合约注册表中获取等级
    const contractTiers = new Map([
      ['0x1111111111111111111111111111111111111111', 1], // Tier 1合约
      ['0x2222222222222222222222222222222222222222', 2], // Tier 2合约
      ['0x3333333333333333333333333333333333333333', 3]  // Tier 3合约
    ]);
    
    return contractTiers.get(contractAddress.toLowerCase()) || null;
  }
  
  /**
   * 获取用户合约等级使用情况
   */
  private getContractTierUsage(userAddress: string, tier: number): {
    tier: number;
    dailyUsage: number;
    lastReset: number;
  } {
    const key = `${userAddress}_${tier}`;
    let usage = this.contractTierUsage.get(key);
    
    if (!usage) {
      usage = {
        tier,
        dailyUsage: 0,
        lastReset: Date.now()
      };
      this.contractTierUsage.set(key, usage);
    }
    
    // 检查是否需要重置每日计数
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    if (now - usage.lastReset > oneDayMs) {
      usage.dailyUsage = 0;
      usage.lastReset = now;
    }
    
    return usage;
  }
  
  /**
   * 更新用户合约等级使用次数
   */
  private updateContractTierUsage(userAddress: string, tier: number): void {
    const usage = this.getContractTierUsage(userAddress, tier);
    usage.dailyUsage++;
  }
  
  /**
   * 检查是否为首次用户
   */
  private async isFirstTimeUser(address: string): Promise<boolean> {
    // 简化实现：检查用户是否有交易历史
    // 实际实现需要查询区块链历史
    return false; // 暂时返回false
  }
  
  /**
   * 检查是否为质押用户
   */
  private async isStakingUser(address: string): Promise<boolean> {
    // 检查用户是否有质押TTN代币
    // 简化实现
    return false; // 暂时返回false
  }
  
  /**
   * 检查是否为治理交易
   */
  private isGovernanceTransaction(tx: Transaction): boolean {
    // 检查交易是否为治理投票
    const governanceSignatures = [
      '0x15373e3d', // vote
      '0x7b3c71d3', // propose
      '0x40e58ee5'  // execute
    ];
    
    const methodSignature = tx.data.substring(0, 10);
    return governanceSignatures.includes(methodSignature);
  }
  
  /**
   * 清理过期数据
   */
  private cleanupExpiredData(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // 清理过期的合约等级使用记录
    const entries = Array.from(this.contractTierUsage.entries());
    for (const [key, usage] of entries) {
      if (now - usage.lastReset > oneDayMs * 7) { // 保留7天的记录
        this.contractTierUsage.delete(key);
      }
    }
  }
  
  /**
   * 获取0-gas费统计信息
   */
  getZeroGasStats(): {
    totalZeroGasTransactions: number;
    totalGasSubsidized: bigint;
    contractTierUsage: Map<string, any>;
  } {
    return {
      totalZeroGasTransactions: 0, // 需要实现计数器
      totalGasSubsidized: BigInt(0), // 需要实现累计器
      contractTierUsage: new Map(this.contractTierUsage)
    };
  }
  
  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.contractTierUsage.clear();
  }
  

  
  /**
   * 设置合约等级
   */
  setContractTier(contractAddress: string, tier: number): void {
    if (tier < 1 || tier > 3) {
      throw new Error('Invalid contract tier. Must be 1, 2, or 3');
    }
    
    // 实际实现需要持久化存储
    console.log(`Set contract ${contractAddress} to tier ${tier}`);
  }
  
  /**
   * 更新每日限额
   */
  updateDailyLimits(tier: number, limit: number): void {
    if (tier < 1 || tier > 3) {
      throw new Error('Invalid tier');
    }
    
    this.dailyLimits[tier as keyof typeof this.dailyLimits] = limit;
    console.log(`Updated tier ${tier} daily limit to ${limit}`);
  }
}