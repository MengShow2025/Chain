/**
 * 性能增强测试
 * Performance Enhancement Test
 * 
 * 验证增强并行处理能力的实现
 * Verify enhanced parallel processing capabilities implementation
 */

import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor';
import { HighPerformanceProcessor } from './blockchain/core/high-performance-processor';
import { TransactionPool } from './blockchain/core/transaction-pool';
import { Transaction } from './blockchain/types/blockchain';

// 创建测试交易 / Create test transactions
function createPerformanceTestTransactions(count: number): Transaction[] {
  const transactions: Transaction[] = [];
  
  for (let i = 0; i < count; i++) {
    transactions.push({
      hash: `perf-tx-${i}-${Date.now()}`,
      from: `0x${Math.random().toString(16).substr(2, 40)}`,
      to: `0x${Math.random().toString(16).substr(2, 40)}`,
      value: Math.floor(Math.random() * 100000),
      gas: Math.floor(Math.random() * 100000) + 21000,
      gasPrice: Math.floor(Math.random() * 100) + 10,
      data: i % 5 === 0 ? `0x${Math.random().toString(16).substr(2, 64)}` : '0x',
      nonce: i,
      timestamp: Date.now() + i,
      blockNumber: 0,
      blockHash: '',
      transactionIndex: 0,
      status: 'pending',
      isZeroGas: i % 10 === 0, // 10% 零Gas交易 / 10% zero gas transactions
      contractTierFeeLevel: i % 3 as 0 | 1 | 2
    });
  }
  
  return transactions;
}

