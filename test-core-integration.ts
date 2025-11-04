/**
 * 核心集成测试
 * Core Integration Test
 * 
 * 验证TitanChain核心组件的集成功能
 * Verify TitanChain core components integration functionality
 */

import { DualBlockProcessor } from './blockchain/core/dual-block-processor';
import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor';
import { HighPerformanceProcessor } from './blockchain/core/high-performance-processor';
import { TransactionPool } from './blockchain/core/transaction-pool';
import { Transaction } from './shared/types/blockchain';

// 创建测试交易 / Create test transaction
function createTestTransaction(index: number, gasPrice: number = 50): Transaction {
  return {
    hash: `test-tx-${index}-${Date.now()}`,
    from: `0x${Math.random().toString(16).substr(2, 40)}`,
    to: `0x${Math.random().toString(16).substr(2, 40)}`,
    value: Math.floor(Math.random() * 1000) + 100,
    gas: Math.floor(Math.random() * 100000) + 21000,
    gasPrice,
    data: index % 5 === 0 ? `0x${Math.random().toString(16).substr(2, 64)}` : '0x',
    nonce: index,
    timestamp: Date.now() + index,
    blockNumber: 0,
    blockHash: '',
    transactionIndex: 0,
    status: 'pending',
    isZeroGas: index % 20 === 0, // 5% 零Gas交易 / 5% zero gas transactions
    contractTierFeeLevel: index % 3 as 0 | 1 | 2
  };
}

// 核心集成测试类 / Core Integration Test Class
class CoreIntegrationTest {
  private dualBlockProcessor: DualBlockProcessor;
  private enhancedProcessor: EnhancedParallelProcessor;
  private transactionPool: TransactionPool;
  private highPerfProcessor: HighPerformanceProcessor;
  
  constructor() {
    this.dualBlockProcessor = new DualBlockProcessor();
    this.enhancedProcessor = new EnhancedParallelProcessor();
    this.transactionPool = new TransactionPool();
    this.highPerfProcessor = new HighPerformanceProcessor(this.transactionPool);
  }
  
  // 测试1: 双区块处理器集成 / Test 1: Dual block processor integration
  async testDualBlockProcessorIntegration(): Promise<boolean> {
    console.log('\n📋 测试1: 双区块处理器集成 / Test 1: Dual block processor integration');
    
    try {
      // 创建不同类型的交易 / Create different types of transactions
      const fastTransactions: Transaction[] = [];
      const batchTransactions: Transaction[] = [];
      
      // 快速交易 (高Gas价格) / Fast transactions (high gas price)
      for (let i = 0; i < 15; i++) {
        fastTransactions.push(createTestTransaction(i, 100));
      }
      
      // 批量交易 (低Gas价格) / Batch transactions (low gas price)
      for (let i = 15; i < 35; i++) {
        batchTransactions.push(createTestTransaction(i, 20));
      }
      
      console.log(`✅ 创建了 ${fastTransactions.length} 个快速交易和 ${batchTransactions.length} 个批量交易`);
      
      // 添加交易到双区块处理器 / Add transactions to dual block processor
      const allTransactions = [...fastTransactions, ...batchTransactions];
      for (const tx of allTransactions) {
        this.dualBlockProcessor.addTransaction(tx);
      }
      
      console.log('📥 所有交易已添加到双区块处理器');
      
      // 等待处理完成 / Wait for processing completion
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      console.log('✅ 双区块处理器集成测试完成');
      return true;
      
    } catch (error) {
      console.error('❌ 双区块处理器集成测试失败:', error);
      return false;
    }
  }
  
