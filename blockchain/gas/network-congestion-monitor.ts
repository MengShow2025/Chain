/**
 * 网络拥堵监控器
 * 实时监控网络状态，为智能gas费定价提供拥堵数据
 */

export interface NetworkMetrics {
  blockUtilization: number;    // 区块利用率 (0-1)
  pendingTransactions: number; // 待处理交易数量
  averageBlockTime: number;    // 平均出块时间 (ms)
  gasUsageRate: number;        // Gas使用率
  timestamp: number;           // 时间戳
}

export interface CongestionLevel {
  level: 'low' | 'medium' | 'high' | 'extreme';
  factor: number;              // 拥堵因子 (0.5-3.0)
  description: string;         // 描述
  estimatedWaitTime: number;   // 预估等待时间 (秒)
}

export class NetworkCongestionMonitor {
  private metricsHistory: NetworkMetrics[] = [];
  private readonly maxHistorySize = 100;
  private readonly monitorInterval = 15000; // 15秒监控一次
  private monitorTimer: NodeJS.Timeout | null = null;
  
  // 拥堵阈值配置
  private readonly congestionThresholds = {
    low: { utilization: 0.3, factor: 0.5 },
    medium: { utilization: 0.6, factor: 1.0 },
    high: { utilization: 0.8, factor: 1.8 },
    extreme: { utilization: 0.95, factor: 3.0 }
  };

  constructor() {
    this.startMonitoring();
  }

  /**
   * 启动网络监控
   */
  private startMonitoring(): void {
    this.monitorTimer = setInterval(() => {
      this.collectNetworkMetrics();
    }, this.monitorInterval);
  }

  /**
   * 停止网络监控
   */
  public stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }

  /**
   * 收集网络指标
   */
  private async collectNetworkMetrics(): Promise<void> {
    try {
      // 在实际环境中，这里会从区块链节点获取真实数据
      // 目前使用模拟数据
      const metrics = this.simulateNetworkMetrics();
      this.addMetrics(metrics);
      
    } catch (error) {
      console.error('Failed to collect network metrics:', error);
    }
  }

  /**
   * 模拟网络指标（用于开发和测试）
   */
  private simulateNetworkMetrics(): NetworkMetrics {
    const lastMetrics = this.getLatestMetrics();
    
    // 模拟网络状态变化
    const baseUtilization = lastMetrics?.blockUtilization || 0.4;
    const utilizationChange = (Math.random() - 0.5) * 0.2; // ±10%变化
    const blockUtilization = Math.max(0, Math.min(1, baseUtilization + utilizationChange));
    
    // 基于利用率计算其他指标
    const pendingTransactions = Math.floor(blockUtilization * 1000 + Math.random() * 200);
    const averageBlockTime = 12000 + (blockUtilization * 8000); // 12-20秒
    const gasUsageRate = blockUtilization * 0.9 + Math.random() * 0.1;
    
    return {
      blockUtilization,
      pendingTransactions,
      averageBlockTime,
      gasUsageRate,
      timestamp: Date.now()
    };
  }

  /**
   * 添加网络指标到历史记录
   */
  private addMetrics(metrics: NetworkMetrics): void {
    this.metricsHistory.push(metrics);
    
    // 限制历史记录大小
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * 获取最新的网络指标
   */
  public getLatestMetrics(): NetworkMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
  }

  /**
   * 获取网络指标历史
   */
  public getMetricsHistory(minutes: number = 30): NetworkMetrics[] {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
  }

  /**
   * 计算当前拥堵等级
   */
  public getCurrentCongestionLevel(): CongestionLevel {
    const metrics = this.getLatestMetrics();
    
    if (!metrics) {
      return {
        level: 'medium',
        factor: 1.0,
        description: '网络状态未知',
        estimatedWaitTime: 60
      };
    }

    const utilization = metrics.blockUtilization;
    
    if (utilization <= this.congestionThresholds.low.utilization) {
      return {
        level: 'low',
        factor: this.congestionThresholds.low.factor,
        description: '网络空闲，交易快速确认',
        estimatedWaitTime: 15
      };
    } else if (utilization <= this.congestionThresholds.medium.utilization) {
      return {
        level: 'medium',
        factor: this.congestionThresholds.medium.factor,
        description: '网络正常，标准确认时间',
        estimatedWaitTime: 30
      };
    } else if (utilization <= this.congestionThresholds.high.utilization) {
      return {
        level: 'high',
        factor: this.congestionThresholds.high.factor,
        description: '网络拥堵，确认时间较长',
        estimatedWaitTime: 120
      };
    } else {
      return {
        level: 'extreme',
        factor: this.congestionThresholds.extreme.factor,
        description: '网络极度拥堵，建议稍后交易',
        estimatedWaitTime: 300
      };
    }
  }

  /**
   * 获取拥堵因子（用于gas费计算）
   */
  public getCongestionFactor(): number {
    return this.getCurrentCongestionLevel().factor;
  }

  /**
   * 预测网络拥堵趋势
   */
  public predictCongestionTrend(): 'increasing' | 'decreasing' | 'stable' {
    const recentMetrics = this.getMetricsHistory(10); // 最近10分钟
    
    if (recentMetrics.length < 3) {
      return 'stable';
    }
    
    // 计算利用率趋势
    const utilizationTrend = this.calculateTrend(
      recentMetrics.map(m => m.blockUtilization)
    );
    
    if (utilizationTrend > 0.05) {
      return 'increasing';
    } else if (utilizationTrend < -0.05) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * 计算数据趋势
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * 获取网络状态摘要
   */
  public getNetworkSummary(): {
    congestion: CongestionLevel;
    trend: 'increasing' | 'decreasing' | 'stable';
    metrics: NetworkMetrics | null;
    recommendation: string;
  } {
    const congestion = this.getCurrentCongestionLevel();
    const trend = this.predictCongestionTrend();
    const metrics = this.getLatestMetrics();
    
    let recommendation = '';
    
    if (congestion.level === 'low') {
      recommendation = '网络空闲，是交易的最佳时机，享受超低gas费';
    } else if (congestion.level === 'medium') {
      recommendation = '网络状态正常，可以正常进行交易';
    } else if (congestion.level === 'high') {
      if (trend === 'decreasing') {
        recommendation = '网络拥堵但正在缓解，可以稍等片刻再交易';
      } else {
        recommendation = '网络拥堵，建议提高gas费或稍后交易';
      }
    } else {
      recommendation = '网络极度拥堵，强烈建议稍后交易以避免高额费用';
    }
    
    return {
      congestion,
      trend,
      metrics,
      recommendation
    };
  }

  /**
   * 手动设置网络指标（用于测试）
   */
  public setNetworkMetrics(metrics: Partial<NetworkMetrics>): void {
    const fullMetrics: NetworkMetrics = {
      blockUtilization: 0.5,
      pendingTransactions: 100,
      averageBlockTime: 15000,
      gasUsageRate: 0.5,
      timestamp: Date.now(),
      ...metrics
    };
    
    this.addMetrics(fullMetrics);
  }

  /**
   * 获取拥堵阈值配置
   */
  public getCongestionThresholds() {
    return { ...this.congestionThresholds };
  }

  /**
   * 更新拥堵阈值配置
   */
  public updateCongestionThresholds(thresholds: Partial<typeof this.congestionThresholds>): void {
    Object.assign(this.congestionThresholds, thresholds);
  }
}

// 全局网络拥堵监控实例
export const networkCongestionMonitor = new NetworkCongestionMonitor();