// 性能增强测试 / Performance enhancement test
async function testPerformanceEnhancement(): Promise<void> {
  console.log('🚀 开始性能增强测试 / Starting performance enhancement test');
  console.log('='.repeat(80));
  
  try {
    // 测试1: 增强并行处理器性能 / Test 1: Enhanced parallel processor performance
    console.log('\n📋 测试1: 增强并行处理器性能测试 / Test 1: Enhanced parallel processor performance test');
    
    const enhancedProcessor = new EnhancedParallelProcessor();
    const testTransactions = createPerformanceTestTransactions(200);
    
    console.log(`📦 创建了 ${testTransactions.length} 个测试交易 / Created ${testTransactions.length} test transactions`);
    
    // 启动处理器 / Start processor
    await enhancedProcessor.startProcessing();
    console.log('✅ 增强并行处理器已启动 / Enhanced parallel processor started');
    
    const startTime = Date.now();
    
    // 批量添加交易 / Add transactions in batch
    console.log('📥 批量添加交易到处理队列... / Adding transactions to processing queue in batch...');
    for (const tx of testTransactions) {
      enhancedProcessor.addTransaction(tx);
    }
    
    // 等待处理完成 / Wait for processing completion
    console.log('⏳ 等待处理完成... / Waiting for processing completion...');
    let waitTime = 0;
    const maxWaitTime = 15000; // 15秒最大等待时间 / 15 seconds max wait time
    
    while (waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitTime += 1000;
      
      const stats = enhancedProcessor.getProcessingStats();
      console.log(`⏱️ 等待时间: ${waitTime/1000}s, 已处理: ${stats.totalProcessed}/${testTransactions.length}`);
      
      if (stats.totalProcessed >= testTransactions.length) {
        break;
      }
    }
    
    const processingTime = Date.now() - startTime;
    const finalStats = enhancedProcessor.getProcessingStats();
    
    console.log('\n📊 增强并行处理器最终统计 / Enhanced parallel processor final statistics:');
    console.log({
      totalProcessed: finalStats.totalProcessed,
      totalSuccessful: finalStats.totalSuccessful,
      totalFailed: finalStats.totalFailed,
      successRate: ((finalStats.totalSuccessful / finalStats.totalProcessed) * 100).toFixed(1) + '%',
      processingTime: processingTime + 'ms',
      averageTPS: (finalStats.totalProcessed / (processingTime / 1000)).toFixed(2),
      currentTPS: finalStats.currentTPS.toFixed(2),
      averageLatency: finalStats.averageLatency.toFixed(2) + 'ms'
    });
    
    // 停止处理器 / Stop processor
    await enhancedProcessor.stopProcessing();
    console.log('✅ 增强并行处理器已停止 / Enhanced parallel processor stopped');
    
    // 测试2: 高性能处理器对比 / Test 2: High performance processor comparison
    console.log('\n📋 测试2: 高性能处理器对比测试 / Test 2: High performance processor comparison test');
    
    const transactionPool = new TransactionPool();
    const comparisonTransactions = createPerformanceTestTransactions(100);
    
    // 添加交易到池 / Add transactions to pool
    for (const tx of comparisonTransactions) {
      transactionPool.addTransaction(tx);
    }
    
    const highPerfProcessor = new HighPerformanceProcessor(transactionPool);
    console.log('✅ 高性能处理器已启动 / High performance processor started');
    
    // 等待处理 / Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const highPerfMetrics = highPerfProcessor.getMetrics();
    console.log('\n📊 高性能处理器统计 / High performance processor statistics:');
    console.log({
      totalProcessed: highPerfMetrics.totalProcessed,
      throughputPerSecond: highPerfMetrics.throughputPerSecond.toFixed(2),
      averageLatency: highPerfMetrics.averageLatency.toFixed(2) + 'ms',
      errorRate: highPerfMetrics.errorRate.toFixed(2) + '%',
      parallelUtilization: highPerfMetrics.parallelUtilization.toFixed(2) + '%',
      batchEfficiency: highPerfMetrics.batchEfficiency.toFixed(2) + '%'
    });
    
    // 测试3: 性能对比分析 / Test 3: Performance comparison analysis
    console.log('\n📋 测试3: 性能对比分析 / Test 3: Performance comparison analysis');
    
    const enhancedTPS = finalStats.totalProcessed / (processingTime / 1000);
    const highPerfTPS = highPerfMetrics.throughputPerSecond;
    
    console.log('🔍 性能对比结果 / Performance comparison results:');
    console.log(`增强并行处理器 TPS: ${enhancedTPS.toFixed(2)}`);
    console.log(`高性能处理器 TPS: ${highPerfTPS.toFixed(2)}`);
    console.log(`性能提升: ${((enhancedTPS / highPerfTPS - 1) * 100).toFixed(1)}%`);
    
    console.log(`增强并行处理器延迟: ${finalStats.averageLatency.toFixed(2)}ms`);
    console.log(`高性能处理器延迟: ${highPerfMetrics.averageLatency.toFixed(2)}ms`);
    
    const latencyImprovement = ((highPerfMetrics.averageLatency - finalStats.averageLatency) / highPerfMetrics.averageLatency) * 100;
    console.log(`延迟改善: ${latencyImprovement.toFixed(1)}%`);
    
    // 测试4: 并行处理能力验证 / Test 4: Parallel processing capability verification
    console.log('\n📋 测试4: 并行处理能力验证 / Test 4: Parallel processing capability verification');
    
    const parallelProcessor = new EnhancedParallelProcessor();
    await parallelProcessor.startProcessing();
    
    // 创建不同层级的交易 / Create transactions for different tiers
    const tier1Transactions = createPerformanceTestTransactions(50);
    const tier2Transactions = createPerformanceTestTransactions(50);
    const tier3Transactions = createPerformanceTestTransactions(50);
    
    // 设置不同的Gas价格来影响分层 / Set different gas prices to affect tiering
    tier1Transactions.forEach(tx => tx.gasPrice = 100); // 高优先级 / High priority
    tier2Transactions.forEach(tx => tx.gasPrice = 50);  // 中优先级 / Medium priority
    tier3Transactions.forEach(tx => tx.gasPrice = 20);  // 低优先级 / Low priority
    
    const parallelStartTime = Date.now();
    
    // 同时添加所有层级的交易 / Add all tier transactions simultaneously
    console.log('📥 同时添加多层级交易... / Adding multi-tier transactions simultaneously...');
    [...tier1Transactions, ...tier2Transactions, ...tier3Transactions].forEach(tx => {
      parallelProcessor.addTransaction(tx);
    });
    
    // 等待并行处理完成 / Wait for parallel processing completion
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    const parallelProcessingTime = Date.now() - parallelStartTime;
    const parallelStats = parallelProcessor.getProcessingStats();
    
    console.log('\n📊 并行处理统计 / Parallel processing statistics:');
    console.log({
      totalProcessed: parallelStats.totalProcessed,
      processingTime: parallelProcessingTime + 'ms',
      parallelTPS: (parallelStats.totalProcessed / (parallelProcessingTime / 1000)).toFixed(2),
      successRate: ((parallelStats.totalSuccessful / parallelStats.totalProcessed) * 100).toFixed(1) + '%'
    });
    
    await parallelProcessor.stopProcessing();
    
    console.log('\n🎉 性能增强测试完成! / Performance enhancement test completed!');
    console.log('='.repeat(80));
    
    // 验证性能提升 / Verify performance improvement
    if (enhancedTPS > highPerfTPS * 0.8) { // 至少80%的性能 / At least 80% performance
      console.log('✅ 性能增强测试通过 / Performance enhancement test passed');
      return true;
    } else {
      console.log('❌ 性能增强测试未达到预期 / Performance enhancement test did not meet expectations');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 性能增强测试过程中出现错误 / Error during performance enhancement test:', error);
    throw error;
  }
}

// 运行测试 / Run test
testPerformanceEnhancement()
  .then((success) => {
    if (success) {
      console.log('✅ 性能增强测试成功完成 / Performance enhancement test completed successfully');
      process.exit(0);
    } else {
      console.log('❌ 性能增强测试失败 / Performance enhancement test failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ 性能增强测试失败 / Performance enhancement test failed:', error);
    process.exit(1);
  });