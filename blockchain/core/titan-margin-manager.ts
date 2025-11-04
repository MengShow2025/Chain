/**
 * TitanChain增强保证金管理器
 * Enhanced Margin Manager for TitanChain
 */

import { EventEmitter } from 'events';
import {
  TitanMarginSystem,
  LeverageParams,
  PositionResult,
  CloseResult,
  LiquidationResult,
  MarginCheckResult,
  MarginConfig,
  MarginSystemEvents
} from '../../shared/types/titan-margin-system';
import {
  MarginAccount,
  Position,
  RiskMetrics,
  RiskLevel,
  AccountStatus,
  OrderSide,
  OrderType
} from '../../shared/types/margin';

export class TitanMarginManager extends EventEmitter implements TitanMarginSystem {
  private accounts: Map<string, MarginAccount> = new Map();
  private positions: Map<string, Position> = new Map();
  private assetPrices: Map<string, bigint> = new Map();
  private supportedAssets: Set<string> = new Set();
  private positionCounter: number = 0;
  
  private config: MarginConfig = {
    initialMarginRate: 0.1,      // 10% 初始保证金率
    maintenanceMarginRate: 0.05, // 5% 维持保证金率
    maxLeverage: 100,            // 最大100倍杠杆 (增强支持)
    liquidationThreshold: 0.03,  // 3% 强制平仓阈值
    marginCallThreshold: 0.08,   // 8% 保证金调用阈值
    liquidationFeeRate: 0.005    // 0.5% 强制平仓手续费
  };

  // VIP等级配置 / VIP Level Configuration
  private vipConfigs: Map<number, { maxLeverage: number; feeDiscount: number; minStakeAmount: bigint }> = new Map([
    [0, { maxLeverage: 10, feeDiscount: 0, minStakeAmount: BigInt(0) }],           // 普通用户 / Regular user
    [1, { maxLeverage: 20, feeDiscount: 0.1, minStakeAmount: BigInt('1000000000000000000000') }],   // VIP1: $1,000
    [2, { maxLeverage: 50, feeDiscount: 0.2, minStakeAmount: BigInt('10000000000000000000000') }],  // VIP2: $10,000
    [3, { maxLeverage: 100, feeDiscount: 0.3, minStakeAmount: BigInt('100000000000000000000000') }] // VIP3: $100,000
  ]);

  constructor() {
    super();
    this.initializeDefaultAssets();
    this.startRiskMonitoring();
  }

  // 初始化默认资产 / Initialize default assets
  private initializeDefaultAssets(): void {
    const defaultAssets = [
      { symbol: 'TTN', price: BigInt('1000000000000000000') },    // $1.00
      { symbol: 'USDT', price: BigInt('1000000000000000000') },   // $1.00
      { symbol: 'BTC', price: BigInt('50000000000000000000000') }, // $50,000
      { symbol: 'ETH', price: BigInt('3000000000000000000000') }   // $3,000
    ];

    defaultAssets.forEach(asset => {
      this.supportedAssets.add(asset.symbol);
      this.assetPrices.set(asset.symbol, asset.price);
    });
  }

  // 保证金账户管理 / Margin Account Management
  async createMarginAccount(userId: string): Promise<MarginAccount> {
    if (this.accounts.has(userId)) {
      throw new Error(`Margin account already exists for user: ${userId}`);
    }

    const account: MarginAccount = {
      user: userId,
      balances: {},
      frozenBalances: {},
      totalEquity: BigInt(0),
      usedMargin: BigInt(0),
      availableMargin: BigInt(0),
      marginRatio: 0,
      status: AccountStatus.Normal,
      vipLevel: 1,
      lastUpdateTime: Date.now()
    };

    this.accounts.set(userId, account);
    return account;
  }

  async getMarginAccount(userId: string): Promise<MarginAccount | null> {
    return this.accounts.get(userId) || null;
  }

