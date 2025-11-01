/**
 * 智能TTN Gas费动态调整引擎
 * 基于TTN价格变化自动调整gas费率，确保用户费用稳定
 */

import { ttnPriceMonitor, PriceData } from './ttn-price-monitor.js';

export interface GasPriceConfig {
  baseGasPrice: bigint;        // 基础gas价格 (wei)
  minGasPrice: bigint;         // 最低gas价格
  maxGasPrice: bigint;         // 最高gas价格
  targetUSDCost: number;       // 目标USD成本
  adjustmentFactor: number;    // 调整因子 (0-1)
  smoothingFactor: number;     // 平滑因子 (0-1)
}

export interface GasPriceResult {
  gasPrice: bigint;           // 计算出的gas价格
  priceMultiplier: number;    // 价格倍数
  adjustmentReason: string;   // 调整原因
  timestamp: number;          // 计算时间戳
}

export class SmartGasEngine {
  private config: GasPriceConfig;
  private lastGasPrice: bigint;
  private lastAdjustmentTime: number = 0;
  private readonly minAdjustmentInterval = 30000; // 最小调整间隔30秒
  
  constructor(config?: Partial<GasPriceConfig>) {
    this.config = {
      baseGasPrice: BigInt('20000000000'), // 20 Gwei 基础价格
      minGasPrice: BigInt('1000000000'),   // 1 Gwei 最低价格
      maxGasPrice: BigInt('100000000000'), // 100 Gwei 最高价格
      targetUSDCost: 0.001,                // 目标成本 $0.001
      adjustmentFactor: 0.8,               // 80%调整因子
      smoothingFactor: 0.3,                // 30%平滑因子
      ...config
    };
    
    this.lastGasPrice = this.config.baseGasPrice;
  }

  /**
   * 计算智能gas价格
   */
  public calculateSmartGasPrice(networkCongestion: number = 1): GasPriceResult {
    const now = Date.now();
    const priceData = ttnPriceMonitor.getCurrentPrice();
    
    if (!priceData) {
      return {
        gasPrice: this.lastGasPrice,
        priceMultiplier: 1,
        adjustmentReason: 'No price data available',
        timestamp: now
      };
    }

    // 计算基于TTN价格的调整
    const priceAdjustedGasPrice = this.calculatePriceAdjustedGasPrice(priceData);
    
    // 应用网络拥堵因子
    const congestionAdjustedPrice = this.applyCongestionFactor(priceAdjustedGasPrice, networkCongestion);
    
    // 应用平滑处理
    const smoothedPrice = this.applySmoothingFactor(congestionAdjustedPrice);
    
    // 确保在合理范围内
    const finalPrice = this.enforceGasPriceLimits(smoothedPrice);
    
    const priceMultiplier = ttnPriceMonitor.getPriceMultiplier();
    const adjustmentReason = this.getAdjustmentReason(priceData, networkCongestion, priceMultiplier);
    
    this.lastGasPrice = finalPrice;
    this.lastAdjustmentTime = now;
    
    return {
      gasPrice: finalPrice,
      priceMultiplier,
      adjustmentReason,
      timestamp: now
    };
  }

  /**
   * 基于TTN价格计算调整后的gas价格
   */
  private calculatePriceAdjustedGasPrice(priceData: PriceData): bigint {
    const basePrice = ttnPriceMonitor.getBasePrice();
    const currentPrice = priceData.price;
    
    // 计算价格倍数
    const priceMultiplier = currentPrice / basePrice;
    
    // 反向调整：TTN价格越高，gas费率越低
    const adjustmentMultiplier = 1 / Math.pow(priceMultiplier, this.config.adjustmentFactor);
    
    // 计算调整后的gas价格
    const adjustedPrice = Number(this.config.baseGasPrice) * adjustmentMultiplier;
    
    return BigInt(Math.floor(adjustedPrice));
  }

  /**
   * 应用网络拥堵因子
   */
  private applyCongestionFactor(basePrice: bigint, congestionFactor: number): bigint {
    // 拥堵因子范围：0.5 (空闲) 到 3.0 (极度拥堵)
    const clampedCongestion = Math.max(0.5, Math.min(3.0, congestionFactor));
    const adjustedPrice = Number(basePrice) * clampedCongestion;
    
    return BigInt(Math.floor(adjustedPrice));
  }

