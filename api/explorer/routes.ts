import { Router } from 'express';
import { ExplorerService } from './service';

const router = Router();
const explorerService = new ExplorerService();

// 网络统计
router.get('/network/stats', async (req, res) => {
  try {
    const stats = await explorerService.getNetworkStats();
    res.json(stats);
  } catch (error) {
    console.error('Failed to get network stats:', error);
    res.status(500).json({ error: 'Failed to get network stats' });
  }
});

// 网络健康状态
router.get('/network/health', async (req, res) => {
  try {
    const health = await explorerService.getNetworkHealth();
    res.json(health);
  } catch (error) {
    console.error('Failed to get network health:', error);
    res.status(500).json({ error: 'Failed to get network health' });
  }
});

// 网络性能指标
router.get('/network/metrics', async (req, res) => {
  try {
    const { range = '24h' } = req.query;
    const metrics = await explorerService.getNetworkMetrics(range as string);
    res.json({ metrics });
  } catch (error) {
    console.error('Failed to get network metrics:', error);
    res.status(500).json({ error: 'Failed to get network metrics' });
  }
});

// 最新区块
router.get('/blocks/recent', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const blocks = await explorerService.getRecentBlocks(
      parseInt(page as string),
      parseInt(limit as string)
    );
    res.json({ blocks });
  } catch (error) {
    console.error('Failed to get recent blocks:', error);
    res.status(500).json({ error: 'Failed to get recent blocks' });
  }
});

// 区块详情
router.get('/block/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const block = await explorerService.getBlockDetails(identifier);
    
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    
    res.json(block);
  } catch (error) {
    console.error('Failed to get block details:', error);
    res.status(500).json({ error: 'Failed to get block details' });
  }
});

// 最新交易
router.get('/transactions/recent', async (req, res) => {
  try {
    const { page = 1, limit = 10, filter = 'all' } = req.query;
    const transactions = await explorerService.getRecentTransactions(
      parseInt(page as string),
      parseInt(limit as string),
      filter as string
    );
    res.json({ transactions });
  } catch (error) {
    console.error('Failed to get recent transactions:', error);
    res.status(500).json({ error: 'Failed to get recent transactions' });
  }
});

// 交易详情
router.get('/transaction/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const transaction = await explorerService.getTransactionDetails(hash);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    console.error('Failed to get transaction details:', error);
    res.status(500).json({ error: 'Failed to get transaction details' });
  }
});

// 地址详情
router.get('/address/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const addressInfo = await explorerService.getAddressDetails(address);
    
    if (!addressInfo) {
      return res.status(404).json({ error: 'Address not found' });
    }
    
    res.json(addressInfo);
  } catch (error) {
    console.error('Failed to get address details:', error);
    res.status(500).json({ error: 'Failed to get address details' });
  }
});

// 地址交易历史
router.get('/address/:address/transactions', async (req, res) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 20, type = 'all' } = req.query;
    
    const transactions = await explorerService.getAddressTransactions(
      address,
      parseInt(page as string),
      parseInt(limit as string),
      type as string
    );
    
    res.json({ transactions });
  } catch (error) {
    console.error('Failed to get address transactions:', error);
    res.status(500).json({ error: 'Failed to get address transactions' });
  }
});

// 验证节点列表
router.get('/validators', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sort = 'rank', 
      status = 'all' 
    } = req.query;
    
    const validators = await explorerService.getValidators(
      parseInt(page as string),
      parseInt(limit as string),
      sort as string,
      status as string
    );
    
    res.json({ validators });
  } catch (error) {
    console.error('Failed to get validators:', error);
    res.status(500).json({ error: 'Failed to get validators' });
  }
});

// 验证节点详情
router.get('/validator/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const validator = await explorerService.getValidatorDetails(identifier);
    
    if (!validator) {
      return res.status(404).json({ error: 'Validator not found' });
    }
    
    res.json(validator);
  } catch (error) {
    console.error('Failed to get validator details:', error);
    res.status(500).json({ error: 'Failed to get validator details' });
  }
});

// 验证节点历史性能
router.get('/validator/:identifier/performance', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { range = '7d' } = req.query;
    
    const performance = await explorerService.getValidatorPerformance(
      identifier,
      range as string
    );
    
    res.json({ performance });
  } catch (error) {
    console.error('Failed to get validator performance:', error);
    res.status(500).json({ error: 'Failed to get validator performance' });
  }
});

// 搜索功能
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const results = await explorerService.search(q);
    res.json({ results });
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 统计数据
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await explorerService.getOverviewStats();
    res.json(stats);
  } catch (error) {
    console.error('Failed to get overview stats:', error);
    res.status(500).json({ error: 'Failed to get overview stats' });
  }
});

// 0-gas费交易统计
router.get('/stats/zero-gas', async (req, res) => {
  try {
    const { range = '24h' } = req.query;
    const stats = await explorerService.getZeroGasStats(range as string);
    res.json(stats);
  } catch (error) {
    console.error('Failed to get zero-gas stats:', error);
    res.status(500).json({ error: 'Failed to get zero-gas stats' });
  }
});

// 流动性共享数据
router.get('/liquidity/pools', async (req, res) => {
  try {
    const pools = await explorerService.getLiquidityPools();
    res.json({ pools });
  } catch (error) {
    console.error('Failed to get liquidity pools:', error);
    res.status(500).json({ error: 'Failed to get liquidity pools' });
  }
});

// 订单簿数据
router.get('/orderbook/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    const { depth = 20 } = req.query;
    
    const orderbook = await explorerService.getOrderBook(
      pair,
      parseInt(depth as string)
    );
    
    res.json(orderbook);
  } catch (error) {
    console.error('Failed to get orderbook:', error);
    res.status(500).json({ error: 'Failed to get orderbook' });
  }
});

// 实时数据WebSocket端点信息
router.get('/websocket/info', (req, res) => {
  res.json({
    endpoints: {
      blocks: '/ws/blocks',
      transactions: '/ws/transactions',
      network: '/ws/network',
      validators: '/ws/validators'
    },
    description: 'WebSocket endpoints for real-time data'
  });
});

export default router;