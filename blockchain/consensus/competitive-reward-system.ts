import { Validator, ValidatorCandidate, RewardTransfer } from '../../shared/types/blockchain.js';
import { CompetitiveBlockProduction, BlockProductionResult } from './competitive-block-production.js';
import { ValidationWorkloadSystem } from './validation-workload-system.js';
import { CONSENSUS_CONFIG } from '../../shared/constants/blockchain.js';

/**
 * 奖励分配结果
 */
export interface RewardDistributionResult {
  blockNumber: number;
  totalReward: bigint;
  blockProducerReward: bigint;
  validationRewards: Map<string, bigint>;
  blockProducer: string;
  timestamp: number;
}

/**
 * 竞争奖励系统
 * 实现正确的奖励分配机制：
 * - 80%奖励给成功出块的节点
 * - 20%奖励按验证工作量分配给候补节点
 */
export class CompetitiveRewardSystem {
  private blockProduction: CompetitiveBlockProduction;
  private validationWorkload: ValidationWorkloadSystem;
  private rewardHistory: Map<number, RewardDistributionResult> = new Map();
  private rewardTransferCallback?: (transfer: RewardTransfer) => Promise<void>;

  constructor(
    blockProduction: CompetitiveBlockProduction,
    validationWorkload: ValidationWorkloadSystem
  ) {
    this.blockProduction = blockProduction;
    this.validationWorkload = validationWorkload;
  }

  /**
   * 设置奖励转账回调
   */
  setRewardTransferCallback(callback: (transfer: RewardTransfer) => Promise<void>): void {
    this.rewardTransferCallback = callback;
  }

  /**
   * 分配区块奖励
   * 实现正确的竞争机制：80%出块奖励 + 20%验证奖励
   */
  async distributeBlockRewards(
    totalReward: bigint,
    blockNumber: number,
    blockProducerAddress: string,
    blockProductionResult?: BlockProductionResult
  ): Promise<RewardDistributionResult> {
    try {
      console.log(`开始分配区块 #${blockNumber} 奖励，总奖励: ${totalReward}`);

      // 计算奖励分配
      const blockProducerReward = (totalReward * BigInt(80)) / BigInt(100); // 80%给出块者
      const validationRewardPool = totalReward - blockProducerReward; // 20%给验证节点

      // 1. 分配出块奖励给成功出块的节点
      await this.distributeBlockProducerReward(
        blockProducerAddress,
        blockProducerReward,
        blockNumber
      );

      // 2. 分配验证奖励给候补节点（基于工作量）
      const validationRewards = await this.distributeValidationRewards(
        validationRewardPool,
        blockNumber
      );

      // 记录奖励分配结果
      const result: RewardDistributionResult = {
        blockNumber,
        totalReward,
        blockProducerReward,
        validationRewards,
        blockProducer: blockProducerAddress,
        timestamp: Date.now()
      };

      this.rewardHistory.set(blockNumber, result);

      console.log(`区块 #${blockNumber} 奖励分配完成:`);
      console.log(`- 出块奖励: ${blockProducerReward} (给 ${blockProducerAddress})`);
      console.log(`- 验证奖励: ${validationRewardPool} (分配给 ${validationRewards.size} 个验证节点)`);

      return result;

    } catch (error) {
      console.error(`分配区块 #${blockNumber} 奖励失败:`, error);
      throw error;
    }
  }

  /**
   * 分配出块奖励给成功出块的节点
   */
  private async distributeBlockProducerReward(
    blockProducerAddress: string,
    reward: bigint,
    blockNumber: number
  ): Promise<void> {
    if (reward <= BigInt(0)) {
      console.warn(`区块 #${blockNumber} 出块奖励为0，跳过分配`);
      return;
    }

    const transfer: RewardTransfer = {
      fromValidator: 'system',
      toValidator: blockProducerAddress,
      amount: reward,
      type: 'block_production_reward',
      blockNumber,
      timestamp: Date.now(),
      epoch: Math.floor(blockNumber / 100) // 假设每100个区块为一个epoch
    };

    await this.executeRewardTransfer(transfer);
    console.log(`出块奖励 ${reward} 已分配给 ${blockProducerAddress}`);
  }

  /**
   * 分配验证奖励给候补节点（基于工作量）
   */
  private async distributeValidationRewards(
    totalValidationReward: bigint,
    blockNumber: number
  ): Promise<Map<string, bigint>> {
    const rewards = new Map<string, bigint>();

    if (totalValidationReward <= BigInt(0)) {
      console.warn(`区块 #${blockNumber} 验证奖励为0，跳过分配`);
      return rewards;
    }

    // 使用验证工作量系统计算奖励分配
    const validationRewards = this.validationWorkload.calculateValidationRewards(
      totalValidationReward,
      100 // 考虑最近100个区块的工作量
    );

    // 执行奖励转账
    for (const [validatorAddress, reward] of validationRewards) {
      if (reward > BigInt(0)) {
        const transfer: RewardTransfer = {
          fromValidator: 'system',
          toValidator: validatorAddress,
          amount: reward,
          type: 'validation_work_reward',
          blockNumber,
          timestamp: Date.now(),
          epoch: Math.floor(blockNumber / 100)
        };

        await this.executeRewardTransfer(transfer);
        rewards.set(validatorAddress, reward);
      }
    }

    console.log(`验证奖励已分配给 ${rewards.size} 个验证节点`);
    return rewards;
  }

  /**
   * 执行奖励转账
   */
  private async executeRewardTransfer(transfer: RewardTransfer): Promise<void> {
    if (this.rewardTransferCallback) {
      await this.rewardTransferCallback(transfer);
    } else {
      console.warn('奖励转账回调未设置，无法执行转账:', transfer);
    }
  }

