import { Request, Response } from 'express';
import { Validator, CandidateNode, StakingInfo, ValidatorPerformance } from '../../shared/types/blockchain';
import { CONSENSUS_CONFIG, VALIDATOR_STATUS, API_ENDPOINTS } from '../../shared/constants/blockchain';
import { blockchainInstance } from '../../shared/blockchain-instance';

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
    console.log('ValidatorManager initialized');
    
    // Initialize genesis validators / 初始化创世验证节点
    this.initializeGenesisValidators();
    
    // Start performance monitoring / 启动性能监控
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 30000); // Update every 30 seconds / 每30秒更新一次
    
    // Start reward distribution / 启动奖励分发
    setInterval(() => {
      this.distributeRewards();
    }, 60000); // Distribute rewards every minute / 每分钟分发一次奖励

    // Start validator synchronization / 启动验证节点同步
    setInterval(() => {
      this.syncValidatorsFromBlockchain();
    }, 10000); // Sync validator data every 10 seconds / 每10秒同步一次验证节点数据
  }
  
  /**
   * 注册验证节点
   */
  async registerValidator(req: Request, res: Response): Promise<void> {
    try {
      const { address, publicKey, stake, metadata } = req.body;
      
      // Validate input parameters / 验证输入参数
      if (!address || !publicKey || !stake) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
        return;
      }
      
      // Check minimum stake amount / 检查最小质押量
      const stakeAmount = BigInt(stake);
      if (stakeAmount < CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE) {
        res.status(400).json({
          success: false,
          error: `Minimum stake required: ${CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE}`
        });
        return;
      }
      
      // Check if validator already exists / 检查验证节点是否已存在
      if (this.validators.has(address)) {
        res.status(409).json({
          success: false,
          error: 'Validator already registered'
        });
        return;
      }
      
      // Check validator count limit / 检查验证节点数量限制
      const activeValidators = this.getActiveValidators();
      if (activeValidators.length >= CONSENSUS_CONFIG.MAX_VALIDATORS) {
        // Add to candidate node list / 添加到候补节点列表
        await this.addCandidateNode(address, publicKey, stakeAmount, metadata);
        
        res.json({
          success: true,
          message: 'Added to candidate node list',
          candidateRank: this.getCandidateRank(address)
        });
        return;
      }
      
      // Create validator / 创建验证节点
      const validator: Validator = {
        address,
        publicKey,
        stake: stakeAmount,
        delegatedStake: BigInt(0),
        totalStake: stakeAmount,
        commission: 5, // Default 5% commission / 默认5%佣金
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
      
      // Add validator / 添加验证节点
      this.validators.set(address, validator);
      
      // Create staking info / 创建质押信息
      const stakingInfo: StakingInfo = {
        validator: address,
        delegator: address, // Self-staking / 自质押
        amount: stakeAmount,
        rewards: BigInt(0),
        lockPeriod: 0, // No lock period for validators / 验证节点无锁定期
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
    // 从区块链核心获取实际的验证节点
    const blockchain = blockchainInstance.getBlockchain();
    if (!blockchain) {
      console.warn('Blockchain instance not available, using fallback validators');
      this.createFallbackValidators();
      return;
    }

    try {
      // 获取区块链核心中的实际验证节点
      const activeValidators = blockchain.getValidatorRankings();
      
      if (activeValidators && activeValidators.length > 0) {
        console.log(`Loading ${activeValidators.length} active validators from blockchain core`);
        
        for (const validatorRanking of activeValidators) {
          // 使用实际的验证节点地址和数据
          const validator: Validator = {
            address: validatorRanking.address,
            publicKey: `0x${validatorRanking.address.slice(2).padStart(128, '0')}`, // 生成公钥
            stake: BigInt(validatorRanking.stake?.toString() || '0'),
            delegatedStake: BigInt(0),
            totalStake: BigInt(validatorRanking.totalStake?.toString() || '0'),
            commission: 5,
            status: VALIDATOR_STATUS.ACTIVE,
            performance: {
              blocksProduced: 0,
              blocksExpected: 0,
              uptime: 100,
              missedBlocks: 0,
              slashingEvents: 0,
              averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
              score: validatorRanking.score || 100
            },
            metadata: {
              name: validatorRanking.address, // 使用实际地址作为名称
              description: `Validator ${validatorRanking.address}`,
              website: `https://validator.titanchain.io/${validatorRanking.address}`
            },
            joinedAt: Date.now(),
            lastActiveBlock: 0
          };
          
          this.validators.set(validatorRanking.address, validator);
          
          // 创建质押信息
          const stakingInfo: StakingInfo = {
            validator: validatorRanking.address,
            delegator: validatorRanking.address,
            amount: validator.stake,
            rewards: BigInt(0),
            lockPeriod: 0,
            unlockTime: 0,
            status: 'active'
          };
          
          this.stakingInfo.set(validatorRanking.address, stakingInfo);
        }
        
        console.log(`Initialized ${this.validators.size} validators from blockchain core`);
      } else {
        console.warn('No active validators found in blockchain core, using fallback');
        this.createFallbackValidators();
      }
    } catch (error) {
      console.error('Error loading validators from blockchain core:', error);
      this.createFallbackValidators();
    }
  }

  /**
   * 创建备用验证节点（当无法从区块链核心获取时使用）
   */
  private createFallbackValidators(): void {
    console.log('Creating fallback validators with actual addresses');
    
    // 创建一些具有实际地址格式的验证节点
    const fallbackAddresses = [
      '0x3c55a7fe31c21c186c6a0c0d7b91c4e7a933a933',
      '0x742d35Cc6634C0532925a3b8D4C2B4e4c7a4B4a4',
      '0x8ba1f109551bD432803012645Hac136c0c0c0c0c',
      '0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e'
    ];
    
    for (let i = 0; i < Math.min(fallbackAddresses.length, 4); i++) {
      const address = fallbackAddresses[i];
      const stake = CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE * BigInt(2);
      
      const validator: Validator = {
        address,
        publicKey: `0x${address.slice(2).padStart(128, '0')}`,
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
          name: address, // 使用实际地址作为名称
          description: `Fallback Validator ${address}`,
          website: `https://validator.titanchain.io/${address}`
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
    
    console.log(`Created ${this.validators.size} fallback validators`);
  }

  /**
   * 从区块链核心同步验证节点数据
   */
  private async syncValidatorsFromBlockchain(): Promise<void> {
    try {
      const blockchain = blockchainInstance.getBlockchain();
      if (!blockchain) {
        return;
      }

      // 获取当前出块节点信息
      const currentProducer = await blockchain.getCurrentBlockProducer();
      const latestProducer = blockchain.getLatestBlockProducer();
      
      // 获取验证节点排名
      const validatorRankings = blockchain.getValidatorRankings();
      
      if (validatorRankings && validatorRankings.length > 0) {
        // 更新现有验证节点的性能数据
        for (const ranking of validatorRankings) {
          const existingValidator = this.validators.get(ranking.address);
          if (existingValidator) {
            // 更新性能评分
            existingValidator.performance.score = ranking.score || 100;
            existingValidator.stake = BigInt(ranking.stake?.toString() || '0');
            existingValidator.totalStake = BigInt(ranking.totalStake?.toString() || '0');
            
            // 更新名称为实际地址
            existingValidator.metadata.name = ranking.address;
            
            this.validators.set(ranking.address, existingValidator);
          } else {
            // 添加新的验证节点
            const newValidator: Validator = {
              address: ranking.address,
              publicKey: `0x${ranking.address.slice(2).padStart(128, '0')}`,
              stake: BigInt(ranking.stake?.toString() || '0'),
              delegatedStake: BigInt(0),
              totalStake: BigInt(ranking.totalStake?.toString() || '0'),
              commission: 5,
              status: VALIDATOR_STATUS.ACTIVE,
              performance: {
                blocksProduced: 0,
                blocksExpected: 0,
                uptime: 100,
                missedBlocks: 0,
                slashingEvents: 0,
                averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
                score: ranking.score || 100
              },
              metadata: {
                name: ranking.address, // 使用实际地址作为名称
                description: `Validator ${ranking.address}`,
                website: `https://validator.titanchain.io/${ranking.address}`
              },
              joinedAt: Date.now(),
              lastActiveBlock: 0
            };
            
            this.validators.set(ranking.address, newValidator);
            
            // 创建质押信息
            const stakingInfo: StakingInfo = {
              validator: ranking.address,
              delegator: ranking.address,
              amount: newValidator.stake,
              rewards: BigInt(0),
              lockPeriod: 0,
              unlockTime: 0,
              status: 'active'
            };
            
            this.stakingInfo.set(ranking.address, stakingInfo);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing validators from blockchain:', error);
    }
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