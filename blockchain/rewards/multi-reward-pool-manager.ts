import { CONSENSUS_CONFIG, TOKEN_CONFIG } from '../../shared/constants/blockchain.js';
import { shouldGasFeeEnterRewardPool, getTransactionTokenType, isNativeTokenTransaction } from '../../shared/utils/native-token-utils.js';
import { Transaction } from '../../shared/types/blockchain.js';

/**
 * 奖励来源类型枚举
 */
export enum RewardSourceType {
  TTN_BLOCK_REWARD = 'ttn_block_reward',        // TTN线性出块奖励
  GAS_FEES = 'gas_fees',                        // 非原生代币gas费
  EXCHANGE_FEES = 'exchange_fees',              // 交易所手续费20%
  PROTOCOL_REVENUE = 'protocol_revenue'         // 其它链上收益20%
}

/**
 * 代币类型枚举
 */
export enum TokenType {
  TTN = 'TTN',           // 原生代币
  TTUSD = 'ttUSD',       // 原生稳定币
  OTHER = 'OTHER'        // 其他代币
}

/**
 * 奖励记录接口
 */
export interface RewardRecord {
  source: RewardSourceType;
  tokenType: TokenType;
  tokenAddress?: string;
  amount: bigint;
  blockNumber: number;
  timestamp: number;
  transactionHash?: string;
  metadata?: any;
}

/**
 * 奖励池状态接口
 */
export interface RewardPoolState {
  totalTTNRewards: bigint;
  totalGasFees: Map<string, bigint>; // tokenAddress -> amount
  totalExchangeFees: Map<string, bigint>;
  totalProtocolRevenue: Map<string, bigint>;
  lastDistributionBlock: number;
  pendingDistribution: boolean;
}

/**
 * 奖励分配结果接口
 */
export interface RewardDistributionResult {
  blockProducerRewards: Map<string, Map<string, bigint>>; // validator -> token -> amount
  validatorRewards: Map<string, Map<string, bigint>>;     // validator -> token -> amount
  totalDistributed: Map<string, bigint>;                  // token -> amount
  distributionBlock: number;
  timestamp: number;
}

/**
 * 多元化奖励池管理器
 * 管理四种奖励来源的收集、累积和分配
 */
export class MultiRewardPoolManager {
  private rewardRecords: RewardRecord[] = [];
  private poolState: RewardPoolState;
  private distributionHistory: Map<number, RewardDistributionResult> = new Map();
  
  // TTN线性释放相关
  private readonly TOTAL_TTN_SUPPLY = TOKEN_CONFIG.TOTAL_SUPPLY;
  private readonly BLOCK_REWARD_RATIO = TOKEN_CONFIG.BLOCK_REWARD_RATIO; // 70%用于区块奖励
  private readonly INITIAL_BLOCK_REWARD = TOKEN_CONFIG.INITIAL_BLOCK_REWARD;
  private readonly REWARD_DECAY_RATE = TOKEN_CONFIG.REWARD_DECAY_RATE;
  
  // 奖励分配比例
  private readonly BLOCK_PRODUCER_SHARE = 0.8; // 80%给出块节点
  private readonly VALIDATOR_SHARE = 0.2;      // 20%给验证节点

  constructor() {
    this.poolState = {
      totalTTNRewards: BigInt(0),
      totalGasFees: new Map(),
      totalExchangeFees: new Map(),
      totalProtocolRevenue: new Map(),
      lastDistributionBlock: 0,
      pendingDistribution: false
    };
  }

  /**
   * 1. 添加TTN线性出块奖励
   */
  addTTNBlockReward(blockNumber: number): bigint {
    // 计算当前区块的TTN奖励（考虑衰减）
    const epochsSinceGenesis = Math.floor(blockNumber / CONSENSUS_CONFIG.EPOCH_BLOCKS);
    const decayFactor = Math.pow(this.REWARD_DECAY_RATE, epochsSinceGenesis / 365); // 年度衰减
    const currentBlockReward = BigInt(Math.floor(Number(this.INITIAL_BLOCK_REWARD) * decayFactor));

    const record: RewardRecord = {
      source: RewardSourceType.TTN_BLOCK_REWARD,
      tokenType: TokenType.TTN,
      amount: currentBlockReward,
      blockNumber,
      timestamp: Date.now()
    };

    this.rewardRecords.push(record);
    this.poolState.totalTTNRewards += currentBlockReward;

    console.log(`添加TTN出块奖励: ${currentBlockReward.toString()} TTN (区块 ${blockNumber})`);
    return currentBlockReward;
  }

