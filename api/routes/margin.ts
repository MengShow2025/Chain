/**
 * TitanChain保证金管理API路由
 * TitanChain Margin Management API Routes
 * 
 * 提供保证金交易相关的RESTful API接口
 * Provides RESTful API interfaces for margin trading
 */

import * as express from 'express';
import { MarginManager } from '../../blockchain/core/margin-manager';
import { 
  MarginTradingParams, 
  OrderSide, 
  OrderType, 
  TimeInForce,
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  MarginAccount,
  Position,
  RiskMetrics,
  MarginCallInfo,
  TradeResult,
  LiquidationResult
} from '../../shared/types/margin';

const router = express.Router();
const marginManager = new MarginManager();

// 中间件：验证用户身份 / Middleware: Verify user identity
const authenticateUser = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
      message: '需要用户ID / User ID required'
    } as ApiResponse<null>);
  }
  req.userId = userId;
  next();
};

// 中间件：验证请求参数 / Middleware: Validate request parameters
const validatePagination = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      error: 'Invalid pagination parameters',
      message: '无效的分页参数 / Invalid pagination parameters'
    } as ApiResponse<null>);
  }
  
  req.pagination = { page, limit, offset: (page - 1) * limit };
  next();
};

/**
 * 创建保证金账户 / Create margin account
 * POST /api/margin/account
 */
router.post('/account', authenticateUser, async (req, res) => {
  try {
    const { stakedAmount } = req.body;
    
    if (!stakedAmount || BigInt(stakedAmount) < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid staked amount',
        message: '无效的质押金额 / Invalid staked amount'
      } as ApiResponse<null>);
    }
    
    const account = await marginManager.createMarginAccount(req.userId, BigInt(stakedAmount));
    
    res.json({
      success: true,
      data: account,
      message: '保证金账户创建成功 / Margin account created successfully'
    } as ApiResponse<MarginAccount>);
    
  } catch (error) {
    console.error('Create margin account error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '创建保证金账户失败 / Failed to create margin account'
    } as ApiResponse<null>);
  }
});

/**
 * 获取保证金账户信息 / Get margin account info
 * GET /api/margin/account
 */
router.get('/account', authenticateUser, async (req, res) => {
  try {
    const account = marginManager.getMarginAccount(req.userId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Margin account not found',
        message: '保证金账户不存在 / Margin account not found'
      } as ApiResponse<null>);
    }
    
    res.json({
      success: true,
      data: account,
      message: '获取账户信息成功 / Account info retrieved successfully'
    } as ApiResponse<MarginAccount>);
    
  } catch (error) {
    console.error('Get margin account error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '获取账户信息失败 / Failed to get account info'
    } as ApiResponse<null>);
  }
});

/**
 * 存入保证金 / Deposit margin
 * POST /api/margin/deposit
 */
router.post('/deposit', authenticateUser, async (req, res) => {
  try {
    const { asset, amount } = req.body;
    
    if (!asset || !amount || BigInt(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deposit parameters',
        message: '无效的存款参数 / Invalid deposit parameters'
      } as ApiResponse<null>);
    }
    
    await marginManager.depositMargin(req.userId, asset, BigInt(amount));
    
    res.json({
      success: true,
      data: null,
      message: '保证金存入成功 / Margin deposited successfully'
    } as ApiResponse<null>);
    
  } catch (error) {
    console.error('Deposit margin error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '存入保证金失败 / Failed to deposit margin'
    } as ApiResponse<null>);
  }
});

/**
 * 提取保证金 / Withdraw margin
 * POST /api/margin/withdraw
 */
router.post('/withdraw', authenticateUser, async (req, res) => {
  try {
    const { asset, amount } = req.body;
    
    if (!asset || !amount || BigInt(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal parameters',
        message: '无效的提取参数 / Invalid withdrawal parameters'
      } as ApiResponse<null>);
    }
    
    await marginManager.withdrawMargin(req.userId, asset, BigInt(amount));
    
    res.json({
      success: true,
      data: null,
      message: '保证金提取成功 / Margin withdrawn successfully'
    } as ApiResponse<null>);
    
  } catch (error) {
    console.error('Withdraw margin error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '提取保证金失败 / Failed to withdraw margin'
    } as ApiResponse<null>);
  }
});

/**
 * 开仓 / Open position
 * POST /api/margin/position/open
 */
