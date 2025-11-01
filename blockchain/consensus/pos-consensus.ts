import { Block, Transaction, Validator, ValidatorCandidate, ConsensusState } from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG, VALIDATOR_STATUS } from '../../shared/constants/blockchain.js';
import { BlockValidator } from '../core/block-validator.js';
import { CompetitiveBlockProduction } from './competitive-block-production.js';
import { ValidationWorkloadSystem } from './validation-workload-system.js';
import { CompetitiveRewardSystem } from './competitive-reward-system.js';

/**
 * PoS共识机制
 * 实现TitanChain的权益证明共识算法
 */
export class PoSConsensus {
  private validators: Map<string, Validator> = new Map();
  private consensusState: ConsensusState;
  private blockValidator: BlockValidator;
  private currentEpoch: number = 0;
  private epochStartTime: number = Date.now();

  // 竞争出块和奖励系统
  private competitiveBlockProduction: CompetitiveBlockProduction;
  private validationWorkloadSystem: ValidationWorkloadSystem;
  private competitiveRewardSystem: CompetitiveRewardSystem;
  
  // 出块者选择缓存，避免重复选择导致不一致
  private blockProducerCache: Map<number, string> = new Map();
  
  constructor() {
    this.consensusState = {
      currentEpoch: 0,
      epochStartBlock: 0,
      epochEndBlock: 0,
      activeValidators: [],
      nextValidators: [],
      proposer: '',
      round: 0,
      step: 'propose',
      totalStaked: BigInt(0),
      lastBlockTime: Date.now(),
      networkHashRate: BigInt(0)
    };
    
    this.blockValidator = new BlockValidator();
    
    // 初始化新的竞争系统
    this.competitiveBlockProduction = new CompetitiveBlockProduction();
    this.validationWorkloadSystem = new ValidationWorkloadSystem();
    this.competitiveRewardSystem = new CompetitiveRewardSystem(
      this.competitiveBlockProduction,
      this.validationWorkloadSystem
    );
  }
  
  /**
   * 初始化共识机制
   */
  async initialize(genesisValidators: Validator[]): Promise<void> {
    console.log('Initializing PoS consensus with', genesisValidators.length, 'validators');
    
    // 添加创世验证节点
    for (const validator of genesisValidators) {
      this.validators.set(validator.address, validator);
      
      // 将活跃验证节点添加到竞争出块系统
      if (validator.status === VALIDATOR_STATUS.ACTIVE) {
        this.competitiveBlockProduction.addBlockProducer(validator);
        console.log(`✅ 添加出块节点到竞争系统: ${validator.address}`);
      }
      
      // 将验证节点添加到验证工作量系统（作为候补节点）
      const candidateValidator: ValidatorCandidate = {
        address: validator.address,
        stake: validator.stake,
        publicKey: validator.publicKey,
        delegatedStake: validator.delegatedStake || BigInt(0),
        totalStake: validator.totalStake || validator.stake,
        commission: validator.commission || 0,
        registeredAt: Date.now(),
        lastElectionAttempt: 0,
        electionAttempts: 0,
        isEligible: true,
        status: 'active',
        metadata: validator.metadata,
        readinessScore: 100,
        violationHistory: []
      };
      this.validationWorkloadSystem.addCandidateValidator(candidateValidator);
      console.log(`✅ 添加验证节点到工作量系统: ${validator.address}`);
    }
    
    // 更新共识状态
    this.updateConsensusState();
    
    console.log(`🎉 PoS共识初始化完成 - 出块节点: ${this.competitiveBlockProduction.getValidatorWeights().size}, 验证节点: ${genesisValidators.length}`);
  }
  
