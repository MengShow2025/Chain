import { Request, Response } from 'express';
import { Validator, CandidateNode, StakingInfo, ValidatorPerformance } from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG, VALIDATOR_STATUS, API_ENDPOINTS } from '../../shared/constants/blockchain.js';

/**
 * 验证节点管理器
 * 负责验证节点的注册、监控、质押和奖励分配
 */
export class ValidatorManager {
  private validators: Map<string, Validator> = new Map();
  private candidateNodes: Map<string, CandidateNode> = new Map();
  private stakingInfo: Map<string, StakingInfo> = new Map();
  private performanceHistory: Map<string, ValidatorPerformance[]> = new Map();
  
  constructor() {
    // 初始化创世验证节点
    this.initializeGenesisValidators();
    
    // 定期更新性能统计
    setInterval(() => this.updatePerformanceMetrics(), 60 * 1000); // 每分钟更新
    
    // 定期分发奖励
    setInterval(() => this.distributeRewards(), 24 * 60 * 60 * 1000); // 每天分发
  }
  
  /**
   * 注册验证节点
   */
  async registerValidator(req: Request, res: Response): Promise<void> {
    try {
      const { address, publicKey, stake, metadata } = req.body;
      
      // 验证输入参数
      if (!address || !publicKey || !stake) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
        return;
      }
      
      // 检查最小质押量
      const stakeAmount = BigInt(stake);
      if (stakeAmount < CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE) {
        res.status(400).json({
          success: false,
          error: `Minimum stake required: ${CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE}`
        });
        return;
      }
      
      // 检查验证节点是否已存在
      if (this.validators.has(address)) {
        res.status(409).json({
          success: false,
          error: 'Validator already registered'
        });
        return;
      }
      
      // 检查验证节点数量限制
      const activeValidators = this.getActiveValidators();
      if (activeValidators.length >= CONSENSUS_CONFIG.MAX_VALIDATORS) {
        // 添加到候补节点列表
        await this.addCandidateNode(address, publicKey, stakeAmount, metadata);
        
        res.json({
          success: true,
          message: 'Added to candidate node list',
          candidateRank: this.getCandidateRank(address)
        });
        return;
      }
      
      // 创建验证节点
      const validator: Validator = {
        address,
        publicKey,
        stake: stakeAmount,
        delegatedStake: BigInt(0),
        totalStake: stakeAmount,
        commission: 5, // 默认5%佣金
        status: VALIDATOR_STATUS.ACTIVE,
        performance: {
          blocksProduced: 0,
          blocksExpected: 0,
          uptime: 100,
          missedBlocks: 0,
          slashingEvents: 0,
          averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
          score: 100
        },
        metadata: {
          name: metadata?.name || `Validator ${address.slice(0, 8)}`,
          description: metadata?.description || 'TitanChain Validator',
          website: metadata?.website,
          identity: metadata?.identity,
          details: metadata?.details
        },
        joinedAt: Date.now(),
        lastActiveBlock: 0
      };
      
      // 添加验证节点
      this.validators.set(address, validator);
      
      // 创建质押信息
      const stakingInfo: StakingInfo = {
        validator: address,
        delegator: address, // 自质押
        amount: stakeAmount,
        rewards: BigInt(0),
        lockPeriod: 0, // 验证节点无锁定期
        unlockTime: 0,
        status: 'active'
      };
      
      this.stakingInfo.set(address, stakingInfo);
      
      console.log(`Validator ${address} registered successfully`);
      
      res.json({
        success: true,
        validator,
        message: 'Validator registered successfully'
      });
      
    } catch (error) {
      console.error('Error registering validator:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * 获取验证节点列表
   */
  async getValidators(req: Request, res: Response): Promise<void> {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      
      let validators = Array.from(this.validators.values());
      
      // 按状态过滤
      if (status) {
        validators = validators.filter(v => v.status === status);
      }
      
      // 分页
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedValidators = validators.slice(startIndex, endIndex);
      
      // 转换BigInt为字符串以便JSON序列化
      const serializedValidators = paginatedValidators.map(validator => ({
        ...validator,
        stake: validator.stake.toString(),
        delegatedStake: validator.delegatedStake?.toString() || '0',
        totalStake: validator.totalStake?.toString() || validator.stake.toString()
      }));
      
      res.json({
        success: true,
        data: serializedValidators,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: validators.length,
          totalPages: Math.ceil(validators.length / Number(limit))
        }
      });
      
    } catch (error) {
      console.error('Error getting validators:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * 获取所有验证节点（用于内部调用）
   */
  getAllValidators(): Validator[] {
    return Array.from(this.validators.values());
  }
  
  /**
   * 获取单个验证节点信息
   */
  async getValidator(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      
      const validator = this.validators.get(address);
      if (!validator) {
        res.status(404).json({
          success: false,
          error: 'Validator not found'
        });
        return;
      }
      
      // 获取质押信息
      const stakingInfo = this.stakingInfo.get(address);
      
      // 获取性能历史
      const performanceHistory = this.performanceHistory.get(address) || [];
      
      // 序列化BigInt字段 - 根据正确的类型定义
      const serializedValidator = {
        ...validator,
        stake: validator.stake?.toString() || '0',
        delegatedStake: validator.delegatedStake?.toString() || '0',
        totalStake: validator.totalStake?.toString() || '0'
      };
      
      const serializedStakingInfo = stakingInfo ? {
        ...stakingInfo,
        amount: stakingInfo.amount.toString(),
        rewards: stakingInfo.rewards.toString()
      } : null;
      
      res.json({
        success: true,
        data: {
          validator: serializedValidator,
          stakingInfo: serializedStakingInfo,
          performanceHistory: performanceHistory.slice(-30) // 最近30条记录
        }
      });
      
    } catch (error) {
      console.error('Error getting validator:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * 更新验证节点质押
   */
  async updateStake(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      const { amount, operation } = req.body; // operation: 'increase' | 'decrease'
      
      const validator = this.validators.get(address);
      if (!validator) {
        res.status(404).json({
          success: false,
          error: 'Validator not found'
        });
        return;
      }
      
      const stakeAmount = BigInt(amount);
      let newStake: bigint;
      
      if (operation === 'increase') {
        newStake = validator.stake + stakeAmount;
      } else if (operation === 'decrease') {
        newStake = validator.stake - stakeAmount;
        
        // 检查最小质押量
        if (newStake < CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE) {
          res.status(400).json({
            success: false,
            error: 'Stake would fall below minimum requirement'
          });
          return;
        }
      } else {
        res.status(400).json({
          success: false,
          error: 'Invalid operation. Must be increase or decrease'
        });
        return;
      }
      
      // 更新质押
      validator.stake = newStake;
      
      // 更新质押信息
      const stakingInfo = this.stakingInfo.get(address);
      if (stakingInfo) {
        stakingInfo.amount = newStake;
      }
      
      console.log(`Validator ${address} stake updated to ${newStake}`);
      
      res.json({
        success: true,
        validator,
        message: 'Stake updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating stake:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * 获取候补节点列表
   */
  async getCandidateNodes(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      
      const candidates = Array.from(this.candidateNodes.values())
        .sort((a, b) => Number(b.stake - a.stake)); // 按质押量排序
      
      // 分页
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedCandidates = candidates.slice(startIndex, endIndex);
      
      // 添加排名信息
      const candidatesWithRank = paginatedCandidates.map((candidate, index) => ({
        ...candidate,
        rank: startIndex + index + 1
      }));
      
      res.json({
        success: true,
        data: candidatesWithRank,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: candidates.length,
          totalPages: Math.ceil(candidates.length / Number(limit))
        }
      });
      
    } catch (error) {
      console.error('Error getting candidate nodes:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * 获取网络统计
   */
  async getNetworkStats(req: Request, res: Response): Promise<void> {
    try {
      const activeValidators = this.getActiveValidators();
      const totalStaked = activeValidators.reduce((sum, v) => sum + v.stake, BigInt(0));
      const averageUptime = activeValidators.reduce((sum, v) => sum + (v.performance?.uptime || 0), 0) / activeValidators.length;
      
      const stats = {
        totalValidators: this.validators.size,
        activeValidators: activeValidators.length,
        candidateNodes: this.candidateNodes.size,
        totalStaked: totalStaked.toString(),
        averageUptime: Math.round(averageUptime * 100) / 100,
        networkHealth: this.calculateNetworkHealth(),
        lastUpdated: Date.now()
      };
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('Error getting network stats:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * 添加候补节点
   */
  private async addCandidateNode(
    address: string,
    publicKey: string,
    stake: bigint,
    metadata: any
  ): Promise<void> {
    const candidateNode: CandidateNode = {
      address,
      publicKey,
      stake,
      delegatedStake: BigInt(0),
      totalStake: stake,
      commission: 5,
      ranking: this.candidateNodes.size + 1,
      metadata: {
        name: metadata?.name || `Candidate ${address.slice(0, 8)}`,
        description: metadata?.description || 'TitanChain Validator Candidate',
        website: metadata?.website,
        identity: metadata?.identity,
        details: metadata?.details
      },
      applicationTime: Date.now(),
      readinessScore: 85 // 默认准备度评分
    };
    
    this.candidateNodes.set(address, candidateNode);
    console.log(`Added candidate node: ${address}`);
  }
  
  /**
   * 获取候补节点排名
   */
  private getCandidateRank(address: string): number {
    const candidates = Array.from(this.candidateNodes.values())
      .sort((a, b) => Number(b.stake - a.stake));
    
    return candidates.findIndex(c => c.address === address) + 1;
  }
  
  /**
   * 获取活跃验证节点
   */
  private getActiveValidators(): Validator[] {
    return Array.from(this.validators.values())
      .filter(v => v.status === VALIDATOR_STATUS.ACTIVE);
  }
  
  /**
   * 初始化创世验证节点
   */
  private initializeGenesisValidators(): void {
    // 创建108个创世验证节点
    for (let i = 0; i < CONSENSUS_CONFIG.MAX_VALIDATORS; i++) {
      const address = `0x${i.toString(16).padStart(40, '0')}`;
      const publicKey = `0x${(i + 1000).toString(16).padStart(128, '0')}`;
      
      const stake = CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE * BigInt(2);
      const validator: Validator = {
        address,
        publicKey,
        stake,
        delegatedStake: BigInt(0),
        totalStake: stake,
        commission: 5,
        status: VALIDATOR_STATUS.ACTIVE,
        performance: {
          blocksProduced: 0,
          blocksExpected: 0,
          uptime: 100,
          missedBlocks: 0,
          slashingEvents: 0,
          averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
          score: 100
        },
        metadata: {
          name: `Genesis Validator ${i + 1}`,
          description: 'Genesis validator node',
          website: `https://validator${i + 1}.titanchain.io`
        },
        joinedAt: Date.now(),
        lastActiveBlock: 0
      };
      
      this.validators.set(address, validator);
      
      // 创建质押信息
      const stakingInfo: StakingInfo = {
        validator: address,
        delegator: address,
        amount: validator.stake,
        rewards: BigInt(0),
        lockPeriod: 0,
        unlockTime: 0,
        status: 'active'
      };
      
      this.stakingInfo.set(address, stakingInfo);
    }
    
    console.log(`Initialized ${CONSENSUS_CONFIG.MAX_VALIDATORS} genesis validators`);
  }
  
  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(): void {
    const now = Date.now();
    
    for (const [address, validator] of this.validators.entries()) {
      if (!validator.performance) continue;
      
      // 更新在线时间
      const timeSinceLastActive = now - validator.lastActiveBlock;
      const isOnline = timeSinceLastActive < 5 * 60 * 1000; // 5分钟内活跃认为在线
      
      if (isOnline) {
        validator.performance.uptime = Math.min(100, validator.performance.uptime + 0.1);
      } else {
        validator.performance.uptime = Math.max(0, validator.performance.uptime - 0.5);
      }
      
      // 记录性能历史
      const performanceRecord: ValidatorPerformance = {
        blocksProduced: validator.performance.blocksProduced,
        blocksExpected: validator.performance.blocksExpected,
        uptime: validator.performance.uptime,
        missedBlocks: validator.performance.missedBlocks,
        slashingEvents: validator.performance.slashingEvents,
        averageBlockTime: validator.performance.averageBlockTime,
        score: validator.performance.score
      };
      
      let history = this.performanceHistory.get(address) || [];
      history.push(performanceRecord);
      
      // 只保留最近100条记录
      if (history.length > 100) {
        history = history.slice(-100);
      }
      
      this.performanceHistory.set(address, history);
    }
  }
  
  /**
   * 分发奖励
   */
  private async distributeRewards(): Promise<void> {
    const activeValidators = this.getActiveValidators();
    const totalStaked = activeValidators.reduce((sum, v) => sum + v.stake, BigInt(0));
    
    if (totalStaked === BigInt(0)) return;
    
    // 计算总奖励池（简化实现）
    const dailyRewardRate = 0.0001; // 0.01% 日奖励率
    const totalRewards = BigInt(Math.floor(Number(totalStaked) * dailyRewardRate));
    
    for (const validator of activeValidators) {
      // 基础奖励按质押比例分配
      const baseReward = (totalRewards * validator.stake) / totalStaked;
      
      // 性能加成
      let performanceMultiplier = 1.0;
      if (validator.performance) {
        performanceMultiplier = Math.max(0.5, Math.min(1.5, validator.performance.uptime / 100));
      }
      
      const finalReward = BigInt(Math.floor(Number(baseReward) * performanceMultiplier));
      
      // 更新验证节点奖励 (奖励记录在质押信息中)
      
      // 更新质押信息
      const stakingInfo = this.stakingInfo.get(validator.address);
      if (stakingInfo) {
        stakingInfo.rewards += finalReward;
      }
      
      console.log(`Distributed ${finalReward} TTN to validator ${validator.address}`);
    }
  }
  
  /**
   * 计算网络健康度
   */
  private calculateNetworkHealth(): number {
    const activeValidators = this.getActiveValidators();
    
    if (activeValidators.length === 0) return 0;
    
    // 基于活跃验证节点数量和平均在线时间计算
    const validatorRatio = activeValidators.length / CONSENSUS_CONFIG.MAX_VALIDATORS;
    const averageUptime = activeValidators.reduce((sum, v) => sum + (v.performance?.uptime || 0), 0) / activeValidators.length;
    
    const health = (validatorRatio * 0.6 + averageUptime / 100 * 0.4) * 100;
    
    return Math.round(health * 100) / 100;
  }
  
  /**
   * 处理验证节点离线
   */
  async handleValidatorOffline(address: string): Promise<void> {
    const validator = this.validators.get(address);
    if (!validator) return;
    
    validator.status = VALIDATOR_STATUS.INACTIVE;
    validator.lastActiveBlock = Date.now();
    
    console.log(`Validator ${address} marked as offline`);
    
    // 如果有候补节点，提升排名第一的候补节点
    await this.promoteTopCandidate();
  }
  
  /**
   * 提升顶级候补节点
   */
  private async promoteTopCandidate(): Promise<void> {
    const candidates = Array.from(this.candidateNodes.values())
      .sort((a, b) => Number(b.stake - a.stake));
    
    if (candidates.length === 0) return;
    
    const topCandidate = candidates[0];
    
    // 将候补节点提升为验证节点
    const validator: Validator = {
      address: topCandidate.address,
      publicKey: topCandidate.publicKey,
      stake: topCandidate.stake,
      delegatedStake: topCandidate.delegatedStake,
      totalStake: topCandidate.totalStake,
      commission: topCandidate.commission,
      status: VALIDATOR_STATUS.ACTIVE,
      joinedAt: Date.now(),
      lastActiveBlock: Date.now(),
      metadata: topCandidate.metadata,
      performance: {
        blocksProduced: 0,
        blocksExpected: 0,
        uptime: 100,
        missedBlocks: 0,
        slashingEvents: 0,
        averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
        score: 100
      }
    };
    
    this.validators.set(topCandidate.address, validator);
    this.candidateNodes.delete(topCandidate.address);
    
    console.log(`Promoted candidate ${topCandidate.address} to validator`);
  }
}