/**
 * TitanChain增强版测试 - 混合双区块架构测试
 * TitanChain Enhanced Test - Hybrid Dual-Block Architecture Test
 */

import { TitanChainEnhanced } from './blockchain/core/titan-chain-enhanced.js';
import { Transaction, Validator } from './shared/types/blockchain.js';
import { DUAL_BLOCK_CONFIG } from './blockchain/core/dual-block-config.js';

/**
 * 创建测试验证节点
 * Create test validators
 */
function createTestValidators(): Validator[] {
  return [
    {
      address: '0x1234567890123456789012345678901234567890',
      publicKey: '0x1234567890123456789012345678901234567890123456789012345678901234567890',
      stake: BigInt('1000000000000000000000'), // 1000 ETH
      isActive: true,
      reputation: 100,
      lastBlockProduced: 0,
      totalBlocksProduced: 0,
      slashCount: 0,
      joinedAt: Date.now()
    },
    {
      address: '0x2345678901234567890123456789012345678901',
      publicKey: '0x2345678901234567890123456789012345678901234567890123456789012345678901',
      stake: BigInt('800000000000000000000'), // 800 ETH
      isActive: true,
      reputation: 95,
      lastBlockProduced: 0,
      totalBlocksProduced: 0,
      slashCount: 0,
      joinedAt: Date.now()
    },
    {
      address: '0x3456789012345678901234567890123456789012',
      publicKey: '0x3456789012345678901234567890123456789012345678901234567890123456789012',
      stake: BigInt('600000000000000000000'), // 600 ETH
      isActive: true,
      reputation: 90,
      lastBlockProduced: 0,
      totalBlocksProduced: 0,
      slashCount: 0,
      joinedAt: Date.now()
    }
  ];
}

/**
 * 创建测试交易
 * Create test transactions
 */
function createTestTransactions(): Transaction[] {
  const transactions: Transaction[] = [];
  
  // 创建简单交易（适合快速区块）/ Create simple transactions (suitable for fast blocks)
  for (let i = 0; i < 10; i++) {
    transactions.push({
      hash: `0x${i.toString().padStart(64, '0')}`,
      from: `0x${(i + 1000).toString(16).padStart(40, '0')}`,
      to: `0x${(i + 2000).toString(16).padStart(40, '0')}`,
      value: BigInt(1000000000000000000), // 1 ETH
      gasLimit: BigInt(21000), // 简单转账 / Simple transfer
      gasPrice: BigInt(20000000000), // 20 Gwei
      nonce: i,
      data: '0x',
      signature: `0x${'a'.repeat(130)}`,
      timestamp: Date.now(),
      isZeroGas: false
    });
  }
  
  // 创建复杂交易（适合批量区块）/ Create complex transactions (suitable for batch blocks)
  for (let i = 10; i < 15; i++) {
    transactions.push({
      hash: `0x${i.toString().padStart(64, '0')}`,
      from: `0x${(i + 1000).toString(16).padStart(40, '0')}`,
      to: `0x${(i + 2000).toString(16).padStart(40, '0')}`,
      value: BigInt(0),
      gasLimit: BigInt(2000000), // 复杂合约调用 / Complex contract call
      gasPrice: BigInt(30000000000), // 30 Gwei
      nonce: i,
      data: '0x' + 'a'.repeat(1000), // 复杂数据 / Complex data
      signature: `0x${'b'.repeat(130)}`,
      timestamp: Date.now(),
      isZeroGas: false
    });
  }
  
  // 创建零Gas交易 / Create zero-gas transactions
  for (let i = 15; i < 20; i++) {
    transactions.push({
      hash: `0x${i.toString().padStart(64, '0')}`,
      from: `0x${(i + 1000).toString(16).padStart(40, '0')}`,
      to: `0x${(i + 2000).toString(16).padStart(40, '0')}`,
      value: BigInt(500000000000000000), // 0.5 ETH
      gasLimit: BigInt(21000),
      gasPrice: BigInt(0), // 零Gas / Zero gas
      nonce: i,
      data: '0x',
      signature: `0x${'c'.repeat(130)}`,
      timestamp: Date.now(),
      isZeroGas: true
    });
  }
  
  return transactions;
}

/**
 * 测试增强版TitanChain
 * Test TitanChain Enhanced
 */
