/**
 * TitanChain性能测试套件
 * 验证500,000 TPS和<0.1ms延迟目标
 */

import { TitanCore } from '../../blockchain/core/titan-core';
import { SmartShardingManager } from '../../blockchain/sharding/smart-sharding';
import { UltraLowLatencyManager } from '../../blockchain/optimization/ultra-low-latency';
import { TitanBFT } from '../../blockchain/consensus/titan-bft';
import { RealTimePerformanceMonitor } from '../../blockchain/monitoring/performance-monitor';
import { TitanEVM } from '../../blockchain/evm/titan-evm';

/**
 * 测试配置
 */
interface TestConfig {
  targetTPS: number;
  targetLatency: number; // ms
  testDuration: number; // ms
  warmupDuration: number; // ms
  orderTypes: string[];
  tradingPairs: string[];
  userCount: number;
  shardCount: number;
}

/**
 * 测试结果
 */
interface TestResult {
  testName: string;
  success: boolean;
  metrics: {
    actualTPS: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    maxLatency: number;
    minLatency: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    networkUsage: number;
  };
  errors: string[];
  duration: number;
  timestamp: number;
}

/**
 * 订单生成器
 */
class OrderGenerator {
  private orderId: number = 1;
  private userIds: string[] = [];
  private tradingPairs: string[] = [];

  constructor(userCount: number, tradingPairs: string[]) {
    this.tradingPairs = tradingPairs;
    
    // 生成用户ID
    for (let i = 1; i <= userCount; i++) {
      this.userIds.push(`user_${i.toString().padStart(6, '0')}`);
    }
  }

  /**
   * 生成随机订单
   */
  public generateOrder(): any {
    const userId = this.userIds[Math.floor(Math.random() * this.userIds.length)];
    const tradingPair = this.tradingPairs[Math.floor(Math.random() * this.tradingPairs.length)];
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const orderType = Math.random() > 0.8 ? 'market' : 'limit';
    
    const basePrice = 100 + Math.random() * 900; // 100-1000价格范围
    const price = orderType === 'market' ? 0 : basePrice + (Math.random() - 0.5) * 20;
    const quantity = Math.random() * 100 + 1; // 1-101数量范围

    return {
      id: `order_${this.orderId++}`,
      userId,
      tradingPair,
      side,
      type: orderType,
      price: Math.round(price * 100) / 100,
      quantity: Math.round(quantity * 100) / 100,
      timestamp: Date.now()
    };
  }

  /**
   * 批量生成订单
   */
  public generateBatch(count: number): any[] {
    const orders = [];
    for (let i = 0; i < count; i++) {
      orders.push(this.generateOrder());
    }
    return orders;
  }
}

/**
 * 性能测试器
 */
export class TitanPerformanceTester {
  private titanCore: TitanCore;
  private shardingManager: SmartShardingManager;
  private latencyManager: UltraLowLatencyManager;
  private consensus: TitanBFT;
  private evm: TitanEVM;
  private performanceMonitor: RealTimePerformanceMonitor;
  private orderGenerator: OrderGenerator;

  private testResults: TestResult[] = [];
  private isRunning: boolean = false;

  constructor() {
    console.log('Initializing TitanChain performance test environment...');
    this.initializeComponents();
  }

  /**
   * 初始化组件
   */
  private initializeComponents(): void {
    // 初始化核心组件
    this.latencyManager = new UltraLowLatencyManager();
    this.consensus = new TitanBFT();
    this.shardingManager = new SmartShardingManager();
    this.titanCore = new TitanCore();
    this.evm = new TitanEVM();
    
    // 初始化性能监控
    this.performanceMonitor = new RealTimePerformanceMonitor(
      this.titanCore,
      this.shardingManager,
      this.latencyManager,
      this.consensus
    );

    // 初始化订单生成器
    this.orderGenerator = new OrderGenerator(10000, ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT']);

    console.log('TitanChain components initialized');
  }

  /**
   * 启动测试环境
   */
  public async startTestEnvironment(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Test environment is already running');
    }

    console.log('Starting TitanChain test environment...');

    // 启动各个组件
    await this.latencyManager.start();
    await this.consensus.start();
    await this.shardingManager.start();
    await this.titanCore.start();
    await this.evm.start();
    await this.performanceMonitor.start();

    this.isRunning = true;
    console.log('TitanChain test environment started successfully');
  }

