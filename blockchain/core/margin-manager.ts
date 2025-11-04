/**
 * TitanChain保证金管理器
 * TitanChain Margin Manager
 * 
 * 核心功能：
 * - 保证金账户管理 / Margin account management
 * - 杠杆交易处理 / Leverage trading processing
 * - 风险监控和强制平仓 / Risk monitoring and liquidation
 * - VIP等级集成 / VIP level integration
 */

import { EventEmitter } from 'events';
import { 
  MarginAccount, 
  Position, 
  MarginConfig, 
  VIPConfig, 
  LeverageOrder, 
  TradeResult, 
  RiskMetrics, 
  RiskLevel, 
  AccountStatus, 
  OrderSide, 
  OrderType,
  LiquidationResult,
  MarginCallInfo,
  MarginTradingParams
} from '../../shared/types/margin.js';
import { Transaction } from '../../shared/types/blockchain.js';

export class MarginManager extends EventEmitter {
  private marginAccounts: Map<string, MarginAccount> = new Map();
  private positions: Map<string, Map<number, Position>> = new Map();
  private marginConfig: MarginConfig;
  private vipConfigs: Map<number, VIPConfig> = new Map();
  private assetPrices: Map<string, bigint> = new Map();
  private supportedAssets: Set<string> = new Set();
  private positionIdCounter: number = 0;
  
  // 常量 / Constants
  private readonly BASIS_POINTS = 10000;
  private readonly MAX_VIP_LEVEL = 5;
  
  constructor() {
    super();
    
    // 初始化默认配置 / Initialize default configuration
    this.marginConfig = {
      initialMarginRate: 1000,        // 10%
      maintenanceMarginRate: 500,     // 5%
      maxLeverage: 10,                // 10x
      liquidationThreshold: 300,      // 3%
      marginCallThreshold: 700        // 7%
    };
    
    this.initializeVIPConfigs();
    this.startRiskMonitoring();
  }
  
  /**
   * 初始化VIP等级配置 / Initialize VIP level configurations
   */
  private initializeVIPConfigs(): void {
    const configs = [
      { level: 0, minStakeAmount: BigInt(0), maxLeverage: 5, feeDiscount: 0, name: 'Regular' },
      { level: 1, minStakeAmount: BigInt('10000000000000000000000'), maxLeverage: 10, feeDiscount: 500, name: 'Bronze' },
      { level: 2, minStakeAmount: BigInt('50000000000000000000000'), maxLeverage: 20, feeDiscount: 1000, name: 'Silver' },
      { level: 3, minStakeAmount: BigInt('100000000000000000000000'), maxLeverage: 50, feeDiscount: 1500, name: 'Gold' },
      { level: 4, minStakeAmount: BigInt('500000000000000000000000'), maxLeverage: 75, feeDiscount: 2000, name: 'Platinum' },
      { level: 5, minStakeAmount: BigInt('1000000000000000000000000'), maxLeverage: 100, feeDiscount: 2500, name: 'Diamond' }
    ];
    
    configs.forEach(config => {
      this.vipConfigs.set(config.level, config);
    });
  }
  
  /**
   * 创建保证金账户 / Create margin account
   */
  async createMarginAccount(user: string, stakedAmount: bigint): Promise<MarginAccount> {
    if (this.marginAccounts.has(user)) {
      throw new Error('Margin account already exists');
    }
    
    const vipLevel = this.calculateVIPLevel(stakedAmount);
    
    const account: MarginAccount = {
      user,
      balances: {},
      frozenBalances: {},
      totalEquity: BigInt(0),
      usedMargin: BigInt(0),
      availableMargin: BigInt(0),
      marginRatio: 0,
      status: AccountStatus.Normal,
      vipLevel,
      lastUpdateTime: Date.now()
    };
    
    this.marginAccounts.set(user, account);
    this.positions.set(user, new Map());
    
    this.emit('accountCreated', { user, vipLevel });
    
    return account;
  }
  
  /**
   * 计算VIP等级 / Calculate VIP level
   */
  private calculateVIPLevel(stakedAmount: bigint): number {
    for (let level = this.MAX_VIP_LEVEL; level > 0; level--) {
      const config = this.vipConfigs.get(level);
      if (config && stakedAmount >= config.minStakeAmount) {
        return level;
      }
    }
    return 0;
  }
  
