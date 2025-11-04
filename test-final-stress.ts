/**
 * TitanChain最终压力测试
 * TitanChain Final Stress Test
 */

import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor';
import { Transaction } from './shared/types/blockchain';

// 创建测试交易 / Create test transaction
function createTestTransaction(index: number, userId: number = 0): Transaction {
  return {
    hash: `final-stress-tx-${userId}-${index}-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
    from: `0x${userId.toString(16).padStart(40, '0')}`,
    to: `0x${Math.random().toString(16).substr(2, 40)}`,
    value: Math.floor(Math.random() * 2000) + 1,
    gas: 21000 + Math.floor(Math.random() * 80000),
    gasPrice: 15 + Math.floor(Math.random() * 85),
    data: index % 8 === 0 ? `0x${Math.random().toString(16).substr(2, 32)}` : '0x',
    nonce: index,
    timestamp: Date.now(),
    blockNumber: 0,
    blockHash: '',
    transactionIndex: 0,
    status: 'pending',
    isZeroGas: index % 30 === 0, // 3.33% 零Gas交易 / 3.33% zero gas transactions
    contractTierFeeLevel: Math.floor(Math.random() * 3) as 0 | 1 | 2
  };
}

// 最终压力测试 / Final stress test
async function runFinalStressTest(): Promise<void> {
  console.log('🚀 开始TitanChain最终压力测试');
  console.log('='.repeat(60));
  
  const processor = new EnhancedParallelProcessor();
  const startTime = Date.now();
  
  try {
    // 启动处理器 / Start processor
    await processor.startProcessing();
    console.log('✅ 增强并行处理器已启动');
    
    // 测试阶段 / Test phases
    const testPhases = [
      { name: '预热阶段', txCount: 100, users: 3, description: 'Warm-up Phase' },
      { name: '标准负载', txCount: 500, users: 10, description: 'Standard Load' },
      { name: '高负载', txCount: 800, users: 15, description: 'High Load' },
      { name: '峰值负载', txCount: 1200, users: 25, description: 'Peak Load' }
    ];
    
    const phaseResults: any[] = [];
    
    for (let phaseIndex = 0; phaseIndex < testPhases.length; phaseIndex++) {
      const phase = testPhases[phaseIndex];
      console.log(`\n🔥 阶段 ${phaseIndex + 1}: ${phase.name} / Phase ${phaseIndex + 1}: ${phase.description}`);
      console.log(`配置: ${phase.txCount}个交易, ${phase.users}个用户`);
      console.log('-'.repeat(50));
      
      const phaseStartTime = Date.now();
      
      // 创建测试交易 / Create test transactions
      const transactions: Transaction[] = [];
      const txPerUser = Math.floor(phase.txCount / phase.users);
      
      console.log(`📦 创建 ${phase.txCount} 个测试交易...`);
      for (let userId = 0; userId < phase.users; userId++) {
        for (let i = 0; i < txPerUser; i++) {
          transactions.push(createTestTransaction(i, userId));
        }
      }
      
      // 补充剩余交易 / Add remaining transactions
      const remaining = phase.txCount - transactions.length;
      for (let i = 0; i < remaining; i++) {
        transactions.push(createTestTransaction(i, 0));
      }
      
      console.log(`✅ 创建了 ${transactions.length} 个测试交易`);
      
      // 分批发送交易 / Send transactions in batches
      const batchSize = Math.min(50, Math.ceil(transactions.length / 10));
      let sentCount = 0;
      
      console.log(`📤 开始分批发送交易，每批 ${batchSize} 个`);
      
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        
        // 发送批次 / Send batch
        for (const tx of batch) {
          processor.addTransaction(tx);
          sentCount++;
        }
        
        const elapsed = (Date.now() - phaseStartTime) / 1000;
        const currentTPS = sentCount / elapsed;
        
        if (sentCount % (batchSize * 2) === 0) { // 每两批输出一次 / Output every two batches
          console.log(`📊 已发送: ${sentCount}/${transactions.length}, 当前TPS: ${currentTPS.toFixed(2)}`);
        }
        
        // 短暂延迟 / Brief delay
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`✅ 所有 ${sentCount} 个交易已发送完成`);
      
      // 等待处理完成 / Wait for processing completion
      console.log('⏳ 等待交易处理完成...');
      
      let waitTime = 0;
      const maxWaitTime = 30000; // 30秒 / 30 seconds
      let lastProcessedCount = 0;
      
      while (waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        waitTime += 2000;
        
        const stats = processor.getProcessingStats();
        const progress = (stats.totalProcessed / sentCount) * 100;
        const processingTPS = (stats.totalProcessed - lastProcessedCount) / 2; // 2秒间隔 / 2 second interval
        
        console.log(`📈 处理进度: ${stats.totalProcessed}/${sentCount} (${progress.toFixed(1)}%)`);
        console.log(`   处理TPS: ${processingTPS.toFixed(2)}, 平均延迟: ${stats.averageLatency.toFixed(2)}ms`);
        
        lastProcessedCount = stats.totalProcessed;
        
        if (stats.totalProcessed >= sentCount * 0.9) { // 90%处理完成 / 90% processing completed
          console.log('✅ 90%的交易已处理完成');
          break;
        }
      }
      
      // 获取阶段统计 / Get phase statistics
      const finalStats = processor.getProcessingStats();
      const phaseTime = Date.now() - phaseStartTime;
      const successRate = (finalStats.totalProcessed / sentCount) * 100;
      const avgTPS = finalStats.totalProcessed / (phaseTime / 1000);
      
      // 记录阶段结果 / Record phase results
      const result = {
        phase: phase.name,
        totalTransactions: sentCount,
        processedTransactions: finalStats.totalProcessed,
        failedTransactions: finalStats.totalFailed,
        successRate,
        processingTime: phaseTime,
        averageTPS: avgTPS,
        averageLatency: finalStats.averageLatency,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      };
      
      phaseResults.push(result);
      
      console.log(`\n📊 ${phase.name}结果:`);
      console.log(`  成功率: ${successRate.toFixed(2)}%`);
      console.log(`  平均TPS: ${avgTPS.toFixed(2)}`);
      console.log(`  处理时间: ${phaseTime}ms`);
      console.log(`  内存使用: ${result.memoryUsage}MB`);
      
      // 阶段间休息 / Rest between phases
      if (phaseIndex < testPhases.length - 1) {
        console.log('\n⏳ 等待系统恢复...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    await processor.stopProcessing();
    console.log('✅ 处理器已停止');
    
    // 生成最终报告 / Generate final report
    console.log('\n📋 TitanChain最终压力测试报告 / TitanChain Final Stress Test Report');
    console.log('='.repeat(80));
    
    phaseResults.forEach((result, index) => {
      console.log(`\n🔍 阶段 ${index + 1}: ${result.phase}`);
      console.log(`  总交易数: ${result.totalTransactions}`);
      console.log(`  处理成功: ${result.processedTransactions}`);
      console.log(`  成功率: ${result.successRate.toFixed(2)}%`);
      console.log(`  平均TPS: ${result.averageTPS.toFixed(2)}`);
      console.log(`  平均延迟: ${result.averageLatency.toFixed(2)}ms`);
      console.log(`  内存使用: ${result.memoryUsage}MB`);
    });
    
    // 总体评估 / Overall evaluation
    const overallSuccessRate = phaseResults.reduce((sum, r) => sum + r.successRate, 0) / phaseResults.length;
    const overallAvgTPS = phaseResults.reduce((sum, r) => sum + r.averageTPS, 0) / phaseResults.length;
    const totalTransactions = phaseResults.reduce((sum, r) => sum + r.totalTransactions, 0);
    const totalProcessed = phaseResults.reduce((sum, r) => sum + r.processedTransactions, 0);
    const totalTime = Date.now() - startTime;
    
    console.log('\n🎯 总体性能评估:');
    console.log(`总交易数: ${totalTransactions}`);
    console.log(`总处理数: ${totalProcessed}`);
    console.log(`平均成功率: ${overallSuccessRate.toFixed(2)}%`);
    console.log(`平均TPS: ${overallAvgTPS.toFixed(2)}`);
    console.log(`总测试时间: ${totalTime}ms`);
    
    // 性能等级评估 / Performance grade evaluation
    let performanceGrade = 'F';
    let performanceDescription = '性能不达标';
    
    if (overallSuccessRate >= 95 && overallAvgTPS >= 50) {
      performanceGrade = 'A+';
      performanceDescription = '卓越性能';
    } else if (overallSuccessRate >= 90 && overallAvgTPS >= 40) {
      performanceGrade = 'A';
      performanceDescription = '优秀性能';
    } else if (overallSuccessRate >= 85 && overallAvgTPS >= 30) {
      performanceGrade = 'B';
      performanceDescription = '良好性能';
    } else if (overallSuccessRate >= 75 && overallAvgTPS >= 20) {
      performanceGrade = 'C';
      performanceDescription = '及格性能';
    } else if (overallSuccessRate >= 60 && overallAvgTPS >= 10) {
      performanceGrade = 'D';
      performanceDescription = '基础性能';
    }
    
    console.log(`\n🏆 性能等级: ${performanceGrade} - ${performanceDescription}`);
    
    if (performanceGrade >= 'C') {
      console.log('\n🎉 最终压力测试通过! / Final stress test PASSED!');
      console.log('✅ TitanChain系统在各种负载下表现稳定 / TitanChain system performs stably under various loads');
    } else {
      console.log('\n⚠️ 最终压力测试需要优化 / Final stress test needs optimization');
      console.log('❌ 系统性能需要进一步改进 / System performance needs further improvement');
    }
    
  } catch (error) {
    console.error('❌ 最终压力测试执行失败:', error);
    throw error;
  }
}

// 执行测试 / Execute test
runFinalStressTest()
  .then(() => {
    console.log('\n✅ 最终压力测试完成 / Final stress test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 最终压力测试失败 / Final stress test failed:', error);
    process.exit(1);
  });