  async updateMarginAccount(userId: string, updates: Partial<MarginAccount>): Promise<void> {
    const account = this.accounts.get(userId);
    if (!account) {
      throw new Error(`Margin account not found for user: ${userId}`);
    }

    Object.assign(account, updates, { lastUpdateTime: Date.now() });
    this.accounts.set(userId, account);
  }

  // 杠杆交易 / Leverage Trading
  async openLeveragePosition(params: LeverageParams): Promise<PositionResult> {
    const account = this.accounts.get(params.userId);
    if (!account) {
      throw new Error(`Account not found: ${params.userId}`);
    }

    // 检查用户最大可用杠杆 / Check user maximum available leverage
    const maxLeverage = await this.getUserMaxLeverage(params.userId, params.tradingPair);
    if (params.leverage > maxLeverage) {
      throw new Error(`Leverage ${params.leverage} exceeds maximum allowed ${maxLeverage} for user VIP level`);
    }

    // 检查保证金要求 / Check margin requirement
    const marginCheck = await this.checkMarginRequirement(params);
    if (!marginCheck.sufficient) {
      throw new Error(`Insufficient margin. Required: ${marginCheck.requiredMargin}, Available: ${marginCheck.availableMargin}`);
    }

    // 获取当前价格 / Get current price
    const [baseAsset] = params.tradingPair.split('/');
    const currentPrice = params.price || this.assetPrices.get(baseAsset) || BigInt(0);
    
    if (currentPrice === BigInt(0)) {
      throw new Error(`Price not available for ${baseAsset}`);
    }

    // 计算所需保证金 / Calculate required margin
    const notionalValue = (params.quantity * currentPrice) / BigInt(10 ** 18);
    const requiredMargin = notionalValue / BigInt(params.leverage);

    // 生成持仓ID / Generate position ID
    this.positionCounter++;
    const positionIdStr = `${params.userId}-${this.positionCounter}`;

    // 创建持仓 / Create position
    const position: Position = {
      id: this.positionCounter,
      user: params.userId,
      tradingPair: params.tradingPair,
      isLong: params.side === 'long',
      quantity: params.quantity,
      avgPrice: currentPrice,
      unrealizedPnl: BigInt(0),
      realizedPnl: BigInt(0),
      margin: requiredMargin,
      leverage: params.leverage,
      liquidationPrice: this.calculateLiquidationPrice(currentPrice, params.leverage, params.side === 'long'),
      openTime: Date.now(),
      isActive: true
    };

    // 存储持仓 / Store position
    this.positions.set(positionIdStr, position);

    // 更新账户保证金 / Update account margin
    account.usedMargin += requiredMargin;
    account.availableMargin -= requiredMargin;
    account.lastUpdateTime = Date.now();

    // 触发事件 / Trigger event
    this.emit('positionOpened', params.userId, position);

    return {
      positionId: positionIdStr,
      orderId: `order-${Date.now()}`,
      executedQuantity: params.quantity,
      executedPrice: currentPrice,
      fee: BigInt(0), // 暂时设为0，后续可以根据VIP等级计算
      timestamp: Date.now(),
      success: true,
      message: 'Position opened successfully'
    };
  }

