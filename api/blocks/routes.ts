import * as express from 'express';

const router = express.Router();

/**
 * Get blocks list / 获取区块列表
 */
router.get('/', async (req, res) => {
  try {
    console.log('🔍 API: Getting blocks list...');
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    
    // Mock block data / 模拟区块数据
    const mockBlocks = Array.from({ length: limit }, (_, i) => {
      const blockNumber = 1234567 - i - offset;
      return {
        number: blockNumber,
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        parentHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        timestamp: Date.now() - (i + offset) * 12000, // 12 seconds per block / 每个区块12秒
        miner: `0x${Math.random().toString(16).substr(2, 40)}`,
        difficulty: Math.floor(Math.random() * 1000000000000),
        totalDifficulty: Math.floor(Math.random() * 10000000000000),
        size: Math.floor(Math.random() * 50000) + 1000,
        gasLimit: 30000000,
        gasUsed: Math.floor(Math.random() * 25000000),
        transactionCount: Math.floor(Math.random() * 200) + 1,
        reward: (Math.random() * 5 + 2).toFixed(6),
        extraData: '0x',
        nonce: `0x${Math.random().toString(16).substr(2, 16)}`,
        mixHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        stateRoot: `0x${Math.random().toString(16).substr(2, 64)}`,
        transactionsRoot: `0x${Math.random().toString(16).substr(2, 64)}`,
        receiptsRoot: `0x${Math.random().toString(16).substr(2, 64)}`
      };
    });
    
    const totalBlocks = 1234567 + Math.floor(Math.random() * 1000);
    const totalPages = Math.ceil(totalBlocks / limit);
    
    console.log('✅ API: Successfully generated blocks list');
    res.json({
      success: true,
      data: mockBlocks,
      pagination: {
        page,
        limit,
        total: totalBlocks,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('❌ API: Error getting blocks list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blocks list / 获取区块列表失败',
      details: error.message
    });
  }
});

/**
 * Get block details by number or hash / 根据区块号或哈希获取区块详情
 */
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log(`🔍 API: Getting block details for: ${identifier}`);
    
    // Check if identifier is a number or hash / 检查标识符是数字还是哈希
    const isBlockNumber = /^\d+$/.test(identifier);
    const isBlockHash = /^0x[a-fA-F0-9]{64}$/.test(identifier);
    
    if (!isBlockNumber && !isBlockHash) {
      return res.status(400).json({
        success: false,
        error: 'Invalid block identifier. Must be block number or hash / 无效的区块标识符，必须是区块号或哈希'
      });
    }
    
    // Mock block details / 模拟区块详情
    const blockNumber = isBlockNumber ? parseInt(identifier) : Math.floor(Math.random() * 1000000);
    const mockBlock = {
      number: blockNumber,
      hash: isBlockHash ? identifier : `0x${Math.random().toString(16).substr(2, 64)}`,
      parentHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      timestamp: Date.now() - Math.random() * 86400000, // Random time within last 24h / 过去24小时内的随机时间
      miner: `0x${Math.random().toString(16).substr(2, 40)}`,
      difficulty: Math.floor(Math.random() * 1000000000000),
      totalDifficulty: Math.floor(Math.random() * 10000000000000),
      size: Math.floor(Math.random() * 50000) + 1000,
      gasLimit: 30000000,
      gasUsed: Math.floor(Math.random() * 25000000),
      transactionCount: Math.floor(Math.random() * 200) + 1,
      reward: (Math.random() * 5 + 2).toFixed(6),
      extraData: '0x',
      nonce: `0x${Math.random().toString(16).substr(2, 16)}`,
      mixHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      stateRoot: `0x${Math.random().toString(16).substr(2, 64)}`,
      transactionsRoot: `0x${Math.random().toString(16).substr(2, 64)}`,
      receiptsRoot: `0x${Math.random().toString(16).substr(2, 64)}`,
      // Additional block details / 额外的区块详情
      transactions: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, () => ({
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        from: `0x${Math.random().toString(16).substr(2, 40)}`,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        value: (Math.random() * 100).toFixed(6),
        gasPrice: Math.floor(Math.random() * 100000000000),
        gas: Math.floor(Math.random() * 1000000),
        status: Math.random() > 0.1 ? 'success' : 'failed'
      }))
    };
    
    console.log('✅ API: Successfully generated block details');
    res.json({
      success: true,
      data: mockBlock
    });
  } catch (error) {
    console.error('❌ API: Error getting block details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get block details / 获取区块详情失败',
      details: error.message
    });
  }
});

export default router;