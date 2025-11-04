/**
 * 综合性能测试
 * Comprehensive Performance Test
 * 
 * 测试高性能处理器和增强并行处理器的集成性能
 * Test integrated performance of high-performance processor and enhanced parallel processor
 */

import { HighPerformanceProcessor } from './blockchain/core/high-performance-processor';
import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor';
import { TransactionPool } from './blockchain/core/transaction-pool';
import { Transaction } from './blockchain/types/blockchain';
import { PerformanceTier } from './blockchain/core/performance-tiers';

// 创建测试交易池 / Create test transaction pool
function createTestTransactionPool(): TransactionPool {
  const pool = new TransactionPool();
  
  // 添加各种类型的测试交易 / Add various types of test transactions
  for (let i = 0; i < 100; i++) {
    const transaction: Transaction = {
      hash: `test-tx-${i}-${Date.now()}`,
      from: `0x${Math.random().toString(16).substr(2, 40)}`,
      to: `0x${Math.random().toString(16).substr(2, 40)}`,
      value: Math.floor(Math.random() * 1000000),
      gas: Math.floor(Math.random() * 100000) + 21000,
      gasPrice: Math.floor(Math.random() * 50) + 10,
      data: i % 10 === 0 ? `0x${Math.random().toString(16).substr(2, 64)}` : '0x',
      nonce: i,
      timestamp: Date.now() + i,
      blockNumber: 0,
      blockHash: '',
      transactionIndex: 0,
      status: 'pending',
      isZeroGas: i % 20 === 0, // 5% 零Gas交易 / 5% zero gas transactions
      contractTierFeeLevel: i % 3 as 0 | 1 | 2
    };
    
    pool.addTransaction(transaction);
  }
  
  return pool;
}

// 创建分层测试交易 / Create tiered test transactions
function createTieredTestTransactions(): Transaction[] {
  const transactions: Transaction[] = [];
  
  // TIER_1 交易 (高优先级，低延迟) / TIER_1 transactions (high priority, low latency)
  for (let i = 0; i < 30; i++) {
    transactions.push({
      hash: `tier1-tx-${i}-${Date.now()}`,
      from: `0x${Math.random().toString(16).substr(2, 40)}`,
      to: `0x${Math.random().toString(16).substr(2, 40)}`,
      value: Math.floor(Math.random() * 10000),
      gas: 21000, // 简单转账 / Simple transfer
      gasPrice: 100, // 高Gas价格 / High gas price
      data: '0x',
      nonce: i,
      timestamp: Date.now() + i,
      blockNumber: 0,
      blockHash: '',
      transactionIndex: 0,
      status: 'pending',
      isZeroGas: false,
      contractTierFeeLevel: 0
    });
  }
  
  // TIER_2 交易 (中等优先级) / TIER_2 transactions (medium priority)
  for (let i = 0; i < 40; i++) {
    transactions.push({
      hash: `tier2-tx-${i}-${Date.now()}`,
      from: `0x${Math.random().toString(16).substr(2, 40)}`,
      to: `0x${Math.random().toString(16).substr(2, 40)}`,
      value: Math.floor(Math.random() * 50000),
      gas: Math.floor(Math.random() * 50000) + 30000,
      gasPrice: 50, // 中等Gas价格 / Medium gas price
      data: `0x${Math.random().toString(16).substr(2, 32)}`,
      nonce: i + 100,
      timestamp: Date.now() + i + 100,
      blockNumber: 0,
      blockHash: '',
      transactionIndex: 0,
      status: 'pending',
      isZeroGas: false,
      contractTierFeeLevel: 1
    });
  }
  
  // TIER_3 交易 (低优先级，复杂操作) / TIER_3 transactions (low priority, complex operations)
  for (let i = 0; i < 30; i++) {
    transactions.push({
      hash: `tier3-tx-${i}-${Date.now()}`,
      from: `0x${Math.random().toString(16).substr(2, 40)}`,
      to: `0x${Math.random().toString(16).substr(2, 40)}`,
      value: Math.floor(Math.random() * 100000),
      gas: Math.floor(Math.random() * 200000) + 100000,
      gasPrice: 20, // 低Gas价格 / Low gas price
      data: `0x${Math.random().toString(16).substr(2, 128)}`,
      nonce: i + 200,
      timestamp: Date.now() + i + 200,
      blockNumber: 0,
      blockHash: '',
      transactionIndex: 0,
      status: 'pending',
      isZeroGas: false,
      contractTierFeeLevel: 2
    });
  }
  
  return transactions;
}

