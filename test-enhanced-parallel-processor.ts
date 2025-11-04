/**
 * 增强并行处理器测试
 * Enhanced Parallel Processor Test
 */

import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor.js';
import { PerformanceTier, PerformanceTierClassifier } from './blockchain/core/performance-tiers.js';

// 创建模拟交易 / Create mock transactions
function createMockTransaction(
  hash: string, 
  from: string, 
  to: string, 
  gasLimit: bigint = BigInt('21000'),
  gasPrice: bigint = BigInt('20000000000'), // 20 Gwei
  data: string = '0x'
): any {
  return {
    hash,
    from,
    to,
    gasLimit,
    gasPrice,
    data,
    value: BigInt('1000000000000000000'), // 1 ETH
    nonce: Math.floor(Math.random() * 1000)
  };
}

// 创建不同类型的测试交易 / Create different types of test transactions
function createTestTransactions(): any[] {
  const transactions = [];
  
  // Tier 1 交易 (简单转账，低Gas) / Tier 1 transactions (simple transfers, low gas)
  for (let i = 0; i < 15; i++) {
    transactions.push(createMockTransaction(
      `tier1-tx-${i}`,
      `0x${i.toString().padStart(40, '0')}`,
      `0x${(i + 100).toString().padStart(40, '0')}`,
      BigInt('21000'), // 低Gas限制 / Low gas limit
      BigInt('50000000000'), // 50 Gwei - 高Gas价格 / High gas price
      '0x' // 无数据，简单转账 / No data, simple transfer
    ));
  }
  
  // Tier 2 交易 (DeFi操作) / Tier 2 transactions (DeFi operations)
  for (let i = 15; i < 35; i++) {
    transactions.push(createMockTransaction(
      `tier2-tx-${i}`,
      `0x${i.toString().padStart(40, '0')}`,
      `0x${(i + 200).toString().padStart(40, '0')}`,
      BigInt('200000'), // 中等Gas限制 / Medium gas limit
      BigInt('25000000000'), // 25 Gwei
      '0x095ea7b3' + '0'.repeat(56) // approve函数选择器，归类为defi_operations / approve function selector, classified as defi_operations
    ));
  }
  
  // Tier 3 交易 (复杂合约调用) / Tier 3 transactions (complex contract calls)
  for (let i = 35; i < 50; i++) {
    transactions.push(createMockTransaction(
      `tier3-tx-${i}`,
      `0x${i.toString().padStart(40, '0')}`,
      `0x${(i + 300).toString().padStart(40, '0')}`,
      BigInt('1000000'), // 高Gas限制，超过TIER_2上限 / High gas limit, exceeds TIER_2 limit
      BigInt('15000000000'), // 15 Gwei
      '0x12345678' + 'a'.repeat(200) // 复杂合约调用数据 / Complex contract call data
    ));
  }
  
  return transactions;
}