  /**
   * 选择下一个区块生产者 - 使用竞争出块系统
   */
  async selectBlockProducer(blockNumber: number): Promise<string | null> {
    // 检查缓存，避免重复选择
    if (this.blockProducerCache.has(blockNumber)) {
      const cachedProducer = this.blockProducerCache.get(blockNumber)!;
      console.log(`📋 使用缓存的出块者 - 区块 #${blockNumber}: ${cachedProducer}`);
      return cachedProducer;
    }

    try {
      // 获取前一个区块的哈希（简化实现）
      const previousBlockHash = `block-${blockNumber - 1}`;
      
      // 使用竞争出块系统选择生产者
      const result = await this.competitiveBlockProduction.selectBlockProducer(
        blockNumber,
        previousBlockHash
      );
      
      if (result) {
        console.log(`🎯 竞争出块选择结果 - 区块 #${blockNumber}: ${result.selectedProducer} (竞争者: ${result.competitorCount})`);
        // 缓存选择结果
        this.blockProducerCache.set(blockNumber, result.selectedProducer);
        return result.selectedProducer;
      } else {
        console.warn(`⚠️ 竞争出块选择失败，回退到传统方式`);
        const fallbackProducer = this.fallbackBlockProducerSelection(blockNumber);
        if (fallbackProducer) {
          this.blockProducerCache.set(blockNumber, fallbackProducer);
        }
        return fallbackProducer;
      }
      
    } catch (error) {
      console.error(`❌ 竞争出块选择错误，回退到传统方式:`, error);
      const fallbackProducer = this.fallbackBlockProducerSelection(blockNumber);
      if (fallbackProducer) {
        this.blockProducerCache.set(blockNumber, fallbackProducer);
      }
      return fallbackProducer;
    }
  }
  
  /**
   * 回退的区块生产者选择方式（保持兼容性）
   */
  private fallbackBlockProducerSelection(blockNumber: number): string | null {
    const activeValidators = this.getActiveValidators();
    
    if (activeValidators.length === 0) {
      console.error('No active validators available');
      return null;
    }
    
    // 基于权重的随机选择算法
    const totalWeight = activeValidators.reduce((sum, v) => sum + this.calculateValidatorWeight(v), BigInt(0));
    
    if (totalWeight === BigInt(0)) {
      console.error('Total validator weight is zero');
      return null;
    }
    
    // 使用区块号作为随机种子
    const seed = this.generateSeed(blockNumber);
    const randomValue = seed % totalWeight;
    
    let currentWeight = BigInt(0);
    for (const validator of activeValidators) {
      currentWeight += this.calculateValidatorWeight(validator);
      if (randomValue < currentWeight) {
        return validator.address;
      }
    }
    
    // 备选方案：返回第一个验证节点
    return activeValidators[0].address;
  }
  
  /**
   * 验证区块生产者权限
   */
  async validateBlockProducer(block: Block): Promise<boolean> {
    const expectedProducer = await this.selectBlockProducer(block.number);
    
    if (!expectedProducer) {
      console.error('No expected block producer found');
      return false;
    }
    
    if (block.validator !== expectedProducer) {
      console.error(`Invalid block producer. Expected: ${expectedProducer}, Got: ${block.validator}`);
      return false;
    }
    
    // 验证生产者是否为活跃验证节点
    const validator = this.validators.get(block.validator);
    if (!validator || validator.status !== VALIDATOR_STATUS.ACTIVE) {
      console.error('Block producer is not an active validator');
      return false;
    }
    
    return true;
  }
  
  /**
   * 处理新区块
   */
  async processNewBlock(block: Block): Promise<boolean> {
    try {
      console.log(`Processing new block #${block.number} from validator ${block.validator}`);
      
      // 1. 验证区块生产者权限
      if (!await this.validateBlockProducer(block)) {
        return false;
      }
      
      // 2. 验证区块内容
      if (!await this.blockValidator.validateBlock(block)) {
        return false;
      }
      
      // 3. 记录验证工作量（模拟其他验证节点的验证工作）
      this.recordValidationWork(block);
      
      // 4. 更新验证节点统计
      this.updateValidatorStats(block.validator, block);
      
      // 5. 更新共识状态
      this.updateConsensusState();
      
      // 6. 检查是否需要切换epoch
      await this.checkEpochTransition(block);
      
      // 7. 清理旧的缓存（保留最近10个区块的缓存）
      this.cleanupBlockProducerCache(block.number);
      
      console.log(`Block #${block.number} processed successfully`);
      return true;
      
    } catch (error) {
      console.error('Error processing new block:', error);
      return false;
    }
  }
  