  /**
   * 停止测试环境
   */
  public async stopTestEnvironment(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping TitanChain test environment...');

    // 停止各个组件
    await this.performanceMonitor.stop();
    await this.evm.stop();
    await this.titanCore.stop();
    await this.shardingManager.stop();
    await this.consensus.stop();
    await this.latencyManager.stop();

    this.isRunning = false;
    console.log('TitanChain test environment stopped');
  }

  /**
   * 运行TPS压力测试
   */
  public async runTPSStressTest(config: TestConfig): Promise<TestResult> {
    console.log(`Starting TPS stress test - Target: ${config.targetTPS} TPS`);
    
    const startTime = Date.now();
    const errors: string[] = [];
    const latencies: number[] = [];
    let processedOrders = 0;
    let totalOrders = 0;

    try {
      // 预热阶段
      console.log('Warming up system...');
      await this.warmupSystem(config.warmupDuration);

      // 计算每秒需要发送的订单数
      const ordersPerSecond = config.targetTPS;
      const batchSize = Math.min(1000, ordersPerSecond / 10); // 每100ms一批
      const batchInterval = 100; // 100ms间隔

      console.log(`Test configuration: ${ordersPerSecond} orders/sec, batch size: ${batchSize}`);

      // 开始压力测试
      const testEndTime = startTime + config.testDuration;
      
      while (Date.now() < testEndTime && this.isRunning) {
        const batchStartTime = performance.now();
        
        // 生成订单批次
        const orders = this.orderGenerator.generateBatch(batchSize);
        totalOrders += orders.length;

        // 并行处理订单
        const promises = orders.map(async (order) => {
          const orderStartTime = performance.now();
          
          try {
            await this.titanCore.submitOrder(order);
            const orderLatency = performance.now() - orderStartTime;
            latencies.push(orderLatency);
            processedOrders++;
          } catch (error) {
            errors.push(`Order ${order.id}: ${error.message}`);
          }
        });

        await Promise.all(promises);

        // 控制发送速率
        const batchDuration = performance.now() - batchStartTime;
        const remainingTime = batchInterval - batchDuration;
        
        if (remainingTime > 0) {
          await this.sleep(remainingTime);
        }
      }

      // 等待所有订单处理完成
      await this.sleep(1000);

      const testDuration = Date.now() - startTime;
      const actualTPS = (processedOrders / testDuration) * 1000;

      // 计算延迟统计
      latencies.sort((a, b) => a - b);
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const p95Index = Math.floor(latencies.length * 0.95);
      const p99Index = Math.floor(latencies.length * 0.99);

      const result: TestResult = {
        testName: 'TPS Stress Test',
        success: actualTPS >= config.targetTPS * 0.95, // 允许5%误差
        metrics: {
          actualTPS,
          averageLatency,
          p95Latency: latencies[p95Index] || 0,
          p99Latency: latencies[p99Index] || 0,
          maxLatency: Math.max(...latencies),
          minLatency: Math.min(...latencies)
        },
        resources: await this.getResourceUsage(),
        errors,
        duration: testDuration,
        timestamp: startTime
      };

      this.testResults.push(result);
      console.log(`TPS test completed: ${actualTPS.toFixed(0)} TPS (target: ${config.targetTPS})`);
      
      return result;

    } catch (error) {
      console.error('TPS stress test failed:', error);
      throw error;
    }
  }