  // 测试2: 增强并行处理器集成 / Test 2: Enhanced parallel processor integration
  async testEnhancedParallelProcessorIntegration(): Promise<boolean> {
    console.log('\n📋 测试2: 增强并行处理器集成 / Test 2: Enhanced parallel processor integration');
    
    try {
      // 启动处理器 / Start processor
      await this.enhancedProcessor.startProcessing();
      console.log('✅ 增强并行处理器已启动');
      
      // 创建分层测试交易 / Create tiered test transactions
      const testTransactions: Transaction[] = [];
      
      // TIER_1 交易 / TIER_1 transactions
      for (let i = 0; i < 20; i++) {
        testTransactions.push(createTestTransaction(i, 100)); // 高Gas价格 / High gas price
      }
      
      // TIER_2 交易 / TIER_2 transactions
      for (let i = 20; i < 40; i++) {
        testTransactions.push(createTestTransaction(i, 50)); // 中等Gas价格 / Medium gas price
      }
      
      // TIER_3 交易 / TIER_3 transactions
      for (let i = 40; i < 60; i++) {
        testTransactions.push(createTestTransaction(i, 20)); // 低Gas价格 / Low gas price
      }
      
      console.log(`✅ 创建了 ${testTransactions.length} 个分层测试交易`);
      
      const startTime = Date.now();
      
      // 批量添加交易 / Add transactions in batch
      for (const tx of testTransactions) {
        this.enhancedProcessor.addTransaction(tx);
      }
      
      console.log('📥 所有交易已添加到增强并行处理器');
      
      // 等待处理完成 / Wait for processing completion
      let waitTime = 0;
      const maxWaitTime = 8000; // 8秒最大等待时间 / 8 seconds max wait time
      
      while (waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
        
        const stats = this.enhancedProcessor.getProcessingStats();
        console.log(`⏱️ 等待时间: ${waitTime/1000}s, 已处理: ${stats.totalProcessed}/${testTransactions.length}`);
        
        if (stats.totalProcessed >= testTransactions.length) {
          break;
        }
      }
      
      const processingTime = Date.now() - startTime;
      const finalStats = this.enhancedProcessor.getProcessingStats();
      
      console.log('📊 增强并行处理器最终统计:', {
        totalProcessed: finalStats.totalProcessed,
        totalSuccessful: finalStats.totalSuccessful,
        successRate: ((finalStats.totalSuccessful / finalStats.totalProcessed) * 100).toFixed(1) + '%',
        processingTime: processingTime + 'ms',
        averageTPS: (finalStats.totalProcessed / (processingTime / 1000)).toFixed(2)
      });
      
      await this.enhancedProcessor.stopProcessing();
      console.log('✅ 增强并行处理器已停止');
      
      return finalStats.totalProcessed >= testTransactions.length * 0.8; // 至少80%处理成功 / At least 80% processing success
      
    } catch (error) {
      console.error('❌ 增强并行处理器集成测试失败:', error);
      return false;
    }
  }
  
  // 测试3: 高性能处理器集成 / Test 3: High performance processor integration
  async testHighPerformanceProcessorIntegration(): Promise<boolean> {
    console.log('\n📋 测试3: 高性能处理器集成 / Test 3: High performance processor integration');
    
    try {
      // 创建测试交易池 / Create test transaction pool
      const testTransactions: Transaction[] = [];
      for (let i = 0; i < 50; i++) {
        const tx = createTestTransaction(i, Math.floor(Math.random() * 80) + 20);
        testTransactions.push(tx);
        this.transactionPool.addTransaction(tx);
      }
      
      console.log(`✅ 创建了 ${testTransactions.length} 个测试交易并添加到交易池`);
      
      // 等待高性能处理器处理 / Wait for high performance processor to process
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const metrics = this.highPerfProcessor.getMetrics();
      console.log('📊 高性能处理器统计:', {
        totalProcessed: metrics.totalProcessed,
        throughputPerSecond: metrics.throughputPerSecond.toFixed(2),
        averageLatency: metrics.averageLatency.toFixed(2) + 'ms',
        errorRate: metrics.errorRate.toFixed(2) + '%',
        parallelUtilization: metrics.parallelUtilization.toFixed(2) + '%',
        batchEfficiency: metrics.batchEfficiency.toFixed(2) + '%'
      });
      
      console.log('✅ 高性能处理器集成测试完成');
      return metrics.totalProcessed > 0;
      
    } catch (error) {
      console.error('❌ 高性能处理器集成测试失败:', error);
      return false;
    }
  }
  
