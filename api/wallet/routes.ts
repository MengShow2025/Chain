import { Router } from 'express';
import { blockchainInstance } from '../../shared/blockchain-instance.js';

const router = Router();

/**
 * 获取单个地址的余额
 */
router.get('/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // 验证地址格式
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }

    const blockchain = blockchainInstance.getBlockchain();
    if (!blockchain) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain service not available'
      });
    }

    // 获取余额 - 通过EVM执行器
    const evmEngine = (blockchain as any).evmEngine;
    if (!evmEngine) {
      return res.status(503).json({
        success: false,
        error: 'EVM engine not available'
      });
    }

    const balance = await evmEngine.getAccountBalance(address);
    
    res.json({
      success: true,
      data: {
        address,
        balance: balance.toString(),
        balanceInTTN: (Number(balance) / Math.pow(10, 18)).toFixed(6)
      }
    });

  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 批量获取多个地址的余额
 */
router.post('/balance/batch', async (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Addresses array is required'
      });
    }

    if (addresses.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Too many addresses (max 50)'
      });
    }

    // 验证所有地址格式
    for (const address of addresses) {
      if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({
          success: false,
          error: `Invalid address format: ${address}`
        });
      }
    }

    const blockchain = blockchainInstance.getBlockchain();
    if (!blockchain) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain service not available'
      });
    }

    // 获取EVM执行器
    const evmEngine = (blockchain as any).evmEngine;
    if (!evmEngine) {
      return res.status(503).json({
        success: false,
        error: 'EVM engine not available'
      });
    }

    // 批量获取余额
    const balances = await Promise.all(
      addresses.map(async (address: string) => {
        try {
          const balance = await evmEngine.getAccountBalance(address);
          return {
            address,
            balance: balance.toString(),
            balanceInTTN: (Number(balance) / Math.pow(10, 18)).toFixed(6),
            success: true
          };
        } catch (error) {
          return {
            address,
            balance: '0',
            balanceInTTN: '0',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      })
    );

    res.json({
      success: true,
      data: balances
    });

  } catch (error) {
    console.error('Error getting batch balances:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 获取地址的详细信息（余额 + 交易历史统计）
 */
router.get('/info/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // 验证地址格式
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }

    const blockchain = blockchainInstance.getBlockchain();
    if (!blockchain) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain service not available'
      });
    }

    // 获取EVM执行器
    const evmEngine = (blockchain as any).evmEngine;
    if (!evmEngine) {
      return res.status(503).json({
        success: false,
        error: 'EVM engine not available'
      });
    }

    // 获取余额和账户信息
    const account = await evmEngine.getAccountInfo(address);
    const balance = account.balance;
    
    // 获取交易统计（使用账户nonce作为交易计数）
    let transactionCount = account.nonce;

    res.json({
      success: true,
      data: {
        address,
        balance: balance.toString(),
        balanceInTTN: (Number(balance) / Math.pow(10, 18)).toFixed(6),
        transactionCount,
        lastUpdated: Date.now()
      }
    });

  } catch (error) {
    console.error('Error getting address info:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;