  /**
   * 应用平滑因子，避免价格剧烈波动
   */
  private applySmoothingFactor(newPrice: bigint): bigint {
    const smoothingFactor = this.config.smoothingFactor;
    const lastPrice = Number(this.lastGasPrice);
    const currentPrice = Number(newPrice);
    
    // 平滑处理：新价格 = 上次价格 * (1-平滑因子) + 新价格 * 平滑因子
    const smoothedPrice = lastPrice * (1 - smoothingFactor) + currentPrice * smoothingFactor;
    
    return BigInt(Math.floor(smoothedPrice));
  }

  /**
   * 确保gas价格在合理范围内
   */
  private enforceGasPriceLimits(price: bigint): bigint {
    if (price < this.config.minGasPrice) {
      return this.config.minGasPrice;
    }
    
    if (price > this.config.maxGasPrice) {
      return this.config.maxGasPrice;
    }
    
    return price;
  }

  /**
   * 获取调整原因说明
   */
  private getAdjustmentReason(priceData: PriceData, congestion: number, priceMultiplier: number): string {
    const reasons: string[] = [];
    
    if (priceMultiplier > 1.1) {
      reasons.push(`TTN升值${((priceMultiplier - 1) * 100).toFixed(1)}%，降低gas费率`);
    } else if (priceMultiplier < 0.9) {
      reasons.push(`TTN下跌${((1 - priceMultiplier) * 100).toFixed(1)}%，提高gas费率`);
    }
    
    if (congestion > 1.5) {
      reasons.push(`网络拥堵${((congestion - 1) * 100).toFixed(0)}%`);
    } else if (congestion < 0.8) {
      reasons.push(`网络空闲，享受低费率`);
    }
    
    return reasons.length > 0 ? reasons.join(', ') : '正常费率';
  }

  /**
   * 获取当前gas价格配置
   */
  public getConfig(): GasPriceConfig {
    return { ...this.config };
  }

  /**
   * 更新gas价格配置
   */
  public updateConfig(newConfig: Partial<GasPriceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 估算交易成本（USD）
   */
  public estimateTransactionCostUSD(gasLimit: bigint, gasPrice?: bigint): number {
    const currentGasPrice = gasPrice || this.lastGasPrice;
    const gasCostWei = gasLimit * currentGasPrice;
    const gasCostTTN = Number(gasCostWei) / 1e18; // 转换为TTN
    
    const priceData = ttnPriceMonitor.getCurrentPrice();
    if (!priceData) return 0;
    
    return gasCostTTN * priceData.price;
  }

  /**
   * 获取推荐的gas价格等级
   */
  public getGasPriceTiers(networkCongestion: number = 1): {
    slow: GasPriceResult;
    standard: GasPriceResult;
    fast: GasPriceResult;
  } {
    const baseResult = this.calculateSmartGasPrice(networkCongestion);
    
    return {
      slow: {
        ...baseResult,
        gasPrice: baseResult.gasPrice * BigInt(80) / BigInt(100), // 80%
        adjustmentReason: `${baseResult.adjustmentReason} (慢速)`
      },
      standard: baseResult,
      fast: {
        ...baseResult,
        gasPrice: baseResult.gasPrice * BigInt(150) / BigInt(100), // 150%
        adjustmentReason: `${baseResult.adjustmentReason} (快速)`
      }
    };
  }

  /**
   * 检查是否需要调整gas价格
   */
  public shouldAdjustGasPrice(): boolean {
    const now = Date.now();
    const timeSinceLastAdjustment = now - this.lastAdjustmentTime;
    
    if (timeSinceLastAdjustment < this.minAdjustmentInterval) {
      return false;
    }
    
    const priceData = ttnPriceMonitor.getCurrentPrice();
    if (!priceData) return false;
    
    const priceMultiplier = ttnPriceMonitor.getPriceMultiplier();
    
    // 如果价格变化超过10%，需要调整
    return Math.abs(priceMultiplier - 1) > 0.1;
  }

  /**
   * 获取gas费优化建议
   */
  public getOptimizationSuggestion(): string {
    const priceData = ttnPriceMonitor.getCurrentPrice();
    if (!priceData) return '价格数据不可用';
    
    const trend = ttnPriceMonitor.getPriceTrend();
    const isStable = ttnPriceMonitor.isPriceStable();
    
    if (trend === 'up' && !isStable) {
      return 'TTN价格上涨中，gas费将自动降低，建议稍后交易以享受更低费率';
    } else if (trend === 'down' && !isStable) {
      return 'TTN价格下跌中，建议尽快完成交易以避免费率上升';
    } else {
      return '价格稳定，当前是交易的好时机';
    }
  }
}

// 全局智能gas引擎实例
export const smartGasEngine = new SmartGasEngine();