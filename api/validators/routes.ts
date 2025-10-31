import { Router } from 'express';
import { ValidatorManager } from './validator-manager.js';

const router = Router();
const validatorManager = new ValidatorManager();

/**
 * 验证节点相关路由
 */

// 注册验证节点
router.post('/register', async (req, res) => {
  await validatorManager.registerValidator(req, res);
});

// 获取验证节点列表
router.get('/', async (req, res) => {
  await validatorManager.getValidators(req, res);
});

// 获取单个验证节点信息
router.get('/:address', async (req, res) => {
  await validatorManager.getValidator(req, res);
});

// 更新验证节点质押
router.put('/:address/stake', async (req, res) => {
  await validatorManager.updateStake(req, res);
});

// 获取候补节点列表
router.get('/candidates/list', async (req, res) => {
  await validatorManager.getCandidateNodes(req, res);
});

// 获取网络统计
router.get('/network/stats', async (req, res) => {
  await validatorManager.getNetworkStats(req, res);
});

export default router;