#!/usr/bin/env tsx

// Test blockchain instance status / 测试区块链实例状态
import { blockchainInstance } from './shared/blockchain-instance.js';

console.log('🔍 Testing blockchain instance status...');

const blockchain = blockchainInstance.getBlockchain();

if (blockchain) {
  console.log('✅ Blockchain instance is available');
  console.log('📊 Blockchain type:', blockchain.constructor.name);
  
  // Test if blockchain has required methods / 测试区块链是否有必需的方法
  const methods = ['getTransactionPoolStats', 'getNetworkStats', 'getBlockHeight'];
  for (const method of methods) {
    if (typeof (blockchain as any)[method] === 'function') {
      console.log(`✅ Method ${method} is available`);
    } else {
      console.log(`❌ Method ${method} is NOT available`);
    }
  }
  
  // Try to get transaction pool stats / 尝试获取交易池统计
  try {
    const stats = (blockchain as any).getTransactionPoolStats?.();
    console.log('📈 Transaction pool stats:', stats);
  } catch (error) {
    console.error('❌ Error getting transaction pool stats:', error.message);
  }
  
} else {
  console.log('❌ Blockchain instance is NOT available');
  console.log('💡 Make sure the blockchain node is running with "npm run dev:full"');
}

console.log('🏁 Test completed');