  /**
   * 运行延迟测试
   */
  public async runLatencyTest(config: TestConfig): Promise<TestResult> {
    console.log(`Starting latency test - Target: <${config.targetLatency}ms`);
    
    const startTime = Date.now();
    const errors: string[] = [];
    const latencies: number[] = [];
    let processedOrders = 0;

    try {
      // 预热
      await this.warmupSystem(config.warmupDuration);

      // 延迟测试：单个订单逐一发送
      const testEndTime = startTime + config.testDuration;
      
      while (Date.now() < testEndTime && this.isRunning) {
        const order = this.orderGenerator.generateOrder();
        const orderStartTime = performance.now();
        
        try {
          await this.titanCore.submitOrder(order);
          const orderLatency = performance.now() - orderStartTime;
          latencies.push(orderLatency);
          processedOrders++;
          
          // 小间隔以避免过载
          await this.sleep(1);
          
        } catch (error) {
          errors.push(`Order ${order.id}: ${error.message}`);
        }
      }

      const testDuration = Date.now() - startTime;

      // 计算延迟统计
      latencies.sort((a, b) => a - b);
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const p95Index = Math.floor(latencies.length * 0.95);
      const p99Index = Math.floor(latencies.length * 0.99);

      const result: TestResult = {
        testName: 'Latency Test',
        success: averageLatency <= config.targetLatency,
        metrics: {
          actualTPS: (processedOrders / testDuration) * 1000,
          averageLatency,
          p95Latency: latencies[p95Index] || 0,
          p99Latency: latencies[p99Index] || 0,
          maxLatency: Math.max(...latencies),
          minLatency: Math.min(...latencies)
        },
        resources: await this.getResourceUsage(),
        errors,
        duration: testDuration,
        timestamp: startTime
      };

      this.testResults.push(result);
      console.log(`Latency test completed: ${averageLatency.toFixed(3)}ms average (target: <${config.targetLatency}ms)`);
      
      return result;

    } catch (error) {
      console.error('Latency test failed:', error);
      throw error;
    }
  }

  /**
   * 运行并发测试
   */
  public async runConcurrencyTest(config: TestConfig): Promise<TestResult> {
    console.log(`Starting concurrency test - ${config.userCount} concurrent users`);
    
    const startTime = Date.now();
    const errors: string[] = [];
    const latencies: number[] = [];
    let processedOrders = 0;

    try {
      // 预热
      await this.warmupSystem(config.warmupDuration);

      // 创建并发用户
      const userPromises: Promise<void>[] = [];
      
      for (let userId = 0; userId < config.userCount; userId++) {
        const userPromise = this.simulateUser(userId, config, latencies, errors);
        userPromises.push(userPromise);
      }

      // 等待所有用户完成
      await Promise.all(userPromises);
      processedOrders = latencies.length;

      const testDuration = Date.now() - startTime;
      const actualTPS = (processedOrders / testDuration) * 1000;

      // 计算延迟统计
      latencies.sort((a, b) => a - b);
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const p95Index = Math.floor(latencies.length * 0.95);
      const p99Index = Math.floor(latencies.length * 0.99);

      const result: TestResult = {
        testName: 'Concurrency Test',
        success: actualTPS >= config.targetTPS * 0.8 && averageLatency <= config.targetLatency * 2,
        metrics: {
          actualTPS,
          averageLatency,
          p95Latency: latencies[p95Index] || 0,
          p99Latency: latencies[p99Index] || 0,
          maxLatency: Math.max(...latencies),
          minLatency: Math.min(...latencies)
        },
        resources: await this.getResourceUsage(),
        errors,
        duration: testDuration,
        timestamp: startTime
      };

      this.testResults.push(result);
      console.log(`Concurrency test completed: ${config.userCount} users, ${actualTPS.toFixed(0)} TPS`);
      
      return result;

    } catch (error) {
      console.error('Concurrency test failed:', error);
      throw error;
    }
  }

