/**
 * TitanChain保证金交易系统类型定义
 * TitanChain Margin Trading System Type Definitions
 */

// 保证金配置 / Margin Configuration
export interface MarginConfig {
  initialMarginRate: number;      // 初始保证金率 (basis points) / Initial margin rate
  maintenanceMarginRate: number;  // 维持保证金率 (basis points) / Maintenance margin rate
  maxLeverage: number;            // 最大杠杆倍数 / Maximum leverage
  liquidationThreshold: number;   // 强制平仓阈值 (basis points) / Liquidation threshold
  marginCallThreshold: number;    // 保证金调用阈值 (basis points) / Margin call threshold
}

// VIP等级配置 / VIP Level Configuration
export interface VIPConfig {
  level: number;                  // VIP等级 / VIP level
  minStakeAmount: bigint;         // 最小质押量 / Minimum stake amount
  maxLeverage: number;            // 最大杠杆倍数 / Maximum leverage
  feeDiscount: number;            // 手续费折扣 (basis points) / Fee discount
  name: string;                   // 等级名称 / Level name
}

// 保证金账户 / Margin Account
export interface MarginAccount {
  user: string;                   // 用户地址 / User address
  balances: Record<string, bigint>; // 资产余额 / Asset balances
  frozenBalances: Record<string, bigint>; // 冻结余额 / Frozen balances
  totalEquity: bigint;            // 总权益 / Total equity
  usedMargin: bigint;             // 已用保证金 / Used margin
  availableMargin: bigint;        // 可用保证金 / Available margin
  marginRatio: number;            // 保证金率 / Margin ratio
  status: AccountStatus;          // 账户状态 / Account status
  vipLevel: number;               // VIP等级 / VIP level
  lastUpdateTime: number;         // 最后更新时间 / Last update time
}

// 杠杆持仓 / Leverage Position
export interface Position {
  id: number;                     // 持仓ID / Position ID
  user: string;                   // 用户地址 / User address
  tradingPair: string;            // 交易对 / Trading pair
  isLong: boolean;                // 是否做多 / Is long position
  quantity: bigint;               // 持仓数量 / Position quantity
  avgPrice: bigint;               // 平均开仓价格 / Average entry price
  unrealizedPnl: bigint;          // 未实现盈亏 / Unrealized PnL
  realizedPnl: bigint;            // 已实现盈亏 / Realized PnL
  margin: bigint;                 // 保证金 / Margin
  leverage: number;               // 杠杆倍数 / Leverage
  liquidationPrice: bigint;       // 强制平仓价格 / Liquidation price
  openTime: number;               // 开仓时间 / Open time
  closeTime?: number;             // 平仓时间 / Close time
  isActive: boolean;              // 是否活跃 / Is active
}

// 账户状态枚举 / Account Status Enum
export enum AccountStatus {
  Normal = 0,         // 正常 / Normal
  MarginCall = 1,     // 保证金调用 / Margin call
  Liquidation = 2     // 强制平仓 / Liquidation
}

// 订单类型 / Order Type
export enum OrderType {
  Market = 'market',      // 市价单 / Market order
  Limit = 'limit',        // 限价单 / Limit order
  Stop = 'stop',          // 止损单 / Stop order
  StopLimit = 'stop_limit' // 止损限价单 / Stop limit order
}

// 订单方向 / Order Side
export enum OrderSide {
  Buy = 'buy',           // 买入 / Buy
  Sell = 'sell'          // 卖出 / Sell
}

// 杠杆交易订单 / Leverage Trading Order
export interface LeverageOrder {
  id: string;                     // 订单ID / Order ID
  user: string;                   // 用户地址 / User address
  tradingPair: string;            // 交易对 / Trading pair
  type: OrderType;                // 订单类型 / Order type
  side: OrderSide;                // 订单方向 / Order side
  quantity: bigint;               // 数量 / Quantity
  price?: bigint;                 // 价格 (限价单) / Price (for limit orders)
  stopPrice?: bigint;             // 止损价格 / Stop price
  leverage: number;               // 杠杆倍数 / Leverage
  marginRequired: bigint;         // 所需保证金 / Required margin
  timeInForce: TimeInForce;       // 有效期类型 / Time in force
  createTime: number;             // 创建时间 / Create time
  status: OrderStatus;            // 订单状态 / Order status
}

