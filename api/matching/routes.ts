// TitanChain Matching Engine Routes / TitanChain 撮合引擎路由
// Handles order submission, cancellation, and order book management / 处理订单提交、取消和订单簿管理
import * as express from 'express';
import { MatchingEngine, Order } from '../../blockchain/matching/matching-engine';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

// Create matching engine instance / 创建撮合引擎实例
const matchingEngine = new MatchingEngine();

// Rate limiting configuration / 限流配置
const orderSubmissionLimit = rateLimit({
  windowMs: 1000, // 1 second / 1秒
  max: 100, // Maximum 100 orders per second / 每秒最多100个订单
  message: 'Too many orders submitted, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimit = rateLimit({
  windowMs: 1000, // 1 second / 1秒
  max: 200, // Maximum 200 requests per second / 每秒最多200个请求
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Submit order / 提交订单
 */
router.post('/orders', orderSubmissionLimit, async (req, res) => {
  try {
    const { order } = req.body;
    
    if (!order) {
      return res.status(400).json({
        success: false,
        error: 'Order data is required'
      });
    }
    
    // Validate required fields / 验证必需字段
    const requiredFields = ['id', 'symbol', 'side', 'type', 'price', 'quantity', 'account'];
    for (const field of requiredFields) {
      if (!order[field]) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`
        });
      }
    }
    
    // Add timestamp and nonce / 添加时间戳和nonce
    order.timestamp = Date.now();
    order.nonce = Math.floor(Math.random() * 1000000);
    
    await matchingEngine.addOrder(order);
    
    res.json({
      success: true,
      data: {
        orderId: order.id,
        status: 'submitted',
        timestamp: order.timestamp
      }
    });
    
  } catch (error) {
    console.error('Order submission error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Cancel order / 取消订单
 */
router.delete('/orders/:orderId', generalLimit, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { account } = req.body;
    
    if (!account) {
      return res.status(400).json({
        success: false,
        error: 'Account address is required'
      });
    }
    
    await matchingEngine.cancelOrder(orderId, account);
    
    res.json({
      success: true,
      data: {
        orderId,
        status: 'cancelled',
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    console.error('Order cancellation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get order book depth / 获取订单簿深度
 */
router.get('/orderbook/:symbol', generalLimit, (req, res) => {
  try {
    const { symbol } = req.params;
    const depth = parseInt(req.query.depth as string) || 10;
    
    if (depth < 1 || depth > 100) {
      return res.status(400).json({
        success: false,
        error: 'Depth must be between 1 and 100'
      });
    }
    
    const orderBookDepth = matchingEngine.getOrderBookDepth(symbol, depth);
    
    res.json({
      success: true,
      data: {
        symbol,
        depth,
        ...orderBookDepth
      }
    });
    
  } catch (error) {
    console.error('OrderBook query error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get matching engine statistics / 获取撮合引擎统计信息
 */
router.get('/stats', generalLimit, (req, res) => {
  try {
    const stats = matchingEngine.getStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Stats query error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Batch submit orders / 批量提交订单
 */
router.post('/orders/batch', orderSubmissionLimit, async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Orders array is required and must not be empty'
      });
    }
    
    if (orders.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 orders per batch'
      });
    }
    
    const results = [];
    const timestamp = Date.now();
    
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      
      try {
        // Add timestamp and nonce / 添加时间戳和nonce
        order.timestamp = timestamp + i; // Ensure unique timestamp for each order / 确保每个订单有唯一时间戳
        order.nonce = Math.floor(Math.random() * 1000000);
        
        await matchingEngine.addOrder(order);
        
        results.push({
          orderId: order.id,
          status: 'submitted',
          timestamp: order.timestamp
        });
        
      } catch (error) {
        results.push({
          orderId: order.id || `order_${i}`,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        totalOrders: orders.length,
        results
      }
    });
    
  } catch (error) {
    console.error('Batch order submission error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get trading pairs list / 获取交易对列表
 */
router.get('/symbols', generalLimit, (req, res) => {
  try {
    // Simulate supported trading pairs / 模拟支持的交易对
    const symbols = [
      'BTC/USDT',
      'ETH/USDT',
      'TTN/USDT',
      'BTC/ETH',
      'TTN/BTC',
      'TTN/ETH'
    ];
    
    res.json({
      success: true,
      data: {
        symbols,
        count: symbols.length
      }
    });
    
  } catch (error) {
    console.error('Symbols query error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get recent matching results / 获取最近的撮合结果
 */
router.get('/matches', generalLimit, (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (limit < 1 || limit > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 1000'
      });
    }
    
    // Should get historical matching data from matching engine / 这里应该从撮合引擎获取历史撮合数据
    // Currently returning mock data / 目前返回模拟数据
    const matches = [];
    for (let i = 0; i < Math.min(limit, 20); i++) {
      matches.push({
        id: `match_${Date.now()}_${i}`,
        symbol: symbol || 'BTC/USDT',
        price: (50000 + Math.random() * 1000).toFixed(2),
        quantity: (Math.random() * 10).toFixed(4),
        timestamp: Date.now() - i * 1000,
        side: Math.random() > 0.5 ? 'buy' : 'sell'
      });
    }
    
    res.json({
      success: true,
      data: {
        matches,
        count: matches.length,
        symbol: symbol || 'all'
      }
    });
    
  } catch (error) {
    console.error('Matches query error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Health check / 健康检查
 */
router.get('/health', (req, res) => {
  try {
    const stats = matchingEngine.getStats();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        matchingEngine: {
          isProcessing: stats.isProcessing,
          pendingOrders: stats.pendingOrders,
          activeOrderBooks: stats.activeOrderBooks
        }
      }
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Error handling middleware / 错误处理中间件
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Matching API error:', error);
  
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Graceful shutdown handling / 优雅关闭处理
process.on('SIGTERM', () => {
  console.log('Shutting down matching engine...');
  matchingEngine.cleanup();
});

process.on('SIGINT', () => {
  console.log('Shutting down matching engine...');
  matchingEngine.cleanup();
});

export default router;