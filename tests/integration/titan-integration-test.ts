/**
 * TitanChain集成测试
 * 验证各个组件的协同工作和完整的交易流程
 */

import { TitanCore } from '../../blockchain/core/titan-core';
import { SmartShardingManager } from '../../blockchain/sharding/smart-sharding';
import { UltraLowLatencyManager } from '../../blockchain/optimization/ultra-low-latency';
import { TitanBFT } from '../../blockchain/consensus/titan-bft';
import { RealTimePerformanceMonitor } from '../../blockchain/monitoring/performance-monitor';
import { TitanEVM } from '../../blockchain/evm/titan-evm';

/**
 * 集成测试套件
 */
export class TitanIntegrationTest {
  private components: {
    titanCore: TitanCore;
    shardingManager: SmartShardingManager;
    latencyManager: UltraLowLatencyManager;
    consensus: TitanBFT;
    evm: TitanEVM;
    performanceMonitor: RealTimePerformanceMonitor;
  };

  private testResults: any[] = [];

  constructor() {
    console.log('Initializing TitanChain integration test suite...');
    this.initializeComponents();
  }

  /**
   * 初始化所有组件
   */
  private initializeComponents(): void {
    this.components = {
      latencyManager: new UltraLowLatencyManager(),
      consensus: new TitanBFT(),
      shardingManager: new SmartShardingManager(),
      titanCore: new TitanCore(),
      evm: new TitanEVM(),
      performanceMonitor: null as any
    };

    // 初始化性能监控（需要其他组件）
    this.components.performanceMonitor = new RealTimePerformanceMonitor(
      this.components.titanCore,
      this.components.shardingManager,
      this.components.latencyManager,
      this.components.consensus
    );

    console.log('All components initialized');
  }

  /**
   * 启动所有组件
   */
  public async startAllComponents(): Promise<void> {
    console.log('Starting all TitanChain components...');

    try {
      await this.components.latencyManager.start();
      await this.components.consensus.start();
      await this.components.shardingManager.start();
      await this.components.titanCore.start();
      await this.components.evm.start();
      await this.components.performanceMonitor.start();

      console.log('All components started successfully');
    } catch (error) {
      console.error('Failed to start components:', error);
      throw error;
    }
  }

  /**
   * 停止所有组件
   */
  public async stopAllComponents(): Promise<void> {
    console.log('Stopping all TitanChain components...');

    try {
      await this.components.performanceMonitor.stop();
      await this.components.evm.stop();
      await this.components.titanCore.stop();
      await this.components.shardingManager.stop();
      await this.components.consensus.stop();
      await this.components.latencyManager.stop();

      console.log('All components stopped successfully');
    } catch (error) {
      console.error('Failed to stop components:', error);
      throw error;
    }
  }

  /**
   * 测试1：基本订单提交和撮合流程
   */
  public async testBasicOrderFlow(): Promise<boolean> {
    console.log('\n=== Test 1: Basic Order Flow ===');

    try {
      // 创建买单
      const buyOrder = {
        id: 'test_buy_001',
        userId: 'user_001',
        tradingPair: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        price: 50000,
        quantity: 1.0,
        timestamp: Date.now()
      };

      // 创建卖单
      const sellOrder = {
        id: 'test_sell_001',
        userId: 'user_002',
        tradingPair: 'BTC/USDT',
        side: 'sell',
        type: 'limit',
        price: 50000,
        quantity: 1.0,
        timestamp: Date.now()
      };

      console.log('Submitting buy order...');
      const buyResult = await this.components.titanCore.submitOrder(buyOrder);
      console.log('Buy order result:', buyResult);

      console.log('Submitting sell order...');
      const sellResult = await this.components.titanCore.submitOrder(sellOrder);
      console.log('Sell order result:', sellResult);

      // 等待撮合完成
      await this.sleep(100);

      // 检查订单薄状态
      const orderBookDepth = this.components.titanCore.getOrderBookDepth('BTC/USDT');
      console.log('Order book depth:', orderBookDepth);

      // 验证撮合是否成功
      const stats = this.components.titanCore.getStats();
      console.log('TitanCore stats:', stats);

      const success = stats.totalMatches > 0;
      this.recordTestResult('Basic Order Flow', success, {
        buyOrderSubmitted: !!buyResult,
        sellOrderSubmitted: !!sellResult,
        matchesExecuted: stats.totalMatches,
        orderBookDepth
      });

      return success;

    } catch (error) {
      console.error('Basic order flow test failed:', error);
      this.recordTestResult('Basic Order Flow', false, { error: error.message });
      return false;
    }
  }

