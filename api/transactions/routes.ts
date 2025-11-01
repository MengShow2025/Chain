// reload trigger: updated on witness duplicate fix
import { Router } from 'express';
import { Transaction, BatchCommit, BatchStatus } from '../../shared/types/blockchain.js';
import { blockchainInstance } from '../../shared/blockchain-instance.js';
import { API_ENDPOINTS, SEQUENCER_CONFIG, SECURITY_VALIDATION } from '../../shared/constants/blockchain.js';
import { BlockValidator } from '../../blockchain/core/block-validator.js';
import { casClient } from '../../shared/da/cas-client.js';
import { SponsorPoolService } from '../../blockchain/core/sponsor-pool.js';
import { computeBatchRoots, computeSponsorAccountsRoot, computeGasCostRoot } from '../../shared/utils/merkle.js';
import { witnessRegistry } from '../../shared/security/witness-registry.js';

const router = Router();
const batchStore: Map<string, any> = new Map();
const validator = new BlockValidator();

// 顶层 BigInt 解析工具，供路由与解析使用
function toBigIntSafe(v: any): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(v);
  if (typeof v === 'string') return BigInt(v);
  throw new Error('invalid_bigint_value');
}

// 将请求体中的数值统一转为 BigInt（与 P2P 层保持一致）
function parseTransaction(tx: any): any {
  if (!tx) return tx;
  const t = { ...tx };
  const toBigInt = (v: any) => {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'string') return BigInt(v);
    if (typeof v === 'number') return BigInt(v);
    return v;
  };
  // 主字段统一转为 BigInt
  t.value = toBigInt(t.value);
  t.gas = toBigInt(t.gas);
  t.gasPrice = toBigInt(t.gasPrice);
  // nonce 统一为 number
  if (typeof t.nonce === 'string') {
    const n = Number(t.nonce);
    t.nonce = Number.isFinite(n) ? n : t.nonce;
  }
  // exchangeBatch 的 totalVolume 统一转为 BigInt
  if (t.exchangeBatch) {
    const eb = { ...t.exchangeBatch };
    eb.totalVolume = toBigInt(eb.totalVolume);
    t.exchangeBatch = eb;
  }
  return t;
}