// 订单有效期类型 / Time In Force
export enum TimeInForce {
  GTC = 'GTC',  // Good Till Cancelled - 撤销前有效
  IOC = 'IOC',  // Immediate Or Cancel - 立即成交或撤销
  FOK = 'FOK'   // Fill Or Kill - 全部成交或撤销
}

// 订单状态 / Order Status
export enum OrderStatus {
  Pending = 'pending',           // 待处理 / Pending
  PartiallyFilled = 'partially_filled', // 部分成交 / Partially filled
  Filled = 'filled',             // 已成交 / Filled
  Cancelled = 'cancelled',       // 已撤销 / Cancelled
  Rejected = 'rejected'          // 已拒绝 / Rejected
}

// 交易结果 / Trade Result
export interface TradeResult {
  orderId: string;                // 订单ID / Order ID
  positionId?: number;            // 持仓ID / Position ID
  executedQuantity: bigint;       // 成交数量 / Executed quantity
  executedPrice: bigint;          // 成交价格 / Executed price
  fee: bigint;                    // 手续费 / Fee
  timestamp: number;              // 时间戳 / Timestamp
  success: boolean;               // 是否成功 / Success
  error?: string;                 // 错误信息 / Error message
}

// 强制平仓结果 / Liquidation Result
export interface LiquidationResult {
  positionId: number;             // 持仓ID / Position ID
  user: string;                   // 用户地址 / User address
  liquidationPrice: bigint;       // 强制平仓价格 / Liquidation price
  liquidatedQuantity: bigint;     // 强制平仓数量 / Liquidated quantity
  remainingMargin: bigint;        // 剩余保证金 / Remaining margin
  penalty: bigint;                // 罚金 / Penalty
  timestamp: number;              // 时间戳 / Timestamp
}

// 风险指标 / Risk Metrics
export interface RiskMetrics {
  user: string;                   // 用户地址 / User address
  totalEquity: bigint;            // 总权益 / Total equity
  totalMargin: bigint;            // 总保证金 / Total margin
  marginRatio: number;            // 保证金率 / Margin ratio
  leverage: number;               // 总杠杆倍数 / Total leverage
  unrealizedPnl: bigint;          // 未实现盈亏 / Unrealized PnL
  riskLevel: RiskLevel;           // 风险等级 / Risk level
  marginCallRequired: boolean;    // 是否需要保证金调用 / Margin call required
  liquidationRisk: boolean;       // 是否有强制平仓风险 / Liquidation risk
}

// 风险等级 / Risk Level
export enum RiskLevel {
  Low = 'low',           // 低风险 / Low risk
  Medium = 'medium',     // 中等风险 / Medium risk
  High = 'high',         // 高风险 / High risk
  Critical = 'critical'  // 极高风险 / Critical risk
}

// 保证金交易参数 / Margin Trading Parameters
export interface MarginTradingParams {
  tradingPair: string;            // 交易对 / Trading pair
  side: OrderSide;                // 交易方向 / Trading side
  quantity: bigint;               // 数量 / Quantity
  price?: bigint;                 // 价格 / Price
  leverage: number;               // 杠杆倍数 / Leverage
  orderType: OrderType;           // 订单类型 / Order type
  timeInForce: TimeInForce;       // 有效期类型 / Time in force
  stopPrice?: bigint;             // 止损价格 / Stop price
  reduceOnly?: boolean;           // 仅减仓 / Reduce only
}

// 保证金调用信息 / Margin Call Information
export interface MarginCallInfo {
  user: string;                   // 用户地址 / User address
  currentMarginRatio: number;     // 当前保证金率 / Current margin ratio
  requiredMarginRatio: number;    // 要求保证金率 / Required margin ratio
  additionalMarginRequired: bigint; // 需要追加的保证金 / Additional margin required
  deadline: number;               // 追加保证金截止时间 / Deadline for additional margin
  positions: Position[];          // 相关持仓 / Related positions
}