  /**
   * 测试2：跨分片交易
   */
  public async testCrossShardTransaction(): Promise<boolean> {
    console.log('\n=== Test 2: Cross-Shard Transaction ===');

    try {
      // 配置多个分片
      await this.components.shardingManager.resizeShards(4);
      await this.sleep(1000); // 等待分片初始化

      // 创建分布在不同分片的订单
      const orders = [
        {
          id: 'shard_test_001',
          userId: 'user_shard_001',
          tradingPair: 'ETH/USDT',
          side: 'buy',
          type: 'limit',
          price: 3000,
          quantity: 10.0,
          timestamp: Date.now()
        },
        {
          id: 'shard_test_002',
          userId: 'user_shard_002',
          tradingPair: 'ETH/USDT',
          side: 'sell',
          type: 'limit',
          price: 3000,
          quantity: 5.0,
          timestamp: Date.now()
        },
        {
          id: 'shard_test_003',
          userId: 'user_shard_003',
          tradingPair: 'ETH/USDT',
          side: 'sell',
          type: 'limit',
          price: 3000,
          quantity: 5.0,
          timestamp: Date.now()
        }
      ];

      console.log('Submitting orders across shards...');
      const results = [];
      for (const order of orders) {
        const result = await this.components.titanCore.submitOrder(order);
        results.push(result);
        console.log(`Order ${order.id} submitted:`, result);
      }

      // 等待跨分片撮合完成
      await this.sleep(500);

      // 检查分片状态
      const shardingStats = this.components.shardingManager.getStats();
      console.log('Sharding stats:', shardingStats);

      // 检查撮合结果
      const coreStats = this.components.titanCore.getStats();
      console.log('Core stats after cross-shard test:', coreStats);

      const success = coreStats.totalMatches > 0 && shardingStats.crossShardTxRatio > 0;
      this.recordTestResult('Cross-Shard Transaction', success, {
        shardCount: shardingStats.shardCount,
        crossShardTxRatio: shardingStats.crossShardTxRatio,
        totalMatches: coreStats.totalMatches,
        orderResults: results
      });

      return success;

    } catch (error) {
      console.error('Cross-shard transaction test failed:', error);
      this.recordTestResult('Cross-Shard Transaction', false, { error: error.message });
      return false;
    }
  }

  /**
   * 测试3：共识机制集成
   */
  public async testConsensusIntegration(): Promise<boolean> {
    console.log('\n=== Test 3: Consensus Integration ===');

    try {
      // 获取初始共识状态
      const initialConsensusStats = this.components.consensus.getStats();
      console.log('Initial consensus stats:', initialConsensusStats);

      // 提交一批交易以触发共识
      const batchOrders = [];
      for (let i = 0; i < 50; i++) {
        batchOrders.push({
          id: `consensus_test_${i.toString().padStart(3, '0')}`,
          userId: `consensus_user_${i % 10}`,
          tradingPair: 'BNB/USDT',
          side: i % 2 === 0 ? 'buy' : 'sell',
          type: 'limit',
          price: 300 + (Math.random() - 0.5) * 10,
          quantity: Math.random() * 5 + 1,
          timestamp: Date.now()
        });
      }

      console.log('Submitting batch orders to trigger consensus...');
      const batchResults = await Promise.all(
        batchOrders.map(order => this.components.titanCore.submitOrder(order))
      );

      // 等待共识处理
      await this.sleep(2000);

      // 检查共识状态变化
      const finalConsensusStats = this.components.consensus.getStats();
      console.log('Final consensus stats:', finalConsensusStats);

      // 验证共识是否正常工作
      const blocksProduced = finalConsensusStats.totalBlocks > initialConsensusStats.totalBlocks;
      const consensusLatencyAcceptable = finalConsensusStats.consensusLatency < 100; // <100ms

      const success = blocksProduced && consensusLatencyAcceptable;
      this.recordTestResult('Consensus Integration', success, {
        initialBlocks: initialConsensusStats.totalBlocks,
        finalBlocks: finalConsensusStats.totalBlocks,
        blocksProduced: finalConsensusStats.totalBlocks - initialConsensusStats.totalBlocks,
        consensusLatency: finalConsensusStats.consensusLatency,
        batchSize: batchOrders.length,
        successfulSubmissions: batchResults.filter(r => r).length
      });

      return success;

    } catch (error) {
      console.error('Consensus integration test failed:', error);
      this.recordTestResult('Consensus Integration', false, { error: error.message });
      return false;
    }
  }

