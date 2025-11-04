import { TitanChain } from '../../blockchain/core/blockchain';
import { ValidatorManager } from '../validators/validator-manager';
import { blockchainInstance } from '../../shared/blockchain-instance';

interface NetworkStats {
  blockHeight: number;
  totalTransactions: number;
  activeValidators: number;
  networkHashRate: string;
  averageBlockTime: number;
  tps: number;
  zeroGasTransactions: number;
  totalStaked: string;
}

interface NetworkHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  consensusHealth: number;
  networkLatency: number;
  syncStatus: number;
}

interface NetworkMetrics {
  timestamp: number;
  tps: number;
  blockTime: number;
  gasUsage: number;
  activeValidators: number;
  networkLoad: number;
}

interface SearchResult {
  type: 'block' | 'transaction' | 'address' | 'validator';
  id: string;
  title: string;
  subtitle?: string;
}

export class ExplorerService {
  private blockchain: TitanChain | null;
  private validatorManager: ValidatorManager;
  
  constructor() {
    // Use global blockchain instance / 使用全局区块链实例
    this.blockchain = blockchainInstance.getBlockchain();
    this.validatorManager = new ValidatorManager();
  }
  
  async getNetworkStats(): Promise<NetworkStats> {
    try {
      // Check if blockchain instance is available / 检查区块链实例是否可用
      if (!this.blockchain) {
        console.warn('Blockchain instance not available, returning default stats');
        return {
          blockHeight: 0,
          totalTransactions: 0,
          activeValidators: 108,
          networkHashRate: '0 H/s',
          averageBlockTime: 3000,
          tps: 0,
          zeroGasTransactions: 0,
          totalStaked: '216000000000000000000000000'
        };
      }

      const networkStats = this.blockchain.getNetworkStats();
      const blockHeight = this.blockchain.getBlockHeight();
      
      return {
        blockHeight: blockHeight,
        totalTransactions: networkStats.totalTransactions,
        activeValidators: networkStats.activeValidators,
        networkHashRate: this.formatHashRate(networkStats.activeValidators * 1000000), // Calculate hash rate / 计算哈希率
        averageBlockTime: networkStats.averageBlockTime,
        tps: networkStats.currentTPS,
        zeroGasTransactions: networkStats.zeroGasTransactions,
        totalStaked: networkStats.totalStaked.toString()
      };
    } catch (error) {
      console.error('Failed to get network stats:', error);
      throw error;
    }
  }
  
  async getNetworkHealth(): Promise<NetworkHealth> {
    try {
      // Get all validators / 获取所有验证节点
      const totalValidators = await this.validatorManager.getAllValidators();
      const activeValidators = totalValidators.filter(v => v.status === 'active');
      
      // Calculate network health metrics / 计算网络健康指标
      const activeValidatorRatio = totalValidators.length > 0 
        ? (activeValidators.length / totalValidators.length) * 100 
        : 0;
      
      // Calculate average uptime / 计算平均正常运行时间
      const avgUptime = activeValidators.length > 0
        ? activeValidators.reduce((sum, v) => sum + (v.performance?.uptime || 0), 0) / activeValidators.length
        : 0;
      
      // Determine network status / 确定网络状态
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (activeValidatorRatio < 50) {
        status = 'critical';
      } else if (activeValidatorRatio < 75 || avgUptime < 95) {
        status = 'warning';
      }
      
      return {
        status,
        uptime: avgUptime,
        consensusHealth: activeValidatorRatio,
        networkLatency: 50, // Simulated value / 模拟值
        syncStatus: 100 // Assume fully synced / 假设完全同步
      };
    } catch (error) {
      console.error('Error getting network health:', error);
      return {
        status: 'critical',
        uptime: 0,
        consensusHealth: 0,
        networkLatency: 0,
        syncStatus: 0
      };
    }
  }
  
