/**
 * TitanChain简化压力测试
 * TitanChain Simplified Stress Test
 */

import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor';
import { Transaction } from './shared/types/blockchain';

// 创建测试交易 / Create test transaction
function createTestTransaction(index: number): Transaction {
  return {
    hash: `stress-tx-${index}-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
    from: `0x${Math.random().toString(16).substr(2, 40)}`,
    to: `0x${Math.random().toString(16).substr(2, 40)}`,
    value: Math.floor(Math.random() * 1000) + 1,
    gas: 21000 + Math.floor(Math.random() * 50000),
    gasPrice: 20 + Math.floor(Math.random() * 80),
    data: '0x',
    nonce: index,
    timestamp: Date.now(),
    blockNumber: 0,
    blockHash: '',
    transactionIndex: 0,
    status: 'pending',
    isZeroGas: index % 20 === 0,
    contractTierFeeLevel: Math.floor(Math.random() * 3) as 0 | 1 | 2
  };
}

// 简化压力测试 / Simplified stress test
async function runSimplifiedStressTest(): Promise<void> {
  console.log('🚀 开始TitanChain简化压力测试');
  console.log('='.repeat(50));
  
  const processor = new EnhancedParallelProcessor();
  const startTime = Date.now();
  
  try {
    // 启动处理器 / Start processor
    await processor.startProcessing();
    console.log('✅ 增强并行处理器已启动');
    
    // 创建测试交易 / Create test transactions
    const transactionCount = 200;
    const transactions: Transaction[] = [];
    
    console.log(`📦 创建 ${transactionCount} 个测试交易...`);
    for (let i = 0; i < transactionCount; i++) {
      transactions.push(createTestTransaction(i));
    }
    
    console.log(`✅ 创建了 ${transactions.length} 个测试交易`);
    
    // 分批发送交易 / Send transactions in batches
    const batchSize = 20;
    let sentCount = 0;
    
    console.log(`📤 开始分批发送交易，每批 ${batchSize} 个`);
    
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      // 发送批次 / Send batch
      for (const tx of batch) {
        processor.addTransaction(tx);
        sentCount++;
      }
      
      const elapsed = (Date.now() - startTime) / 1000;
      const currentTPS = sentCount / elapsed;
      
      console.log(`📊 已发送: ${sentCount}/${transactionCount}, 当前TPS: ${currentTPS.toFixed(2)}`);
      
      // 短暂等待 / Brief wait
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ 所有 ${sentCount} 个交易已发送完成`);
    
    // 等待处理完成 / Wait for processing completion
    console.log('⏳ 等待交易处理完成...');
    
    let waitTime = 0;
    const maxWaitTime = 30000; // 30秒 / 30 seconds
    
    while (waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      waitTime += 2000;
      
      const stats = processor.getProcessingStats();
      const progress = (stats.totalProcessed / sentCount) * 100;
      
      console.log(`📈 处理进度: ${stats.totalProcessed}/${sentCount} (${progress.toFixed(1)}%)`);
      console.log(`   平均延迟: ${stats.averageLatency.toFixed(2)}ms`);
      
      // 安全访问TPS属性 / Safe access to TPS property
      const currentTPS = (stats as any).tps || (stats.totalProcessed / (waitTime / 1000));
      console.log(`   TPS: ${currentTPS.toFixed(2)}`);
      
      if (stats.totalProcessed >= sentCount * 0.9) { // 90%处理完成 / 90% processing completed
        console.log('✅ 90%的交易已处理完成');
        break;
      }
    }
    
    // 获取最终统计 / Get final statistics
    const finalStats = processor.getProcessingStats();
    const totalTime = Date.now() - startTime;
    
    await processor.stopProcessing();
    console.log('✅ 处理器已停止');
    
    // 输出结果 / Output results
    console.log('\n📊 压力测试结果:');
    console.log('='.repeat(50));
    console.log(`总交易数: ${sentCount}`);
    console.log(`处理成功: ${finalStats.totalProcessed}`);
    console.log(`处理失败: ${finalStats.totalFailed}`);
    console.log(`成功率: ${((finalStats.totalProcessed / sentCount) * 100).toFixed(2)}%`);
    console.log(`总耗时: ${totalTime}ms`);
    console.log(`平均TPS: ${(finalStats.totalProcessed / (totalTime / 1000)).toFixed(2)}`);
    console.log(`平均延迟: ${finalStats.averageLatency.toFixed(2)}ms`);
    
    // 内存使用情况 / Memory usage
    const memUsage = process.memoryUsage();
    console.log(`内存使用: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    
    // 性能评估 / Performance evaluation
    const successRate = (finalStats.totalProcessed / sentCount) * 100;
    const avgTPS = finalStats.totalProcessed / (totalTime / 1000);
    
    console.log('\n🎯 性能评估:');
    if (successRate >= 80 && avgTPS >= 10) {
      console.log('🎉 简化压力测试通过! / Simplified stress test PASSED!');
      console.log('✅ 系统性能表现良好 / System performance is good');
    } else {
      console.log('⚠️ 简化压力测试需要优化 / Simplified stress test needs optimization');
      console.log('❌ 系统性能需要改进 / System performance needs improvement');
    }
    
  } catch (error) {
    console.error('❌ 压力测试执行失败:', error);
    throw error;
  }
}

// 执行测试 / Execute test
runSimplifiedStressTest()
  .then(() => {
    console.log('\n✅ 简化压力测试完成 / Simplified stress test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 简化压力测试失败 / Simplified stress test failed:', error);
    process.exit(1);
  });