  /**
   * 测试4：EVM智能合约集成
   */
  public async testEVMIntegration(): Promise<boolean> {
    console.log('\n=== Test 4: EVM Integration ===');

    try {
      // 获取EVM初始状态
      const initialEVMStats = this.components.evm.getStats();
      console.log('Initial EVM stats:', initialEVMStats);

      // 模拟智能合约调用
      const contractCall = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0000000000000000000000000000000000000001', // TitanCore预编译合约
        data: '0x12345678', // 模拟调用数据
        gas: 100000,
        gasPrice: 20000000000,
        value: 0
      };

      console.log('Executing smart contract call...');
      const contractResult = await this.components.evm.executeTransaction(contractCall);
      console.log('Contract execution result:', contractResult);

      // 检查EVM状态变化
      const finalEVMStats = this.components.evm.getStats();
      console.log('Final EVM stats:', finalEVMStats);

      // 验证EVM集成
      const transactionsExecuted = finalEVMStats.totalTransactions > initialEVMStats.totalTransactions;
      const executionSuccessful = contractResult && contractResult.success;

      const success = transactionsExecuted && executionSuccessful;
      this.recordTestResult('EVM Integration', success, {
        initialTransactions: initialEVMStats.totalTransactions,
        finalTransactions: finalEVMStats.totalTransactions,
        contractCallResult: contractResult,
        gasUsed: contractResult?.gasUsed || 0
      });

      return success;

    } catch (error) {
      console.error('EVM integration test failed:', error);
      this.recordTestResult('EVM Integration', false, { error: error.message });
      return false;
    }
  }

  /**
   * 测试5：性能监控集成
   */
  public async testPerformanceMonitoring(): Promise<boolean> {
    console.log('\n=== Test 5: Performance Monitoring ===');

    try {
      // 获取初始性能指标
      const initialMetrics = this.components.performanceMonitor.getCurrentMetrics();
      console.log('Initial performance metrics:', initialMetrics);

      // 生成一些负载以触发监控
      const loadOrders = [];
      for (let i = 0; i < 100; i++) {
        loadOrders.push({
          id: `perf_test_${i.toString().padStart(3, '0')}`,
          userId: `perf_user_${i % 20}`,
          tradingPair: 'ADA/USDT',
          side: i % 2 === 0 ? 'buy' : 'sell',
          type: Math.random() > 0.8 ? 'market' : 'limit',
          price: 1.5 + (Math.random() - 0.5) * 0.2,
          quantity: Math.random() * 1000 + 100,
          timestamp: Date.now()
        });
      }

      console.log('Generating load for performance monitoring...');
      await Promise.all(
        loadOrders.map(order => this.components.titanCore.submitOrder(order))
      );

      // 等待性能指标更新
      await this.sleep(1000);

      // 获取更新后的性能指标
      const finalMetrics = this.components.performanceMonitor.getCurrentMetrics();
      console.log('Final performance metrics:', finalMetrics);

      // 检查活跃告警
      const activeAlerts = this.components.performanceMonitor.getActiveAlerts();
      console.log('Active alerts:', activeAlerts);

      // 获取优化历史
      const optimizationHistory = this.components.performanceMonitor.getOptimizationHistory(5);
      console.log('Recent optimizations:', optimizationHistory);

      // 验证性能监控
      const metricsUpdated = finalMetrics && finalMetrics.timestamp > (initialMetrics?.timestamp || 0);
      const tpsRecorded = finalMetrics && finalMetrics.tps > 0;

      const success = metricsUpdated && tpsRecorded;
      this.recordTestResult('Performance Monitoring', success, {
        initialMetrics,
        finalMetrics,
        activeAlerts: activeAlerts.length,
        optimizations: optimizationHistory.length,
        loadOrdersSubmitted: loadOrders.length
      });

      return success;

    } catch (error) {
      console.error('Performance monitoring test failed:', error);
      this.recordTestResult('Performance Monitoring', false, { error: error.message });
      return false;
    }
  }

  /**
   * 测试6：延迟优化集成
   */
  public async testLatencyOptimization(): Promise<boolean> {
    console.log('\n=== Test 6: Latency Optimization ===');

    try {
      // 获取延迟管理器状态
      const systemStatus = this.components.latencyManager.getSystemStatus();
      console.log('Latency manager system status:', systemStatus);

      // 测试零拷贝内存分配
      console.log('Testing zero-copy memory allocation...');
      const testBuffer = this.components.latencyManager.allocateMemory(1024 * 1024); // 1MB
      const allocationSuccessful = testBuffer !== null;
      console.log('Memory allocation successful:', allocationSuccessful);

      // 测试高频订单提交以验证延迟优化
      const latencyTestOrders = [];
      const latencies = [];

      for (let i = 0; i < 20; i++) {
        const order = {
          id: `latency_test_${i.toString().padStart(2, '0')}`,
          userId: 'latency_test_user',
          tradingPair: 'SOL/USDT',
          side: i % 2 === 0 ? 'buy' : 'sell',
          type: 'limit',
          price: 100 + (Math.random() - 0.5) * 5,
          quantity: Math.random() * 10 + 1,
          timestamp: Date.now()
        };

        const startTime = performance.now();
        await this.components.titanCore.submitOrder(order);
        const latency = performance.now() - startTime;
        
        latencies.push(latency);
        latencyTestOrders.push(order);
      }

      // 计算延迟统计
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      console.log(`Latency stats - Avg: ${avgLatency.toFixed(3)}ms, Min: ${minLatency.toFixed(3)}ms, Max: ${maxLatency.toFixed(3)}ms`);

      // 验证延迟优化效果
      const latencyTargetMet = avgLatency < 1.0; // 目标1ms以内
      const memoryOptimized = allocationSuccessful;

      const success = latencyTargetMet && memoryOptimized;
      this.recordTestResult('Latency Optimization', success, {
        systemStatus,
        memoryAllocationSuccessful: allocationSuccessful,
        latencyStats: {
          average: avgLatency,
          minimum: minLatency,
          maximum: maxLatency,
          samples: latencies.length
        },
        ordersProcessed: latencyTestOrders.length
      });

      return success;

    } catch (error) {
      console.error('Latency optimization test failed:', error);
      this.recordTestResult('Latency Optimization', false, { error: error.message });
      return false;
    }
  }

  /**
   * 运行完整集成测试套件
   */
  public async runFullIntegrationTest(): Promise<boolean> {
    console.log('\n' + '='.repeat(80));
    console.log('TITANCHAIN INTEGRATION TEST SUITE');
    console.log('='.repeat(80));

    try {
      // 启动所有组件
      await this.startAllComponents();
      
      // 等待系统稳定
      await this.sleep(2000);

      // 运行所有测试
      const testResults = [
        await this.testBasicOrderFlow(),
        await this.testCrossShardTransaction(),
        await this.testConsensusIntegration(),
        await this.testEVMIntegration(),
        await this.testPerformanceMonitoring(),
        await this.testLatencyOptimization()
      ];

      // 计算总体结果
      const successfulTests = testResults.filter(result => result).length;
      const totalTests = testResults.length;
      const overallSuccess = successfulTests === totalTests;

      // 打印测试摘要
      this.printIntegrationTestSummary(successfulTests, totalTests);

      return overallSuccess;

    } catch (error) {
      console.error('Integration test suite failed:', error);
      return false;
    } finally {
      // 停止所有组件
      await this.stopAllComponents();
    }
  }

  /**
   * 记录测试结果
   */
  private recordTestResult(testName: string, success: boolean, details: any): void {
    const result = {
      testName,
      success,
      details,
      timestamp: Date.now()
    };
    
    this.testResults.push(result);
    console.log(`${success ? '✅' : '❌'} ${testName}: ${success ? 'PASSED' : 'FAILED'}`);
  }

  /**
   * 打印集成测试摘要
   */
  private printIntegrationTestSummary(successful: number, total: number): void {
    console.log('\n' + '='.repeat(80));
    console.log('INTEGRATION TEST SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`Total Tests: ${total}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${total - successful}`);
    console.log(`Success Rate: ${((successful / total) * 100).toFixed(1)}%`);
    
    console.log('\nDETAILED RESULTS:');
    console.log('-'.repeat(50));
    
    for (const result of this.testResults) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.testName}`);
      
      if (!result.success && result.details.error) {
        console.log(`  Error: ${result.details.error}`);
      }
    }
    
    if (successful === total) {
      console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('TitanChain components are working together correctly.');
    } else {
      console.log('\n⚠️  Some integration tests failed.');
      console.log('Please review the failed tests and fix the issues.');
    }
    
    console.log('='.repeat(80));
  }

  /**
   * 获取测试结果
   */
  public getTestResults(): any[] {
    return [...this.testResults];
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 运行集成测试的主函数
 */
export async function runTitanChainIntegrationTest(): Promise<boolean> {
  const integrationTest = new TitanIntegrationTest();
  
  try {
    const success = await integrationTest.runFullIntegrationTest();
    
    // 保存测试结果
    const testReport = {
      timestamp: Date.now(),
      overallSuccess: success,
      results: integrationTest.getTestResults()
    };
    
    console.log('\nIntegration test report:', JSON.stringify(testReport, null, 2));
    
    return success;
    
  } catch (error) {
    console.error('Integration test execution failed:', error);
    return false;
  }
}

// 如果直接运行此文件，执行集成测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTitanChainIntegrationTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Integration test failed:', error);
      process.exit(1);
    });
}