  async closeLeveragePosition(positionId: string, quantity?: bigint): Promise<CloseResult> {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position not found: ${positionId}`);
    }

    const account = await this.getMarginAccount(position.user);
    if (!account) {
      throw new Error(`Margin account not found for user: ${position.user}`);
    }

    const closeQuantity = quantity || position.quantity;
    const [baseAsset] = position.tradingPair.split('/');
    const currentPrice = this.assetPrices.get(baseAsset) || position.avgPrice;

    // 计算盈亏 / Calculate PnL
    const priceDiff = position.isLong 
      ? currentPrice - position.avgPrice
      : position.avgPrice - currentPrice;
    
    const pnl = (closeQuantity * priceDiff * BigInt(position.leverage)) / BigInt(10 ** 18);
    
    // 计算手续费 / Calculate fee
    const notionalValue = (closeQuantity * currentPrice) / BigInt(10 ** 18);
    const fee = notionalValue * BigInt(25) / BigInt(10000); // 0.25% 手续费

    // 更新持仓 / Update position
    if (closeQuantity >= position.quantity) {
      // 完全平仓 / Full close
      position.isActive = false;
      position.realizedPnl = pnl;
      this.positions.delete(positionId);
    } else {
      // 部分平仓 / Partial close
      position.quantity -= closeQuantity;
      position.realizedPnl += pnl;
    }

    // 释放保证金 / Release margin
    const releasedMargin = (position.margin * closeQuantity) / (position.quantity + closeQuantity);
    account.usedMargin -= releasedMargin;
    account.availableMargin += releasedMargin + pnl - fee;

    await this.updateAccountEquity(position.user);

    const result: CloseResult = {
      positionId,
      closedQuantity: closeQuantity,
      closedPrice: currentPrice,
      pnl,
      fee,
      timestamp: Date.now(),
      success: true
    };

    // 触发事件 / Trigger event
    this.emit('positionClosed', position.user, result);

    return result;
  }

  async getPosition(positionId: string): Promise<Position | null> {
    return this.positions.get(positionId) || null;
  }

  async getUserPositions(userId: string): Promise<Position[]> {
    return Array.from(this.positions.values()).filter(pos => pos.user === userId);
  }

  // 获取用户持仓的Map键 / Get user position map keys
  private getUserPositionKeys(userId: string): string[] {
    const keys: string[] = [];
    for (const [key, position] of this.positions.entries()) {
      if (position.user === userId) {
        keys.push(key);
      }
    }
    return keys;
  }

  // 风险管理 / Risk Management
  async calculateMarginRatio(userId: string): Promise<number> {
    const account = await this.getMarginAccount(userId);
    if (!account || account.totalEquity === BigInt(0)) {
      return 0;
    }

    return Number(account.usedMargin * BigInt(1000000)) / Number(account.totalEquity);
  }

  async checkLiquidationRisk(userId: string): Promise<boolean> {
    const marginRatio = await this.calculateMarginRatio(userId);
    return marginRatio > this.config.liquidationThreshold * 1000000;
  }

  async executeLiquidation(userId: string): Promise<LiquidationResult> {
    const account = await this.getMarginAccount(userId);
    if (!account) {
      throw new Error(`Margin account not found for user: ${userId}`);
    }

    const userPositionKeys = this.getUserPositionKeys(userId);
    const liquidatedPositions: string[] = [];
    let totalLoss = BigInt(0);

    // 强制平仓所有持仓 / Liquidate all positions
    for (const positionKey of userPositionKeys) {
      const position = this.positions.get(positionKey);
      if (position && position.isActive) {
        try {
          const closeResult = await this.closeLeveragePosition(positionKey);
          liquidatedPositions.push(positionKey);
          if (closeResult.pnl < 0) {
            totalLoss += -closeResult.pnl;
          }
        } catch (error) {
          console.error(`Failed to liquidate position ${positionKey}:`, error);
          // 继续处理其他持仓 / Continue with other positions
        }
      }
    }

    const liquidationFee = totalLoss * BigInt(this.config.liquidationFeeRate * 1000) / BigInt(1000);
    if (account.availableMargin >= liquidationFee) {
      account.availableMargin -= liquidationFee;
    } else {
      account.availableMargin = BigInt(0);
    }

    // 更新账户状态为强制平仓 / Update account status to liquidation
    account.status = AccountStatus.Liquidation;
    account.lastUpdateTime = Date.now();

    const result: LiquidationResult = {
      userId,
      liquidatedPositions,
      totalLoss,
      liquidationFee,
      timestamp: Date.now(),
      reason: 'Margin ratio exceeded liquidation threshold'
    };

    // 触发事件 / Trigger event
    this.emit('liquidation', userId, result);

    return result;
  }

  async checkMarginRequirement(params: LeverageParams): Promise<MarginCheckResult> {
    const account = await this.getMarginAccount(params.userId);
    if (!account) {
      throw new Error(`Margin account not found for user: ${params.userId}`);
    }

    const [baseAsset] = params.tradingPair.split('/');
    const price = params.price || this.assetPrices.get(baseAsset) || BigInt(0);
    
    // 计算所需保证金 / Calculate required margin
    const notionalValue = (params.quantity * price) / BigInt(10 ** 18);
    const requiredMargin = notionalValue * BigInt(this.config.initialMarginRate * 1000) / BigInt(1000);

    const sufficient = account.availableMargin >= requiredMargin;
    const marginRatio = await this.calculateMarginRatio(params.userId);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (marginRatio > this.config.liquidationThreshold * 1000000) {
      riskLevel = 'critical';
    } else if (marginRatio > this.config.marginCallThreshold * 1000000) {
      riskLevel = 'high';
    } else if (marginRatio > this.config.initialMarginRate * 1000000) {
      riskLevel = 'medium';
    }

    return {
      sufficient,
      requiredMargin,
      availableMargin: account.availableMargin,
      marginRatio,
      riskLevel
    };
  }

  // 保证金调用 / Margin Call
  async triggerMarginCall(userId: string): Promise<void> {
    const marginRatio = await this.calculateMarginRatio(userId);
    this.emit('marginCall', userId, marginRatio);
  }

  async getMarginCallUsers(): Promise<string[]> {
    const users: string[] = [];
    for (const [userId] of this.accounts) {
      const marginRatio = await this.calculateMarginRatio(userId);
      if (marginRatio > this.config.marginCallThreshold * 1000000) {
        users.push(userId);
      }
    }
    return users;
  }

  // 配置管理 / Configuration Management
  async updateMarginConfig(config: Partial<MarginConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  async getMarginConfig(): Promise<MarginConfig> {
    return { ...this.config };
  }

  // 价格管理 / Price Management
  async updateAssetPrice(asset: string, price: bigint): Promise<void> {
    this.assetPrices.set(asset, price);
    
    // 更新所有相关持仓的未实现盈亏 / Update unrealized PnL for all related positions
    for (const position of this.positions.values()) {
      const [baseAsset] = position.tradingPair.split('/');
      if (baseAsset === asset) {
        // 重新计算未实现盈亏 / Recalculate unrealized PnL
        const priceDiff = position.isLong 
          ? price - position.avgPrice
          : position.avgPrice - price;
        position.unrealizedPnl = (position.quantity * priceDiff * BigInt(position.leverage)) / BigInt(10 ** 18);
      }
    }

    // 更新所有账户权益 / Update all account equity
    for (const [userId] of this.accounts) {
      await this.updateAccountEquity(userId);
    }
  }

  async getAssetPrice(asset: string): Promise<bigint> {
    const price = this.assetPrices.get(asset);
    if (!price) {
      throw new Error(`Price not found for asset: ${asset}`);
    }
    return price;
  }

  // 统计和监控 / Statistics and Monitoring
  async getRiskMetrics(userId: string): Promise<RiskMetrics> {
    const account = await this.getMarginAccount(userId);
    if (!account) {
      throw new Error(`Margin account not found for user: ${userId}`);
    }

    const positions = await this.getUserPositions(userId);
    const totalUnrealizedPnl = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, BigInt(0));
    const marginRatio = await this.calculateMarginRatio(userId);
    const leverage = account.usedMargin > 0 ? Number(account.totalEquity) / Number(account.usedMargin) : 0;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (marginRatio > this.config.liquidationThreshold * 1000000) {
      riskLevel = 'critical';
    } else if (marginRatio > this.config.marginCallThreshold * 1000000) {
      riskLevel = 'high';
    } else if (marginRatio > this.config.initialMarginRate * 1000000) {
      riskLevel = 'medium';
    }

    return {
      user: userId,
      totalEquity: account.totalEquity,
      totalMargin: account.usedMargin,
      marginRatio,
      leverage,
      unrealizedPnl: totalUnrealizedPnl,
      riskLevel,
      marginCallRequired: marginRatio > this.config.marginCallThreshold * 1000000,
      liquidationRisk: marginRatio > this.config.liquidationThreshold * 1000000
    };
  }

  async getSystemRiskMetrics(): Promise<{
    totalMarginUsed: bigint;
    totalEquity: bigint;
    averageMarginRatio: number;
    usersAtRisk: number;
    liquidationsPending: number;
  }> {
    let totalMarginUsed = BigInt(0);
    let totalEquity = BigInt(0);
    let totalMarginRatio = 0;
    let usersAtRisk = 0;
    let liquidationsPending = 0;

    for (const [userId, account] of this.accounts) {
      totalMarginUsed += account.usedMargin;
      totalEquity += account.totalEquity;
      
      const marginRatio = await this.calculateMarginRatio(userId);
      totalMarginRatio += marginRatio;
      
      if (marginRatio > this.config.marginCallThreshold * 1000000) {
        usersAtRisk++;
      }
      
      if (marginRatio > this.config.liquidationThreshold * 1000000) {
        liquidationsPending++;
      }
    }

    return {
      totalMarginUsed,
      totalEquity,
      averageMarginRatio: this.accounts.size > 0 ? totalMarginRatio / this.accounts.size : 0,
      usersAtRisk,
      liquidationsPending
    };
  }

  // 辅助方法 / Helper methods
  async addSupportedAsset(asset: string, initialPrice: bigint): Promise<void> {
    this.supportedAssets.add(asset);
    this.assetPrices.set(asset, initialPrice);
  }

  private calculateLiquidationPrice(entryPrice: bigint, leverage: number, isLong: boolean): bigint {
    // 简化的强制平仓价格计算 / Simplified liquidation price calculation
    const maintenanceMarginRate = BigInt(Math.floor(this.config.maintenanceMarginRate * 1000000));
    const leverageBigInt = BigInt(leverage);
    
    if (isLong) {
      // 做多强制平仓价格 = 开仓价格 * (1 - 1/杠杆 + 维持保证金率)
      return entryPrice * (BigInt(1000000) - BigInt(1000000) / leverageBigInt + maintenanceMarginRate) / BigInt(1000000);
    } else {
      // 做空强制平仓价格 = 开仓价格 * (1 + 1/杠杆 - 维持保证金率)
      return entryPrice * (BigInt(1000000) + BigInt(1000000) / leverageBigInt - maintenanceMarginRate) / BigInt(1000000);
    }
  }

  async depositMargin(userId: string, asset: string, amount: bigint): Promise<void> {
    if (!this.supportedAssets.has(asset)) {
      throw new Error('Asset not supported');
    }

    const account = await this.getMarginAccount(userId);
    if (!account) {
      throw new Error(`Margin account not found for user: ${userId}`);
    }

    account.balances[asset] = (account.balances[asset] || BigInt(0)) + amount;
    await this.updateAccountEquity(userId);
  }

  private async updateAccountEquity(userId: string): Promise<void> {
    const account = this.accounts.get(userId);
    if (!account) return;

    let totalEquity = BigInt(0);

    // 计算余额价值 / Calculate balance value
    for (const [asset, balance] of Object.entries(account.balances)) {
      const price = this.assetPrices.get(asset) || BigInt(0);
      totalEquity += (balance * price) / BigInt(10 ** 18);
    }

    // 更新持仓的未实现盈亏并计算总未实现盈亏 / Update position unrealized PnL and calculate total
    const positions = await this.getUserPositions(userId);
    let totalUnrealizedPnl = BigInt(0);
    
    for (const position of positions) {
      if (position.isActive) {
        // 获取当前价格 / Get current price
        const [baseAsset] = position.tradingPair.split('/');
        const currentPrice = this.assetPrices.get(baseAsset) || position.avgPrice;
        
        // 计算未实现盈亏 / Calculate unrealized PnL
        const priceDiff = position.isLong 
          ? currentPrice - position.avgPrice
          : position.avgPrice - currentPrice;
        
        const unrealizedPnl = (position.quantity * priceDiff * BigInt(position.leverage)) / BigInt(10 ** 18);
        
        // 更新持仓的未实现盈亏 / Update position unrealized PnL
        position.unrealizedPnl = unrealizedPnl;
        totalUnrealizedPnl += unrealizedPnl;
        
        // 更新Map中的持仓 / Update position in map
        const positionKey = `${userId}-${position.id}`;
        this.positions.set(positionKey, position);
      }
    }

    totalEquity += totalUnrealizedPnl;

    account.totalEquity = totalEquity;
    account.availableMargin = totalEquity - account.usedMargin;
    account.marginRatio = totalEquity > 0 ? Number(account.usedMargin * BigInt(1000000)) / Number(totalEquity) : 0;
    account.lastUpdateTime = Date.now();
  }

  private startRiskMonitoring(): void {
    setInterval(async () => {
      try {
        for (const [userId] of this.accounts) {
          const riskMetrics = await this.getRiskMetrics(userId);
          
          if (riskMetrics.liquidationRisk) {
            await this.executeLiquidation(userId);
          } else if (riskMetrics.marginCallRequired) {
            await this.triggerMarginCall(userId);
          }
        }
      } catch (error) {
        console.error('Risk monitoring error:', error);
      }
    }, 30000);
  }

  // VIP等级管理方法 / VIP Level Management Methods
  
  /**
   * 获取用户VIP等级配置 / Get user VIP level configuration
   */
  async getUserVIPConfig(userId: string): Promise<{ maxLeverage: number; feeDiscount: number; minStakeAmount: bigint } | null> {
    const account = await this.getMarginAccount(userId);
    if (!account) return null;
    
    return this.vipConfigs.get(account.vipLevel) || this.vipConfigs.get(0)!;
  }

  /**
   * 更新用户VIP等级 / Update user VIP level
   */
  async updateUserVIPLevel(userId: string, newLevel: number): Promise<void> {
    const account = this.accounts.get(userId);
    if (!account) {
      throw new Error(`Account not found: ${userId}`);
    }

    if (!this.vipConfigs.has(newLevel)) {
      throw new Error(`Invalid VIP level: ${newLevel}`);
    }

    const oldLevel = account.vipLevel;
    account.vipLevel = newLevel;
    account.lastUpdateTime = Date.now();

    // 触发VIP等级更新事件 / Trigger VIP level update event
    this.emit('vipLevelUpdated', {
      userId,
      oldLevel,
      newLevel,
      timestamp: Date.now()
    });
  }

  /**
   * 检查用户是否符合VIP等级要求 / Check if user meets VIP level requirements
   */
  async checkVIPEligibility(userId: string, targetLevel: number): Promise<boolean> {
    const account = await this.getMarginAccount(userId);
    if (!account) return false;

    const vipConfig = this.vipConfigs.get(targetLevel);
    if (!vipConfig) return false;

    // 检查质押金额要求 / Check stake amount requirement
    return account.totalEquity >= vipConfig.minStakeAmount;
  }

  /**
   * 获取用户最大可用杠杆 / Get user maximum available leverage
   */
  async getUserMaxLeverage(userId: string, tradingPair: string): Promise<number> {
    const vipConfig = await this.getUserVIPConfig(userId);
    if (!vipConfig) return 1;

    // 返回VIP等级允许的最大杠杆和系统配置的较小值 / Return the smaller of VIP max leverage and system config
    return Math.min(vipConfig.maxLeverage, this.config.maxLeverage);
  }

  /**
   * 计算用户手续费率（含VIP折扣）/ Calculate user fee rate with VIP discount
   */
  async getUserFeeRate(userId: string, baseFeeRate: number): Promise<number> {
    const vipConfig = await this.getUserVIPConfig(userId);
    if (!vipConfig) return baseFeeRate;

    return baseFeeRate * (1 - vipConfig.feeDiscount);
  }
}