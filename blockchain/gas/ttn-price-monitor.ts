/**
 * TTN价格监控和汇率管理器
 * 实时跟踪TTN价值变化，为智能gas费调整提供数据支持
 */

export interface PriceData {
  price: number;        // TTN/USD价格
  timestamp: number;    // 价格时间戳
  source: string;       // 价格来源
  confidence: number;   // 价格可信度 (0-1)
}

export interface PriceHistory {
  prices: PriceData[];
  averagePrice24h: number;
  priceChange24h: number;
  volatility: number;
}

export class TTNPriceMonitor {
  private currentPrice: PriceData | null = null;
  private priceHistory: PriceData[] = [];
  private readonly maxHistorySize = 1000;
  private readonly updateInterval = 60000; // 1分钟更新一次
  private updateTimer: NodeJS.Timeout | null = null;
  
  // 基准价格配置
  private readonly basePriceUSD = 0.01; // TTN基准价格 $0.01
  private readonly maxPriceMultiplier = 100; // 最大价格倍数
  
  constructor() {
    this.initializePriceMonitoring();
  }

  /**
   * 初始化价格监控
   */
  private initializePriceMonitoring(): void {
    // 设置初始价格（开发环境使用模拟价格）
    this.currentPrice = {
      price: this.basePriceUSD,
      timestamp: Date.now(),
      source: 'initial',
      confidence: 1.0
    };
    
    // 启动定期价格更新
    this.startPriceUpdates();
  }

  /**
   * 启动价格更新定时器
   */
  private startPriceUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.updatePrice();
    }, this.updateInterval);
  }

  /**
   * 停止价格更新
   */
  public stopPriceUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * 更新TTN价格
   */
  private async updatePrice(): Promise<void> {
    try {
      // 在实际环境中，这里会调用外部价格API
      // 目前使用模拟价格变化
      const newPrice = this.simulatePriceChange();
      
      const priceData: PriceData = {
        price: newPrice,
        timestamp: Date.now(),
        source: 'simulation',
        confidence: 0.9
      };
      
      this.addPriceData(priceData);
      
    } catch (error) {
      console.error('Failed to update TTN price:', error);
    }
  }

  /**
   * 模拟价格变化（用于开发和测试）
   */
  private simulatePriceChange(): number {
    if (!this.currentPrice) return this.basePriceUSD;
    
    // 模拟价格波动 (-5% 到 +5%)
    const volatility = 0.05;
    const change = (Math.random() - 0.5) * 2 * volatility;
    const newPrice = this.currentPrice.price * (1 + change);
    
    // 确保价格在合理范围内
    return Math.max(
      this.basePriceUSD * 0.1, 
      Math.min(newPrice, this.basePriceUSD * this.maxPriceMultiplier)
    );
  }

  /**
   * 添加价格数据到历史记录
   */
  private addPriceData(priceData: PriceData): void {
    this.currentPrice = priceData;
    this.priceHistory.push(priceData);
    
    // 限制历史记录大小
    if (this.priceHistory.length > this.maxHistorySize) {
      this.priceHistory.shift();
    }
  }

  /**
   * 获取当前TTN价格
   */
  public getCurrentPrice(): PriceData | null {
    return this.currentPrice;
  }

  /**
   * 获取TTN价格历史
   */
  public getPriceHistory(hours: number = 24): PriceHistory {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const recentPrices = this.priceHistory.filter(p => p.timestamp >= cutoffTime);
    
    if (recentPrices.length === 0) {
      return {
        prices: [],
        averagePrice24h: this.currentPrice?.price || this.basePriceUSD,
        priceChange24h: 0,
        volatility: 0
      };
    }
    
    const averagePrice = recentPrices.reduce((sum, p) => sum + p.price, 0) / recentPrices.length;
    const oldestPrice = recentPrices[0].price;
    const currentPrice = this.currentPrice?.price || oldestPrice;
    const priceChange = ((currentPrice - oldestPrice) / oldestPrice) * 100;
    
    // 计算波动率
    const priceVariances = recentPrices.map(p => Math.pow(p.price - averagePrice, 2));
    const variance = priceVariances.reduce((sum, v) => sum + v, 0) / priceVariances.length;
    const volatility = Math.sqrt(variance) / averagePrice;
    
    return {
      prices: recentPrices,
      averagePrice24h: averagePrice,
      priceChange24h: priceChange,
      volatility
    };
  }

  /**
   * 获取价格倍数（相对于基准价格）
   */
  public getPriceMultiplier(): number {
    if (!this.currentPrice) return 1;
    return this.currentPrice.price / this.basePriceUSD;
  }

  /**
   * 获取基准价格
   */
  public getBasePrice(): number {
    return this.basePriceUSD;
  }

  /**
   * 手动设置价格（用于测试）
   */
  public setPrice(price: number, source: string = 'manual'): void {
    const priceData: PriceData = {
      price,
      timestamp: Date.now(),
      source,
      confidence: 1.0
    };
    
    this.addPriceData(priceData);
  }

  /**
   * 检查价格是否稳定
   */
  public isPriceStable(thresholdPercent: number = 10): boolean {
    const history = this.getPriceHistory(1); // 1小时内的价格
    return history.volatility < (thresholdPercent / 100);
  }

  /**
   * 获取价格趋势
   */
  public getPriceTrend(): 'up' | 'down' | 'stable' {
    const history = this.getPriceHistory(1);
    
    if (Math.abs(history.priceChange24h) < 2) {
      return 'stable';
    }
    
    return history.priceChange24h > 0 ? 'up' : 'down';
  }
}

// 全局价格监控实例
export const ttnPriceMonitor = new TTNPriceMonitor();