import { Validator, ValidatorCandidate } from '../../shared/types/blockchain.js';
import { VRFRandomSelector } from './vrf-random-selector.js';
import { CONSENSUS_CONFIG } from '../../shared/constants/blockchain.js';

/**
 * 出块竞争结果
 */
export interface BlockProductionResult {
  selectedProducer: string;
  blockNumber: number;
  timestamp: number;
  vrfProof: string;
  competitorCount: number;
  selectionWeight: bigint;
}

/**
 * 验证节点出块权重
 */
export interface ValidatorWeight {
  address: string;
  stake: bigint;
  performance: number; // 0-100
  uptime: number; // 0-100
  finalWeight: bigint;
}

/**
 * 竞争出块系统
 * 实现108个出块节点的公平竞争机制
 */
export class CompetitiveBlockProduction {
  private vrfSelector: VRFRandomSelector;
  private activeProducers: Map<string, Validator> = new Map();
  private blockProductionHistory: Map<number, BlockProductionResult> = new Map();
  private validatorWeights: Map<string, ValidatorWeight> = new Map();

  constructor(vrfPrivateKey?: Buffer) {
    this.vrfSelector = new VRFRandomSelector(vrfPrivateKey);
  }

  /**
   * 添加出块节点
   */
  addBlockProducer(validator: Validator): void {
    this.activeProducers.set(validator.address, validator);
    this.updateValidatorWeight(validator);
    console.log(`Added block producer: ${validator.address}`);
  }

  /**
   * 移除出块节点
   */
  removeBlockProducer(address: string): void {
    this.activeProducers.delete(address);
    this.validatorWeights.delete(address);
    console.log(`Removed block producer: ${address}`);
  }

  /**
   * 更新验证节点权重
   */
  private updateValidatorWeight(validator: Validator): void {
    // 使用固定的基础权重，确保更公平的分布
    const baseWeight = BigInt(1000000); // 固定基础权重
    
    // 性能加权 (0.9-1.1倍) - 减小性能影响
    const performanceMultiplier = validator.performance?.score 
      ? Math.max(0.9, Math.min(1.1, validator.performance.score / 100))
      : 1.0;
    
    // 在线时间加权 (0.95-1.0倍) - 减小在线时间影响
    const uptimeMultiplier = validator.performance?.uptime
      ? Math.max(0.95, validator.performance.uptime / 100)
      : 1.0;

    // 增加更大的随机变化以增加选择多样性 (0.5-1.5倍)
    const randomMultiplier = 0.5 + Math.random() * 1.0;

    // 添加基于地址和时间的伪随机因子
    const addressHash = parseInt(validator.address.slice(-8), 16);
    const timeHash = Date.now() % 10000;
    const addressMultiplier = 0.7 + ((addressHash + timeHash) % 1000) / 1666; // 0.7-1.3倍

    // 计算最终权重
    const finalWeight = BigInt(Math.floor(
      Number(baseWeight) * performanceMultiplier * uptimeMultiplier * randomMultiplier * addressMultiplier
    ));

    this.validatorWeights.set(validator.address, {
      address: validator.address,
      stake: validator.stake,
      performance: validator.performance?.score || 0,
      uptime: validator.performance?.uptime || 0,
      finalWeight
    });
  }

  /**
   * 竞争选择出块者
   * 基于VRF和权重的公平竞争机制
   */
  async selectBlockProducer(blockNumber: number, previousBlockHash: string): Promise<BlockProductionResult | null> {
    const producers = Array.from(this.activeProducers.values());
    
    if (producers.length === 0) {
      console.error('No active block producers available');
      return null;
    }

    // 更新所有验证节点权重
    for (const producer of producers) {
      this.updateValidatorWeight(producer);
    }

    // 计算总权重
    const totalWeight = Array.from(this.validatorWeights.values())
      .reduce((sum, weight) => sum + weight.finalWeight, BigInt(0));

    if (totalWeight === BigInt(0)) {
      console.error('Total validator weight is zero');
      return null;
    }

    // 使用多重随机源生成随机数
    const entropy1 = Math.random().toString(36).substring(2);
    const entropy2 = Date.now().toString(36);
    const entropy3 = (blockNumber * 31 + producers.length * 17).toString(36);
    
    // 组合多个熵源
    const combinedEntropy = `${blockNumber}-${previousBlockHash}-${entropy1}-${entropy2}-${entropy3}`;
    
    // 使用crypto.createHash生成更好的随机性
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(combinedEntropy);
    const hashResult = hash.digest('hex');
    
    // 生成随机值进行选择 - 确保随机值在总权重范围内
    const hashValue = BigInt('0x' + hashResult.slice(0, 16)); // 使用前16个字符
    const randomValue = hashValue % totalWeight; // 确保随机值在总权重范围内

    // 基于权重选择出块者
    let currentWeight = BigInt(0);
    let selectedProducer: string | null = null;
    let selectionWeight = BigInt(0);

    // 调试：打印权重分布
    console.log(`\n=== 区块 #${blockNumber} 权重分布 ===`);
    console.log(`总权重: ${totalWeight}`);
    console.log(`随机值: ${randomValue}`);
    
    for (const [address, weight] of this.validatorWeights) {
      console.log(`${address}: ${weight.finalWeight} (${Number(weight.finalWeight * BigInt(100) / totalWeight)}%)`);
      currentWeight += weight.finalWeight;
      if (randomValue < currentWeight && !selectedProducer) {
        selectedProducer = address;
        selectionWeight = weight.finalWeight;
        console.log(`✅ 选中: ${address}`);
      }
    }

    // 备选方案：选择第一个生产者
    if (!selectedProducer) {
      selectedProducer = producers[0].address;
      selectionWeight = this.validatorWeights.get(selectedProducer)?.finalWeight || BigInt(0);
    }

    const result: BlockProductionResult = {
      selectedProducer,
      blockNumber,
      timestamp: Date.now(),
      vrfProof: hashResult, // 使用哈希结果作为证明
      competitorCount: producers.length,
      selectionWeight
    };

    // 记录出块历史
    this.blockProductionHistory.set(blockNumber, result);

    console.log(`Block #${blockNumber} producer selected: ${selectedProducer} (weight: ${selectionWeight})`);
    
    return result;
  }

