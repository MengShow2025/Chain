import crypto from 'crypto';
import { 
  ValidatorCandidate, 
  VRFProof, 
  RandomSelectionResult 
} from '../../shared/types/blockchain.js';

/**
 * VRF随机选择器
 * 使用可验证随机函数确保候选节点选择的公正性和不可预测性
 */
export class VRFRandomSelector {
  private readonly privateKey: Buffer;
  private readonly publicKey: Buffer;
  
  constructor(privateKey?: Buffer) {
    if (privateKey) {
      this.privateKey = privateKey;
      // 从私钥生成公钥
      const keyPair = crypto.createECDH('secp256k1');
      keyPair.setPrivateKey(privateKey);
      this.publicKey = keyPair.getPublicKey();
    } else {
      // 生成新的密钥对
      const keyPair = crypto.createECDH('secp256k1');
      keyPair.generateKeys();
      this.privateKey = keyPair.getPrivateKey();
      this.publicKey = keyPair.getPublicKey();
    }
    
    console.log('VRF Random Selector initialized');
  }
  
  /**
   * 从候选节点中随机选择指定数量的节点
   */
  async selectRandomCandidates(
    candidates: ValidatorCandidate[],
    count: number,
    blockHash: string,
    timestamp: number,
    additionalEntropy?: string
  ): Promise<RandomSelectionResult> {
    if (candidates.length === 0) {
      throw new Error('No candidates available for selection');
    }
    
    if (count > candidates.length) {
      console.warn(`Requested ${count} candidates but only ${candidates.length} available`);
      count = candidates.length;
    }
    
    // 构建随机种子
    const seed = this.buildRandomSeed(blockHash, timestamp, additionalEntropy);
    
    // 生成VRF证明
    const vrfProof = this.generateVRFProof(seed);
    
    // 基于VRF输出进行选择
    const selectedCandidates = this.performSelection(candidates, count, vrfProof.output);
    
    const result: RandomSelectionResult = {
      selectedCandidates,
      vrfProof,
      seed,
      timestamp: Date.now(),
      selectionMethod: 'vrf_weighted',
      totalCandidates: candidates.length,
      requestedCount: count,
      actualCount: selectedCandidates.length
    };
    
    console.log(`Selected ${selectedCandidates.length} candidates from ${candidates.length} using VRF`);
    return result;
  }
  
  /**
   * 构建随机种子
   */
  private buildRandomSeed(blockHash: string, timestamp: number, additionalEntropy?: string): string {
    const components = [
      blockHash,
      timestamp.toString(),
      Date.now().toString(), // 当前时间戳
      Math.random().toString(), // 额外随机性
      additionalEntropy || ''
    ];
    
    // 使用SHA-256哈希组合所有组件
    const hash = crypto.createHash('sha256');
    hash.update(components.join('|'));
    return hash.digest('hex');
  }
  
  /**
   * 生成VRF证明
   */
  private generateVRFProof(seed: string): VRFProof {
    // 使用HMAC作为VRF的简化实现
    // 在生产环境中应该使用更严格的VRF实现，如ECVRF
    const hmac = crypto.createHmac('sha256', this.privateKey);
    hmac.update(seed);
    const output = hmac.digest();
    
    // 生成证明（简化版本）
    const proofHmac = crypto.createHmac('sha256', this.privateKey);
    proofHmac.update(seed + output.toString('hex'));
    const proof = proofHmac.digest();
    
    return {
      seed,
      output: output.toString('hex'),
      proof: proof.toString('hex'),
      publicKey: this.publicKey.toString('hex'),
      timestamp: Date.now()
    };
  }
  
  /**
   * 验证VRF证明
   */
  verifyVRFProof(vrfProof: VRFProof): boolean {
    try {
      // 重新计算输出
      const hmac = crypto.createHmac('sha256', Buffer.from(vrfProof.publicKey, 'hex'));
      hmac.update(vrfProof.seed);
      const expectedOutput = hmac.digest('hex');
      
      if (expectedOutput !== vrfProof.output) {
        return false;
      }
      
      // 验证证明
      const proofHmac = crypto.createHmac('sha256', Buffer.from(vrfProof.publicKey, 'hex'));
      proofHmac.update(vrfProof.seed + vrfProof.output);
      const expectedProof = proofHmac.digest('hex');
      
      return expectedProof === vrfProof.proof;
    } catch (error) {
      console.error('VRF proof verification failed:', error);
      return false;
    }
  }
  
  /**
   * 执行选择算法
   */
  private performSelection(
    candidates: ValidatorCandidate[],
    count: number,
    vrfOutput: string
  ): ValidatorCandidate[] {
    // 为每个候选节点计算权重分数
    const weightedCandidates = candidates.map((candidate, index) => {
      const weight = this.calculateCandidateWeight(candidate, vrfOutput, index);
      return { candidate, weight, index };
    });
    
    // 按权重排序（降序）
    weightedCandidates.sort((a, b) => b.weight - a.weight);
    
    // 选择前N个
    return weightedCandidates.slice(0, count).map(item => item.candidate);
  }
  