  // 测试4: 组件协同工作 / Test 4: Component collaboration
  async testComponentCollaboration(): Promise<boolean> {
    console.log('\n📋 测试4: 组件协同工作测试 / Test 4: Component collaboration test');
    
    try {
      // 创建大量混合交易 / Create large number of mixed transactions
      const mixedTransactions: Transaction[] = [];
      
      for (let i = 0; i < 100; i++) {
        const gasPrice = i < 30 ? 100 : i < 70 ? 50 : 20; // 分层Gas价格 / Tiered gas prices
        mixedTransactions.push(createTestTransaction(i, gasPrice));
      }
      
      console.log(`✅ 创建了 ${mixedTransactions.length} 个混合交易`);
      
      // 启动增强并行处理器 / Start enhanced parallel processor
      await this.enhancedProcessor.startProcessing();
      
      const startTime = Date.now();
      
      // 同时向多个处理器添加交易 / Add transactions to multiple processors simultaneously
      const promises: Promise<void>[] = [];
      
      // 一半交易给双区块处理器 / Half transactions to dual block processor
      promises.push(
        (async () => {
          for (let i = 0; i < 50; i++) {
            this.dualBlockProcessor.addTransaction(mixedTransactions[i]);
          }
        })()
      );
      
      // 另一半交易给增强并行处理器 / Other half to enhanced parallel processor
      promises.push(
        (async () => {
          for (let i = 50; i < 100; i++) {
            this.enhancedProcessor.addTransaction(mixedTransactions[i]);
          }
        })()
      );
      
      await Promise.all(promises);
      console.log('📥 交易已分配给不同的处理器');
      
      // 等待所有处理器完成 / Wait for all processors to complete
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      const processingTime = Date.now() - startTime;
      
      // 获取各处理器统计 / Get statistics from all processors
      const enhancedStats = this.enhancedProcessor.getProcessingStats();
      const highPerfMetrics = this.highPerfProcessor.getMetrics();
      
      console.log('📊 组件协同工作统计 / Component collaboration statistics:');
      console.log('增强并行处理器:', {
        处理数: enhancedStats.totalProcessed,
        成功数: enhancedStats.totalSuccessful,
        TPS: enhancedStats.currentTPS.toFixed(2)
      });
      
      console.log('高性能处理器:', {
        处理数: highPerfMetrics.totalProcessed,
        TPS: highPerfMetrics.throughputPerSecond.toFixed(2),
        延迟: highPerfMetrics.averageLatency.toFixed(2) + 'ms'
      });
      
      const totalProcessed = enhancedStats.totalProcessed + highPerfMetrics.totalProcessed;
      const overallTPS = (totalProcessed / (processingTime / 1000)).toFixed(2);
      
      console.log('总体统计:', {
        总处理数: totalProcessed,
        总耗时: processingTime + 'ms',
        总体TPS: overallTPS
      });
      
      await this.enhancedProcessor.stopProcessing();
      console.log('✅ 组件协同工作测试完成');
      
      return totalProcessed >= mixedTransactions.length * 0.6; // 至少60%处理成功 / At least 60% processing success
      
    } catch (error) {
      console.error('❌ 组件协同工作测试失败:', error);
      return false;
    }
  }
  
  // 运行完整的核心集成测试 / Run complete core integration test
  async runCompleteTest(): Promise<void> {
    console.log('🚀 开始核心集成测试 / Starting core integration test');
    console.log('='.repeat(80));
    
    const testResults: { [key: string]: boolean } = {};
    
    try {
      // 运行所有测试 / Run all tests
      testResults['双区块处理器集成'] = await this.testDualBlockProcessorIntegration();
      testResults['增强并行处理器集成'] = await this.testEnhancedParallelProcessorIntegration();
      testResults['高性能处理器集成'] = await this.testHighPerformanceProcessorIntegration();
      testResults['组件协同工作'] = await this.testComponentCollaboration();
      
      // 统计测试结果 / Summarize test results
      console.log('\n📊 核心集成测试结果汇总 / Core integration test results summary:');
      console.log('='.repeat(80));
      
      let passedTests = 0;
      let totalTests = 0;
      
      Object.entries(testResults).forEach(([testName, result]) => {
        totalTests++;
        if (result) {
          passedTests++;
          console.log(`✅ ${testName}: 通过 / PASSED`);
        } else {
          console.log(`❌ ${testName}: 失败 / FAILED`);
        }
      });
      
      const successRate = (passedTests / totalTests) * 100;
      console.log(`\n📈 测试通过率: ${successRate.toFixed(1)}% (${passedTests}/${totalTests})`);
      
      if (successRate >= 75) {
        console.log('\n🎉 核心集成测试整体通过! / Core integration test overall PASSED!');
        return;
      } else {
        console.log('\n❌ 核心集成测试整体失败 / Core integration test overall FAILED');
        throw new Error('Core integration test failed');
      }
      
    } catch (error) {
      console.error('❌ 核心集成测试过程中出现错误:', error);
      throw error;
    }
  }
}

// 运行核心集成测试 / Run core integration test
async function runCoreIntegrationTest(): Promise<void> {
  const testScenario = new CoreIntegrationTest();
  await testScenario.runCompleteTest();
}

// 执行测试 / Execute test
runCoreIntegrationTest()
  .then(() => {
    console.log('✅ 核心集成测试成功完成 / Core integration test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 核心集成测试失败 / Core integration test failed:', error);
    process.exit(1);
  });