  async getNetworkMetrics(range: string): Promise<NetworkMetrics[]> {
    try {
      const now = Date.now();
      const dataPoints = this.getDataPointsForRange(range);
      const interval = this.getIntervalForRange(range);
      
      const metrics: NetworkMetrics[] = [];
      
      for (let i = dataPoints; i >= 0; i--) {
        const timestamp = now - (i * interval);
        const networkStats = this.blockchain.getNetworkStats();
        
        metrics.push({
          timestamp,
          tps: networkStats.currentTPS + Math.floor(Math.random() * 10000) - 5000,
          blockTime: 2.1 + (Math.random() - 0.5) * 0.4, // 1.9-2.3s
          gasUsage: Math.random() * 30 + 70, // 70-100%
          activeValidators: 108 + Math.floor(Math.random() * 3) - 1, // 107-109
          networkLoad: Math.random() * 40 + 60 // 60-100%
        });
      }
      
      return metrics;
    } catch (error) {
      console.error('Failed to get network metrics:', error);
      throw error;
    }
  }
  
  async getRecentBlocks(page: number, limit: number) {
    try {
      const networkStats = this.blockchain.getNetworkStats();
      const startHeight = networkStats.blockHeight - ((page - 1) * limit);
      
      const blocks = [];
      for (let i = 0; i < limit; i++) {
        const height = startHeight - i;
        if (height <= 0) break;
        
        // 模拟区块数据
        blocks.push({
          height,
          hash: `0x${Math.random().toString(16).substr(2, 64)}`,
          timestamp: Date.now() - (i * 2100), // 每2.1秒一个区块
          validator: `Validator-${Math.floor(Math.random() * 108) + 1}`,
          transactionCount: Math.floor(Math.random() * 500) + 100,
          gasUsed: Math.floor(Math.random() * 8000000) + 2000000,
          gasLimit: 10000000,
          size: Math.floor(Math.random() * 50000) + 20000,
          reward: (Math.random() * 2 + 1).toFixed(4),
          difficulty: (Math.random() * 1000000000000).toExponential(2)
        });
      }
      
      return blocks;
    } catch (error) {
      console.error('Failed to get recent blocks:', error);
      throw error;
    }
  }
  
  async getBlockDetails(identifier: string) {
    try {
      // 根据标识符类型（高度或哈希）获取区块详情
      const isHeight = /^\d+$/.test(identifier);
      
      // 模拟区块详情
      return {
        height: isHeight ? parseInt(identifier) : Math.floor(Math.random() * 1000000),
        hash: isHeight ? `0x${Math.random().toString(16).substr(2, 64)}` : identifier,
        parentHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        timestamp: Date.now() - Math.random() * 86400000,
        validator: `Validator-${Math.floor(Math.random() * 108) + 1}`,
        transactionCount: Math.floor(Math.random() * 500) + 100,
        gasUsed: Math.floor(Math.random() * 8000000) + 2000000,
        gasLimit: 10000000,
        size: Math.floor(Math.random() * 50000) + 20000,
        reward: (Math.random() * 2 + 1).toFixed(4),
        difficulty: (Math.random() * 1000000000000).toExponential(2),
        nonce: Math.floor(Math.random() * 1000000),
        merkleRoot: `0x${Math.random().toString(16).substr(2, 64)}`,
        stateRoot: `0x${Math.random().toString(16).substr(2, 64)}`,
        receiptsRoot: `0x${Math.random().toString(16).substr(2, 64)}`
      };
    } catch (error) {
      console.error('Failed to get block details:', error);
      throw error;
    }
  }
  
  async getRecentTransactions(page: number, limit: number, filter: string) {
    try {
      const transactions = [];
      const transactionTypes = ['transfer', 'contract', 'exchange_batch', 'staking'];
      const statuses = ['success', 'success', 'success', 'failed', 'pending'];
      
      for (let i = 0; i < limit; i++) {
        const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
        const isZeroGas = type === 'exchange_batch' || Math.random() < 0.3;
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        // 应用过滤器
        if (filter === 'zero_gas' && !isZeroGas) continue;
        if (filter === 'regular' && isZeroGas) continue;
        
        transactions.push({
          hash: `0x${Math.random().toString(16).substr(2, 64)}`,
          from: `0x${Math.random().toString(16).substr(2, 40)}`,
          to: `0x${Math.random().toString(16).substr(2, 40)}`,
          value: (Math.random() * 1000).toFixed(4),
          gasPrice: isZeroGas ? '0' : (Math.random() * 50 + 10).toFixed(2),
          gasUsed: Math.floor(Math.random() * 100000) + 21000,
          gasLimit: Math.floor(Math.random() * 200000) + 100000,
          status,
          timestamp: Date.now() - (i * 1000) - Math.random() * 10000,
          blockHeight: 1234567 - Math.floor(i / 300),
          type,
          isZeroGas,
          fee: isZeroGas ? '0' : (Math.random() * 0.01).toFixed(6)
        });
      }
      
      return transactions;
    } catch (error) {
      console.error('Failed to get recent transactions:', error);
      throw error;
    }
  }
  