router.post('/position/open', authenticateUser, async (req, res) => {
  try {
    const { 
      tradingPair, 
      side, 
      orderType, 
      quantity, 
      price, 
      leverage, 
      timeInForce 
    } = req.body;
    
    // 验证必需参数 / Validate required parameters
    if (!tradingPair || !side || !orderType || !quantity || !leverage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: '缺少必需参数 / Missing required parameters'
      } as ApiResponse<null>);
    }
    
    // 验证参数值 / Validate parameter values
    if (!Object.values(OrderSide).includes(side) || 
        !Object.values(OrderType).includes(orderType) ||
        BigInt(quantity) <= 0 ||
        leverage <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameter values',
        message: '无效的参数值 / Invalid parameter values'
      } as ApiResponse<null>);
    }
    
    const params: MarginTradingParams = {
      tradingPair,
      side,
      orderType,
      quantity: BigInt(quantity),
      price: price ? BigInt(price) : undefined,
      leverage,
      timeInForce: timeInForce || TimeInForce.GTC
    };
    
    const result = await marginManager.openPosition(req.userId, params);
    
    res.json({
      success: true,
      data: result,
      message: '开仓成功 / Position opened successfully'
    } as ApiResponse<TradeResult>);
    
  } catch (error) {
    console.error('Open position error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '开仓失败 / Failed to open position'
    } as ApiResponse<null>);
  }
});

/**
 * 平仓 / Close position
 * POST /api/margin/position/close
 */
router.post('/position/close', authenticateUser, async (req, res) => {
  try {
    const { positionId, price } = req.body;
    
    if (!positionId || positionId < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position ID',
        message: '无效的持仓ID / Invalid position ID'
      } as ApiResponse<null>);
    }
    
    const result = await marginManager.closePosition(
      req.userId, 
      positionId, 
      price ? BigInt(price) : undefined
    );
    
    res.json({
      success: true,
      data: result,
      message: '平仓成功 / Position closed successfully'
    } as ApiResponse<TradeResult>);
    
  } catch (error) {
    console.error('Close position error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '平仓失败 / Failed to close position'
    } as ApiResponse<null>);
  }
});

/**
 * 获取持仓列表 / Get positions list
 * GET /api/margin/positions
 */
router.get('/positions', authenticateUser, validatePagination, async (req, res) => {
  try {
    const { active } = req.query;
    const { page, limit, offset } = req.pagination;
    
    let positions = marginManager.getUserPositions(req.userId);
    
    // 过滤活跃持仓 / Filter active positions
    if (active === 'true') {
      positions = positions.filter(p => p.isActive);
    } else if (active === 'false') {
      positions = positions.filter(p => !p.isActive);
    }
    
    // 分页 / Pagination
    const total = positions.length;
    const paginatedPositions = positions.slice(offset, offset + limit);
    
    const response: PaginatedResponse<Position> = {
      items: paginatedPositions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '获取持仓列表失败 / Failed to get positions'
    } as ApiResponse<null>);
  }
});

/**
 * 获取单个持仓信息 / Get single position info
 * GET /api/margin/position/:positionId
 */
router.get('/position/:positionId', authenticateUser, async (req, res) => {
  try {
    const positionId = parseInt(req.params.positionId);
    
    if (isNaN(positionId) || positionId < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position ID',
        message: '无效的持仓ID / Invalid position ID'
      } as ApiResponse<null>);
    }
    
    const position = marginManager.getPosition(req.userId, positionId);
    
    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Position not found',
        message: '持仓不存在 / Position not found'
      } as ApiResponse<null>);
    }
    
    res.json({
      success: true,
      data: position,
      message: '获取持仓信息成功 / Position info retrieved successfully'
    } as ApiResponse<Position>);
    
  } catch (error) {
    console.error('Get position error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '获取持仓信息失败 / Failed to get position info'
    } as ApiResponse<null>);
  }
});

/**
 * 获取风险指标 / Get risk metrics
 * GET /api/margin/risk
 */
router.get('/risk', authenticateUser, async (req, res) => {
  try {
    const riskMetrics = await marginManager.getRiskMetrics(req.userId);
    
    if (!riskMetrics) {
      return res.status(404).json({
        success: false,
        error: 'Risk metrics not available',
        message: '风险指标不可用 / Risk metrics not available'
      } as ApiResponse<null>);
    }
    
    res.json({
      success: true,
      data: riskMetrics,
      message: '获取风险指标成功 / Risk metrics retrieved successfully'
    } as ApiResponse<RiskMetrics>);
    
  } catch (error) {
    console.error('Get risk metrics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '获取风险指标失败 / Failed to get risk metrics'
    } as ApiResponse<null>);
  }
});

/**
 * 检查保证金调用 / Check margin call
 * GET /api/margin/margin-call
 */