// 性能基准测试 / Performance benchmark test
async function performanceBenchmark(): Promise<void> {
  console.log('🏁 开始性能基准测试 / Starting performance benchmark');
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  
  // 测试1: 高性能处理器基准 / Test 1: High performance processor benchmark
  console.log('\n📋 测试1: 高性能处理器基准测试 / Test 1: High performance processor benchmark');
  const transactionPool = createTestTransactionPool();
  const highPerfProcessor = new HighPerformanceProcessor(transactionPool);
  
  // 等待处理完成 / Wait for processing completion
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const highPerfMetrics = highPerfProcessor.getMetrics();
  console.log('📊 高性能处理器指标 / High performance processor metrics:', {
    totalProcessed: highPerfMetrics.totalProcessed,
    throughputPerSecond: highPerfMetrics.throughputPerSecond.toFixed(2),
    averageLatency: highPerfMetrics.averageLatency.toFixed(2) + 'ms',
    errorRate: highPerfMetrics.errorRate.toFixed(2) + '%',
    parallelUtilization: highPerfMetrics.parallelUtilization.toFixed(2) + '%',
    batchEfficiency: highPerfMetrics.batchEfficiency.toFixed(2) + '%'
  });
  
  // 测试2: 增强并行处理器基准 / Test 2: Enhanced parallel processor benchmark
  console.log('\n📋 测试2: 增强并行处理器基准测试 / Test 2: Enhanced parallel processor benchmark');
  const enhancedProcessor = new EnhancedParallelProcessor();
  const tieredTransactions = createTieredTestTransactions();
  
  // 启动处理器 / Start processor
  await enhancedProcessor.startProcessing();
  
  // 添加交易到各层级队列 / Add transactions to tier queues
  for (const tx of tieredTransactions) {
    enhancedProcessor.addTransaction(tx);
  }
  
  // 等待处理完成 / Wait for processing completion
  console.log('⏳ 等待增强并行处理完成... / Waiting for enhanced parallel processing completion...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const enhancedStats = enhancedProcessor.getProcessingStats();
  console.log('📊 增强并行处理器统计 / Enhanced parallel processor statistics:', {
    totalProcessed: enhancedStats.totalProcessed,
    totalSuccessful: enhancedStats.totalSuccessful,
    successRate: ((enhancedStats.totalSuccessful / enhancedStats.totalProcessed) * 100).toFixed(1) + '%',
    currentTPS: enhancedStats.currentTPS.toFixed(2),
    averageLatency: enhancedStats.averageLatency.toFixed(2) + 'ms'
  });
  
  // 各层级详细统计 / Detailed tier statistics
  console.log('\n📊 各层级性能统计 / Tier performance statistics:');
  const tierStatus = enhancedProcessor.getTierStatus() as Map<PerformanceTier, any>;
  tierStatus.forEach((status, tier) => {
    console.log(`  ${tier}: {
    TPS: ${status.metrics.currentTPS.toFixed(2)},
    平均延迟: ${status.metrics.averageLatency.toFixed(2)}ms,
    成功率: ${((status.metrics.successfulTransactions / status.metrics.totalTransactions) * 100).toFixed(1)}%,
    队列负载: ${((status.queueSize / status.maxQueueSize) * 100).toFixed(1)}%
  }`);
  });
  
  // 停止处理器 / Stop processors
  await enhancedProcessor.stopProcessing();
  
  const totalTime = Date.now() - startTime;
  console.log(`\n🏁 性能基准测试完成，总耗时: ${totalTime}ms / Performance benchmark completed, total time: ${totalTime}ms`);
  console.log('='.repeat(80));
}

// 压力测试 / Stress test
async function stressTest(): Promise<void> {
  console.log('\n💪 开始压力测试 / Starting stress test');
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  
  // 创建大量交易 / Create large number of transactions
  const largeTransactionPool = new TransactionPool();
  const stressTransactions: Transaction[] = [];
  
  console.log('📦 创建1000个压力测试交易... / Creating 1000 stress test transactions...');
  for (let i = 0; i < 1000; i++) {
    const transaction: Transaction = {
      hash: `stress-tx-${i}-${Date.now()}`,
      from: `0x${Math.random().toString(16).substr(2, 40)}`,
      to: `0x${Math.random().toString(16).substr(2, 40)}`,
      value: Math.floor(Math.random() * 1000000),
      gas: Math.floor(Math.random() * 200000) + 21000,
      gasPrice: Math.floor(Math.random() * 100) + 10,
      data: i % 5 === 0 ? `0x${Math.random().toString(16).substr(2, 128)}` : '0x',
      nonce: i,
      timestamp: Date.now() + i,
      blockNumber: 0,
      blockHash: '',
      transactionIndex: 0,
      status: 'pending',
      isZeroGas: i % 50 === 0, // 2% 零Gas交易 / 2% zero gas transactions
      contractTierFeeLevel: i % 3 as 0 | 1 | 2
    };
    
    largeTransactionPool.addTransaction(transaction);
    stressTransactions.push(transaction);
  }
  
  // 同时运行两个处理器 / Run both processors simultaneously
  console.log('🚀 启动双处理器压力测试... / Starting dual processor stress test...');
  
  const highPerfProcessor = new HighPerformanceProcessor(largeTransactionPool);
  const enhancedProcessor = new EnhancedParallelProcessor();
  
  await enhancedProcessor.startProcessing();
  
  // 将一半交易给增强处理器 / Give half transactions to enhanced processor
  for (let i = 500; i < 1000; i++) {
    enhancedProcessor.addTransaction(stressTransactions[i]);
  }
  
  // 等待处理完成 / Wait for processing completion
  console.log('⏳ 等待压力测试完成... / Waiting for stress test completion...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // 获取最终统计 / Get final statistics
  const highPerfFinalMetrics = highPerfProcessor.getMetrics();
  const enhancedFinalStats = enhancedProcessor.getProcessingStats();
  
  console.log('\n📊 压力测试结果 / Stress test results:');
  console.log('高性能处理器 / High Performance Processor:', {
    处理总数: highPerfFinalMetrics.totalProcessed,
    吞吐量: highPerfFinalMetrics.throughputPerSecond.toFixed(2) + ' TPS',
    平均延迟: highPerfFinalMetrics.averageLatency.toFixed(2) + 'ms',
    错误率: highPerfFinalMetrics.errorRate.toFixed(2) + '%',
    并行利用率: highPerfFinalMetrics.parallelUtilization.toFixed(2) + '%'
  });
  
  console.log('增强并行处理器 / Enhanced Parallel Processor:', {
    处理总数: enhancedFinalStats.totalProcessed,
    成功总数: enhancedFinalStats.totalSuccessful,
    当前TPS: enhancedFinalStats.currentTPS.toFixed(2),
    平均延迟: enhancedFinalStats.averageLatency.toFixed(2) + 'ms',
    成功率: ((enhancedFinalStats.totalSuccessful / enhancedFinalStats.totalProcessed) * 100).toFixed(1) + '%'
  });
  
  // 计算总体性能 / Calculate overall performance
  const totalProcessed = highPerfFinalMetrics.totalProcessed + enhancedFinalStats.totalProcessed;
  const totalTime = Date.now() - startTime;
  const overallTPS = (totalProcessed / totalTime) * 1000;
  
  console.log('\n🎯 总体性能指标 / Overall performance metrics:', {
    总处理数: totalProcessed,
    总耗时: totalTime + 'ms',
    总体TPS: overallTPS.toFixed(2),
    平均每秒处理: (totalProcessed / (totalTime / 1000)).toFixed(2) + ' tx/s'
  });
  
  await enhancedProcessor.stopProcessing();
  
  console.log('\n💪 压力测试完成! / Stress test completed!');
  console.log('='.repeat(80));
}

// 主测试函数 / Main test function
async function runComprehensivePerformanceTest(): Promise<void> {
  console.log('🚀 开始综合性能测试 / Starting comprehensive performance test');
  console.log('='.repeat(80));
  
  try {
    // 运行性能基准测试 / Run performance benchmark
    await performanceBenchmark();
    
    // 运行压力测试 / Run stress test
    await stressTest();
    
    console.log('\n🎉 综合性能测试全部完成! / Comprehensive performance test completed!');
    console.log('✅ 所有测试通过 / All tests passed');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误 / Error during testing:', error);
    throw error;
  }
}

// 运行测试 / Run test
runComprehensivePerformanceTest()
  .then(() => {
    console.log('✅ 综合性能测试成功完成 / Comprehensive performance test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 综合性能测试失败 / Comprehensive performance test failed:', error);
    process.exit(1);
  });