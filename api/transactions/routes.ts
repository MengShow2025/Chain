import { Router } from 'express';
import { Transaction } from '../../shared/types/blockchain.js';
import { blockchainInstance } from '../../shared/blockchain-instance.js';

const router = Router();

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

export default router;