router.get('/margin-call', authenticateUser, async (req, res) => {
  try {
    const marginCallInfo = await marginManager.checkMarginCall(req.userId);
    
    res.json({
      success: true,
      data: marginCallInfo,
      message: marginCallInfo 
        ? '需要追加保证金 / Margin call required' 
        : '保证金充足 / Margin sufficient'
    } as ApiResponse<MarginCallInfo | null>);
    
  } catch (error) {
    console.error('Check margin call error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '检查保证金调用失败 / Failed to check margin call'
    } as ApiResponse<null>);
  }
});

/**
 * 执行强制平仓检查 / Execute liquidation check
 * POST /api/margin/liquidation/check
 */
router.post('/liquidation/check', authenticateUser, async (req, res) => {
  try {
    const liquidationResults = await marginManager.checkAndExecuteLiquidation(req.userId);
    
    res.json({
      success: true,
      data: liquidationResults,
      message: liquidationResults.length > 0 
        ? '执行了强制平仓 / Liquidation executed' 
        : '无需强制平仓 / No liquidation needed'
    } as ApiResponse<LiquidationResult[]>);
    
  } catch (error) {
    console.error('Liquidation check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '强制平仓检查失败 / Failed to check liquidation'
    } as ApiResponse<null>);
  }
});

/**
 * 更新VIP等级 / Update VIP level
 * POST /api/margin/vip/update
 */
router.post('/vip/update', authenticateUser, async (req, res) => {
  try {
    const { stakedAmount } = req.body;
    
    if (!stakedAmount || BigInt(stakedAmount) < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid staked amount',
        message: '无效的质押金额 / Invalid staked amount'
      } as ApiResponse<null>);
    }
    
    await marginManager.updateVIPLevel(req.userId, BigInt(stakedAmount));
    
    res.json({
      success: true,
      data: null,
      message: 'VIP等级更新成功 / VIP level updated successfully'
    } as ApiResponse<null>);
    
  } catch (error) {
    console.error('Update VIP level error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'VIP等级更新失败 / Failed to update VIP level'
    } as ApiResponse<null>);
  }
});

/**
 * 获取VIP配置 / Get VIP configuration
 * GET /api/margin/vip/config
 */
router.get('/vip/config', async (req, res) => {
  try {
    const configs = [];
    for (let level = 0; level <= 5; level++) {
      const config = marginManager.getVIPConfig(level);
      if (config) {
        configs.push(config);
      }
    }
    
    res.json({
      success: true,
      data: configs,
      message: '获取VIP配置成功 / VIP configuration retrieved successfully'
    } as ApiResponse<any[]>);
    
  } catch (error) {
    console.error('Get VIP config error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '获取VIP配置失败 / Failed to get VIP configuration'
    } as ApiResponse<null>);
  }
});

/**
 * 获取保证金配置 / Get margin configuration
 * GET /api/margin/config
 */
router.get('/config', async (req, res) => {
  try {
    const config = marginManager.getMarginConfig();
    
    res.json({
      success: true,
      data: config,
      message: '获取保证金配置成功 / Margin configuration retrieved successfully'
    } as ApiResponse<any>);
    
  } catch (error) {
    console.error('Get margin config error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '获取保证金配置失败 / Failed to get margin configuration'
    } as ApiResponse<null>);
  }
});

/**
 * 获取支持的资产列表 / Get supported assets
 * GET /api/margin/assets
 */
router.get('/assets', async (req, res) => {
  try {
    const assets = marginManager.getSupportedAssets();
    
    res.json({
      success: true,
      data: assets,
      message: '获取支持资产成功 / Supported assets retrieved successfully'
    } as ApiResponse<string[]>);
    
  } catch (error) {
    console.error('Get supported assets error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '获取支持资产失败 / Failed to get supported assets'
    } as ApiResponse<null>);
  }
});

/**
 * 更新资产价格 / Update asset price
 * POST /api/margin/price/update
 */
router.post('/price/update', async (req, res) => {
  try {
    const { asset, price } = req.body;
    
    if (!asset || !price || BigInt(price) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid price update parameters',
        message: '无效的价格更新参数 / Invalid price update parameters'
      } as ApiResponse<null>);
    }
    
    marginManager.updateAssetPrice(asset, BigInt(price));
    
    res.json({
      success: true,
      data: null,
      message: '资产价格更新成功 / Asset price updated successfully'
    } as ApiResponse<null>);
    
  } catch (error) {
    console.error('Update asset price error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '资产价格更新失败 / Failed to update asset price'
    } as ApiResponse<null>);
  }
});

// 扩展Express Request接口 / Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      userId: string;
      pagination: PaginationParams & { offset: number };
    }
  }
}

export default router;