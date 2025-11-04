// TitanChain Validator Routes / TitanChain 验证节点路由
// Handles validator registration, management and network statistics / 处理验证节点注册、管理和网络统计
import { Router } from 'express';
import { ValidatorManager } from './validator-manager';

const router = Router();
const validatorManager = new ValidatorManager();

// Blockchain service URL / 区块链服务URL
const BLOCKCHAIN_SERVICE_URL = 'http://localhost:3001';

/**
 * Proxy requests to blockchain service / 代理请求到区块链服务
 */
async function proxyToBlockchainService(endpoint: string, method: string = 'GET', body?: any) {
  try {
    const response = await fetch(`${BLOCKCHAIN_SERVICE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    return await response.json();
  } catch (error) {
    console.error(`Proxy request failed ${endpoint} / 代理请求失败 ${endpoint}:`, error);
    return { success: false, error: 'Internal server error' };
  }
}

// Register validator node / 注册验证节点
router.post('/register', async (req, res) => {
  await validatorManager.registerValidator(req, res);
});

// Get validator list - prioritize blockchain service / 获取验证节点列表 - 优先从区块链服务获取
router.get('/', async (req, res) => {
  try {
    // First try to get from blockchain service / 首先尝试从区块链服务获取
    const blockchainData = await proxyToBlockchainService('/api/validators');
    
    if (blockchainData.success) {
      res.json(blockchainData);
      return;
    }
    
    // If blockchain service unavailable, use local validator manager / 如果区块链服务不可用，使用本地验证节点管理器
    console.log('Blockchain service unavailable, using local validator data / 区块链服务不可用，使用本地验证节点数据');
    await validatorManager.getValidators(req, res);
  } catch (error) {
    console.error('Failed to get validator list / 获取验证节点列表失败:', error);
    // Fallback to local validator manager / 回退到本地验证节点管理器
    await validatorManager.getValidators(req, res);
  }
});

// Get single validator information / 获取单个验证节点信息
router.get('/:address', async (req, res) => {
  await validatorManager.getValidator(req, res);
});

// Update validator stake / 更新验证节点质押
router.put('/:address/stake', async (req, res) => {
  await validatorManager.updateStake(req, res);
});

// Get candidate node list / 获取候补节点列表
router.get('/candidates/list', async (req, res) => {
  await validatorManager.getCandidateNodes(req, res);
});

// Get network statistics / 获取网络统计
router.get('/network/stats', async (req, res) => {
  await validatorManager.getNetworkStats(req, res);
});

export default router;