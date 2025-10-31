import { Block, Transaction, Validator, ConsensusState } from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG, VALIDATOR_STATUS } from '../../shared/constants/blockchain.js';
import { BlockValidator } from '../core/block-validator.js';

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
  }
  
  /**
   * 初始化共识机制
   */
  async initialize(genesisValidators: Validator[]): Promise<void> {
    console.log('Initializing PoS consensus with', genesisValidators.length, 'validators');
    
    // 添加创世验证节点
    for (const validator of genesisValidators) {
      this.validators.set(validator.address, validator);
    }
    
    // 更新共识状态
    this.updateConsensusState();
    
    console.log('PoS consensus initialized successfully');
  }
  
  /**
   * 选择下一个区块生产者
   */
  selectBlockProducer(blockNumber: number): string | null {
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
    const expectedProducer = this.selectBlockProducer(block.number);
    
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
      
      // 3. 更新验证节点统计
      this.updateValidatorStats(block.validator, block);
      
      // 4. 更新共识状态
      this.updateConsensusState();
      
      // 5. 检查是否需要切换epoch
      await this.checkEpochTransition(block);
      
      console.log(`Block #${block.number} processed successfully`);
      return true;
      
    } catch (error) {
      console.error('Error processing new block:', error);
      return false;
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
   * 分发奖励给验证节点
   */
  async distributeBlockRewards(blockNumber: number, blockReward: bigint): Promise<void> {
    const rewards = this.calculateRewards(blockNumber, blockReward);
    
    for (const [validatorAddress, reward] of rewards) {
      const validator = this.validators.get(validatorAddress);
      if (validator) {
        // 更新验证节点总奖励（需要添加到Validator类型中）
        (validator as any).totalRewards = ((validator as any).totalRewards || BigInt(0)) + reward;
        
        console.log(`Distributed ${reward} TTN to validator ${validatorAddress}`);
      }
    }
  }
  
  /**
   * 检查是否可以生产区块
   */
  canProduceBlock(validatorAddress: string, blockNumber: number): boolean {
    const validator = this.validators.get(validatorAddress);
    if (!validator || validator.status !== VALIDATOR_STATUS.ACTIVE) {
      return false;
    }
    
    const expectedProducer = this.selectBlockProducer(blockNumber);
    return expectedProducer === validatorAddress;
  }
}