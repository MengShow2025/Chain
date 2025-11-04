import { Router } from 'express';
import { ExplorerService } from './service';

const router = Router();
const explorerService = new ExplorerService();

// Network statistics / 网络统计
router.get('/stats', async (req, res) => {
  try {
    const stats = await explorerService.getNetworkStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get network stats' });
  }
});

// Network health status / 网络健康状态
router.get('/health', async (req, res) => {
  try {
    const health = await explorerService.getNetworkHealth();
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get network health' });
  }
});

// Network performance metrics / 网络性能指标
router.get('/performance', async (req, res) => {
  try {
    const range = req.query.range as string || '24h';
    const metrics = await explorerService.getNetworkMetrics(range);
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get network metrics' });
  }
});

// Latest blocks / 最新区块
router.get('/blocks', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const blocks = await explorerService.getRecentBlocks(page, limit);
    res.json({
      success: true,
      data: blocks
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get blocks' });
  }
});

// Block details / 区块详情
router.get('/blocks/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const block = await explorerService.getBlockDetails(identifier);
    
    if (!block) {
      return res.status(404).json({ success: false, error: 'Block not found' });
    }
    
    res.json({
      success: true,
      data: block
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get block details' });
  }
});

// Latest transactions / 最新交易
router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const filter = req.query.filter as string || 'all';
    
    const transactions = await explorerService.getRecentTransactions(page, limit, filter);
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get transactions' });
  }
});

// Transaction details / 交易详情
router.get('/transactions/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const transaction = await explorerService.getTransactionDetails(hash);
    
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get transaction details' });
  }
});

// Address details / 地址详情
router.get('/addresses/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const addressInfo = await explorerService.getAddressDetails(address);
    
    if (!addressInfo) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }
    
    res.json({
      success: true,
      data: addressInfo
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get address details' });
  }
});

// Address transaction history / 地址交易历史
router.get('/addresses/:address/transactions', async (req, res) => {
  try {
    const { address } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string || 'all';
    
    const transactions = await explorerService.getAddressTransactions(address, page, limit, type);
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get address transactions' });
  }
});

// Validator node list / 验证节点列表
router.get('/validators', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sort = req.query.sort as string || 'rank';
    const status = req.query.status as string || 'all';
    
    const validators = await explorerService.getValidators(page, limit, sort, status);
    res.json({
      success: true,
      data: validators
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get validators' });
  }
});

// Validator node details / 验证节点详情
router.get('/validators/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const validator = await explorerService.getValidatorDetails(identifier);
    
    if (!validator) {
      return res.status(404).json({ success: false, error: 'Validator not found' });
    }
    
    res.json({
      success: true,
      data: validator
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get validator details' });
  }
});

// Validator historical performance / 验证节点历史性能
router.get('/validators/:identifier/performance', async (req, res) => {
  try {
    const { identifier } = req.params;
    const range = req.query.range as string || '7d';
    
    const performance = await explorerService.getValidatorPerformance(identifier, range);
    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get validator performance' });
  }
});

// Search functionality / 搜索功能
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const results = await explorerService.search(query);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// Statistical data / 统计数据
router.get('/statistics', async (req, res) => {
  try {
    const stats = await explorerService.getOverviewStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
});

// Zero-gas fee transaction statistics / 0-gas费交易统计
router.get('/zero-gas-stats', async (req, res) => {
  try {
    const range = req.query.range as string || '24h';
    const stats = await explorerService.getZeroGasStats(range);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get zero gas stats' });
  }
});

// Liquidity sharing data / 流动性共享数据
router.get('/liquidity', async (req, res) => {
  try {
    const pools = await explorerService.getLiquidityPools();
    
    res.json({
      success: true,
      data: pools
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get liquidity data' });
  }
});

// Order book data / 订单簿数据
router.get('/orderbook/:pair?', async (req, res) => {
  try {
    const pair = req.params.pair || 'TTN/USDT';
    const depth = parseInt(req.query.depth as string) || 20;
    
    const orderbook = await explorerService.getOrderBook(pair, depth);
    
    res.json({
      success: true,
      data: orderbook
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get orderbook data' });
  }
});

// Real-time data WebSocket endpoint information / 实时数据WebSocket端点信息
router.get('/websocket-info', (req, res) => {
  res.json({
    success: true,
    data: {
      endpoints: {
        blocks: '/ws/blocks',
        transactions: '/ws/transactions',
        validators: '/ws/validators',
        stats: '/ws/stats'
      },
      protocols: ['ws', 'wss']
    }
  });
});

export default router;