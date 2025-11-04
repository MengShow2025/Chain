// Reload trigger: updated on witness duplicate fix / 重新加载触发器：在见证人重复修复时更新
import { Router } from 'express';
import { blockchainInstance } from '../../shared/blockchain-instance';
import { Transaction } from '../../shared/types/blockchain.js';
import { SponsorPoolService } from '../../blockchain/core/sponsor-pool.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Top-level BigInt parsing utility for routes and parsing / 顶层 BigInt 解析工具，供路由与解析使用
function toBigIntSafe(v: any): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(v);
  if (typeof v === 'string') return BigInt(v);
  throw new Error('invalid_bigint_value');
}

// Convert numeric values in request body to BigInt (consistent with P2P layer) / 将请求体中的数值统一转为 BigInt（与 P2P 层保持一致）
function parseTransaction(tx: any): any {
  if (!tx) return tx;
  const t = { ...tx };
  const toBigInt = (v: any) => {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'string') return BigInt(v);
    if (typeof v === 'number') return BigInt(v);
    return v;
  };
  // Convert main fields to BigInt / 主字段统一转为 BigInt
  t.value = toBigInt(t.value);
  t.gas = toBigInt(t.gas);
  t.gasPrice = toBigInt(t.gasPrice);
  // Nonce unified as number / nonce 统一为 number
  if (typeof t.nonce === 'string') {
    const n = Number(t.nonce);
    t.nonce = Number.isFinite(n) ? n : t.nonce;
  }

  return t;
}

/**
 * 获取交易列表 / Get transactions list
 */