  async getTransactionDetails(hash: string) {
    try {
      // 模拟交易详情
      const isZeroGas = Math.random() < 0.3;
      
      return {
        hash,
        blockHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        blockHeight: Math.floor(Math.random() * 1000000),
        transactionIndex: Math.floor(Math.random() * 200),
        from: `0x${Math.random().toString(16).substr(2, 40)}`,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        value: (Math.random() * 1000).toFixed(4),
        gasPrice: isZeroGas ? '0' : (Math.random() * 50 + 10).toFixed(2),
        gasUsed: Math.floor(Math.random() * 100000) + 21000,
        gasLimit: Math.floor(Math.random() * 200000) + 100000,
        status: Math.random() > 0.1 ? 'success' : 'failed',
        timestamp: Date.now() - Math.random() * 86400000,
        nonce: Math.floor(Math.random() * 1000),
        input: '0x',
        logs: [],
        isZeroGas,
        fee: isZeroGas ? '0' : (Math.random() * 0.01).toFixed(6)
      };
    } catch (error) {
      console.error('Failed to get transaction details:', error);
      throw error;
    }
  }
  
  async getAddressDetails(address: string) {
    try {
      // 模拟地址详情
      return {
        address,
        balance: (Math.random() * 10000).toFixed(4),
        transactionCount: Math.floor(Math.random() * 1000),
        isContract: Math.random() < 0.1,
        contractInfo: Math.random() < 0.1 ? {
          name: 'Sample Contract',
          symbol: 'SC',
          decimals: 18,
          totalSupply: '1000000'
        } : null
      };
    } catch (error) {
      console.error('Failed to get address details:', error);
      throw error;
    }
  }
  
  async getAddressTransactions(address: string, page: number, limit: number, type: string) {
    try {
      // 复用getRecentTransactions的逻辑，但过滤特定地址
      const transactions = await this.getRecentTransactions(page, limit, 'all');
      
      // 模拟地址相关的交易
      return transactions.map(tx => ({
        ...tx,
        from: Math.random() < 0.5 ? address : tx.from,
        to: Math.random() < 0.5 ? address : tx.to
      }));
    } catch (error) {
      console.error('Failed to get address transactions:', error);
      throw error;
    }
  }
  
  async getValidators(page: number, limit: number, sort: string, status: string) {
    try {
      const allValidators = await this.validatorManager.getAllValidators();
      
      // 应用状态过滤
      let filteredValidators = allValidators;
      if (status !== 'all') {
        filteredValidators = allValidators.filter(v => v.status === status);
      }
      
      // 应用排序
      filteredValidators.sort((a, b) => {
        switch (sort) {
          case 'stake':
            return Number(b.totalStake - a.totalStake);
          case 'performance':
            return (b.performance?.score || 0) - (a.performance?.score || 0);
          case 'uptime':
            return (b.performance?.uptime || 0) - (a.performance?.uptime || 0);
          default:
            return 0; // 移除 rank 排序，因为 Validator 类型中没有 rank 字段
        }
      });
      
      // 分页
      const startIndex = (page - 1) * limit;
      const paginatedValidators = filteredValidators.slice(startIndex, startIndex + limit);
      
      // 转换BigInt为字符串以便JSON序列化
      const serializedValidators = paginatedValidators.map(validator => {
        const serialized = { ...validator } as any;
        
        // 转换所有BigInt字段为字符串
        if (typeof serialized.stake === 'bigint') {
          serialized.stake = serialized.stake.toString();
        }
        if (typeof serialized.delegatedStake === 'bigint') {
          serialized.delegatedStake = serialized.delegatedStake.toString();
        }
        if (typeof serialized.totalStake === 'bigint') {
          serialized.totalStake = serialized.totalStake.toString();
        }
        if (typeof serialized.totalRewards === 'bigint') {
          serialized.totalRewards = serialized.totalRewards.toString();
        }
        
        return serialized;
      });
      
      return serializedValidators;
    } catch (error) {
      console.error('Failed to get validators:', error);
      throw error;
    }
  }
  