  /**
   * 存入保证金 / Deposit margin
   */
  async depositMargin(user: string, asset: string, amount: bigint): Promise<void> {
    if (!this.supportedAssets.has(asset)) {
      throw new Error('Asset not supported');
    }
    
    const account = this.marginAccounts.get(user);
    if (!account) {
      throw new Error('Margin account not found');
    }
    
    // 更新余额 / Update balance
    const currentBalance = account.balances[asset] || BigInt(0);
    account.balances[asset] = currentBalance + amount;
    
    // 重新计算权益 / Recalculate equity
    await this.updateAccountEquity(user);
    
    this.emit('marginDeposited', { user, asset, amount });
  }
  
  /**
   * 提取保证金 / Withdraw margin
   */
  async withdrawMargin(user: string, asset: string, amount: bigint): Promise<void> {
    const account = this.marginAccounts.get(user);
    if (!account) {
      throw new Error('Margin account not found');
    }
    
    const currentBalance = account.balances[asset] || BigInt(0);
    if (currentBalance < amount) {
      throw new Error('Insufficient balance');
    }
    
    // 检查提取后的可用保证金 / Check available margin after withdrawal
    const assetPrice = this.assetPrices.get(asset) || BigInt(0);
    const withdrawValue = amount * assetPrice / BigInt(10**18);
    
    if (account.availableMargin < withdrawValue) {
      throw new Error('Insufficient available margin');
    }
    
    // 更新余额 / Update balance
    account.balances[asset] = currentBalance - amount;
    
    // 重新计算权益 / Recalculate equity
    await this.updateAccountEquity(user);
    
    this.emit('marginWithdrawn', { user, asset, amount });
  }
  
  /**
   * 开仓 / Open position
   */
  async openPosition(user: string, params: MarginTradingParams): Promise<TradeResult> {
    const account = this.marginAccounts.get(user);
    if (!account) {
      throw new Error('Margin account not found');
    }
    
    if (account.status !== AccountStatus.Normal) {
      throw new Error('Account not in normal status');
    }
    
    // 检查杠杆倍数限制 / Check leverage limits
    const vipConfig = this.vipConfigs.get(account.vipLevel);
    if (!vipConfig || params.leverage > vipConfig.maxLeverage) {
      throw new Error('Leverage exceeds limit');
    }
    
    // 计算所需保证金 / Calculate required margin
    const price = params.price || this.assetPrices.get(params.tradingPair) || BigInt(0);
    const positionValue = params.quantity * price / BigInt(10**18);
    const requiredMargin = positionValue * BigInt(this.marginConfig.initialMarginRate) / BigInt(this.BASIS_POINTS) / BigInt(params.leverage);
    
    if (account.availableMargin < requiredMargin) {
      throw new Error('Insufficient margin');
    }
    
    // 创建持仓 / Create position
    const positionId = this.positionIdCounter++;
    const liquidationPrice = this.calculateLiquidationPrice(price, params.side === OrderSide.Buy, params.leverage);
    
    const position: Position = {
      id: positionId,
      user,
      tradingPair: params.tradingPair,
      isLong: params.side === OrderSide.Buy,
      quantity: params.quantity,
      avgPrice: price,
      unrealizedPnl: BigInt(0),
      realizedPnl: BigInt(0),
      margin: requiredMargin,
      leverage: params.leverage,
      liquidationPrice,
      openTime: Date.now(),
      isActive: true
    };
    
    // 更新账户 / Update account
    account.usedMargin += requiredMargin;
    account.availableMargin -= requiredMargin;
    
    // 保存持仓 / Save position
    const userPositions = this.positions.get(user) || new Map();
    userPositions.set(positionId, position);
    this.positions.set(user, userPositions);
    
    const result: TradeResult = {
      orderId: `${user}-${positionId}`,
      positionId,
      executedQuantity: params.quantity,
      executedPrice: price,
      fee: this.calculateTradingFee(positionValue, account.vipLevel),
      timestamp: Date.now(),
      success: true
    };
    
    this.emit('positionOpened', { user, positionId, position });
    
    return result;
  }
  