// 交易对配置 / Trading Pair Configuration
export interface TradingPairConfig {
  pair: string;                   // 交易对 / Trading pair
  baseAsset: string;              // 基础资产 / Base asset
  quoteAsset: string;             // 计价资产 / Quote asset
  minQuantity: bigint;            // 最小交易数量 / Minimum quantity
  maxQuantity: bigint;            // 最大交易数量 / Maximum quantity
  tickSize: bigint;               // 价格精度 / Tick size
  maxLeverage: number;            // 最大杠杆倍数 / Maximum leverage
  maintenanceMarginRate: number;  // 维持保证金率 / Maintenance margin rate
  makerFee: number;               // 挂单手续费 / Maker fee
  takerFee: number;               // 吃单手续费 / Taker fee
  isActive: boolean;              // 是否活跃 / Is active
}

// 市场数据 / Market Data
export interface MarketData {
  tradingPair: string;            // 交易对 / Trading pair
  lastPrice: bigint;              // 最新价格 / Last price
  priceChange24h: bigint;         // 24小时价格变化 / 24h price change
  priceChangePercent24h: number;  // 24小时价格变化百分比 / 24h price change percent
  high24h: bigint;                // 24小时最高价 / 24h high
  low24h: bigint;                 // 24小时最低价 / 24h low
  volume24h: bigint;              // 24小时交易量 / 24h volume
  openInterest: bigint;           // 持仓量 / Open interest
  fundingRate: number;            // 资金费率 / Funding rate
  nextFundingTime: number;        // 下次资金费用时间 / Next funding time
  timestamp: number;              // 时间戳 / Timestamp
}

// API响应类型 / API Response Types
export interface ApiResponse<T> {
  success: boolean;               // 是否成功 / Success
  data?: T;                       // 数据 / Data
  error?: string;                 // 错误信息 / Error message
  code?: number;                  // 错误代码 / Error code
}

// 分页参数 / Pagination Parameters
export interface PaginationParams {
  page: number;                   // 页码 / Page number
  limit: number;                  // 每页数量 / Items per page
  sortBy?: string;                // 排序字段 / Sort by field
  sortOrder?: 'asc' | 'desc';     // 排序方向 / Sort order
}

// 分页响应 / Paginated Response
export interface PaginatedResponse<T> {
  items: T[];                     // 数据项 / Data items
  total: number;                  // 总数 / Total count
  page: number;                   // 当前页 / Current page
  limit: number;                  // 每页数量 / Items per page
  totalPages: number;             // 总页数 / Total pages
}

// 事件类型 / Event Types
export interface MarginEvent {
  type: MarginEventType;          // 事件类型 / Event type
  user: string;                   // 用户地址 / User address
  data: any;                      // 事件数据 / Event data
  timestamp: number;              // 时间戳 / Timestamp
  blockNumber: number;            // 区块号 / Block number
  transactionHash: string;        // 交易哈希 / Transaction hash
}

// 保证金事件类型 / Margin Event Types
export enum MarginEventType {
  AccountCreated = 'account_created',
  MarginDeposited = 'margin_deposited',
  MarginWithdrawn = 'margin_withdrawn',
  PositionOpened = 'position_opened',
  PositionClosed = 'position_closed',
  MarginCallTriggered = 'margin_call_triggered',
  LiquidationExecuted = 'liquidation_executed',
  VIPLevelUpdated = 'vip_level_updated'
}

// 统计数据 / Statistics
export interface MarginStatistics {
  totalAccounts: number;          // 总账户数 / Total accounts
  totalActivePositions: number;   // 总活跃持仓数 / Total active positions
  totalMarginDeposited: bigint;   // 总保证金存入 / Total margin deposited
  totalTradingVolume24h: bigint;  // 24小时交易量 / 24h trading volume
  totalOpenInterest: bigint;      // 总持仓量 / Total open interest
  averageLeverage: number;        // 平均杠杆倍数 / Average leverage
  liquidationCount24h: number;    // 24小时强制平仓次数 / 24h liquidation count
  topTradingPairs: string[];      // 热门交易对 / Top trading pairs
}