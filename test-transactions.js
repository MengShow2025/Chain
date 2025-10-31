#!/usr/bin/env node

/**
 * TitanChain 交易测试脚本
 * 用于提交测试交易，触发区块生产
 */

const API_BASE_URL = 'http://localhost:3001';

/**
 * 生成测试交易
 */
function generateTestTransaction(index) {
  return {
    hash: `0x${Math.random().toString(16).substr(2, 64)}`,
    from: `0x${Math.random().toString(16).substr(2, 40)}`,
    to: `0x${Math.random().toString(16).substr(2, 40)}`,
    value: BigInt(Math.floor(Math.random() * 1000000)).toString(),
    gas: BigInt(21000).toString(),
    gasPrice: BigInt(20000000000).toString(),
    nonce: index,
    data: '0x',
    timestamp: Date.now(),
    signature: {
      r: `0x${Math.random().toString(16).substr(2, 64)}`,
      s: `0x${Math.random().toString(16).substr(2, 64)}`,
      v: 27 + Math.floor(Math.random() * 2)
    }
  };
}

/**
 * 提交交易到API
 */
async function submitTransaction(transaction) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transactions/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transaction)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Transaction ${transaction.hash.substr(0, 10)}... submitted successfully`);
      return true;
    } else {
      console.log(`❌ Failed to submit transaction ${transaction.hash.substr(0, 10)}...`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error submitting transaction:`, error.message);
    return false;
  }
}

/**
 * 检查网络状态
 */
async function checkNetworkStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/network/stats`);
    if (response.ok) {
      const stats = await response.json();
      console.log(`📊 Network Stats:`, {
        blockHeight: stats.totalBlocks,
        totalTransactions: stats.totalTransactions,
        tps: stats.tps,
        validators: stats.totalValidators
      });
      return stats;
    }
  } catch (error) {
    console.error('❌ Error fetching network stats:', error.message);
  }
  return null;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 Starting TitanChain transaction test...');
  
  // 检查初始状态
  console.log('\n📊 Initial network status:');
  await checkNetworkStatus();
  
  // 提交测试交易
  console.log('\n💸 Submitting test transactions...');
  const transactions = [];
  
  for (let i = 0; i < 10; i++) {
    const tx = generateTestTransaction(i);
    transactions.push(tx);
    await submitTransaction(tx);
    
    // 每次提交后稍等一下
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✅ Submitted ${transactions.length} test transactions`);
  
  // 等待区块生产
  console.log('\n⏳ Waiting for block production...');
  
  let attempts = 0;
  const maxAttempts = 30; // 等待30秒
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    
    const stats = await checkNetworkStatus();
    if (stats && stats.totalBlocks > 0) {
      console.log(`\n🎉 Success! Blocks are being produced!`);
      console.log(`📈 Current block height: ${stats.totalBlocks}`);
      console.log(`📊 Total transactions: ${stats.totalTransactions}`);
      break;
    }
    
    if (attempts % 5 === 0) {
      console.log(`⏳ Still waiting... (${attempts}/${maxAttempts}s)`);
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n⚠️  Timeout: No blocks produced after 30 seconds');
    console.log('💡 This might indicate an issue with the block production mechanism');
  }
  
  // 最终状态检查
  console.log('\n📊 Final network status:');
  await checkNetworkStatus();
}

// 运行测试
main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});