  /**
   * 处理完整的区块奖励流程
   * 包括竞争出块和奖励分配
   */
  async processBlockRewards(
    blockNumber: number,
    previousBlockHash: string,
    baseReward: bigint
  ): Promise<RewardDistributionResult | null> {
    try {
      // 1. 竞争选择出块者
      const blockProductionResult = await this.blockProduction.selectBlockProducer(
        blockNumber,
        previousBlockHash
      );

      if (!blockProductionResult) {
        console.error(`区块 #${blockNumber} 出块者选择失败`);
        return null;
      }

      // 2. 分配奖励
      const rewardResult = await this.distributeBlockRewards(
        baseReward,
        blockNumber,
        blockProductionResult.selectedProducer,
        blockProductionResult
      );

      console.log(`区块 #${blockNumber} 完整奖励流程处理完成`);
      return rewardResult;

    } catch (error) {
      console.error(`处理区块 #${blockNumber} 奖励流程失败:`, error);
      return null;
    }
  }

  /**
   * 获取奖励分配统计
   */
  getRewardDistributionStats(epochBlocks: number = 100): {
    totalBlocks: number;
    totalRewards: bigint;
    blockProducerRewards: bigint;
    validationRewards: bigint;
    averageBlockReward: bigint;
    averageValidationReward: bigint;
    rewardDistribution: {
      blockProducerShare: number;
      validationShare: number;
    };
  } {
    const recentHistory = Array.from(this.rewardHistory.values())
      .slice(-epochBlocks);

    let totalRewards = BigInt(0);
    let blockProducerRewards = BigInt(0);
    let validationRewards = BigInt(0);

    for (const record of recentHistory) {
      totalRewards += record.totalReward;
      blockProducerRewards += record.blockProducerReward;
      
      for (const reward of record.validationRewards.values()) {
        validationRewards += reward;
      }
    }

    const totalBlocks = recentHistory.length;
    const averageBlockReward = totalBlocks > 0 ? totalRewards / BigInt(totalBlocks) : BigInt(0);
    const averageValidationReward = totalBlocks > 0 ? validationRewards / BigInt(totalBlocks) : BigInt(0);

    return {
      totalBlocks,
      totalRewards,
      blockProducerRewards,
      validationRewards,
      averageBlockReward,
      averageValidationReward,
      rewardDistribution: {
        blockProducerShare: totalRewards > BigInt(0) 
          ? Number(blockProducerRewards * BigInt(100) / totalRewards) 
          : 0,
        validationShare: totalRewards > BigInt(0) 
          ? Number(validationRewards * BigInt(100) / totalRewards) 
          : 0
      }
    };
  }

  /**
   * 获取验证节点奖励排名
   */
  getValidatorRewardRanking(epochBlocks: number = 100): Array<{
    address: string;
    totalRewards: bigint;
    blockCount: number;
    averageReward: bigint;
  }> {
    const recentHistory = Array.from(this.rewardHistory.values())
      .slice(-epochBlocks);

    const validatorStats = new Map<string, {
      totalRewards: bigint;
      blockCount: number;
    }>();

    // 统计出块奖励
    for (const record of recentHistory) {
      const producer = record.blockProducer;
      const stats = validatorStats.get(producer) || { totalRewards: BigInt(0), blockCount: 0 };
      stats.totalRewards += record.blockProducerReward;
      stats.blockCount += 1;
      validatorStats.set(producer, stats);
    }

    // 统计验证奖励
    for (const record of recentHistory) {
      for (const [validator, reward] of record.validationRewards) {
        const stats = validatorStats.get(validator) || { totalRewards: BigInt(0), blockCount: 0 };
        stats.totalRewards += reward;
        validatorStats.set(validator, stats);
      }
    }

    // 转换为排名数组
    return Array.from(validatorStats.entries())
      .map(([address, stats]) => ({
        address,
        totalRewards: stats.totalRewards,
        blockCount: stats.blockCount,
        averageReward: stats.blockCount > 0 
          ? stats.totalRewards / BigInt(stats.blockCount) 
          : BigInt(0)
      }))
      .sort((a, b) => {
        // 按总奖励排序
        if (a.totalRewards > b.totalRewards) return -1;
        if (a.totalRewards < b.totalRewards) return 1;
        return 0;
      });
  }

  /**
   * 获取奖励历史
   */
  getRewardHistory(limit: number = 100): RewardDistributionResult[] {
    return Array.from(this.rewardHistory.values())
      .slice(-limit)
      .sort((a, b) => b.blockNumber - a.blockNumber);
  }

  /**
   * 清理旧的奖励历史
   */
  cleanupOldHistory(keepBlocks: number = 1000): void {
    const allBlocks = Array.from(this.rewardHistory.keys()).sort((a, b) => b - a);
    
    if (allBlocks.length > keepBlocks) {
      const blocksToRemove = allBlocks.slice(keepBlocks);
      for (const blockNumber of blocksToRemove) {
        this.rewardHistory.delete(blockNumber);
      }
      console.log(`清理了 ${blocksToRemove.length} 个旧的奖励记录`);
    }
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    const stats = this.getRewardDistributionStats();
    const blockProductionStats = this.blockProduction.getSystemStatus();
    const validationStats = this.validationWorkload.getSystemStatus();

    return {
      rewardSystem: {
        totalBlocks: stats.totalBlocks,
        totalRewards: stats.totalRewards.toString(),
        blockProducerShare: stats.rewardDistribution.blockProducerShare,
        validationShare: stats.rewardDistribution.validationShare
      },
      blockProduction: blockProductionStats,
      validation: validationStats,
      systemHealth: 
        blockProductionStats.systemHealth === 'healthy' && 
        validationStats.systemHealth === 'healthy' 
          ? 'healthy' : 'warning'
    };
  }
}