  /**
   * 平仓 / Close position
   */
  async closePosition(user: string, positionId: number, currentPrice?: bigint): Promise<TradeResult> {
    const userPositions = this.positions.get(user);
    if (!userPositions) {
      throw new Error('No positions found for user');
    }
    
    const position = userPositions.get(positionId);
    if (!position || !position.isActive) {
      throw new Error('Position not found or not active');
    }
    
    const account = this.marginAccounts.get(user);
    if (!account) {
      throw new Error('Margin account not found');
    }
    
    // 使用当前价格或市场价格 / Use current price or market price
    const closePrice = currentPrice || this.assetPrices.get(position.tradingPair) || position.avgPrice;
    
    // 计算盈亏 / Calculate PnL
    const pnl = this.calculatePnL(position, closePrice);
    
    // 更新账户 / Update account
    account.usedMargin -= position.margin;
    
    // 处理盈亏 / Handle PnL
    if (pnl > 0) {
      account.availableMargin += position.margin + BigInt(pnl);
    } else {
      const loss = BigInt(-pnl);
      if (loss < position.margin) {
        account.availableMargin += position.margin - loss;
      }
      // 如果亏损超过保证金，保证金归零 / If loss exceeds margin, margin becomes zero
    }
    
    // 关闭持仓 / Close position
    position.isActive = false;
    position.closeTime = Date.now();
    position.realizedPnl = BigInt(pnl);
    
    const fee = this.calculateTradingFee(position.quantity * closePrice / BigInt(10**18), account.vipLevel);
    
    const result: TradeResult = {
      orderId: `${user}-${positionId}-close`,
      positionId,
      executedQuantity: position.quantity,
      executedPrice: closePrice,
      fee,
      timestamp: Date.now(),
      success: true
    };
    
    this.emit('positionClosed', { user, positionId, pnl });
    
    return result;
  }
  
  /**
   * 计算强制平仓价格 / Calculate liquidation price
   */
  private calculateLiquidationPrice(entryPrice: bigint, isLong: boolean, leverage: number): bigint {
    const liquidationRate = BigInt(this.marginConfig.liquidationThreshold);
    const priceChange = entryPrice * liquidationRate / BigInt(this.BASIS_POINTS) / BigInt(leverage);
    
    if (isLong) {
      return entryPrice > priceChange ? entryPrice - priceChange : BigInt(0);
    } else {
      return entryPrice + priceChange;
    }
  }
  
  /**
   * 计算盈亏 / Calculate PnL
   */
  private calculatePnL(position: Position, currentPrice: bigint): number {
    const priceDiff = position.isLong 
      ? Number(currentPrice - position.avgPrice)
      : Number(position.avgPrice - currentPrice);
    
    return priceDiff * Number(position.quantity) / (10**18);
  }
  
  /**
   * 计算交易手续费 / Calculate trading fee
   */
  private calculateTradingFee(positionValue: bigint, vipLevel: number): bigint {
    const vipConfig = this.vipConfigs.get(vipLevel);
    const baseFee = positionValue * BigInt(30) / BigInt(this.BASIS_POINTS); // 0.3% base fee
    
    if (vipConfig && vipConfig.feeDiscount > 0) {
      const discount = BigInt(vipConfig.feeDiscount);
      return baseFee * (BigInt(this.BASIS_POINTS) - discount) / BigInt(this.BASIS_POINTS);
    }
    
    return baseFee;
  }
  