  /**
   * 计算候选节点权重
   */
  private calculateCandidateWeight(
    candidate: ValidatorCandidate,
    vrfOutput: string,
    index: number
  ): number {
    // 基础随机权重（基于VRF输出和候选节点索引）
    const randomSeed = vrfOutput + index.toString() + candidate.address;
    const hash = crypto.createHash('sha256').update(randomSeed).digest();
    const baseRandomWeight = hash.readUInt32BE(0) / 0xFFFFFFFF; // 0-1之间的随机数
    
    // 质押权重（质押越多，权重稍微增加，但不是决定性因素）
    const stakeWeight = Math.log(Number(candidate.stakeAmount) / 1e18 + 1) / 10; // 对数缩放
    
    // 性能权重
    const performanceWeight = this.calculatePerformanceWeight(candidate);
    
    // 地理分布权重（鼓励地理分散）
    const geoWeight = this.calculateGeographicWeight(candidate);
    
    // 组合权重（随机性占主导地位）
    const totalWeight = 
      baseRandomWeight * 0.7 +        // 70%随机性
      stakeWeight * 0.1 +             // 10%质押权重
      performanceWeight * 0.15 +      // 15%性能权重
      geoWeight * 0.05;               // 5%地理权重
    
    return totalWeight;
  }
  
  /**
   * 计算性能权重
   */
  private calculatePerformanceWeight(candidate: ValidatorCandidate): number {
    const performance = candidate.performance;
    if (!performance) return 0.5; // 默认中等权重
    
    // 综合性能指标
    const uptimeScore = performance.uptime / 100;
    const blockScore = performance.blocksProduced / (performance.blocksProduced + performance.blocksMissed + 1);
    const responseScore = Math.max(0, 1 - performance.averageResponseTime / 1000); // 1秒为基准
    
    return (uptimeScore + blockScore + responseScore) / 3;
  }
  
  /**
   * 计算地理权重
   */
  private calculateGeographicWeight(candidate: ValidatorCandidate): number {
    // 简化的地理权重计算
    // 实际实现中应该考虑现有验证节点的地理分布
    const metadata = candidate.metadata;
    if (!metadata?.location) return 0.5;
    
    // 根据地理位置给予不同权重
    // 这里简化为基于国家代码的权重
    const locationWeights: { [key: string]: number } = {
      'US': 0.8,
      'CN': 0.7,
      'EU': 0.9,
      'JP': 0.8,
      'KR': 0.8,
      'SG': 0.9,
      'OTHER': 1.0 // 其他地区给予更高权重以促进分散
    };
    
    return locationWeights[metadata.location] || locationWeights['OTHER'];
  }
  
  /**
   * 选择单个候选节点（用于替换被踢出的节点）
   */
  async selectSingleCandidate(
    candidates: ValidatorCandidate[],
    blockHash: string,
    timestamp: number,
    excludeAddresses: string[] = [],
    additionalEntropy?: string
  ): Promise<ValidatorCandidate | null> {
    // 过滤掉排除的地址
    const filteredCandidates = candidates.filter(
      candidate => !excludeAddresses.includes(candidate.address)
    );
    
    if (filteredCandidates.length === 0) {
      console.warn('No eligible candidates available after filtering');
      return null;
    }
    
    const result = await this.selectRandomCandidates(
      filteredCandidates,
      1,
      blockHash,
      timestamp,
      additionalEntropy
    );
    
    return result.selectedCandidates[0] || null;
  }
  
  /**
   * 批量选择候选节点（用于初始化或大规模替换）
   */
  async selectMultipleCandidates(
    candidates: ValidatorCandidate[],
    count: number,
    blockHash: string,
    timestamp: number,
    requirements?: {
      minStake?: bigint;
      maxSameLocation?: number;
      excludeAddresses?: string[];
    }
  ): Promise<RandomSelectionResult> {
    let filteredCandidates = [...candidates];
    
    // 应用过滤条件
    if (requirements) {
      if (requirements.minStake) {
        filteredCandidates = filteredCandidates.filter(
          candidate => candidate.stakeAmount >= requirements.minStake!
        );
      }
      
      if (requirements.excludeAddresses) {
        filteredCandidates = filteredCandidates.filter(
          candidate => !requirements.excludeAddresses!.includes(candidate.address)
        );
      }
    }
    
    const result = await this.selectRandomCandidates(
      filteredCandidates,
      count,
      blockHash,
      timestamp
    );
    
    // 应用地理分布限制
    if (requirements?.maxSameLocation) {
      result.selectedCandidates = this.enforceGeographicDistribution(
        result.selectedCandidates,
        requirements.maxSameLocation
      );
    }
    
    return result;
  }
  
  /**
   * 强制地理分布
   */
  private enforceGeographicDistribution(
    candidates: ValidatorCandidate[],
    maxSameLocation: number
  ): ValidatorCandidate[] {
    const locationCounts = new Map<string, number>();
    const result: ValidatorCandidate[] = [];
    
    for (const candidate of candidates) {
      const location = candidate.metadata?.location || 'UNKNOWN';
      const currentCount = locationCounts.get(location) || 0;
      
      if (currentCount < maxSameLocation) {
        result.push(candidate);
        locationCounts.set(location, currentCount + 1);
      }
    }
    
    return result;
  }
  
  /**
   * 获取公钥
   */
  getPublicKey(): string {
    return this.publicKey.toString('hex');
  }
  
  /**
   * 生成选择报告
   */
  generateSelectionReport(result: RandomSelectionResult): string {
    const report = [
      '=== VRF Random Selection Report ===',
      `Timestamp: ${new Date(result.timestamp).toISOString()}`,
      `Total Candidates: ${result.totalCandidates}`,
      `Requested Count: ${result.requestedCount}`,
      `Actually Selected: ${result.actualCount}`,
      `Selection Method: ${result.selectionMethod}`,
      `VRF Seed: ${result.seed}`,
      `VRF Output: ${result.vrfProof.output}`,
      '',
      'Selected Candidates:',
      ...result.selectedCandidates.map((candidate, index) => 
        `${index + 1}. ${candidate.address} (Stake: ${candidate.stakeAmount} TTN)`
      ),
      '',
      '=== End Report ==='
    ];
    
    return report.join('\n');
  }
}