/**
 * TitanChain综合压力测试
 * TitanChain Comprehensive Stress Test
 */

import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor';
import { DualBlockProcessor } from './blockchain/core/dual-block-processor';
import { TransactionPool } from './blockchain/core/transaction-pool';
import { Transaction } from './shared/types/blockchain';

// 创建测试交易 / Create test transaction
function createTestTransaction(index: number, userId: number = 0): Transaction {
  return {
    hash: `stress-tx-${userId}-${index}-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
    from: `0x${userId.toString(16).padStart(40, '0')}`,
    to: `0x${Math.random().toString(16).substr(2, 40)}`,
    value: Math.floor(Math.random() * 5000) + 1,
    gas: 21000 + Math.floor(Math.random() * 100000),
    gasPrice: 10 + Math.floor(Math.random() * 100),
    data: index % 5 === 0 ? `0x${Math.random().toString(16).substr(2, 64)}` : '0x',
    nonce: index,
    timestamp: Date.now(),
    blockNumber: 0,
    blockHash: '',
    transactionIndex: 0,
    status: 'pending',
    isZeroGas: index % 25 === 0, // 4% 零Gas交易 / 4% zero gas transactions
    contractTierFeeLevel: Math.floor(Math.random() * 3) as 0 | 1 | 2
  };
}

// 综合压力测试 / Comprehensive stress test
async function runComprehensiveStressTest(): Promise<void> {
  console.log('🚀 开始TitanChain综合压力测试');
  console.log('='.repeat(60));
  
  const enhancedProcessor = new EnhancedParallelProcessor();
  const dualBlockProcessor = new DualBlockProcessor();
  const transactionPool = new TransactionPool();
  
  const startTime = Date.now();
  
  try {
    // 启动所有处理器 / Start all processors
    await enhancedProcessor.startProcessing();
    console.log('✅ 增强并行处理器已启动');
    
    // 测试配置 / Test configuration
    const testConfigs = [
      { name: '轻量级测试', txCount: 300, users: 5, description: 'Lightweight Test' },
      { name: '中等负载测试', txCount: 600, users: 10, description: 'Medium Load Test' },
      { name: '高负载测试', txCount: 1000, users: 20, description: 'High Load Test' }
    ];
    
    const results: any[] = [];
    
    for (const config of testConfigs) {
      console.log(`\n🔥 开始${config.name} / Starting ${config.description}`);
      console.log(`配置: ${config.txCount}个交易, ${config.users}个用户`);
      console.log('-'.repeat(50));
      
      const testStartTime = Date.now();
      
      // 创建测试交易 / Create test transactions
      const transactions: Transaction[] = [];
      const txPerUser = Math.floor(config.txCount / config.users);
      
      console.log(`📦 创建 ${config.txCount} 个测试交易...`);
      for (let userId = 0; userId < config.users; userId++) {
        for (let i = 0; i < txPerUser; i++) {
          transactions.push(createTestTransaction(i, userId));
        }
      }
      
      // 补充剩余交易 / Add remaining transactions
      const remaining = config.txCount - transactions.length;
      for (let i = 0; i < remaining; i++) {
        transactions.push(createTestTransaction(i, 0));
      }
      
      console.log(`✅ 创建了 ${transactions.length} 个测试交易`);
      
      // 分配交易到不同处理器 / Distribute transactions to different processors
      const enhancedTx = transactions.slice(0, Math.floor(transactions.length * 0.6));
      const dualTx = transactions.slice(Math.floor(transactions.length * 0.6), Math.floor(transactions.length * 0.8));
      const poolTx = transactions.slice(Math.floor(transactions.length * 0.8));
      
      console.log(`📤 分配交易: 增强处理器(${enhancedTx.length}), 双区块处理器(${dualTx.length}), 交易池(${poolTx.length})`);
      
      // 并行发送交易 / Send transactions in parallel
      let sentCount = 0;
      
      await Promise.all([
        // 增强并行处理器 / Enhanced parallel processor
        (async () => {
          for (const tx of enhancedTx) {
            enhancedProcessor.addTransaction(tx);
            sentCount++;
            if (sentCount % 50 === 0) {
              await new Promise(resolve => setTimeout(resolve, 10)); // 短暂延迟 / Brief delay
            }
          }
        })(),
        
        // 双区块处理器 / Dual block processor
        (async () => {
          for (const tx of dualTx) {
            dualBlockProcessor.addTransaction(tx);
            sentCount++;
            if (sentCount % 50 === 0) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
        })(),
        
        // 交易池 / Transaction pool
        (async () => {
          for (const tx of poolTx) {
            transactionPool.addTransaction(tx);
            sentCount++;
            if (sentCount % 50 === 0) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
        })()
      ]);
      
      console.log(`✅ 所有 ${transactions.length} 个交易已发送完成`);
      
      // 等待处理完成 / Wait for processing completion
      console.log('⏳ 等待交易处理完成...');
      
      let waitTime = 0;
      const maxWaitTime = 45000; // 45秒 / 45 seconds
      let lastProcessedCount = 0;
      
      while (waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        waitTime += 3000;
        
        const enhancedStats = enhancedProcessor.getProcessingStats();
        const dualMetrics = dualBlockProcessor.getPerformanceMetrics();
        const poolStats = transactionPool.getPoolStats();
        
        // 计算双区块处理器的总处理数 / Calculate total processed for dual block processor
        const dualProcessed = dualMetrics.fastBlock.totalTransactions + dualMetrics.batchBlock.totalTransactions;
        
        const totalProcessed = enhancedStats.totalProcessed + dualProcessed + poolStats.totalTransactions;
        const progress = (totalProcessed / transactions.length) * 100;
        const processingTPS = (totalProcessed - lastProcessedCount) / 3; // 3秒间隔 / 3 second interval
        
        console.log(`📈 处理进度: ${totalProcessed}/${transactions.length} (${progress.toFixed(1)}%)`);
        console.log(`   增强处理器: ${enhancedStats.totalProcessed}, 双区块: ${dualProcessed}, 交易池: ${poolStats.totalTransactions}`);
        console.log(`   处理TPS: ${processingTPS.toFixed(2)}, 平均延迟: ${enhancedStats.averageLatency.toFixed(2)}ms`);
        
        lastProcessedCount = totalProcessed;
        
        if (totalProcessed >= transactions.length * 0.85) { // 85%处理完成 / 85% processing completed
          console.log('✅ 85%的交易已处理完成');
          break;
        }
      }
      
      // 获取最终统计 / Get final statistics
      const finalEnhancedStats = enhancedProcessor.getProcessingStats();
      const finalDualMetrics = dualBlockProcessor.getPerformanceMetrics();
      const finalPoolStats = transactionPool.getPoolStats();
      
      const testTime = Date.now() - testStartTime;
      const finalDualProcessed = finalDualMetrics.fastBlock.totalTransactions + finalDualMetrics.batchBlock.totalTransactions;
      const totalProcessed = finalEnhancedStats.totalProcessed + finalDualProcessed + finalPoolStats.totalTransactions;
      const totalFailed = transactions.length - totalProcessed;
      const successRate = (totalProcessed / transactions.length) * 100;
      const avgTPS = totalProcessed / (testTime / 1000);
      
      // 记录结果 / Record results
      const result = {
        name: config.name,
        totalTransactions: transactions.length,
        processedTransactions: totalProcessed,
        failedTransactions: totalFailed,
        successRate,
        processingTime: testTime,
        averageTPS: avgTPS,
        averageLatency: finalEnhancedStats.averageLatency,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      };
      
      results.push(result);
      
      console.log(`\n📊 ${config.name}结果:`);
      console.log(`  成功率: ${successRate.toFixed(2)}%`);
      console.log(`  平均TPS: ${avgTPS.toFixed(2)}`);
      console.log(`  处理时间: ${testTime}ms`);
      console.log(`  内存使用: ${result.memoryUsage}MB`);
      
      // 短暂休息 / Brief rest
      if (config !== testConfigs[testConfigs.length - 1]) {
        console.log('\n⏳ 等待系统恢复...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    await enhancedProcessor.stopProcessing();
    console.log('✅ 所有处理器已停止');
    
    // 生成综合报告 / Generate comprehensive report
    console.log('\n📋 TitanChain综合压力测试报告 / TitanChain Comprehensive Stress Test Report');
    console.log('='.repeat(80));
    
    results.forEach(result => {
      console.log(`\n🔍 ${result.name}:`);
      console.log(`  总交易数: ${result.totalTransactions}`);
      console.log(`  处理成功: ${result.processedTransactions}`);
      console.log(`  成功率: ${result.successRate.toFixed(2)}%`);
      console.log(`  平均TPS: ${result.averageTPS.toFixed(2)}`);
      console.log(`  平均延迟: ${result.averageLatency.toFixed(2)}ms`);
      console.log(`  内存使用: ${result.memoryUsage}MB`);
    });
    
    // 总体评估 / Overall evaluation
    const overallSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
    const overallAvgTPS = results.reduce((sum, r) => sum + r.averageTPS, 0) / results.length;
    const totalTransactions = results.reduce((sum, r) => sum + r.totalTransactions, 0);
    const totalProcessed = results.reduce((sum, r) => sum + r.processedTransactions, 0);
    const totalTime = Date.now() - startTime;
    
    console.log('\n🎯 总体性能评估:');
    console.log(`总交易数: ${totalTransactions}`);
    console.log(`总处理数: ${totalProcessed}`);
    console.log(`平均成功率: ${overallSuccessRate.toFixed(2)}%`);
    console.log(`平均TPS: ${overallAvgTPS.toFixed(2)}`);
    console.log(`总测试时间: ${totalTime}ms`);
    
    if (overallSuccessRate >= 75 && overallAvgTPS >= 25) {
      console.log('\n🎉 综合压力测试整体通过! / Comprehensive stress test overall PASSED!');
      console.log('✅ TitanChain系统在各种负载下表现稳定 / TitanChain system performs stably under various loads');
    } else {
      console.log('\n⚠️ 综合压力测试需要优化 / Comprehensive stress test needs optimization');
      console.log('❌ 系统在高负载下性能需要改进 / System performance under high load needs improvement');
    }
    
  } catch (error) {
    console.error('❌ 综合压力测试执行失败:', error);
    throw error;
  }
}

// 执行测试 / Execute test
runComprehensiveStressTest()
  .then(() => {
    console.log('\n✅ 综合压力测试完成 / Comprehensive stress test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 综合压力测试失败 / Comprehensive stress test failed:', error);
    process.exit(1);
  });