  /**
   * 更新账户权益 / Update account equity
   */
  private async updateAccountEquity(user: string): Promise<void> {
    const account = this.marginAccounts.get(user);
    if (!account) return;
    
    let totalValue = BigInt(0);
    
    // 计算所有资产价值 / Calculate total asset value
    for (const [asset, balance] of Object.entries(account.balances)) {
      const price = this.assetPrices.get(asset) || BigInt(0);
      totalValue += BigInt(balance) * price / BigInt(10**18);
    }
    
    // 计算未实现盈亏 / Calculate unrealized PnL
    const userPositions = this.positions.get(user);
    if (userPositions) {
      for (const position of Array.from(userPositions.values())) {
        if (position.isActive) {
          const currentPrice = this.assetPrices.get(position.tradingPair) || position.avgPrice;
          const pnl = this.calculatePnL(position, currentPrice);
          totalValue += BigInt(pnl);
          position.unrealizedPnl = BigInt(pnl);
        }
      }
    }
    
    account.totalEquity = totalValue;
    account.availableMargin = totalValue > account.usedMargin ? totalValue - account.usedMargin : BigInt(0);
    
    // 计算保证金率 / Calculate margin ratio
    if (account.usedMargin > 0) {
      account.marginRatio = Number(account.totalEquity * BigInt(this.BASIS_POINTS) / account.usedMargin);
    } else {
      account.marginRatio = this.BASIS_POINTS; // 100%
    }
    
    account.lastUpdateTime = Date.now();
  }
  
  /**
   * 检查风险并执行强制平仓 / Check risk and execute liquidation
   */
  async checkAndExecuteLiquidation(user: string): Promise<LiquidationResult[]> {
    const account = this.marginAccounts.get(user);
    if (!account) return [];
    
    await this.updateAccountEquity(user);
    
    const results: LiquidationResult[] = [];
    
    // 检查是否需要强制平仓 / Check if liquidation is needed
    if (account.marginRatio < this.marginConfig.liquidationThreshold) {
      account.status = AccountStatus.Liquidation;
      
      const userPositions = this.positions.get(user);
      if (userPositions) {
        for (const [positionId, position] of Array.from(userPositions.entries())) {
          if (position.isActive) {
            // 执行强制平仓 / Execute liquidation
            const currentPrice = this.assetPrices.get(position.tradingPair) || position.avgPrice;
            
            position.isActive = false;
            position.closeTime = Date.now();
            
            const result: LiquidationResult = {
              positionId,
              user,
              liquidationPrice: currentPrice,
              liquidatedQuantity: position.quantity,
              remainingMargin: BigInt(0), // 强制平仓通常没有剩余保证金
              penalty: position.margin * BigInt(50) / BigInt(this.BASIS_POINTS), // 0.5% penalty
              timestamp: Date.now()
            };
            
            results.push(result);
            this.emit('liquidationExecuted', result);
          }
        }
      }
    }
    
    return results;
  }
  
  /**
   * 检查保证金调用 / Check margin call
   */
  async checkMarginCall(user: string): Promise<MarginCallInfo | null> {
    const account = this.marginAccounts.get(user);
    if (!account) return null;
    
    await this.updateAccountEquity(user);
    
    if (account.marginRatio < this.marginConfig.marginCallThreshold && 
        account.marginRatio >= this.marginConfig.liquidationThreshold) {
      
      account.status = AccountStatus.MarginCall;
      
      const additionalMarginRequired = account.usedMargin * BigInt(this.marginConfig.maintenanceMarginRate) / BigInt(this.BASIS_POINTS) - account.totalEquity;
      
      const userPositions = this.positions.get(user);
      const activePositions = userPositions ? Array.from(userPositions.values()).filter(p => p.isActive) : [];
      
      const marginCallInfo: MarginCallInfo = {
        user,
        currentMarginRatio: account.marginRatio,
        requiredMarginRatio: this.marginConfig.maintenanceMarginRate,
        additionalMarginRequired: additionalMarginRequired > 0 ? additionalMarginRequired : BigInt(0),
        deadline: Date.now() + 24 * 60 * 60 * 1000, // 24小时后
        positions: activePositions
      };
      
      this.emit('marginCallTriggered', marginCallInfo);
      
      return marginCallInfo;
    }
    
    return null;
  }
  
