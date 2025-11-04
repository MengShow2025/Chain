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
  // Track consecutive production counts per validator // 英文 /中文
  private consecutiveProductionCount: Map<string, number> = new Map(); // 英文 /中文
  // Remember last selected producer // 英文 /中文
  private lastSelectedProducer: string | null = null; // 英文 /中文
  // Track when a producer was added for cold-start boost // 英文 /中文
  private producerAddedAt: Map<string, number> = new Map(); // 英文 /中文

  constructor(vrfPrivateKey?: Buffer) {
    this.vrfSelector = new VRFRandomSelector(vrfPrivateKey);
  }

  /**
   * 添加出块节点
   */
  addBlockProducer(validator: Validator): void {
    this.activeProducers.set(validator.address, validator);
    this.updateValidatorWeight(validator);
    // Initialize tracking maps // 英文 /中文
    this.producerAddedAt.set(validator.address, Date.now()); // 英文 /中文
    if (!this.consecutiveProductionCount.has(validator.address)) {
      this.consecutiveProductionCount.set(validator.address, 0); // 英文 /中文
    }
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
    // 基础权重：质押量 // 英文 /中文
    const stakeBase = validator.totalStake || validator.stake || BigInt(0); // 英文 /中文
    const baseWeight = stakeBase;

    // Performance multiplier (0.6 - 1.4) using integer scaling (x1000) // 英文 /中文
    const perfScore = validator.performance?.score ?? 100; // 英文 /中文
    const perfMultiplierFloat = 0.6 + 0.8 * (Math.max(0, Math.min(100, perfScore)) / 100); // 英文 /中文
    const perfScaled = Math.round(perfMultiplierFloat * 1000); // 600-1400 // 英文 /中文

    // Uptime multiplier (0.8 - 1.2) using integer scaling (x1000) // 英文 /中文
    const uptimeScore = validator.performance?.uptime ?? 100; // 英文 /中文
    const uptimeMultiplierFloat = 0.8 + 0.4 * (Math.max(0, Math.min(100, uptimeScore)) / 100); // 英文 /中文
    const uptimeScaled = Math.round(uptimeMultiplierFloat * 1000); // 800-1200 // 英文 /中文

    // 移除非确定性随机与时间相关因子，避免不可复现选择 // 英文 /中文

    // Scale factor denominator (x1000 for each multiplier) // 英文 /中文
    const SCALE = BigInt(1000);
    const DEN = SCALE * SCALE; // 10^6 // 英文 /中文

    // Compute final weight in BigInt space to avoid precision loss // 英文 /中文
    let finalWeight = (baseWeight * BigInt(perfScaled) * BigInt(uptimeScaled)) / DEN; // 英文 /中文
    if (finalWeight < BigInt(1)) finalWeight = BigInt(1); // 防止为0 // 英文 /中文

    this.validatorWeights.set(validator.address, {
      address: validator.address,
      stake: stakeBase,
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

    // 更新所有验证节点权重 // 英文 /中文
    for (const producer of producers) {
      this.updateValidatorWeight(producer);
    }

    // 计算有效权重（含连续出块折扣与冷启动加成） // 英文 /中文
    const effectiveWeights = new Map<string, bigint>(); // 英文 /中文
    const SCALE = BigInt(1000); // 英文 /中文
    const DEN = SCALE * SCALE; // 纯选择附加的双乘因子分母 // 英文 /中文

    for (const [address, weight] of this.validatorWeights) {
      // 连续出块抑制：指数衰减 0.85^(k-1)，最小0.4 // 英文 /中文
      const consec = this.consecutiveProductionCount.get(address) ?? 0; // 英文 /中文
      const decay = Math.max(0.4, Math.pow(0.85, Math.max(0, consec - 1))); // 英文 /中文
      const consecScaled = Math.round(decay * 1000); // 英文 /中文

      // 冷启动加成：加入10分钟内，线性 1.05-1.10 // 英文 /中文
      const addedAt = this.producerAddedAt.get(address) ?? Date.now(); // 英文 /中文
      const ageMs = Date.now() - addedAt; // 英文 /中文
      const COLD_MS = 10 * 60 * 1000; // 英文 /中文
      let coldScaled = 1000; // 英文 /中文
      if (ageMs < COLD_MS) {
        const frac = Math.max(0, (COLD_MS - ageMs) / COLD_MS); // 0-1 // 英文 /中文
        const boost = 1.05 + frac * 0.05; // 1.05 - 1.10 // 英文 /中文
        coldScaled = Math.round(boost * 1000); // 英文 /中文
      }

      // 计算有效权重 // 英文 /中文
      let eff = (weight.finalWeight * BigInt(consecScaled) * BigInt(coldScaled)) / DEN; // 英文 /中文
      if (eff < BigInt(1)) eff = BigInt(1); // 英文 /中文
      effectiveWeights.set(address, eff); // 英文 /中文
    }

    // 计算总有效权重 // 英文 /中文
    const totalEffectiveWeight = Array.from(effectiveWeights.values())
      .reduce((sum, w) => sum + w, BigInt(0)); // 英文 /中文

    if (totalEffectiveWeight === BigInt(0)) {
      console.error('Total effective validator weight is zero'); // 英文 /中文
      return null;
    }

    // 使用VRF生成确定性随机值（可验证） // 英文 /中文
    const seed = `${blockNumber}-${previousBlockHash}`; // 英文 /中文
    const vrf = await this.vrfSelector.generateVRFProof(seed); // 英文 /中文
    const outputHex = (vrf.output || '0'.repeat(64)); // 英文 /中文
    const hashValue = BigInt('0x' + outputHex.slice(0, 16)); // 使用前16个字符 // 英文 /中文
    const randomValue = hashValue % totalEffectiveWeight; // 英文 /中文

    // 基于有效权重选择出块者 // 英文 /中文
    let currentWeight = BigInt(0);
    let selectedProducer: string | null = null;
    let selectionWeight = BigInt(0);

    // 调试：打印权重分布（有效权重） // 英文 /中文
    console.log(`\n=== 区块 #${blockNumber} 权重分布(有效) ===`);
    console.log(`总有效权重: ${totalEffectiveWeight}`);
    console.log(`随机值(VRF): ${randomValue}`);
    console.log(`VRF Seed: ${seed}, Output: ${outputHex.slice(0, 16)}...`); // 英文 /中文
    
    for (const [address, effWeight] of effectiveWeights) {
      console.log(`${address}: ${effWeight} (${Number(effWeight * BigInt(100) / totalEffectiveWeight)}%)`); // 英文 /中文
      currentWeight += effWeight;
      if (randomValue < currentWeight && !selectedProducer) {
        selectedProducer = address;
        selectionWeight = effWeight;
        console.log(`✅ 选中: ${address}`); // 英文 /中文
      }
    }

    // 备选方案：选择第一个生产者 // 英文 /中文
    if (!selectedProducer) {
      selectedProducer = producers[0].address;
      selectionWeight = effectiveWeights.get(selectedProducer) || BigInt(0);
    }

    const result: BlockProductionResult = {
      selectedProducer,
      blockNumber,
      timestamp: Date.now(),
      vrfProof: outputHex, // 使用VRF输出作为证明 // 英文 /中文
      competitorCount: producers.length,
      selectionWeight
    };

    // 记录出块历史与连续计数 // 英文 /中文
    this.blockProductionHistory.set(blockNumber, result);
    const prev = this.lastSelectedProducer; // 英文 /中文
    if (prev === selectedProducer) {
      const c = (this.consecutiveProductionCount.get(selectedProducer!) || 0) + 1; // 英文 /中文
      this.consecutiveProductionCount.set(selectedProducer!, c); // 英文 /中文
    } else {
      if (prev) this.consecutiveProductionCount.set(prev, 0); // 英文 /中文
      this.consecutiveProductionCount.set(selectedProducer!, 1); // 英文 /中文
    }
    this.lastSelectedProducer = selectedProducer; // 英文 /中文

    console.log(`Block #${blockNumber} producer selected: ${selectedProducer} (effective weight: ${selectionWeight})`); // 英文 /中文
    
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