  async getValidatorDetails(identifier: string) {
    try {
      const allValidators = await this.validatorManager.getAllValidators();
      const validator = allValidators.find(v => v.address === identifier || v.publicKey === identifier);
      
      if (!validator) {
        throw new Error('Validator not found');
      }
      
      // 转换BigInt字段为字符串
       const serializedValidator = { ...validator } as any;
       if (typeof serializedValidator.stake === 'bigint') {
         serializedValidator.stake = serializedValidator.stake.toString();
       }
       if (typeof serializedValidator.delegatedStake === 'bigint') {
         serializedValidator.delegatedStake = serializedValidator.delegatedStake.toString();
       }
       if (typeof serializedValidator.totalStake === 'bigint') {
         serializedValidator.totalStake = serializedValidator.totalStake.toString();
       }
      
      return serializedValidator;
    } catch (error) {
      console.error('Failed to get validator details:', error);
      throw error;
    }
  }
  
  async getValidatorPerformance(identifier: string, range: string) {
    try {
      // 模拟验证节点性能历史数据
      const dataPoints = this.getDataPointsForRange(range);
      const interval = this.getIntervalForRange(range);
      const now = Date.now();
      
      const performance = [];
      for (let i = dataPoints; i >= 0; i--) {
        performance.push({
          timestamp: now - (i * interval),
          uptime: Math.random() * 5 + 95, // 95-100%
          blocksProduced: Math.floor(Math.random() * 10),
          missedBlocks: Math.floor(Math.random() * 2),
          rewards: (Math.random() * 100).toFixed(2)
        });
      }
      
      return performance;
    } catch (error) {
      console.error('Failed to get validator performance:', error);
      throw error;
    }
  }
  
  async search(query: string): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = [];
      
      // 检查是否是区块高度
      if (/^\d+$/.test(query)) {
        const blockHeight = parseInt(query);
        
        // 验证区块是否存在
        if (this.blockchain) {
          const currentHeight = this.blockchain.getBlockHeight();
          if (blockHeight <= currentHeight && blockHeight >= 0) {
            results.push({
              type: 'block',
              id: query,
              title: `Block #${query}`,
              subtitle: `Block height (Current: ${currentHeight})`
            });
          }
        } else {
          // 如果区块链实例不可用，仍然返回结果但标注为未验证
          results.push({
            type: 'block',
            id: query,
            title: `Block #${query}`,
            subtitle: 'Block height (unverified)'
          });
        }
      }
      
