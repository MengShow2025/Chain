import express from 'express';

const router = express.Router();

// 区块链服务的基础URL
const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:3001';

/**
 * 代理请求到区块链服务
 */
async function proxyToBlockchainService(endpoint: string): Promise<any> {
  try {
    const response = await fetch(`${BLOCKCHAIN_SERVICE_URL}/api/blockchain${endpoint}`);
    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    console.error('Error proxying to blockchain service:', error);
    return { success: false, error: 'Failed to connect to blockchain service', status: 503 };
  }
}

/**
 * 获取当前出块节点信息
 */
router.get('/current-producer', async (req, res) => {
  try {
    console.log('🔍 API: Getting current block producer via proxy...');
    
    const result = await proxyToBlockchainService('/current-producer');
    
    if (result.success) {
      console.log('✅ API: Successfully got current block producer from blockchain service');
      res.json(result.data);
    } else {
      console.log('❌ API: Failed to get current block producer from blockchain service');
      res.status(result.status || 503).json({
        success: false,
        error: result.error || 'Blockchain service unavailable'
      });
    }
  } catch (error) {
    console.error('❌ API: Error getting current block producer:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * 获取区块链状态
 */
router.get('/status', async (req, res) => {
  try {
    console.log('🔍 API: Getting blockchain status via proxy...');
    
    const result = await proxyToBlockchainService('/status');
    
    if (result.success) {
      console.log('✅ API: Successfully got blockchain status from blockchain service');
      res.json(result.data);
    } else {
      console.log('❌ API: Failed to get blockchain status from blockchain service');
      res.status(result.status || 503).json({
        success: false,
        error: result.error || 'Blockchain service unavailable'
      });
    }
  } catch (error) {
    console.error('Error getting blockchain status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;