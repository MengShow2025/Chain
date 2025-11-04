/**
 * TitanChain完整保证金系统接口定义
 * Complete Margin System Interface for TitanChain
 */

import { MarginAccount, MarginTradingParams, Position, RiskMetrics } from './margin';

// 杠杆参数接口 / Leverage Parameters Interface
export interface LeverageParams {
  userId: string;
  tradingPair: string;
  side: 'long' | 'short';
  quantity: bigint;
  leverage: number;
  orderType: 'market' | 'limit';
  price?: bigint; // 限价单价格 / Limit order price
  stopLoss?: bigint; // 止损价格 / Stop loss price
  takeProfit?: bigint; // 止盈价格 / Take profit price
}

// 持仓结果接口 / Position Result Interface
export interface PositionResult {
  positionId: string;
  orderId: string;
  executedQuantity: bigint;
  executedPrice: bigint;
  fee: bigint;
  timestamp: number;
  success: boolean;
  message?: string;
}

// 平仓结果接口 / Close Position Result Interface
export interface CloseResult {
  positionId: string;
  closedQuantity: bigint;
  closedPrice: bigint;
  pnl: bigint; // 盈亏 / Profit and Loss
  fee: bigint;
  timestamp: number;
  success: boolean;
  message?: string;
}

// 强制平仓结果接口 / Liquidation Result Interface
export interface LiquidationResult {
  userId: string;
  liquidatedPositions: string[];
  totalLoss: bigint;
  liquidationFee: bigint;
  timestamp: number;
  reason: string;
}

// 保证金检查结果接口 / Margin Check Result Interface
export interface MarginCheckResult {
  sufficient: boolean;
  requiredMargin: bigint;
  availableMargin: bigint;
  marginRatio: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// 保证金配置接口 / Margin Configuration Interface
export interface MarginConfig {
  initialMarginRate: number;      // 初始保证金率 / Initial margin rate
  maintenanceMarginRate: number;  // 维持保证金率 / Maintenance margin rate
  maxLeverage: number;            // 最大杠杆倍数 / Maximum leverage
  liquidationThreshold: number;   // 强制平仓阈值 / Liquidation threshold
  marginCallThreshold: number;    // 保证金调用阈值 / Margin call threshold
  liquidationFeeRate: number;     // 强制平仓手续费率 / Liquidation fee rate
}

// TitanChain保证金系统主接口 / Main TitanChain Margin System Interface
export interface TitanMarginSystem {
  // 保证金账户管理 / Margin Account Management
  createMarginAccount(userId: string): Promise<MarginAccount>;
  getMarginAccount(userId: string): Promise<MarginAccount | null>;
  updateMarginAccount(userId: string, updates: Partial<MarginAccount>): Promise<void>;
  
  // 杠杆交易 / Leverage Trading
  openLeveragePosition(params: LeverageParams): Promise<PositionResult>;
  closeLeveragePosition(positionId: string, quantity?: bigint): Promise<CloseResult>;
  getPosition(positionId: string): Promise<Position | null>;
  getUserPositions(userId: string): Promise<Position[]>;
  
  // 风险管理 / Risk Management
  calculateMarginRatio(userId: string): Promise<number>;
  checkLiquidationRisk(userId: string): Promise<boolean>;
  executeLiquidation(userId: string): Promise<LiquidationResult>;
  checkMarginRequirement(params: LeverageParams): Promise<MarginCheckResult>;
  
  // 保证金调用 / Margin Call
  triggerMarginCall(userId: string): Promise<void>;
  getMarginCallUsers(): Promise<string[]>;
  
  // 配置管理 / Configuration Management
  updateMarginConfig(config: Partial<MarginConfig>): Promise<void>;
  getMarginConfig(): Promise<MarginConfig>;
  
  // 价格管理 / Price Management
  updateAssetPrice(asset: string, price: bigint): Promise<void>;
  getAssetPrice(asset: string): Promise<bigint>;
  
  // 统计和监控 / Statistics and Monitoring
  getRiskMetrics(userId: string): Promise<RiskMetrics>;
  getSystemRiskMetrics(): Promise<{
    totalMarginUsed: bigint;
    totalEquity: bigint;
    averageMarginRatio: number;
    usersAtRisk: number;
    liquidationsPending: number;
  }>;
}

// 保证金系统事件接口 / Margin System Events Interface
export interface MarginSystemEvents {
  onMarginCall: (userId: string, marginRatio: number) => void;
  onLiquidation: (userId: string, result: LiquidationResult) => void;
  onPositionOpened: (userId: string, position: Position) => void;
  onPositionClosed: (userId: string, result: CloseResult) => void;
  onRiskLevelChanged: (userId: string, oldLevel: string, newLevel: string) => void;
}

// 导出所有类型 / Export all types
export * from './margin';