      // 检查是否是交易哈希
      if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
        results.push({
          type: 'transaction',
          id: query,
          title: `${query.slice(0, 10)}...${query.slice(-8)}`,
          subtitle: 'Transaction hash'
        });
      }
      
      // 检查是否是地址
      if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
        // 检查是否是已知的验证节点地址
        const knownValidators = [
          '0x3c55a5681d272E8787C818e2d164c0ABFd90a933', // 区块生产者
          '0x151bBae42e263EbfBD6740C966420B852d9156dE'  // 验证节点
        ];
        
        const isValidator = knownValidators.some(addr => addr.toLowerCase() === query.toLowerCase());
        
        results.push({
          type: 'address',
          id: query,
          title: `${query.slice(0, 10)}...${query.slice(-8)}`,
          subtitle: isValidator ? 'Validator Address' : 'Address'
        });
      }
      
      // 检查是否是区块哈希
      if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
        // 如果已经作为交易哈希添加，也添加为区块哈希的可能性
        const existingTx = results.find(r => r.type === 'transaction' && r.id === query);
        if (existingTx) {
          results.push({
            type: 'block',
            id: query,
            title: `${query.slice(0, 10)}...${query.slice(-8)}`,
            subtitle: 'Block hash'
          });
        }
      }
      
      // 模糊搜索验证节点
      if (query.toLowerCase().includes('validator') || query.toLowerCase().includes('node')) {
        results.push({
          type: 'validator',
          id: 'validator-1',
          title: 'Validator Node #1',
          subtitle: 'Active validator'
        });
      }
      
      return results;
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }
  
  async getOverviewStats() {
    try {
      const networkStats = await this.getNetworkStats();
      const health = await this.getNetworkHealth();
      
      return {
        ...networkStats,
        ...health,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('Failed to get overview stats:', error);
      throw error;
    }
  }
  
  async getZeroGasStats(range: string) {
    try {
      const dataPoints = this.getDataPointsForRange(range);
      const interval = this.getIntervalForRange(range);
      const now = Date.now();
      
      const stats = [];
      let totalZeroGas = 0;
      let totalRegular = 0;
      
      for (let i = dataPoints; i >= 0; i--) {
        const zeroGasCount = Math.floor(Math.random() * 1000) + 500;
        const regularCount = Math.floor(Math.random() * 2000) + 1000;
        
        totalZeroGas += zeroGasCount;
        totalRegular += regularCount;
        
        stats.push({
          timestamp: now - (i * interval),
          zeroGasTransactions: zeroGasCount,
          regularTransactions: regularCount,
          zeroGasPercentage: (zeroGasCount / (zeroGasCount + regularCount)) * 100
        });
      }
      
      return {
        stats,
        summary: {
          totalZeroGas,
          totalRegular,
          overallPercentage: (totalZeroGas / (totalZeroGas + totalRegular)) * 100
        }
      };
    } catch (error) {
      console.error('Failed to get zero-gas stats:', error);
      throw error;
    }
  }
  
  async getLiquidityPools() {
    try {
      // 模拟流动性池数据
      const pools = [
        {
          id: 'TTN-USDC',
          token0: 'TTN',
          token1: 'USDC',
          liquidity: '1250000',
          volume24h: '850000',
          fees24h: '2550',
          apr: 12.5
        },
        {
          id: 'TTN-ETH',
          token0: 'TTN',
          token1: 'ETH',
          liquidity: '980000',
          volume24h: '620000',
          fees24h: '1860',
          apr: 15.2
        }
      ];
      
      return pools;
    } catch (error) {
      console.error('Failed to get liquidity pools:', error);
      throw error;
    }
  }
  
  async getOrderBook(pair: string, depth: number) {
    try {
      // 模拟订单簿数据
      const bids = [];
      const asks = [];
      
      const basePrice = 100 + Math.random() * 50; // 基础价格
      
      for (let i = 0; i < depth; i++) {
        bids.push({
          price: (basePrice - i * 0.1).toFixed(2),
          amount: (Math.random() * 1000 + 100).toFixed(2),
          total: 0
        });
        
        asks.push({
          price: (basePrice + i * 0.1).toFixed(2),
          amount: (Math.random() * 1000 + 100).toFixed(2),
          total: 0
        });
      }
      
      return {
        pair,
        bids,
        asks,
        lastPrice: basePrice.toFixed(2),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to get orderbook:', error);
      throw error;
    }
  }
  
  private formatHashRate(hashRate: number): string {
    if (hashRate >= 1e12) {
      return `${(hashRate / 1e12).toFixed(1)} TH/s`;
    } else if (hashRate >= 1e9) {
      return `${(hashRate / 1e9).toFixed(1)} GH/s`;
    } else if (hashRate >= 1e6) {
      return `${(hashRate / 1e6).toFixed(1)} MH/s`;
    } else {
      return `${hashRate.toFixed(0)} H/s`;
    }
  }
  
  private calculateTotalStaked(validators: any[]): number {
    return validators.reduce((total, validator) => {
      return total + parseFloat(validator.totalStake || '0');
    }, 0);
  }
  
  private getDataPointsForRange(range: string): number {
    switch (range) {
      case '1h': return 60;
      case '24h': return 144;
      case '7d': return 168;
      case '30d': return 720;
      default: return 144;
    }
  }
  
  private getIntervalForRange(range: string): number {
    switch (range) {
      case '1h': return 60000; // 1分钟
      case '24h': return 600000; // 10分钟
      case '7d': return 3600000; // 1小时
      case '30d': return 3600000; // 1小时
      default: return 600000;
    }
  }
}