  /**
   * 清理区块生产者缓存
   */
  private cleanupBlockProducerCache(currentBlockNumber: number): void {
    const cacheLimit = 10;
    const minBlockToKeep = currentBlockNumber - cacheLimit;
    
    for (const [blockNumber] of this.blockProducerCache) {
      if (blockNumber < minBlockToKeep) {
        this.blockProducerCache.delete(blockNumber);
      }
    }
  }
  
  /**
   * 添加验证节点
   */
  async addValidator(validator: Validator): Promise<boolean> {
    try {
      // 验证最小质押量
      if (validator.stake < CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE) {
        console.error('Validator stake below minimum requirement');
        return false;
      }
      
      // 检查验证节点数量限制
      const activeCount = this.getActiveValidators().length;
      if (activeCount >= CONSENSUS_CONFIG.MAX_VALIDATORS) {
        console.error('Maximum validator count reached');
        return false;
      }
      
      // 添加验证节点
      this.validators.set(validator.address, validator);
      
      // 添加到竞争出块系统（活跃验证节点）
      if (validator.status === VALIDATOR_STATUS.ACTIVE) {
        this.competitiveBlockProduction.addBlockProducer(validator);
      }
      
      // 更新共识状态
      this.updateConsensusState();
      
      console.log(`Validator ${validator.address} added successfully`);
      return true;
      
    } catch (error) {
      console.error('Error adding validator:', error);
      return false;
    }
  }
  
  /**
   * 移除验证节点
   */
  async removeValidator(address: string): Promise<boolean> {
    try {
      const validator = this.validators.get(address);
      if (!validator) {
        console.error('Validator not found');
        return false;
      }
      
      // 更新状态为非活跃
      validator.status = VALIDATOR_STATUS.INACTIVE;
      
      // 从竞争出块系统中移除
      this.competitiveBlockProduction.removeBlockProducer(address);
      
      // 从验证工作量系统中移除
      this.validationWorkloadSystem.removeCandidateValidator(address);
      
      // 更新共识状态
      this.updateConsensusState();
      
      console.log(`Validator ${address} removed successfully`);
      return true;
      
    } catch (error) {
      console.error('Error removing validator:', error);
      return false;
    }
  }
  
  /**
   * 更新验证节点质押
   */
  async updateValidatorStake(address: string, newStake: bigint): Promise<boolean> {
    try {
      const validator = this.validators.get(address);
      if (!validator) {
        console.error('Validator not found');
        return false;
      }
      
      // 检查最小质押量
      if (newStake < CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE) {
        // 质押量不足，设为非活跃
        validator.status = VALIDATOR_STATUS.INACTIVE;
      } else {
        // 质押量充足，设为活跃
        validator.status = VALIDATOR_STATUS.ACTIVE;
      }
      
      validator.stake = newStake;
      
      // 更新共识状态
      this.updateConsensusState();
      
      console.log(`Validator ${address} stake updated to ${newStake}`);
      return true;
      
    } catch (error) {
      console.error('Error updating validator stake:', error);
      return false;
    }
  }
  
  /**
   * 获取活跃验证节点
   */
  getActiveValidators(): Validator[] {
    return Array.from(this.validators.values())
      .filter(v => v.status === VALIDATOR_STATUS.ACTIVE)
      .sort((a, b) => Number(b.stake - a.stake)); // 按质押量排序
  }
  