// 提交单个交易
router.post('/submit', async (req, res) => {
  try {
    console.log('Received transaction submission:', JSON.stringify(req.body, null, 2));
    
    const transaction = parseTransaction(req.body);
    console.log('Parsed transaction:', JSON.stringify(transaction, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));
    
    // 获取区块链实例
    const chain = blockchainInstance.getBlockchain();
    if (!chain) {
      console.error('Blockchain instance not available');
      return res.status(503).json({
        success: false,
        error: 'Blockchain service not available'
      });
    }

    // 添加时间戳（如果没有的话）
    if (!transaction.timestamp) {
      transaction.timestamp = Date.now();
    }

    console.log('Submitting transaction to blockchain...');
    
    // 提交交易
    const success = await chain.submitTransaction(transaction);
    
    console.log(`Transaction submission result: ${success}`);
    
    if (success) {
      res.json({
        success: true,
        hash: transaction.hash,
        message: 'Transaction submitted successfully'
      });
    } else {
      res.status(429).json({
        success: false,
        error: 'Transaction rejected by pool (rate limit/anti-spam/validation)'
      });
    }
  } catch (error) {
    console.error('Transaction submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// 批量提交交易
router.post('/submit/batch', async (req, res) => {
  try {
    const transactions = req.body.transactions;
    if (!Array.isArray(transactions)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch format'
      });
    }

    const chain = blockchainInstance.getBlockchain();
    if (!chain) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain service not available'
      });
    }

    const parsed = transactions.map(parseTransaction);
    const result = await (chain as any).submitTransactions?.(parsed);
    // 如果 submitTransactions 不存在，逐个提交
    if (!result) {
      let success = 0, failed = 0;
      for (const tx of parsed) {
        // 简单有效性校验
        if (!tx || !tx.hash || !tx.from || typeof tx.nonce !== 'number') { failed++; continue; }
        const ok = await chain.submitTransaction(tx);
        ok ? success++ : failed++;
      }
      return res.json({ success: true, result: { success, failed } });
    }
    return res.json({ success: true, result });
  } catch (e) {
    console.error('Error in /api/transactions/submit/batch:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 获取交易池统计
router.get('/stats/pool', async (req, res) => {
  try {
    const chain = blockchainInstance.getBlockchain();
    if (!chain) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain service not available'
      });
    }
    const stats = chain.getTransactionPoolStats();
    return res.json({ success: true, stats });
  } catch (e) {
    console.error('Error in /api/transactions/stats/pool:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 获取交易池安全统计
router.get('/stats/security', async (req, res) => {
  try {
    const chain = blockchainInstance.getBlockchain();
    if (!chain) {
      return res.status(503).json({ success: false, error: 'Blockchain service not available' });
    }
    const security = (chain as any).getTransactionPoolSecurityStats?.();
    return res.json({ success: true, security });
  } catch (e) {
    console.error('Error in /api/transactions/stats/security:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

// ===== Off-chain 批次承诺占位接口 =====

// 测试辅助：提交批次数据到 CAS（仅用于本地验证）
router.post('/offchain/batch-data', async (req, res) => {
  try {
    const { cid, batchData } = req.body || {};
    if (!cid || typeof cid !== 'string') {
      return res.status(400).json({ success: false, error: 'invalid_cid' });
    }
    if (!batchData || typeof batchData !== 'object') {
      return res.status(400).json({ success: false, error: 'invalid_batch_data' });
    }
    casClient.put(cid, {
      orders: Array.isArray(batchData.orders) ? batchData.orders : [],
      matches: Array.isArray(batchData.matches) ? batchData.matches : [],
      balanceDiffs: Array.isArray(batchData.balanceDiffs) ? batchData.balanceDiffs : [],
      auditLog: Array.isArray(batchData.auditLog) ? batchData.auditLog : [],
    });
    return res.json({ success: true });
  } catch (e) {
    console.error('Error in /offchain/batch-data:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 测试辅助：计算批次数据的 Merkle 根（便于构造合法承诺）
router.post('/offchain/batch-roots', async (req, res) => {
  try {
    const batchData = req.body || {};
    const roots = computeBatchRoots({
      orders: Array.isArray(batchData.orders) ? batchData.orders : [],
      matches: Array.isArray(batchData.matches) ? batchData.matches : [],
      balanceDiffs: Array.isArray(batchData.balanceDiffs) ? batchData.balanceDiffs : [],
      auditLog: Array.isArray(batchData.auditLog) ? batchData.auditLog : [],
    });
    // 赞助账户根：直接基于当前赞助池快照
    const sponsorSnapshot = SponsorPoolService.snapshot();
    const sponsorAccountsRoot = computeSponsorAccountsRoot(sponsorSnapshot);
    // Gas 成本根：若提供 gasCosts（或 transactions），计算对应根
    const gasCosts = Array.isArray(batchData.gasCosts) ? batchData.gasCosts
      : (Array.isArray(batchData.transactions) ? batchData.transactions.map((tx: any) => ({
          txHash: tx.hash,
          gasUnits: typeof tx.gas === 'bigint' ? tx.gas.toString() : String(tx.gas ?? 0),
          gasPrice: typeof tx.gasPrice === 'bigint' ? tx.gasPrice.toString() : String(tx.gasPrice ?? 0),
        })) : []);
    const gasCostRoot = computeGasCostRoot(gasCosts);
    return res.json({ success: true, roots: { ...roots, sponsorAccountsRoot, gasCostRoot } });
  } catch (e) {
    console.error('Error in /offchain/batch-roots:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 测试辅助：注册见证地址（用于身份校验）
router.post('/offchain/witness/register', async (req, res) => {
  try {
    const { address } = req.body || {};
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ success: false, error: 'invalid_address' });
    }
    witnessRegistry.register(address);
    return res.json({ success: true });
  } catch (e) {
    console.error('Error in /offchain/witness/register:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 测试辅助：查询已注册见证
router.get('/offchain/witness/list', async (req, res) => {
  try {
    return res.json({ success: true, witnesses: witnessRegistry.list() });
  } catch (e) {
    console.error('Error in /offchain/witness/list:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 提交批次承诺（与 API_ENDPOINTS.BATCH_COMMIT 对齐）
router.post('/offchain/batch-commit', async (req, res) => {
  try {
    const body = req.body || {};

    // 统一并强类型化请求体为 BatchCommit
    const commit: BatchCommit = {
      batchId: body.batchId || body.id,
      nextStateRoot: body.nextStateRoot,
      liquidityMetaRoot: body.liquidityMetaRoot,
      feeReceiptsRoot: body.feeReceiptsRoot,
      distributionPlanRoot: body.distributionPlanRoot,
      ordersRoot: body.ordersRoot,
      matchesRoot: body.matchesRoot,
      cancellationsRoot: body.cancellationsRoot,
      balanceDiffsRoot: body.balanceDiffsRoot,
      auditLogRoot: body.auditLogRoot,
      gasCostRoot: body.gasCostRoot,
      sponsorAccountsRoot: body.sponsorAccountsRoot,
      prevStateRoot: body.prevStateRoot,
      recipeVersion: body.recipeVersion ?? SECURITY_VALIDATION.RECIPE_FORMAT_VERSION,
      witnessSigs: Array.isArray(body.witnessSigs) ? body.witnessSigs : (Array.isArray(body.witnesses) ? body.witnesses : []),
      timestamp: body.timestamp ?? Date.now(),
      cid: body.cid,
      producerId: body.producerId,
      producerSig: body.producerSig,
    };

    // 限制挂起批次数量，防止DoS
    if (batchStore.size >= SEQUENCER_CONFIG.MAX_PENDING_BATCHES) {
      return res.status(429).json({ success: false, error: 'too_many_pending_batches' });
    }

    const result = await validator.validateOffchainBatchCommit(commit);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.reason });
    }

    // 简易存储（后续可替换为 DA 或链上记录）
    const status: BatchStatus = {
      batchId: commit.batchId!,
      status: 'received',
      witnessesCollected: commit.witnessSigs?.length || 0,
      nextStateRoot: commit.nextStateRoot,
      timestamp: commit.timestamp || Date.now(),
    };
    batchStore.set(commit.batchId!, { ...commit, status: status.status });
    return res.json({ success: true, batch: status });
  } catch (e) {
    console.error('Error in /offchain/batch-commit:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 查询批次承诺状态（与 API_ENDPOINTS.BATCH_STATUS 对齐）
router.get('/offchain/batch/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = batchStore.get(id);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    const status: BatchStatus = {
      batchId: id,
      status: data.status || 'received',
      witnessesCollected: Array.isArray(data.witnessSigs) ? data.witnessSigs.length : 0,
      nextStateRoot: data.nextStateRoot,
      timestamp: data.timestamp || Date.now(),
    };
    return res.json({ success: true, batch: status });
  } catch (e) {
    console.error('Error in /offchain/batch/:id:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===== Gas 赞助池再平衡（与 API_ENDPOINTS.GAS_SPONSOR 对齐） =====
router.post('/gas/sponsor', async (req, res) => {
  try {
    const body = req.body || {};
    const operations: Array<{ account: string; deltaBudget?: string | number | bigint; setBudget?: string | number | bigint }> =
      Array.isArray(body.operations) ? body.operations : [];

    if (!operations.length) {
      return res.status(400).json({ success: false, error: 'invalid_operations' });
    }

    const toBigInt = (v: any): bigint => {
      if (typeof v === 'bigint') return v;
      if (typeof v === 'number') return BigInt(v);
      if (typeof v === 'string') return BigInt(v);
      throw new Error('invalid_bigint_value');
    };

    const normalizedOps = operations.map(op => ({
      account: op.account,
      setBudget: op.setBudget !== undefined ? toBigInt(op.setBudget) : undefined,
      deltaBudget: op.deltaBudget !== undefined ? toBigInt(op.deltaBudget) : undefined,
    }));

    const results = SponsorPoolService.rebalance(normalizedOps);
    return res.json({ success: true, pools: results });
  } catch (e) {
    console.error('Error in /gas/sponsor:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 兼容旧接口命名：/gas-sponsor-rebalance
router.post('/gas-sponsor-rebalance', async (req, res) => {
  try {
    const body = req.body || {};
    const operations: Array<{ account: string; deltaBudget?: string | number | bigint; setBudget?: string | number | bigint }> =
      Array.isArray(body.operations) ? body.operations : [];

    const normalizedOps = operations.map(op => ({
      account: op.account,
      setBudget: op.setBudget !== undefined ? toBigIntSafe(op.setBudget) : undefined,
      deltaBudget: op.deltaBudget !== undefined ? toBigIntSafe(op.deltaBudget) : undefined,
    }));

    const results = SponsorPoolService.rebalance(normalizedOps);
    return res.json({ success: true, pools: results });
  } catch (e) {
    console.error('Error in /gas-sponsor-rebalance:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===== 流动性元数据查询（占位实现） =====
router.get('/liquidity/meta', async (req, res) => {
  try {
    const pairId = (req.query.pairId as string) || '';
    // 简易从注册表读取（后续可扩展为动态元数据与配额）
    const { PAIR_REGISTRY, LIQUIDITY_CONFIG } = await import('../../shared/constants/blockchain.js');
    const pair = PAIR_REGISTRY.pairs.find((p: any) => p.pairId === pairId) || PAIR_REGISTRY.pairs[0];
    if (!pair) {
      return res.status(404).json({ success: false, error: 'pair_not_found' });
    }
    const meta = {
      pairId: pair.pairId,
      base: pair.base,
      quote: pair.quote,
      decimals: pair.decimals,
      quotas: {
        minLiquidityThreshold: LIQUIDITY_CONFIG.MIN_LIQUIDITY_THRESHOLD.toString(),
        maxPriceDeviation: LIQUIDITY_CONFIG.MAX_PRICE_DEVIATION,
      },
      updateIntervalMs: LIQUIDITY_CONFIG.ORDER_BOOK_UPDATE_INTERVAL,
    };
    return res.json({ success: true, meta });
  } catch (e) {
    console.error('Error in /liquidity/meta:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});