  /**
   * 获取风险指标 / Get risk metrics
   */
  async getRiskMetrics(user: string): Promise<RiskMetrics | null> {
    const account = this.marginAccounts.get(user);
    if (!account) return null;
    
    await this.updateAccountEquity(user);
    
    // 计算总杠杆倍数 / Calculate total leverage
    let totalLeverage = 0;
    let totalUnrealizedPnl = BigInt(0);
    
    const userPositions = this.positions.get(user);
    if (userPositions) {
      let totalPositionValue = BigInt(0);
      for (const position of Array.from(userPositions.values())) {
        if (position.isActive) {
          const positionValue = (position.quantity * position.avgPrice) / BigInt(10**18);
          totalPositionValue += positionValue;
          totalUnrealizedPnl += position.unrealizedPnl;
        }
      }
      
      if (account.totalEquity > 0) {
        totalLeverage = Number(totalPositionValue * BigInt(100) / account.totalEquity) / 100;
      }
    }
    
    // 确定风险等级 / Determine risk level
    let riskLevel: RiskLevel;
    if (account.marginRatio >= this.marginConfig.marginCallThreshold) {
      riskLevel = RiskLevel.Low;
    } else if (account.marginRatio >= this.marginConfig.liquidationThreshold) {
      riskLevel = RiskLevel.Medium;
    } else if (account.marginRatio >= this.marginConfig.liquidationThreshold * 0.5) {
      riskLevel = RiskLevel.High;
    } else {
      riskLevel = RiskLevel.Critical;
    }
    
    return {
      user,
      totalEquity: account.totalEquity,
      totalMargin: account.usedMargin,
      marginRatio: account.marginRatio,
      leverage: totalLeverage,
      unrealizedPnl: totalUnrealizedPnl,
      riskLevel,
      marginCallRequired: account.marginRatio < this.marginConfig.marginCallThreshold,
      liquidationRisk: account.marginRatio < this.marginConfig.liquidationThreshold
    };
  }
  
  /**
   * 启动风险监控 / Start risk monitoring
   */
  private startRiskMonitoring(): void {
    setInterval(async () => {
      for (const user of Array.from(this.marginAccounts.keys())) {
        try {
          // 检查保证金调用 / Check margin call
          await this.checkMarginCall(user);
          
          // 检查强制平仓 / Check liquidation
          await this.checkAndExecuteLiquidation(user);
        } catch (error) {
          console.error(`Risk monitoring error for user ${user}:`, error);
        }
      }
    }, 30000); // 每30秒检查一次 / Check every 30 seconds
  }
  
  /**
   * 更新资产价格 / Update asset price
   */
  updateAssetPrice(asset: string, price: bigint): void {
    this.assetPrices.set(asset, price);
    this.emit('assetPriceUpdated', { asset, price });
  }
  
  /**
   * 添加支持的资产 / Add supported asset
   */
  addSupportedAsset(asset: string, initialPrice: bigint): void {
    this.supportedAssets.add(asset);
    this.assetPrices.set(asset, initialPrice);
  }
  
  /**
   * 更新VIP等级 / Update VIP level
   */
  async updateVIPLevel(user: string, stakedAmount: bigint): Promise<void> {
    const account = this.marginAccounts.get(user);
    if (!account) return;
    
    const oldLevel = account.vipLevel;
    const newLevel = this.calculateVIPLevel(stakedAmount);
    
    if (oldLevel !== newLevel) {
      account.vipLevel = newLevel;
      this.emit('vipLevelUpdated', { user, oldLevel, newLevel });
    }
  }
  
  // 查询方法 / Query methods
  
  getMarginAccount(user: string): MarginAccount | undefined {
    return this.marginAccounts.get(user);
  }
  
  getPosition(user: string, positionId: number): Position | undefined {
    const userPositions = this.positions.get(user);
    return userPositions?.get(positionId);
  }
  
  getUserPositions(user: string): Position[] {
    const userPositions = this.positions.get(user);
    return userPositions ? Array.from(userPositions.values()) : [];
  }
  
  getActivePositions(user: string): Position[] {
    return this.getUserPositions(user).filter(p => p.isActive);
  }
  
  getVIPConfig(level: number): VIPConfig | undefined {
    return this.vipConfigs.get(level);
  }
  
  getMarginConfig(): MarginConfig {
    return { ...this.marginConfig };
  }
  
  getSupportedAssets(): string[] {
    return Array.from(this.supportedAssets);
  }
  
  getAssetPrice(asset: string): bigint | undefined {
    return this.assetPrices.get(asset);
  }
}