  /**
   * 2. 添加Gas费收入（仅非原生代币）
   */
  addGasFeeReward(
    tokenType: TokenType,
    tokenAddress: string,
    amount: bigint,
    blockNumber: number,
    transactionHash: string
  ): void {
    const record: RewardRecord = {
      source: RewardSourceType.GAS_FEES,
      tokenType,
      tokenAddress,
      amount,
      blockNumber,
      timestamp: Date.now(),
      transactionHash
    };

    this.rewardRecords.push(record);
    
    const currentAmount = this.poolState.totalGasFees.get(tokenAddress) || BigInt(0);
    this.poolState.totalGasFees.set(tokenAddress, currentAmount + amount);

    console.log(`添加Gas费收入: ${amount.toString()} ${tokenType} (${tokenAddress})`);
  }

  /**
   * 处理交易的Gas费（智能分配）
   * 根据交易类型决定gas费是否进入奖励池
   */
  processTransactionGasFee(
    tx: Transaction,
    gasFee: bigint,
    blockNumber: number
  ): {
    addedToRewardPool: boolean;
    tokenType: 'TTN' | 'ttUSD' | 'OTHER';
    reason: string;
  } {
    const tokenType = getTransactionTokenType(tx);
    const isNative = isNativeTokenTransaction(tx);
    const shouldEnterPool = shouldGasFeeEnterRewardPool(tx);

    if (shouldEnterPool && !isNative) {
      // 非原生代币交易的gas费进入奖励池
      this.addGasFeeReward(
        tokenType === 'OTHER' ? TokenType.OTHER : TokenType.TTN,
        tx.to || 'unknown',
        gasFee,
        blockNumber,
        tx.hash
      );

      return {
        addedToRewardPool: true,
        tokenType,
        reason: `非原生代币交易gas费已添加到奖励池`
      };
    } else {
      // 原生代币交易的gas费不进入奖励池
      return {
        addedToRewardPool: false,
        tokenType,
        reason: isNative 
          ? `原生代币(${tokenType})交易gas费不进入奖励池`
          : `交易不符合奖励池条件`
      };
    }
  }

  /**
   * 3. 添加交易所手续费分成（20%）
   */
  addExchangeFeeShare(
    tokenAddress: string,
    totalFee: bigint,
    blockNumber: number,
    exchangeAddress: string
  ): void {
    const shareAmount = totalFee * BigInt(20) / BigInt(100); // 20%分成

    const record: RewardRecord = {
      source: RewardSourceType.EXCHANGE_FEES,
      tokenType: tokenAddress === 'TTN' ? TokenType.TTN : TokenType.OTHER,
      tokenAddress,
      amount: shareAmount,
      blockNumber,
      timestamp: Date.now(),
      metadata: { exchangeAddress, totalFee }
    };

    this.rewardRecords.push(record);
    
    const currentAmount = this.poolState.totalExchangeFees.get(tokenAddress) || BigInt(0);
    this.poolState.totalExchangeFees.set(tokenAddress, currentAmount + shareAmount);

    console.log(`添加交易所手续费分成: ${shareAmount.toString()} (${tokenAddress}) 来自 ${exchangeAddress}`);
  }

  /**
   * 4. 添加协议收益分成（20%）
   */
  addProtocolRevenueShare(
    tokenAddress: string,
    totalRevenue: bigint,
    blockNumber: number,
    protocolName: string
  ): void {
    const shareAmount = totalRevenue * BigInt(20) / BigInt(100); // 20%分成

    const record: RewardRecord = {
      source: RewardSourceType.PROTOCOL_REVENUE,
      tokenType: tokenAddress === 'TTN' ? TokenType.TTN : TokenType.OTHER,
      tokenAddress,
      amount: shareAmount,
      blockNumber,
      timestamp: Date.now(),
      metadata: { protocolName, totalRevenue }
    };

    this.rewardRecords.push(record);
    
    const currentAmount = this.poolState.totalProtocolRevenue.get(tokenAddress) || BigInt(0);
    this.poolState.totalProtocolRevenue.set(tokenAddress, currentAmount + shareAmount);

    console.log(`添加协议收益分成: ${shareAmount.toString()} (${tokenAddress}) 来自 ${protocolName}`);
  }

  /**
   * 计算总奖励池（所有代币）
   */
  calculateTotalRewardPool(): Map<string, bigint> {
    const totalPool = new Map<string, bigint>();

    // TTN奖励
    totalPool.set('TTN', this.poolState.totalTTNRewards);

    // Gas费奖励
    for (const [tokenAddress, amount] of this.poolState.totalGasFees) {
      const current = totalPool.get(tokenAddress) || BigInt(0);
      totalPool.set(tokenAddress, current + amount);
    }

    // 交易所手续费
    for (const [tokenAddress, amount] of this.poolState.totalExchangeFees) {
      const current = totalPool.get(tokenAddress) || BigInt(0);
      totalPool.set(tokenAddress, current + amount);
    }

    // 协议收益
    for (const [tokenAddress, amount] of this.poolState.totalProtocolRevenue) {
      const current = totalPool.get(tokenAddress) || BigInt(0);
      totalPool.set(tokenAddress, current + amount);
    }

    return totalPool;
  }