async function testTitanChainEnhanced(): Promise<void> {
  console.log('🚀 开始测试TitanChain增强版 - 混合双区块架构 / Starting TitanChain Enhanced test - Hybrid Dual-Block Architecture');
  console.log('=' .repeat(80));
  
  try {
    // 1. 初始化增强版TitanChain / Initialize TitanChain Enhanced
    console.log('\n📋 步骤 1: 初始化增强版TitanChain / Step 1: Initialize TitanChain Enhanced');
    const titanChain = new TitanChainEnhanced();
    const validators = createTestValidators();
    
    // 2. 启动网络 / Start network
    console.log('\n📋 步骤 2: 启动增强版网络 / Step 2: Start enhanced network');
    await titanChain.start(validators);
    
    // 等待系统稳定 / Wait for system to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. 测试交易提交和路由 / Test transaction submission and routing
    console.log('\n📋 步骤 3: 测试交易提交和智能路由 / Step 3: Test transaction submission and smart routing');
    const transactions = createTestTransactions();
    
    console.log(`📤 提交 ${transactions.length} 个测试交易 / Submitting ${transactions.length} test transactions`);
    
    let successCount = 0;
    for (const tx of transactions) {
      const success = await titanChain.submitTransaction(tx);
      if (success) {
        successCount++;
      }
      
      // 小延迟以观察路由效果 / Small delay to observe routing effect
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ 成功提交 ${successCount}/${transactions.length} 个交易 / Successfully submitted ${successCount}/${transactions.length} transactions`);
    
    // 4. 等待区块生产 / Wait for block production
    console.log('\n📋 步骤 4: 等待双区块系统生产区块 / Step 4: Wait for dual-block system to produce blocks');
    
    // 等待足够时间让快速区块和批量区块都被生产 / Wait enough time for both fast and batch blocks to be produced
    console.log('⏳ 等待10秒观察区块生产... / Waiting 10 seconds to observe block production...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 5. 检查网络状态 / Check network status
    console.log('\n📋 步骤 5: 检查增强版网络状态 / Step 5: Check enhanced network status');
    const networkStats = titanChain.getEnhancedNetworkStats();
    
    console.log('\n📊 增强版网络统计 / Enhanced Network Statistics:');
    console.log(`   总区块高度 / Total Block Height: ${networkStats.blockHeight}`);
    console.log(`   快速区块数量 / Fast Blocks: ${networkStats.fastBlockCount}`);
    console.log(`   批量区块数量 / Batch Blocks: ${networkStats.batchBlockCount}`);
    console.log(`   快速区块TPS / Fast Block TPS: ${networkStats.fastBlockTPS.toFixed(2)}`);
    console.log(`   批量区块TPS / Batch Block TPS: ${networkStats.batchBlockTPS.toFixed(2)}`);
    console.log(`   总体TPS / Overall TPS: ${networkStats.currentTPS.toFixed(2)}`);
    console.log(`   路由效率 / Routing Efficiency: ${(networkStats.routingEfficiency * 100).toFixed(2)}%`);
    console.log(`   网络健康状态 / Network Health: ${networkStats.networkHealth}`);
    console.log(`   活跃验证节点 / Active Validators: ${networkStats.activeValidators}`);
    console.log(`   总质押量 / Total Staked: ${networkStats.totalStaked.toString()} wei`);
    
    // 6. 检查双区块系统详细状态 / Check dual-block system detailed status
    console.log('\n📊 双区块系统详细状态 / Dual-Block System Detailed Status:');
    const dualBlockStatus = networkStats.dualBlockSystem;
    
    console.log('\n🚀 快速区块状态 / Fast Block Status:');
    console.log(`   队列大小 / Queue Size: ${dualBlockStatus.fastBlock.queueSize}`);
    console.log(`   区块数量 / Block Count: ${dualBlockStatus.fastBlock.blockCount}`);
    console.log(`   平均延迟 / Average Latency: ${dualBlockStatus.fastBlock.averageLatency}ms`);
    console.log(`   错误数量 / Error Count: ${dualBlockStatus.fastBlock.errorCount}`);
    console.log(`   是否运行 / Is Running: ${dualBlockStatus.fastBlock.isRunning}`);
    
    console.log('\n📦 批量区块状态 / Batch Block Status:');
    console.log(`   队列大小 / Queue Size: ${dualBlockStatus.batchBlock.queueSize}`);
    console.log(`   区块数量 / Block Count: ${dualBlockStatus.batchBlock.blockCount}`);
    console.log(`   平均延迟 / Average Latency: ${dualBlockStatus.batchBlock.averageLatency}ms`);
    console.log(`   错误数量 / Error Count: ${dualBlockStatus.batchBlock.errorCount}`);
    console.log(`   是否运行 / Is Running: ${dualBlockStatus.batchBlock.isRunning}`);
    
    console.log('\n🎯 路由统计 / Routing Statistics:');
    console.log(`   快速区块路由 / Fast Block Routed: ${dualBlockStatus.routingStats.fast || 0}`);
    console.log(`   批量区块路由 / Batch Block Routed: ${dualBlockStatus.routingStats.batch || 0}`);
    console.log(`   零Gas交易路由 / Zero-Gas Routed: ${dualBlockStatus.routingStats.zeroGas || 0}`);
    
    // 7. 性能基准测试 / Performance benchmarking
    console.log('\n📋 步骤 6: 性能基准测试 / Step 6: Performance benchmarking');
    
    console.log('\n🎯 性能目标对比 / Performance Target Comparison:');
    const targets = networkStats.performanceTargets;
    
    console.log(`   快速区块延迟目标 / Fast Block Latency Target: ${targets.fastBlockLatency}ms`);
    console.log(`   实际快速区块延迟 / Actual Fast Block Latency: ${networkStats.averageFastBlockTime}ms`);
    console.log(`   快速区块延迟达标 / Fast Block Latency Met: ${networkStats.averageFastBlockTime <= targets.fastBlockLatency ? '✅' : '❌'}`);
    
    console.log(`   批量区块延迟目标 / Batch Block Latency Target: ${targets.batchBlockLatency}ms`);
    console.log(`   实际批量区块延迟 / Actual Batch Block Latency: ${networkStats.averageBatchBlockTime}ms`);
    console.log(`   批量区块延迟达标 / Batch Block Latency Met: ${networkStats.averageBatchBlockTime <= targets.batchBlockLatency ? '✅' : '❌'}`);
    
    console.log(`   快速区块TPS目标 / Fast Block TPS Target: ${targets.fastBlockTPS}`);
    console.log(`   实际快速区块TPS / Actual Fast Block TPS: ${networkStats.fastBlockTPS.toFixed(2)}`);
    console.log(`   快速区块TPS达标 / Fast Block TPS Met: ${networkStats.fastBlockTPS >= targets.fastBlockTPS ? '✅' : '❌'}`);
    
    console.log(`   批量区块TPS目标 / Batch Block TPS Target: ${targets.batchBlockTPS}`);
    console.log(`   实际批量区块TPS / Actual Batch Block TPS: ${networkStats.batchBlockTPS.toFixed(2)}`);
    console.log(`   批量区块TPS达标 / Batch Block TPS Met: ${networkStats.batchBlockTPS >= targets.batchBlockTPS ? '✅' : '❌'}`);
    
    // 8. 测试结果评估 / Test result evaluation
    console.log('\n📋 步骤 7: 测试结果评估 / Step 7: Test result evaluation');
    
    const testResults = {
      networkStarted: true,
      transactionsSubmitted: successCount === transactions.length,
      blocksProduced: networkStats.blockHeight > 0,
      fastBlocksWorking: networkStats.fastBlockCount > 0,
      batchBlocksWorking: networkStats.batchBlockCount > 0,
      routingWorking: networkStats.routingEfficiency > 0,
      performanceTargetsMet: {
        fastBlockLatency: networkStats.averageFastBlockTime <= targets.fastBlockLatency,
        batchBlockLatency: networkStats.averageBatchBlockTime <= targets.batchBlockLatency,
        fastBlockTPS: networkStats.fastBlockTPS >= targets.fastBlockTPS,
        batchBlockTPS: networkStats.batchBlockTPS >= targets.batchBlockTPS
      }
    };
    
    console.log('\n🎯 测试结果总结 / Test Results Summary:');
    console.log(`   网络启动 / Network Started: ${testResults.networkStarted ? '✅' : '❌'}`);
    console.log(`   交易提交 / Transactions Submitted: ${testResults.transactionsSubmitted ? '✅' : '❌'}`);
    console.log(`   区块生产 / Blocks Produced: ${testResults.blocksProduced ? '✅' : '❌'}`);
    console.log(`   快速区块工作 / Fast Blocks Working: ${testResults.fastBlocksWorking ? '✅' : '❌'}`);
    console.log(`   批量区块工作 / Batch Blocks Working: ${testResults.batchBlocksWorking ? '✅' : '❌'}`);
    console.log(`   智能路由工作 / Smart Routing Working: ${testResults.routingWorking ? '✅' : '❌'}`);
    
    const allTestsPassed = Object.values(testResults).every(result => 
      typeof result === 'boolean' ? result : Object.values(result).every(r => r)
    );
    
    // 9. 停止网络 / Stop network
    console.log('\n📋 步骤 8: 停止增强版网络 / Step 8: Stop enhanced network');
    await titanChain.stop();
    
    console.log('\n' + '='.repeat(80));
    if (allTestsPassed) {
      console.log('🎉 TitanChain增强版测试全部通过！混合双区块架构工作正常！');
      console.log('🎉 TitanChain Enhanced test passed! Hybrid dual-block architecture working properly!');
    } else {
      console.log('⚠️ TitanChain增强版测试部分失败，需要进一步优化');
      console.log('⚠️ TitanChain Enhanced test partially failed, further optimization needed');
    }
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ TitanChain增强版测试失败 / TitanChain Enhanced test failed:', error);
    throw error;
  }
}

// 运行测试 / Run test
if (import.meta.url === `file://${process.argv[1]}`) {
  testTitanChainEnhanced()
    .then(() => {
      console.log('\n✅ 测试完成 / Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 测试失败 / Test failed:', error);
      process.exit(1);
    });
}

export { testTitanChainEnhanced };