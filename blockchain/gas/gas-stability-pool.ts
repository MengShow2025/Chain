/**
 * Gas费稳定性缓冲池
 * 平滑短期价格波动，确保用户可预期的费用支出
 */

export interface StabilityConfig {
  bufferSize: number;          // 缓冲池大小
  maxPriceChange: number;      // 最大价格变化幅度 (%)
  smoothingWindow: number;     // 平滑窗口大小
  emergencyThreshold: number;  // 紧急调整阈值
  rebalanceInterval: number;   // 重新平衡间隔 (ms)
}

export interface PriceBuffer {
  timestamp: number;
  price: bigint;
  weight: number;
  source: 'market' | 'smoothed' | 'emergency';
}

export interface StabilityMetrics {
  currentPrice: bigint;
  smoothedPrice: bigint;
  volatility: number;
  bufferUtilization: number;
  stabilityScore: number;      // 稳定性评分 (0-100)
  lastRebalance: number;
}

export class GasStabilityPool {
  private config: StabilityConfig;
  private priceBuffer: PriceBuffer[] = [];
  private lastRebalanceTime: number = 0;
  private rebalanceTimer: NodeJS.Timeout | null = null;
  
  constructor(config?: Partial<StabilityConfig>) {
    this.config = {
      bufferSize: 50,              // 50个价格点
      maxPriceChange: 20,          // 最大20%变化
      smoothingWindow: 10,         // 10个点的平滑窗口
      emergencyThreshold: 50,      // 50%紧急阈值
      rebalanceInterval: 300000,   // 5分钟重新平衡
      ...config
    };
    
    this.startRebalancing();
  }

  /**
   * 启动自动重新平衡
   */
  private startRebalancing(): void {
    this.rebalanceTimer = setInterval(() => {
      this.rebalancePool();
    }, this.config.rebalanceInterval);
  }

  /**
   * 停止自动重新平衡
   */
  public stopRebalancing(): void {
    if (this.rebalanceTimer) {
      clearInterval(this.rebalanceTimer);
      this.rebalanceTimer = null;
    }
  }

  /**
   * 添加新的价格数据到缓冲池
   */
  public addPrice(price: bigint, source: 'market' | 'smoothed' | 'emergency' = 'market'): void {
    const priceBuffer: PriceBuffer = {
      timestamp: Date.now(),
      price,
      weight: this.calculateWeight(source),
      source
    };
    
    this.priceBuffer.push(priceBuffer);
    
    // 限制缓冲池大小
    if (this.priceBuffer.length > this.config.bufferSize) {
      this.priceBuffer.shift();
    }
  }

  /**
   * 计算价格权重
   */
  private calculateWeight(source: 'market' | 'smoothed' | 'emergency'): number {
    switch (source) {
      case 'market':
        return 1.0;
      case 'smoothed':
        return 0.8;
      case 'emergency':
        return 0.5;
      default:
        return 1.0;
    }
  }

  /**
   * 获取稳定化的gas价格
   */
  public getStabilizedPrice(rawPrice: bigint): bigint {
    // 添加原始价格到缓冲池
    this.addPrice(rawPrice, 'market');
    
    // 检查是否需要紧急调整
    if (this.needsEmergencyAdjustment(rawPrice)) {
      return this.applyEmergencyStabilization(rawPrice);
    }
    
    // 应用平滑算法
    return this.applySmoothingAlgorithm(rawPrice);
  }

  /**
   * 检查是否需要紧急调整
   */
  private needsEmergencyAdjustment(newPrice: bigint): boolean {
    if (this.priceBuffer.length < 2) return false;
    
    const lastPrice = this.priceBuffer[this.priceBuffer.length - 2].price;
    const priceChange = Math.abs(Number(newPrice - lastPrice)) / Number(lastPrice);
    
    return priceChange > (this.config.emergencyThreshold / 100);
  }

  /**
   * 应用紧急稳定化
   */
  private applyEmergencyStabilization(rawPrice: bigint): bigint {
    const recentPrices = this.getRecentPrices(5); // 最近5个价格
    if (recentPrices.length === 0) return rawPrice;
    
    // 计算加权平均价格
    const weightedSum = recentPrices.reduce((sum, buffer) => {
      return sum + (Number(buffer.price) * buffer.weight);
    }, 0);
    
    const totalWeight = recentPrices.reduce((sum, buffer) => sum + buffer.weight, 0);
    const averagePrice = weightedSum / totalWeight;
    
    // 限制价格变化幅度
    const maxChange = this.config.maxPriceChange / 100;
    const lastPrice = recentPrices[recentPrices.length - 1].price;
    const maxAllowedPrice = Number(lastPrice) * (1 + maxChange);
    const minAllowedPrice = Number(lastPrice) * (1 - maxChange);
    
    const stabilizedPrice = Math.max(minAllowedPrice, Math.min(maxAllowedPrice, averagePrice));
    
    // 记录紧急调整
    this.addPrice(BigInt(Math.floor(stabilizedPrice)), 'emergency');
    
    return BigInt(Math.floor(stabilizedPrice));
  }

  /**
   * 应用平滑算法
   */
  private applySmoothingAlgorithm(rawPrice: bigint): bigint {
    const windowSize = Math.min(this.config.smoothingWindow, this.priceBuffer.length);
    if (windowSize < 2) return rawPrice;
    
    const recentPrices = this.priceBuffer.slice(-windowSize);
    
    // 使用指数移动平均 (EMA)
    let ema = Number(recentPrices[0].price);
    const alpha = 2 / (windowSize + 1);
    
    for (let i = 1; i < recentPrices.length; i++) {
      const currentPrice = Number(recentPrices[i].price);
      ema = alpha * currentPrice + (1 - alpha) * ema;
    }
    
    // 记录平滑后的价格
    const smoothedPrice = BigInt(Math.floor(ema));
    this.addPrice(smoothedPrice, 'smoothed');
    
    return smoothedPrice;
  }