  /**
   * 获取共识状态
   */
  getConsensusState(): ConsensusState {
    return { ...this.consensusState };
  }
  
  /**
   * 计算验证节点权重
   */
  private calculateValidatorWeight(validator: Validator): bigint {
    // 基础权重 = 质押量
    let weight = validator.stake;
    
    // 性能加成
    if (validator.performance) {
      const performanceMultiplier = Math.max(0.5, Math.min(1.5, validator.performance.uptime / 100));
      weight = BigInt(Math.floor(Number(weight) * performanceMultiplier));
    }
    
    // 最小权重保证
    return weight > BigInt(0) ? weight : BigInt(1);
  }
  
  /**
   * 生成随机种子
   */
  private generateSeed(blockNumber: number): bigint {
    // 使用区块号和当前epoch生成伪随机数
    const seed = blockNumber * 1000 + this.currentEpoch;
    return BigInt(seed) % BigInt(Number.MAX_SAFE_INTEGER);
  }
  
  /**
   * 记录验证工作量（模拟其他验证节点的验证工作）
   */
  private recordValidationWork(block: Block): void {
    const activeValidators = this.getActiveValidators();
    const blockProducer = block.validator;
    
    // 为除了出块者之外的其他验证节点记录验证工作
    for (const validator of activeValidators) {
      if (validator.address !== blockProducer) {
        // 模拟验证工作：区块验证
        this.validationWorkloadSystem.recordValidationWork(
          validator.address,
          'block_verification' as any, // 使用字符串避免导入枚举
          block.number,
          {
            blockHash: block.hash,
            transactionCount: block.transactions.length,
            gasUsed: block.gasUsed
          },
          Math.floor(Math.random() * 20) + 80 // 80-100的质量分数
        );
        
        // 随机模拟一些交易验证工作
        if (block.transactions.length > 0 && Math.random() > 0.5) {
          this.validationWorkloadSystem.recordValidationWork(
            validator.address,
            'transaction_validation' as any,
            block.number,
            {
              transactionHashes: block.transactions.map(tx => tx.hash),
              validatedCount: block.transactions.length
            },
            Math.floor(Math.random() * 15) + 85 // 85-100的质量分数
          );
        }
      }
    }
  }

  /**
   * 更新验证节点统计
   */
  private updateValidatorStats(validatorAddress: string, block: Block): void {
    const validator = this.validators.get(validatorAddress);
    if (!validator) return;
    
    // 更新区块生产统计
    validator.lastActiveBlock = block.number;
    
    // 更新性能统计
    if (!validator.performance) {
      validator.performance = {
        blocksProduced: 0,
        blocksExpected: 0,
        uptime: 100,
        missedBlocks: 0,
        slashingEvents: 0,
        averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
        score: 100
      };
    }
    
    validator.performance.blocksProduced++;
    validator.lastActiveBlock = block.number;
    
    // 计算平均出块时间
    if (validator.performance.blocksProduced > 1) {
      const expectedTime = validator.performance.blocksProduced * CONSENSUS_CONFIG.BLOCK_TIME * 1000;
      const actualTime = Date.now() - (validator.joinedAt || Date.now());
      validator.performance.averageBlockTime = actualTime / validator.performance.blocksProduced;
    }
  }
  
  /**
   * 更新共识状态
   */
  private updateConsensusState(): void {
    const activeValidators = this.getActiveValidators();
    
    this.consensusState.activeValidators = activeValidators;
    this.consensusState.totalStaked = activeValidators.reduce((sum, v) => sum + v.stake, BigInt(0));
    this.consensusState.lastBlockTime = Date.now();
    
    // 计算网络哈希率（简化）
    this.consensusState.networkHashRate = BigInt(activeValidators.length * 1000000);
  }
  