  /**
   * 分配奖励给出块节点和验证节点
   */
  distributeRewards(
    blockNumber: number,
    blockProducerAddress: string,
    validatorRewards: Map<string, bigint> // validator -> weight
  ): RewardDistributionResult {
    const totalPool = this.calculateTotalRewardPool();
    const result: RewardDistributionResult = {
      blockProducerRewards: new Map(),
      validatorRewards: new Map(),
      totalDistributed: new Map(),
      distributionBlock: blockNumber,
      timestamp: Date.now()
    };

    // 为每种代币分配奖励
    for (const [tokenAddress, totalAmount] of totalPool) {
      if (totalAmount === BigInt(0)) continue;

      // 80%给出块节点
      const blockProducerAmount = totalAmount * BigInt(80) / BigInt(100);
      
      // 20%给验证节点
      const validatorPoolAmount = totalAmount * BigInt(20) / BigInt(100);

      // 分配给出块节点
      if (!result.blockProducerRewards.has(blockProducerAddress)) {
        result.blockProducerRewards.set(blockProducerAddress, new Map());
      }
      result.blockProducerRewards.get(blockProducerAddress)!.set(tokenAddress, blockProducerAmount);

      // 分配给验证节点（按权重）
      const totalValidatorWeight = Array.from(validatorRewards.values())
        .reduce((sum, weight) => sum + weight, BigInt(0));

      if (totalValidatorWeight > BigInt(0)) {
        for (const [validatorAddress, weight] of validatorRewards) {
          const validatorAmount = validatorPoolAmount * weight / totalValidatorWeight;
          
          if (!result.validatorRewards.has(validatorAddress)) {
            result.validatorRewards.set(validatorAddress, new Map());
          }
          result.validatorRewards.get(validatorAddress)!.set(tokenAddress, validatorAmount);
        }
      }

      result.totalDistributed.set(tokenAddress, totalAmount);
    }

    // 清空奖励池
    this.resetRewardPools();
    this.poolState.lastDistributionBlock = blockNumber;
    this.distributionHistory.set(blockNumber, result);

    console.log(`奖励分配完成 (区块 ${blockNumber}): 出块节点获得80%，${validatorRewards.size}个验证节点获得20%`);
    return result;
  }

  /**
   * 重置奖励池
   */
  private resetRewardPools(): void {
    this.poolState.totalTTNRewards = BigInt(0);
    this.poolState.totalGasFees.clear();
    this.poolState.totalExchangeFees.clear();
    this.poolState.totalProtocolRevenue.clear();
  }

  /**
   * 获取奖励统计信息
   */
  getRewardStatistics() {
    const totalPool = this.calculateTotalRewardPool();
    const rewardsBySource = new Map<RewardSourceType, Map<string, bigint>>();

    // 按来源统计奖励
    for (const record of this.rewardRecords) {
      if (!rewardsBySource.has(record.source)) {
        rewardsBySource.set(record.source, new Map());
      }
      const sourceMap = rewardsBySource.get(record.source)!;
      const tokenKey = record.tokenAddress || record.tokenType;
      const current = sourceMap.get(tokenKey) || BigInt(0);
      sourceMap.set(tokenKey, current + record.amount);
    }

    return {
      totalRewardPool: totalPool,
      rewardsBySource,
      totalRecords: this.rewardRecords.length,
      lastDistributionBlock: this.poolState.lastDistributionBlock,
      distributionHistory: Array.from(this.distributionHistory.entries()).slice(-10) // 最近10次分配
    };
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    const totalPool = this.calculateTotalRewardPool();
    const totalTTNValue = totalPool.get('TTN') || BigInt(0);
    
    return {
      totalRewardSources: 4,
      activePools: totalPool.size,
      totalTTNRewards: totalTTNValue.toString(),
      totalGasTokens: this.poolState.totalGasFees.size,
      totalExchangeTokens: this.poolState.totalExchangeFees.size,
      totalProtocolTokens: this.poolState.totalProtocolRevenue.size,
      pendingDistribution: this.poolState.pendingDistribution,
      lastDistributionBlock: this.poolState.lastDistributionBlock,
      systemHealth: totalTTNValue > BigInt(0) ? 'active' : 'waiting'
    };
  }

  /**
   * 清理旧记录
   */
  cleanupOldRecords(keepDays: number = 30): void {
    const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
    const initialCount = this.rewardRecords.length;
    
    this.rewardRecords = this.rewardRecords.filter(record => record.timestamp > cutoffTime);
    
    const cleanedCount = initialCount - this.rewardRecords.length;
    console.log(`清理了 ${cleanedCount} 条旧奖励记录`);
  }
}