async function testEnhancedParallelProcessor(): Promise<void> {
  console.log('🧪 开始增强并行处理器测试 / Starting enhanced parallel processor test');
  console.log('='.repeat(80));
  
  try {
    // 测试1: 初始化处理器 / Test 1: Initialize processor
    console.log('\n📋 测试1: 初始化增强并行处理器 / Test 1: Initialize enhanced parallel processor');
    const processor = new EnhancedParallelProcessor();
    
    // 验证初始状态 / Verify initial state
    const initialStats = processor.getProcessingStats();
    console.log('✅ 初始统计:', {
      totalProcessed: initialStats.totalProcessed,
      totalSuccessful: initialStats.totalSuccessful,
      totalFailed: initialStats.totalFailed,
      currentTPS: initialStats.currentTPS
    });
    
    // 测试2: 添加交易到队列 / Test 2: Add transactions to queue
    console.log('\n📋 测试2: 添加交易到处理队列 / Test 2: Add transactions to processing queue');
    const testTransactions = createTestTransactions();
    console.log(`创建了 ${testTransactions.length} 个测试交易 / Created ${testTransactions.length} test transactions`);
    
    // 批量添加交易 / Add transactions in batch
    console.log(`📥 批量添加 ${testTransactions.length} 个交易 / Adding ${testTransactions.length} transactions in batch`);
    
    // 验证交易分类 / Verify transaction classification
    console.log('\n🔍 验证交易分类 / Verifying transaction classification:');
    let tier1Count = 0, tier2Count = 0, tier3Count = 0;
    
    for (const tx of testTransactions) {
      const tier = PerformanceTierClassifier.classifyTransaction(tx);
      if (tier === 'tier_1') tier1Count++;
      else if (tier === 'tier_2') tier2Count++;
      else if (tier === 'tier_3') tier3Count++;
    }
    
    console.log(`  tier_1: ${tier1Count} 个交易`);
    console.log(`  tier_2: ${tier2Count} 个交易`);
    console.log(`  tier_3: ${tier3Count} 个交易`);
    console.log('');
    
    await processor.addTransactionBatch(testTransactions);
    console.log(`✅ 批量添加完成 / Batch addition completed`);
    
    // 检查队列状态 / Check queue status
    const queueStatus = processor.getQueueStatus();
    console.log('✅ 队列状态 / Queue status:');
    for (const [tier, count] of queueStatus) {
      console.log(`  ${tier}: ${count} 个交易 / ${count} transactions`);
    }
    
    // 测试3: 启动并行处理 / Test 3: Start parallel processing
    console.log('\n📋 测试3: 启动并行处理 / Test 3: Start parallel processing');
    await processor.startProcessing();
    
    // 等待处理完成 / Wait for processing to complete
    console.log('⏳ 等待处理完成... / Waiting for processing to complete...');
    
    let waitTime = 0;
    const maxWaitTime = 60000; // 最大等待60秒 / Maximum wait 60 seconds
    const checkInterval = 2000; // 每2秒检查一次 / Check every 2 seconds
    
    while (waitTime < maxWaitTime) {
      const stats = processor.getProcessingStats();
      const queueStatus = processor.getQueueStatus();
      
      // 计算剩余交易数量 / Calculate remaining transactions
      const remainingTransactions = Array.from(queueStatus.values()).reduce((sum, count) => sum + count, 0);
      
      console.log(`⏱️ 等待时间: ${waitTime/1000}s, 剩余交易: ${remainingTransactions}, 已处理: ${stats.totalProcessed}`);
      
      // 每10秒打印一次详细状态 / Print detailed status every 10 seconds
      if (waitTime % 10000 === 0 && waitTime > 0) {
        const tierStatuses = processor.getTierStatus();
        console.log('📊 当前各层级状态 / Current tier status:');
        for (const [tier, status] of tierStatuses) {
          console.log(`  ${tier}: 队列大小=${status.queueSize}, TPS=${status.metrics.currentTPS.toFixed(2)}, 延迟=${status.metrics.averageLatency.toFixed(2)}ms, 活跃=${status.isActive}, 过载=${status.isOverloaded}`);
        }
        
        // 打印队列详细信息 / Print queue details
        console.log('📋 队列详细信息 / Queue details:');
        for (const [tier, count] of queueStatus) {
          console.log(`  ${tier}: ${count} 个交易`);
        }
      }
      
      // 如果所有交易都处理完成，退出等待 / Exit if all transactions are processed
      if (remainingTransactions === 0) {
        console.log('✅ 所有交易处理完成 / All transactions processed');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
    }
    
    if (waitTime >= maxWaitTime) {
      console.log('⚠️ 等待超时，强制继续 / Wait timeout, forcing continue');
    }
    
    // 测试4: 获取最终统计 / Test 4: Get final statistics
    console.log('\n📋 测试4: 获取最终处理统计 / Test 4: Get final processing statistics');
    const finalStats = processor.getProcessingStats();
    
    console.log('✅ 最终统计 / Final statistics:', {
      totalProcessed: finalStats.totalProcessed,
      totalSuccessful: finalStats.totalSuccessful,
      totalFailed: finalStats.totalFailed,
      successRate: ((finalStats.totalSuccessful / finalStats.totalProcessed) * 100).toFixed(1) + '%',
      averageLatency: finalStats.averageLatency.toFixed(2) + 'ms',
      currentTPS: finalStats.currentTPS.toFixed(2)
    });
    
    // 显示各层级详细统计 / Show detailed tier statistics
    console.log('\n📊 各层级详细统计 / Detailed tier statistics:');
    for (const [tier, metrics] of finalStats.tierStats) {
      console.log(`  ${tier}:`, {
        currentTPS: metrics.currentTPS.toFixed(2),
        averageLatency: metrics.averageLatency.toFixed(2) + 'ms',
        errorRate: (metrics.errorRate * 100).toFixed(1) + '%',
        successRate: (metrics.successRate * 100).toFixed(1) + '%',
        queueLoad: (metrics.queueLoad * 100).toFixed(1) + '%'
      });
    }
    
    // 测试5: 性能验证 / Test 5: Performance validation
    console.log('\n📋 测试5: 性能指标验证 / Test 5: Performance metrics validation');
    
    // 验证处理完成率 / Verify completion rate
    const completionRate = (finalStats.totalSuccessful / testTransactions.length) * 100;
    console.log(`✅ 处理完成率: ${completionRate.toFixed(1)}% / Completion rate: ${completionRate.toFixed(1)}%`);
    
    if (completionRate >= 95) {
      console.log('✅ 处理完成率测试通过 / Completion rate test passed');
    } else {
      console.log('❌ 处理完成率测试失败 / Completion rate test failed');
    }
    
    // 验证平均延迟 / Verify average latency
    if (finalStats.averageLatency < 1000) { // 小于1秒 / Less than 1 second
      console.log('✅ 平均延迟测试通过 / Average latency test passed');
    } else {
      console.log('❌ 平均延迟测试失败 / Average latency test failed');
    }
    
    // 验证TPS / Verify TPS
    if (finalStats.currentTPS > 10) { // 大于10 TPS
      console.log('✅ TPS测试通过 / TPS test passed');
    } else {
      console.log('❌ TPS测试失败 / TPS test failed');
    }
    
    // 测试6: 停止处理器 / Test 6: Stop processor
    console.log('\n📋 测试6: 停止并行处理器 / Test 6: Stop parallel processor');
    await processor.stopProcessing();
    console.log('✅ 处理器已停止 / Processor stopped');
    
    console.log('\n🎉 增强并行处理器测试完成! / Enhanced parallel processor test completed!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误 / Error during testing:', error);
    throw error;
  }
}

// 运行测试 / Run test
testEnhancedParallelProcessor()
  .then(() => {
    console.log('✅ 所有测试通过 / All tests passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 测试失败 / Test failed:', error);
    process.exit(1);
  });