  /**
   * 检查epoch转换
   */
  private async checkEpochTransition(block: Block): Promise<void> {
    const epochDuration = CONSENSUS_CONFIG.EPOCH_LENGTH * CONSENSUS_CONFIG.BLOCK_TIME * 1000;
    const currentTime = Date.now();
    
    if (currentTime - this.epochStartTime >= epochDuration) {
      await this.transitionToNextEpoch(block);
    }
  }
  
  /**
   * 转换到下一个epoch
   */
  private async transitionToNextEpoch(block: Block): Promise<void> {
    this.currentEpoch++;
    this.epochStartTime = Date.now();
    this.consensusState.currentEpoch = this.currentEpoch;
    
    console.log(`Transitioned to epoch ${this.currentEpoch} at block #${block.number}`);
    
    // 重新评估验证节点性能
    await this.evaluateValidatorPerformance();
    
    // 分发奖励
    await this.distributeRewards();
  }
  
  /**
   * 评估验证节点性能
   */
  private async evaluateValidatorPerformance(): Promise<void> {
    const activeValidators = this.getActiveValidators();
    
    for (const validator of activeValidators) {
      if (!validator.performance) continue;
      
      // 计算在线时间
      const expectedBlocks = Math.floor((Date.now() - (validator.joinedAt || Date.now())) / (CONSENSUS_CONFIG.BLOCK_TIME * 1000));
      const actualBlocks = validator.performance.blocksProduced;
      
      if (expectedBlocks > 0) {
        validator.performance.uptime = Math.min(100, (actualBlocks / expectedBlocks) * 100);
      }
      
      // 惩罚表现不佳的验证节点
      if (validator.performance.uptime < 50) {
        console.warn(`Validator ${validator.address} has low uptime: ${validator.performance.uptime}%`);
        // 可以实施惩罚机制
      }
    }
  }
  
  /**
   * 分发奖励
   */
  private async distributeRewards(): Promise<void> {
    const activeValidators = this.getActiveValidators();
    const totalStaked = this.consensusState.totalStaked;
    
    if (totalStaked === BigInt(0)) return;
    
    // 计算总奖励池
    const totalRewards = BigInt(Math.floor(Number(totalStaked) * CONSENSUS_CONFIG.REWARD_RATE));
    
    for (const validator of activeValidators) {
      // 按质押比例分配奖励
      const validatorReward = (totalRewards * validator.stake) / totalStaked;
      
      // 性能加成
      let finalReward = validatorReward;
      if (validator.performance && validator.performance.uptime > 90) {
        finalReward = (finalReward * BigInt(110)) / BigInt(100); // 10%加成
      }
      
      console.log(`Distributed ${finalReward} TTN to validator ${validator.address}`);
    }
  }
  
  /**
   * 获取验证节点信息
   */
  getValidator(address: string): Validator | undefined {
    return this.validators.get(address);
  }
  
  /**
   * 获取所有验证节点
   */
  getAllValidators(): Validator[] {
    return Array.from(this.validators.values());
  }
  
  /**
   * 选择提议者（区块生产者）
   */
  selectProposer(blockNumber: number): string | null {
    const activeValidators = this.getActiveValidators();
    
    if (activeValidators.length === 0) {
      console.error('No active validators available for proposer selection');
      return null;
    }
    
    // 使用加权随机选择算法
    const totalWeight = activeValidators.reduce((sum, v) => sum + this.calculateValidatorWeight(v), BigInt(0));
    
    if (totalWeight === BigInt(0)) {
      console.error('Total validator weight is zero');
      return null;
    }
    
    // 使用区块号和时间戳作为随机种子
    const seed = this.generateSeed(blockNumber);
    const randomValue = seed % totalWeight;
    
    let currentWeight = BigInt(0);
    for (const validator of activeValidators) {
      currentWeight += this.calculateValidatorWeight(validator);
      if (randomValue < currentWeight) {
        this.consensusState.proposer = validator.address;
        return validator.address;
      }
    }
    
    // 备选方案：返回第一个验证节点
    const selectedProposer = activeValidators[0].address;
    this.consensusState.proposer = selectedProposer;
    return selectedProposer;
  }

