/**
 * TitanChain性能压力测试
 * TitanChain Performance Stress Test
 * 
 * 验证系统在高负载下的性能表现和稳定性
 * Verify system performance and stability under high load
 */

import { DualBlockProcessor } from './blockchain/core/dual-block-processor';
import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor';
import { HighPerformanceProcessor } from './blockchain/core/high-performance-processor';
import { TransactionPool } from './blockchain/core/transaction-pool';
import { Transaction } from './shared/types/blockchain';

// 性能指标接口 / Performance Metrics Interface
interface PerformanceMetrics {
  totalTransactions: number;
  processedTransactions: number;
  failedTransactions: number;
  processingTime: number;
  averageTPS: number;
  peakTPS: number;
  averageLatency: number;
  memoryUsage: number;
  cpuUsage: number;
  successRate: number;
}

// 压力测试配置 / Stress Test Configuration
interface StressTestConfig {
  transactionCount: number;
  concurrentUsers: number;
  testDuration: number; // 秒 / seconds
  rampUpTime: number;   // 秒 / seconds
  targetTPS: number;
}

// 创建压力测试交易 / Create stress test transaction
function createStressTestTransaction(index: number, userId: number): Transaction {
  const gasPrice = Math.floor(Math.random() * 100) + 10; // 10-110 gwei
  const gasLimit = Math.floor(Math.random() * 200000) + 21000; // 21k-221k gas
  
  return {
    hash: `stress-tx-${userId}-${index}-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
    from: `0x${userId.toString(16).padStart(40, '0')}`,
    to: `0x${Math.random().toString(16).substr(2, 40)}`,
    value: Math.floor(Math.random() * 10000) + 1,
    gas: gasLimit,
    gasPrice,
    data: index % 10 === 0 ? `0x${Math.random().toString(16).substr(2, 128)}` : '0x',
    nonce: index,
    timestamp: Date.now(),
    blockNumber: 0,
    blockHash: '',
    transactionIndex: 0,
    status: 'pending',
    isZeroGas: index % 50 === 0, // 2% 零Gas交易 / 2% zero gas transactions
    contractTierFeeLevel: Math.floor(Math.random() * 3) as 0 | 1 | 2
  };
}

// 性能监控器 / Performance Monitor
class PerformanceMonitor {
  private startTime: number = 0;
  private endTime: number = 0;
  private tpsHistory: number[] = [];
  private latencyHistory: number[] = [];
  
  start(): void {
    this.startTime = Date.now();
    this.tpsHistory = [];
    this.latencyHistory = [];
  }
  
  end(): void {
    this.endTime = Date.now();
  }
  
  recordTPS(tps: number): void {
    this.tpsHistory.push(tps);
  }
  
  recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
  }
  
  getMetrics(totalTransactions: number, processedTransactions: number, failedTransactions: number): PerformanceMetrics {
    const processingTime = this.endTime - this.startTime;
    const averageTPS = processedTransactions / (processingTime / 1000);
    const peakTPS = Math.max(...this.tpsHistory, 0);
    const averageLatency = this.latencyHistory.length > 0 
      ? this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length 
      : 0;
    
    return {
      totalTransactions,
      processedTransactions,
      failedTransactions,
      processingTime,
      averageTPS,
      peakTPS,
      averageLatency,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: 0, // 简化实现 / Simplified implementation
      successRate: (processedTransactions / totalTransactions) * 100
    };
  }
  
  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024); // MB
  }
}

// 压力测试执行器 / Stress Test Executor
class StressTestExecutor {
  private dualBlockProcessor: DualBlockProcessor;
  private enhancedProcessor: EnhancedParallelProcessor;
  private transactionPool: TransactionPool;
  private highPerfProcessor: HighPerformanceProcessor;
  private monitor: PerformanceMonitor;
  
  constructor() {
    this.dualBlockProcessor = new DualBlockProcessor();
    this.enhancedProcessor = new EnhancedParallelProcessor();
    this.transactionPool = new TransactionPool();
    this.highPerfProcessor = new HighPerformanceProcessor(this.transactionPool);
    this.monitor = new PerformanceMonitor();
  }
  
  // 轻量级压力测试 / Lightweight stress test
  async runLightweightStressTest(): Promise<PerformanceMetrics> {
    console.log('\n🔥 开始轻量级压力测试 / Starting lightweight stress test');
    console.log('配置: 500个交易, 10个并发用户, 30秒测试时间');
    
    const config: StressTestConfig = {
      transactionCount: 500,
      concurrentUsers: 10,
      testDuration: 30,
      rampUpTime: 5,
      targetTPS: 50
    };
    
    return await this.executeStressTest(config, 'lightweight');
  }
  
  // 中等压力测试 / Medium stress test
  async runMediumStressTest(): Promise<PerformanceMetrics> {
    console.log('\n🔥 开始中等压力测试 / Starting medium stress test');
    console.log('配置: 1000个交易, 20个并发用户, 45秒测试时间');
    
    const config: StressTestConfig = {
      transactionCount: 1000,
      concurrentUsers: 20,
      testDuration: 45,
      rampUpTime: 10,
      targetTPS: 100
    };
    
    return await this.executeStressTest(config, 'medium');
  }
  
  // 高强度压力测试 / High intensity stress test
  async runHighIntensityStressTest(): Promise<PerformanceMetrics> {
    console.log('\n🔥 开始高强度压力测试 / Starting high intensity stress test');
    console.log('配置: 2000个交易, 50个并发用户, 60秒测试时间');
    
    const config: StressTestConfig = {
      transactionCount: 2000,
      concurrentUsers: 50,
      testDuration: 60,
      rampUpTime: 15,
      targetTPS: 200
    };
    
    return await this.executeStressTest(config, 'high');
  }
  
  // 执行压力测试 / Execute stress test
  private async executeStressTest(config: StressTestConfig, testType: string): Promise<PerformanceMetrics> {
    this.monitor.start();
    
    try {
      // 启动处理器 / Start processors
      await this.enhancedProcessor.startProcessing();
      console.log('✅ 所有处理器已启动');
      
      // 创建测试交易 / Create test transactions
      const allTransactions: Transaction[] = [];
      const transactionsPerUser = Math.floor(config.transactionCount / config.concurrentUsers);
      
      console.log(`📦 创建 ${config.transactionCount} 个测试交易...`);
      for (let userId = 0; userId < config.concurrentUsers; userId++) {
        for (let i = 0; i < transactionsPerUser; i++) {
          allTransactions.push(createStressTestTransaction(i, userId));
        }
      }
      
      // 补充剩余交易 / Add remaining transactions
      const remainingTx = config.transactionCount - allTransactions.length;
      for (let i = 0; i < remainingTx; i++) {
        allTransactions.push(createStressTestTransaction(i, 0));
      }
      
      console.log(`✅ 创建了 ${allTransactions.length} 个测试交易`);
      
      // 分批发送交易 / Send transactions in batches
      const batchSize = Math.ceil(config.transactionCount / (config.testDuration - config.rampUpTime));
      const batches: Transaction[][] = [];
      
      for (let i = 0; i < allTransactions.length; i += batchSize) {
        batches.push(allTransactions.slice(i, i + batchSize));
      }
      
      console.log(`📤 将分 ${batches.length} 批发送交易，每批 ${batchSize} 个`);
      
      // 渐进式发送交易 / Progressive transaction sending
      const startTime = Date.now();
      let sentTransactions = 0;
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // 分配交易到不同处理器 / Distribute transactions to different processors
        const enhancedBatch = batch.slice(0, Math.ceil(batch.length * 0.6));
        const dualBatch = batch.slice(Math.ceil(batch.length * 0.6), Math.ceil(batch.length * 0.8));
        const poolBatch = batch.slice(Math.ceil(batch.length * 0.8));
        
        // 并行发送到不同处理器 / Send to different processors in parallel
        await Promise.all([
          // 增强并行处理器 / Enhanced parallel processor
          (async () => {
            for (const tx of enhancedBatch) {
              this.enhancedProcessor.addTransaction(tx);
              sentTransactions++;
            }
          })(),
          
          // 双区块处理器 / Dual block processor
          (async () => {
            for (const tx of dualBatch) {
              this.dualBlockProcessor.addTransaction(tx);
              sentTransactions++;
            }
          })(),
          
          // 交易池 / Transaction pool
          (async () => {
            for (const tx of poolBatch) {
              this.transactionPool.addTransaction(tx);
              sentTransactions++;
            }
          })()
        ]);
        
        const elapsed = (Date.now() - startTime) / 1000;
        const currentTPS = sentTransactions / elapsed;
        this.monitor.recordTPS(currentTPS);
        
        console.log(`📊 批次 ${batchIndex + 1}/${batches.length} 完成, 已发送: ${sentTransactions}, 当前TPS: ${currentTPS.toFixed(2)}`);
        
        // 控制发送速率 / Control sending rate
        if (batchIndex < batches.length - 1) {
          const targetInterval = (config.testDuration - config.rampUpTime) * 1000 / batches.length;
          await new Promise(resolve => setTimeout(resolve, targetInterval));
        }
      }
      
      console.log(`✅ 所有 ${sentTransactions} 个交易已发送完成`);
      
      // 等待处理完成 / Wait for processing completion
      console.log('⏳ 等待所有交易处理完成...');
      const processingStartTime = Date.now();
      let lastProcessedCount = 0;
      
      while ((Date.now() - processingStartTime) < (config.testDuration * 1000)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const enhancedStats = this.enhancedProcessor.getProcessingStats();
        const highPerfMetrics = this.highPerfProcessor.getMetrics();
        
        const currentProcessed = enhancedStats.totalProcessed + highPerfMetrics.totalProcessed;
        const processingTPS = (currentProcessed - lastProcessedCount) / 2; // 2秒间隔 / 2 second interval
        
        this.monitor.recordTPS(processingTPS);
        this.monitor.recordLatency(enhancedStats.averageLatency);
        
        console.log(`📈 处理进度: ${currentProcessed}/${sentTransactions} (${((currentProcessed/sentTransactions)*100).toFixed(1)}%), 处理TPS: ${processingTPS.toFixed(2)}`);
        
        lastProcessedCount = currentProcessed;
        
        if (currentProcessed >= sentTransactions * 0.95) { // 95%处理完成 / 95% processing completed
          console.log('✅ 95%的交易已处理完成，提前结束等待');
          break;
        }
      }
      
      // 获取最终统计 / Get final statistics
      const enhancedFinalStats = this.enhancedProcessor.getProcessingStats();
      const highPerfFinalMetrics = this.highPerfProcessor.getMetrics();
      
      const totalProcessed = enhancedFinalStats.totalProcessed + highPerfFinalMetrics.totalProcessed;
      const totalFailed = enhancedFinalStats.totalFailed + (sentTransactions - totalProcessed);
      
      await this.enhancedProcessor.stopProcessing();
      console.log('✅ 所有处理器已停止');
      
      this.monitor.end();
      
      const metrics = this.monitor.getMetrics(sentTransactions, totalProcessed, totalFailed);
      
      console.log(`\n📊 ${testType.toUpperCase()}压力测试结果:`);
      console.log('='.repeat(60));
      console.log(`总交易数: ${metrics.totalTransactions}`);
      console.log(`处理成功: ${metrics.processedTransactions}`);
      console.log(`处理失败: ${metrics.failedTransactions}`);
      console.log(`成功率: ${metrics.successRate.toFixed(2)}%`);
      console.log(`总耗时: ${metrics.processingTime}ms`);
      console.log(`平均TPS: ${metrics.averageTPS.toFixed(2)}`);
      console.log(`峰值TPS: ${metrics.peakTPS.toFixed(2)}`);
      console.log(`平均延迟: ${metrics.averageLatency.toFixed(2)}ms`);
      console.log(`内存使用: ${metrics.memoryUsage}MB`);
      
      return metrics;
      
    } catch (error) {
      console.error(`❌ ${testType}压力测试执行失败:`, error);
      throw error;
    }
  }
}

// 主测试函数 / Main test function
async function runPerformanceStressTests(): Promise<void> {
  console.log('🚀 开始TitanChain性能压力测试 / Starting TitanChain performance stress tests');
  console.log('='.repeat(80));
  
  const executor = new StressTestExecutor();
  const results: { [key: string]: PerformanceMetrics } = {};
  
  try {
    // 运行轻量级压力测试 / Run lightweight stress test
    results['lightweight'] = await executor.runLightweightStressTest();
    
    // 等待系统恢复 / Wait for system recovery
    console.log('\n⏳ 等待系统恢复...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 运行中等压力测试 / Run medium stress test
    results['medium'] = await executor.runMediumStressTest();
    
    // 等待系统恢复 / Wait for system recovery
    console.log('\n⏳ 等待系统恢复...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 运行高强度压力测试 / Run high intensity stress test
    results['high'] = await executor.runHighIntensityStressTest();
    
    // 生成综合报告 / Generate comprehensive report
    console.log('\n📋 TitanChain性能压力测试综合报告 / TitanChain Performance Stress Test Comprehensive Report');
    console.log('='.repeat(80));
    
    Object.entries(results).forEach(([testType, metrics]) => {
      console.log(`\n🔍 ${testType.toUpperCase()}测试结果:`);
      console.log(`  成功率: ${metrics.successRate.toFixed(2)}%`);
      console.log(`  平均TPS: ${metrics.averageTPS.toFixed(2)}`);
      console.log(`  峰值TPS: ${metrics.peakTPS.toFixed(2)}`);
      console.log(`  平均延迟: ${metrics.averageLatency.toFixed(2)}ms`);
      console.log(`  内存使用: ${metrics.memoryUsage}MB`);
    });
    
    // 性能评估 / Performance evaluation
    const overallSuccessRate = Object.values(results).reduce((sum, metrics) => sum + metrics.successRate, 0) / Object.keys(results).length;
    const overallAvgTPS = Object.values(results).reduce((sum, metrics) => sum + metrics.averageTPS, 0) / Object.keys(results).length;
    
    console.log('\n🎯 总体性能评估:');
    console.log(`平均成功率: ${overallSuccessRate.toFixed(2)}%`);
    console.log(`平均TPS: ${overallAvgTPS.toFixed(2)}`);
    
    if (overallSuccessRate >= 80 && overallAvgTPS >= 30) {
      console.log('\n🎉 性能压力测试整体通过! / Performance stress test overall PASSED!');
      console.log('✅ 系统在高负载下表现良好 / System performs well under high load');
    } else {
      console.log('\n⚠️ 性能压力测试需要优化 / Performance stress test needs optimization');
      console.log('❌ 系统在高负载下性能不足 / System performance insufficient under high load');
    }
    
  } catch (error) {
    console.error('❌ 性能压力测试过程中出现错误:', error);
    throw error;
  }
}

// 执行测试 / Execute test
runPerformanceStressTests()
  .then(() => {
    console.log('\n✅ 性能压力测试完成 / Performance stress test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 性能压力测试失败 / Performance stress test failed:', error);
    process.exit(1);
  });