  /**
   * 获取最近的价格数据
   */
  private getRecentPrices(count: number): PriceBuffer[] {
    return this.priceBuffer.slice(-count);
  }

  /**
   * 重新平衡缓冲池
   */
  private rebalancePool(): void {
    const now = Date.now();
    
    // 移除过期的价格数据 (超过1小时)
    const cutoffTime = now - (60 * 60 * 1000);
    this.priceBuffer = this.priceBuffer.filter(buffer => buffer.timestamp >= cutoffTime);
    
    // 重新计算权重
    this.reweightPrices();
    
    this.lastRebalanceTime = now;
  }

  /**
   * 重新计算价格权重
   */
  private reweightPrices(): void {
    const now = Date.now();
    
    this.priceBuffer.forEach(buffer => {
      const age = now - buffer.timestamp;
      const ageHours = age / (60 * 60 * 1000);
      
      // 随时间衰减权重
      const decayFactor = Math.exp(-ageHours / 2); // 2小时半衰期
      buffer.weight *= decayFactor;
    });
  }

  /**
   * 获取稳定性指标
   */
  public getStabilityMetrics(): StabilityMetrics {
    if (this.priceBuffer.length === 0) {
      return {
        currentPrice: BigInt(0),
        smoothedPrice: BigInt(0),
        volatility: 0,
        bufferUtilization: 0,
        stabilityScore: 0,
        lastRebalance: this.lastRebalanceTime
      };
    }
    
    const recentPrices = this.getRecentPrices(10);
    const currentPrice = this.priceBuffer[this.priceBuffer.length - 1].price;
    
    // 计算平滑价格
    const smoothedPrice = this.calculateSmoothedPrice(recentPrices);
    
    // 计算波动率
    const volatility = this.calculateVolatility(recentPrices);
    
    // 计算缓冲池利用率
    const bufferUtilization = this.priceBuffer.length / this.config.bufferSize;
    
    // 计算稳定性评分
    const stabilityScore = this.calculateStabilityScore(volatility, bufferUtilization);
    
    return {
      currentPrice,
      smoothedPrice,
      volatility,
      bufferUtilization,
      stabilityScore,
      lastRebalance: this.lastRebalanceTime
    };
  }

  /**
   * 计算平滑价格
   */
  private calculateSmoothedPrice(prices: PriceBuffer[]): bigint {
    if (prices.length === 0) return BigInt(0);
    
    const weightedSum = prices.reduce((sum, buffer) => {
      return sum + (Number(buffer.price) * buffer.weight);
    }, 0);
    
    const totalWeight = prices.reduce((sum, buffer) => sum + buffer.weight, 0);
    
    return BigInt(Math.floor(weightedSum / totalWeight));
  }

  /**
   * 计算波动率
   */
  private calculateVolatility(prices: PriceBuffer[]): number {
    if (prices.length < 2) return 0;
    
    const priceValues = prices.map(p => Number(p.price));
    const mean = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
    
    const variance = priceValues.reduce((sum, price) => {
      return sum + Math.pow(price - mean, 2);
    }, 0) / priceValues.length;
    
    const standardDeviation = Math.sqrt(variance);
    
    return standardDeviation / mean; // 变异系数
  }

  /**
   * 计算稳定性评分
   */
  private calculateStabilityScore(volatility: number, bufferUtilization: number): number {
    // 基础评分：低波动率 = 高评分
    const volatilityScore = Math.max(0, 100 - (volatility * 1000));
    
    // 缓冲池利用率评分：适中利用率 = 高评分
    const utilizationScore = 100 - Math.abs(bufferUtilization - 0.5) * 200;
    
    // 综合评分
    const finalScore = (volatilityScore * 0.7) + (utilizationScore * 0.3);
    
    return Math.max(0, Math.min(100, finalScore));
  }

  /**
   * 获取价格预测
   */
  public getPricePrediction(horizonMinutes: number = 30): {
    predictedPrice: bigint;
    confidence: number;
    trend: 'up' | 'down' | 'stable';
  } {
    const recentPrices = this.getRecentPrices(20);
    
    if (recentPrices.length < 5) {
      return {
        predictedPrice: this.priceBuffer[this.priceBuffer.length - 1]?.price || BigInt(0),
        confidence: 0,
        trend: 'stable'
      };
    }
    
    // 简单线性回归预测
    const priceValues = recentPrices.map(p => Number(p.price));
    const trend = this.calculateTrend(priceValues);
    
    const currentPrice = priceValues[priceValues.length - 1];
    const predictedPrice = currentPrice + (trend * horizonMinutes);
    
    // 计算预测置信度
    const volatility = this.calculateVolatility(recentPrices);
    const confidence = Math.max(0, Math.min(100, 100 - (volatility * 500)));
    
    const trendDirection = trend > 0.01 ? 'up' : trend < -0.01 ? 'down' : 'stable';
    
    return {
      predictedPrice: BigInt(Math.floor(Math.max(0, predictedPrice))),
      confidence,
      trend: trendDirection
    };
  }

  /**
   * 计算价格趋势
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
   * 手动触发重新平衡
   */
  public manualRebalance(): void {
    this.rebalancePool();
  }

  /**
   * 获取配置
   */
  public getConfig(): StabilityConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<StabilityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 清空缓冲池
   */
  public clearBuffer(): void {
    this.priceBuffer = [];
  }
}

// 全局gas费稳定性池实例
export const gasStabilityPool = new GasStabilityPool();