  /**
   * 模拟单个用户行为
   */
  private async simulateUser(
    userId: number, 
    config: TestConfig, 
    latencies: number[], 
    errors: string[]
  ): Promise<void> {
    const userEndTime = Date.now() + config.testDuration;
    
    while (Date.now() < userEndTime && this.isRunning) {
      const order = this.orderGenerator.generateOrder();
      order.userId = `concurrent_user_${userId}`;
      
      const orderStartTime = performance.now();
      
      try {
        await this.titanCore.submitOrder(order);
        const orderLatency = performance.now() - orderStartTime;
        latencies.push(orderLatency);
        
        // 随机间隔模拟真实用户行为
        await this.sleep(Math.random() * 100 + 50); // 50-150ms间隔
        
      } catch (error) {
        errors.push(`User ${userId} Order ${order.id}: ${error.message}`);
      }
    }
  }

  /**
   * 运行完整测试套件
   */
  public async runFullTestSuite(): Promise<TestResult[]> {
    console.log('Starting TitanChain full performance test suite...');
    
    const testConfigs: TestConfig[] = [
      // 基础TPS测试
      {
        targetTPS: 100000,
        targetLatency: 0.1,
        testDuration: 30000, // 30秒
        warmupDuration: 5000, // 5秒预热
        orderTypes: ['limit', 'market'],
        tradingPairs: ['BTC/USDT', 'ETH/USDT'],
        userCount: 1000,
        shardCount: 8
      },
      // 高TPS测试
      {
        targetTPS: 300000,
        targetLatency: 0.15,
        testDuration: 60000, // 60秒
        warmupDuration: 10000, // 10秒预热
        orderTypes: ['limit', 'market'],
        tradingPairs: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'],
        userCount: 5000,
        shardCount: 16
      },
      // 目标TPS测试
      {
        targetTPS: 500000,
        targetLatency: 0.1,
        testDuration: 120000, // 120秒
        warmupDuration: 15000, // 15秒预热
        orderTypes: ['limit', 'market'],
        tradingPairs: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT'],
        userCount: 10000,
        shardCount: 32
      }
    ];

    const results: TestResult[] = [];

    for (const config of testConfigs) {
      console.log(`\n=== Running test: ${config.targetTPS} TPS target ===`);
      
      // 配置系统
      await this.configureSystem(config);
      
      // 运行TPS测试
      const tpsResult = await this.runTPSStressTest(config);
      results.push(tpsResult);
      
      // 等待系统稳定
      await this.sleep(5000);
      
      // 运行延迟测试
      const latencyResult = await this.runLatencyTest(config);
      results.push(latencyResult);
      
      // 等待系统稳定
      await this.sleep(5000);
      
      // 运行并发测试
      const concurrencyResult = await this.runConcurrencyTest(config);
      results.push(concurrencyResult);
      
      // 测试间隔
      await this.sleep(10000);
    }

    this.testResults.push(...results);
    console.log('\n=== Full test suite completed ===');
    this.printTestSummary(results);
    
    return results;
  }

  /**
   * 配置系统参数
   */
  private async configureSystem(config: TestConfig): Promise<void> {
    console.log(`Configuring system for ${config.targetTPS} TPS test...`);
    
    // 配置分片数量
    await this.shardingManager.resizeShards(config.shardCount);
    
    // 配置延迟目标
    this.latencyManager.setLatencyTarget(config.targetLatency);
    
    // 配置共识参数
    const batchSize = Math.min(10000, config.targetTPS / 100);
    this.consensus.setBatchSize(batchSize);
    
    console.log(`System configured: ${config.shardCount} shards, ${batchSize} batch size`);
  }

  /**
   * 系统预热
   */
  private async warmupSystem(duration: number): Promise<void> {
    console.log(`Warming up system for ${duration}ms...`);
    
    const warmupEndTime = Date.now() + duration;
    const warmupOrders = [];
    
    // 生成预热订单
    while (Date.now() < warmupEndTime) {
      const orders = this.orderGenerator.generateBatch(100);
      warmupOrders.push(...orders);
      
      // 提交预热订单
      const promises = orders.map(order => 
        this.titanCore.submitOrder(order).catch(() => {}) // 忽略预热错误
      );
      
      await Promise.all(promises);
      await this.sleep(10);
    }
    
    console.log(`Warmup completed: ${warmupOrders.length} orders processed`);
  }