router.get('/', async (req, res) => {
  try {
    console.log('🔍 API: Getting transactions list...');
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    
    // 模拟交易数据 / Mock transaction data
    const mockTransactions = Array.from({ length: limit }, (_, i) => ({
      hash: `0x${Math.random().toString(16).substr(2, 64)}`,
      from: `0x${Math.random().toString(16).substr(2, 40)}`,
      to: `0x${Math.random().toString(16).substr(2, 40)}`,
      value: (Math.random() * 1000).toFixed(6),
      gas: Math.floor(Math.random() * 100000) + 21000,
      gasPrice: (Math.random() * 50 + 10).toFixed(2),
      nonce: Math.floor(Math.random() * 1000),
      blockNumber: 1234567 - i - offset,
      blockHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      transactionIndex: Math.floor(Math.random() * 100),
      timestamp: Date.now() - (i + offset) * 60000,
      status: Math.random() > 0.1 ? 'success' : 'failed',
      type: Math.random() > 0.3 ? 'transfer' : 'contract'
    }));
    
    const totalTransactions = 9876543 + Math.floor(Math.random() * 10000);
    const totalPages = Math.ceil(totalTransactions / limit);
    
    console.log('✅ API: Successfully generated transactions list');
    res.json({
      success: true,
      data: mockTransactions,
      pagination: {
        page,
        limit,
        total: totalTransactions,
        totalPages
      }
    });
  } catch (error) {
    console.error('❌ API: Error getting transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * 根据哈希获取交易详情 / Get transaction by hash
 */
router.get('/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    console.log(`🔍 API: Getting transaction details for hash: ${hash}`);
    
    // 模拟交易详情数据 / Mock transaction detail data
    const transactionDetail = {
      hash,
      from: `0x${Math.random().toString(16).substr(2, 40)}`,
      to: `0x${Math.random().toString(16).substr(2, 40)}`,
      value: (Math.random() * 1000).toFixed(6),
      gas: Math.floor(Math.random() * 100000) + 21000,
      gasPrice: (Math.random() * 50 + 10).toFixed(2),
      gasUsed: Math.floor(Math.random() * 50000) + 21000,
      nonce: Math.floor(Math.random() * 1000),
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
      blockHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      transactionIndex: Math.floor(Math.random() * 100),
      timestamp: Date.now() - Math.floor(Math.random() * 86400000),
      status: Math.random() > 0.1 ? 'success' : 'failed',
      type: Math.random() > 0.3 ? 'transfer' : 'contract',
      input: Math.random() > 0.5 ? '0x' : `0x${Math.random().toString(16).substr(2, 128)}`,
      logs: [],
      confirmations: Math.floor(Math.random() * 1000) + 1
    };
    
    console.log('✅ API: Successfully generated transaction details');
    res.json({
      success: true,
      data: transactionDetail
    });
  } catch (error) {
    console.error('❌ API: Error getting transaction details:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Submit single transaction / 提交单个交易
router.post('/submit', async (req, res) => {
  try {
    const transaction = parseTransaction(req.body);
    
    // Get blockchain instance / 获取区块链实例
    const chain = blockchainInstance.getBlockchain();
    if (!chain) {
      console.error('Blockchain instance not available');
      return res.status(503).json({
        success: false,
        error: 'Blockchain service not available'
      });
    }

    // Add timestamp if not present / 添加时间戳（如果没有的话）
    if (!transaction.timestamp) {
      transaction.timestamp = Date.now();
    }

    console.log('Submitting transaction to blockchain...');
    
    // Submit transaction / 提交交易
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
        error: 'Transaction submission failed'
      });
    }
  } catch (error) {
    console.error('Transaction submission error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Batch submit transactions / 批量提交交易
router.post('/batch', async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions)) {
      return res.status(400).json({ success: false, error: 'transactions must be an array' });
    }
    
    const parsed = transactions.map(parseTransaction);
    const chain = blockchainInstance.getBlockchain();
    if (!chain) {
      return res.status(503).json({ success: false, error: 'Blockchain service not available' });
    }
    
    const result = (chain as any).submitTransactions?.(parsed);
    
    // If submitTransactions doesn't exist, submit one by one / 如果 submitTransactions 不存在，逐个提交
    if (!result) {
      let success = 0, failed = 0;
      for (const tx of parsed) {
        // Simple validity check / 简单有效性校验
        if (!tx || !tx.hash || !tx.from || typeof tx.nonce !== 'number') { failed++; continue; }
        const ok = await chain.submitTransaction(tx);
        ok ? success++ : failed++;
      }
      return res.json({ success: true, result: { success, failed } });
    }
    return res.json({ success: true, result });
  } catch (e) {
    console.error('Batch transaction error:', e);
    res.status(400).json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// Get transaction pool statistics / 获取交易池统计
router.get('/pool/stats', async (req, res) => {
  try {
    const chain = blockchainInstance.getBlockchain();
    if (!chain) {
      return res.status(503).json({ success: false, error: 'Blockchain service not available' });
    }
    
    const stats = (chain as any).getTransactionPoolStats?.() || {
      pending: 0,
      queued: 0,
      total: 0
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Pool stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get pool stats' });
  }
});

// Get transaction pool security statistics / 获取交易池安全统计
router.get('/pool/security', async (req, res) => {
  try {
    const chain = blockchainInstance.getBlockchain();
    if (!chain) {
      return res.status(503).json({ success: false, error: 'Blockchain service not available' });
    }
    
    const securityStats = (chain as any).getTransactionPoolSecurityStats?.() || {
      duplicateCount: 0,
      invalidCount: 0,
      suspiciousCount: 0
    };
    
    res.json({ success: true, securityStats });
  } catch (error) {
    console.error('Pool security stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get security stats' });
  }
});

// ===== Gas Sponsor Pool Rebalancing (aligned with API_ENDPOINTS.GAS_SPONSOR) ===== / ===== Gas 赞助池再平衡（与 API_ENDPOINTS.GAS_SPONSOR 对齐） =====

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

// ===== 流动性元数据查询（占位实现） ===== / ===== 流动性元数据查询（占位实现） =====
router.get('/liquidity/metadata', async (req, res) => {
  try {
    // Simple read from registry (can be extended for dynamic metadata and quotas) / 简易从注册表读取（后续可扩展为动态元数据与配额）
    
    const pairId = (req.query.pairId as string) || '';
    const { PAIR_REGISTRY, LIQUIDITY_CONFIG } = await import('../../shared/constants/blockchain');
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
export default router;