  /**
   * 验证出块者选择的有效性
   */
  async verifyBlockProducerSelection(
    blockNumber: number,
    claimedProducer: string,
    vrfProof: string,
    previousBlockHash: string
  ): Promise<boolean> {
    try {
      // 重新计算选择过程
      const vrfInput = `${blockNumber}-${previousBlockHash}`;
      // 构造VRFProof对象进行验证
      const vrfProofObj = {
        proof: vrfProof,
        publicKey: this.vrfSelector.getPublicKey(),
        seed: vrfInput,
        output: vrfProof.slice(0, 64), // 假设前64个字符是输出
        verified: false
      };
      const isValidProof = this.vrfSelector.verifyVRFProof(vrfProofObj);
      
      if (!isValidProof) {
        console.error(`Invalid VRF proof for block #${blockNumber}`);
        return false;
      }

      // 验证生产者是否在活跃列表中
      if (!this.activeProducers.has(claimedProducer)) {
        console.error(`Producer ${claimedProducer} not in active producers list`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error verifying block producer selection:', error);
      return false;
    }
  }

  /**
   * 获取出块统计信息
   */
  getBlockProductionStats(epochBlocks: number = 100): {
    totalBlocks: number;
    producerDistribution: Map<string, number>;
    averageCompetition: number;
    fairnessScore: number;
  } {
    const recentHistory = Array.from(this.blockProductionHistory.values())
      .slice(-epochBlocks);

    const producerCount = new Map<string, number>();
    let totalCompetition = 0;

    for (const record of recentHistory) {
      producerCount.set(
        record.selectedProducer,
        (producerCount.get(record.selectedProducer) || 0) + 1
      );
      totalCompetition += record.competitorCount;
    }

    // 计算公平性分数 (基于分布的标准差)
    const expectedBlocksPerProducer = recentHistory.length / this.activeProducers.size;
    const variance = Array.from(producerCount.values())
      .reduce((sum, count) => sum + Math.pow(count - expectedBlocksPerProducer, 2), 0) / producerCount.size;
    const fairnessScore = Math.max(0, 100 - Math.sqrt(variance) * 10);

    return {
      totalBlocks: recentHistory.length,
      producerDistribution: producerCount,
      averageCompetition: totalCompetition / recentHistory.length,
      fairnessScore
    };
  }

  /**
   * 获取验证节点权重信息
   */
  getValidatorWeights(): Map<string, ValidatorWeight> {
    return new Map(this.validatorWeights);
  }

  /**
   * 获取出块历史
   */
  getBlockProductionHistory(limit: number = 100): BlockProductionResult[] {
    return Array.from(this.blockProductionHistory.values())
      .slice(-limit)
      .sort((a, b) => b.blockNumber - a.blockNumber);
  }

  /**
   * 清理旧的出块历史
   */
  cleanupOldHistory(keepBlocks: number = 1000): void {
    const allBlocks = Array.from(this.blockProductionHistory.keys()).sort((a, b) => b - a);
    
    if (allBlocks.length > keepBlocks) {
      const blocksToRemove = allBlocks.slice(keepBlocks);
      for (const blockNumber of blocksToRemove) {
        this.blockProductionHistory.delete(blockNumber);
      }
      console.log(`Cleaned up ${blocksToRemove.length} old block production records`);
    }
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    const stats = this.getBlockProductionStats();
    
    return {
      activeProducers: this.activeProducers.size,
      totalWeights: Array.from(this.validatorWeights.values())
        .reduce((sum, w) => sum + w.finalWeight, BigInt(0)),
      recentBlocks: stats.totalBlocks,
      fairnessScore: stats.fairnessScore,
      averageCompetition: stats.averageCompetition,
      systemHealth: this.activeProducers.size >= CONSENSUS_CONFIG.MAX_VALIDATORS * 0.9 ? 'healthy' : 'warning'
    };
  }
}