  /**
   * 惩罚验证节点
   */
  async slashValidator(
    validatorAddress: string, 
    violationType: 'double_sign' | 'downtime' | 'malicious_behavior',
    evidence?: any
  ): Promise<boolean> {
    try {
      const validator = this.validators.get(validatorAddress);
      if (!validator) {
        console.error(`Validator ${validatorAddress} not found for slashing`);
        return false;
      }

      // 计算惩罚比例
      let slashFraction = 0;
      switch (violationType) {
        case 'double_sign':
          slashFraction = 0.05; // 5% 惩罚
          break;
        case 'downtime':
          slashFraction = 0.01; // 1% 惩罚
          break;
        case 'malicious_behavior':
          slashFraction = 0.1; // 10% 惩罚
          break;
      }

      // 计算惩罚金额
      const slashAmount = BigInt(Math.floor(Number(validator.stake) * slashFraction));
      
      // 执行惩罚
      validator.stake = validator.stake - slashAmount;
      
      // 更新验证节点状态
      if (violationType === 'double_sign' || violationType === 'malicious_behavior') {
        validator.status = 'jailed';
      }
      
      // 记录惩罚事件
      if (validator.performance) {
        validator.performance.slashingEvents = (validator.performance.slashingEvents || 0) + 1;
      }

      console.log(`Slashed validator ${validatorAddress}: ${slashAmount} TTN for ${violationType}`);
      
      // 更新共识状态
      this.updateConsensusState();
      
      return true;
      
    } catch (error) {
      console.error('Error slashing validator:', error);
      return false;
    }
  }

  /**
   * 计算奖励
   */
  calculateRewards(blockNumber: number, blockReward: bigint): Map<string, bigint> {
    const rewards = new Map<string, bigint>();
    const activeValidators = this.getActiveValidators();
    
    if (activeValidators.length === 0) {
      return rewards;
    }

    // 计算总质押量
    const totalStaked = activeValidators.reduce((sum, v) => sum + v.stake, BigInt(0));
    
    if (totalStaked === BigInt(0)) {
      return rewards;
    }

    // 基础奖励分配
    const baseRewardPerValidator = blockReward / BigInt(activeValidators.length);
    
    for (const validator of activeValidators) {
      let validatorReward = baseRewardPerValidator;
      
      // 按质押比例调整奖励
      const stakeRatio = validator.stake * BigInt(100) / totalStaked;
      validatorReward = (validatorReward * stakeRatio) / BigInt(100);
      
      // 性能加成
      if (validator.performance && validator.performance.uptime > 95) {
        validatorReward = (validatorReward * BigInt(110)) / BigInt(100); // 10% 加成
      } else if (validator.performance && validator.performance.uptime < 80) {
        validatorReward = (validatorReward * BigInt(90)) / BigInt(100); // 10% 减少
      }
      
      rewards.set(validator.address, validatorReward);
    }
    
    return rewards;
  }