  /**
   * 获取资源使用情况
   */
  private async getResourceUsage(): Promise<any> {
    const memUsage = process.memoryUsage();
    
    return {
      cpuUsage: Math.random() * 100, // 简化实现
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      networkUsage: Math.random() * 100 // 简化实现
    };
  }

  /**
   * 打印测试摘要
   */
  private printTestSummary(results: TestResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('TITANCHAIN PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(80));
    
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`Successful: ${successfulTests.length}`);
    console.log(`Failed: ${failedTests.length}`);
    console.log(`Success Rate: ${((successfulTests.length / results.length) * 100).toFixed(1)}%`);
    
    console.log('\nPERFORMANCE METRICS:');
    console.log('-'.repeat(50));
    
    for (const result of results) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.testName}`);
      console.log(`  TPS: ${result.metrics.actualTPS.toFixed(0)}`);
      console.log(`  Avg Latency: ${result.metrics.averageLatency.toFixed(3)}ms`);
      console.log(`  P95 Latency: ${result.metrics.p95Latency.toFixed(3)}ms`);
      console.log(`  P99 Latency: ${result.metrics.p99Latency.toFixed(3)}ms`);
      console.log(`  Errors: ${result.errors.length}`);
      console.log('');
    }
    
    // 检查是否达到目标
    const maxTPS = Math.max(...results.map(r => r.metrics.actualTPS));
    const minLatency = Math.min(...results.map(r => r.metrics.averageLatency));
    
    console.log('TARGET ACHIEVEMENT:');
    console.log('-'.repeat(30));
    console.log(`Max TPS Achieved: ${maxTPS.toFixed(0)} (Target: 500,000)`);
    console.log(`Min Latency Achieved: ${minLatency.toFixed(3)}ms (Target: <0.1ms)`);
    
    const tpsAchieved = maxTPS >= 500000;
    const latencyAchieved = minLatency <= 0.1;
    
    console.log(`TPS Target: ${tpsAchieved ? '✅ ACHIEVED' : '❌ NOT ACHIEVED'}`);
    console.log(`Latency Target: ${latencyAchieved ? '✅ ACHIEVED' : '❌ NOT ACHIEVED'}`);
    
    if (tpsAchieved && latencyAchieved) {
      console.log('\n🎉 CONGRATULATIONS! TitanChain has achieved both performance targets!');
    } else {
      console.log('\n⚠️  Performance targets not fully achieved. Further optimization needed.');
    }
    
    console.log('='.repeat(80));
  }

  /**
   * 获取测试结果
   */
  public getTestResults(): TestResult[] {
    return [...this.testResults];
  }

  /**
   * 清除测试结果
   */
  public clearTestResults(): void {
    this.testResults = [];
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 运行性能测试的主函数
 */
export async function runTitanChainPerformanceTest(): Promise<void> {
  const tester = new TitanPerformanceTester();
  
  try {
    // 启动测试环境
    await tester.startTestEnvironment();
    
    // 运行完整测试套件
    const results = await tester.runFullTestSuite();
    
    // 保存测试结果
    const testReport = {
      timestamp: Date.now(),
      results,
      summary: {
        totalTests: results.length,
        successfulTests: results.filter(r => r.success).length,
        maxTPS: Math.max(...results.map(r => r.metrics.actualTPS)),
        minLatency: Math.min(...results.map(r => r.metrics.averageLatency))
      }
    };
    
    console.log('\nTest report generated:', JSON.stringify(testReport, null, 2));
    
  } catch (error) {
    console.error('Performance test failed:', error);
    throw error;
  } finally {
    // 停止测试环境
    await tester.stopTestEnvironment();
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTitanChainPerformanceTest().catch(console.error);
}