  /**
   * 分发奖励给验证节点 - 使用新的竞争奖励系统
   */
  async distributeBlockRewards(blockNumber: number, blockReward: bigint, evmEngine?: any): Promise<void> {
    try {
      // 设置奖励转账回调
      this.competitiveRewardSystem.setRewardTransferCallback(async (transfer) => {
        const validator = this.validators.get(transfer.toValidator);
        if (validator) {
          // 更新验证节点总奖励
          (validator as any).totalRewards = ((validator as any).totalRewards || BigInt(0)) + transfer.amount;
          
          // 如果有EVM引擎，实际更新账户余额
          if (evmEngine && transfer.amount > BigInt(0)) {
            try {
              const currentBalance = await evmEngine.getBalance(transfer.toValidator);
              const newBalance = currentBalance + transfer.amount;
              await evmEngine.updateBalance(transfer.toValidator, newBalance);
              
              console.log(`✅ ${transfer.type}: ${transfer.amount} TTN -> ${transfer.toValidator} (余额: ${newBalance})`);
            } catch (error) {
              console.error(`❌ 奖励转账失败 ${transfer.toValidator}:`, error);
            }
          } else {
            console.log(`📝 ${transfer.type}: ${transfer.amount} TTN -> ${transfer.toValidator} (内部记录)`);
          }
        }
      });

      // 获取前一个区块的哈希（简化实现）
      const previousBlockHash = `block-${blockNumber - 1}`;
      
      // 使用竞争奖励系统处理完整的奖励流程
      const result = await this.competitiveRewardSystem.processBlockRewards(
        blockNumber,
        previousBlockHash,
        blockReward
      );

      if (result) {
        console.log(`🎉 区块 #${blockNumber} 竞争奖励分配完成:`);
        console.log(`   出块者: ${result.blockProducer} (奖励: ${result.blockProducerReward})`);
        console.log(`   验证节点: ${result.validationRewards.size} 个 (总奖励: ${result.totalReward - result.blockProducerReward})`);
      } else {
        console.warn(`⚠️ 区块 #${blockNumber} 奖励分配失败，回退到传统方式`);
        await this.fallbackRewardDistribution(blockNumber, blockReward, evmEngine);
      }

    } catch (error) {
      console.error(`❌ 竞争奖励系统失败，回退到传统方式:`, error);
      await this.fallbackRewardDistribution(blockNumber, blockReward, evmEngine);
    }
  }

  /**
   * 回退奖励分配方式（保持兼容性）
   */
  private async fallbackRewardDistribution(blockNumber: number, blockReward: bigint, evmEngine?: any): Promise<void> {
    console.log(`🔄 使用传统奖励分配方式处理区块 #${blockNumber}`);
    
    const rewards = this.calculateRewards(blockNumber, blockReward);
    
    for (const [validatorAddress, reward] of rewards) {
      const validator = this.validators.get(validatorAddress);
      if (validator) {
        (validator as any).totalRewards = ((validator as any).totalRewards || BigInt(0)) + reward;
        
        if (evmEngine && reward > BigInt(0)) {
          try {
            const currentBalance = await evmEngine.getBalance(validatorAddress);
            const newBalance = currentBalance + reward;
            await evmEngine.updateBalance(validatorAddress, newBalance);
            
            console.log(`📊 传统奖励: ${reward} TTN -> ${validatorAddress} (余额: ${newBalance})`);
          } catch (error) {
            console.error(`❌ 传统奖励转账失败 ${validatorAddress}:`, error);
          }
        }
      }
    }
  }
  
  /**
   * 检查是否可以生产区块
   */
  canProduceBlock(validatorAddress: string, blockNumber: number): boolean {
    const validator = this.validators.get(validatorAddress);
    if (!validator || validator.status !== 'active') {
      return false;
    }
    
    // 简化检查：如果验证节点是活跃的，就可以参与竞争出块
    // 具体的选择逻辑由竞争出块系统处理
    return true;
  }

  /**
   * 添加候补验证节点到验证工作量系统
   */
  addCandidateValidator(candidate: any): void {
    this.validationWorkloadSystem.addCandidateValidator(candidate);
    console.log(`候补验证节点 ${candidate.address} 已添加到验证工作量系统`);
  }

  /**
   * 获取竞争奖励系统状态
   */
  getCompetitiveRewardSystemStatus() {
    return this.competitiveRewardSystem.getSystemStatus();
  }

  /**
   * 获取出块竞争统计
   */
  getBlockProductionStats() {
    return this.competitiveBlockProduction.getSystemStatus();
  }

  /**
   * 获取验证工作量统计
   */
  getValidationWorkloadStats() {
    return this.validationWorkloadSystem.getSystemStatus();
  }
}