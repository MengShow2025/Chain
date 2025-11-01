import { PerformanceMonitor, defaultPerformanceThresholds } from './blockchain/performance/performance-monitor';
import { PerformanceOptimizer, defaultOptimizerConfig } from './blockchain/performance/performance-optimizer';

/**
 * 性能测试套件
 */
class PerformanceTestSuite {
  private monitor: PerformanceMonitor;
  private optimizer: PerformanceOptimizer;
  private testResults: any[] = [];

  constructor() {
    // 创建性能监控器
    this.monitor = new PerformanceMonitor({
      ...defaultPerformanceThresholds,
      minTPS: 200000, // 目标200k TPS
      maxLatencyP95: 100, // 最大延迟100ms
      minAvailability: 99.9 // 99.9%可用性
    });

    // 创建性能优化器
    this.optimizer = new PerformanceOptimizer(this.monitor, {
      ...defaultOptimizerConfig,
      autoOptimization: false // 测试时禁用自动优化
    });

    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.monitor.on('alert:triggered', (alert) => {
      console.log(`🚨 性能警报: ${alert.message}`);
    });

    this.optimizer.on('action:completed', ({ action, result }) => {
      console.log(`✅ 优化完成: ${action.description} - ${result.success ? '成功' : '失败'}`);
    });
  }

  /**
   * 运行完整的性能测试
   */
  async runFullPerformanceTest(): Promise<void> {
    console.log('🚀 开始性能测试套件');
    console.log('目标: TPS=200k, 延迟<100ms, 可用性>99.9%');
    console.log('=' .repeat(60));

    try {
      // 启动监控器
      this.monitor.start(1000); // 1秒间隔

      // 1. 基础性能测试
      await this.runBasicPerformanceTest();

      // 2. 压力测试
      await this.runStressTest();

      // 3. 延迟测试
      await this.runLatencyTest();

      // 4. 吞吐量测试
      await this.runThroughputTest();

      // 5. 可用性测试
      await this.runAvailabilityTest();

      // 6. 优化器测试
      await this.runOptimizerTest();

      // 7. 长期稳定性测试
      await this.runStabilityTest();

      // 生成测试报告
      this.generateTestReport();

    } catch (error) {
      console.error('❌ 性能测试失败:', error);
    } finally {
      this.monitor.stop();
      this.optimizer.stop();
    }
  }

  /**
   * 基础性能测试
   */
  private async runBasicPerformanceTest(): Promise<void> {
    console.log('\n📊 1. 基础性能测试');
    console.log('-'.repeat(40));

    const testName = '基础性能测试';
    const startTime = Date.now();

    try {
      // 模拟基础负载
      await this.simulateLoad({
        duration: 10000, // 10秒
        requestsPerSecond: 1000,
        transactionsPerSecond: 500
      });

      const metrics = this.monitor.getCurrentMetrics();
      const result = {
        testName,
        duration: Date.now() - startTime,
        success: true,
        metrics: metrics ? {
          tps: Math.round(metrics.tps),
          latencyP95: Math.round(metrics.latency.p95 * 100) / 100,
          availability: Math.round(metrics.availability * 100) / 100,
          errorRate: Math.round(metrics.errors.errorRate * 100) / 100
        } : null
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}完成`);
      if (metrics) {
        console.log(`   TPS: ${result.metrics!.tps}`);
        console.log(`   延迟P95: ${result.metrics!.latencyP95}ms`);
        console.log(`   可用性: ${result.metrics!.availability}%`);
      }

    } catch (error) {
      this.testResults.push({
        testName,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      });
      console.log(`❌ ${testName}失败:`, error);
    }
  }

  /**
   * 压力测试
   */
  private async runStressTest(): Promise<void> {
    console.log('\n🔥 2. 压力测试');
    console.log('-'.repeat(40));

    const testName = '压力测试';
    const startTime = Date.now();

    try {
      // 逐步增加负载
      const loadLevels = [
        { rps: 5000, tps: 2500, duration: 5000 },
        { rps: 10000, tps: 5000, duration: 5000 },
        { rps: 20000, tps: 10000, duration: 5000 },
        { rps: 50000, tps: 25000, duration: 5000 },
        { rps: 100000, tps: 50000, duration: 5000 }
      ];

      const results = [];
      for (const level of loadLevels) {
        console.log(`   测试负载: ${level.rps} RPS, ${level.tps} TPS`);
        
        await this.simulateLoad({
          duration: level.duration,
          requestsPerSecond: level.rps,
          transactionsPerSecond: level.tps
        });

        const metrics = this.monitor.getCurrentMetrics();
        if (metrics) {
          results.push({
            targetRPS: level.rps,
            targetTPS: level.tps,
            actualTPS: Math.round(metrics.tps),
            latencyP95: Math.round(metrics.latency.p95 * 100) / 100,
            errorRate: Math.round(metrics.errors.errorRate * 100) / 100
          });
        }

        // 短暂休息
        await this.sleep(2000);
      }

      const result = {
        testName,
        duration: Date.now() - startTime,
        success: true,
        results
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}完成`);
      console.log(`   最高TPS: ${Math.max(...results.map(r => r.actualTPS))}`);
      console.log(`   最低延迟: ${Math.min(...results.map(r => r.latencyP95))}ms`);

    } catch (error) {
      this.testResults.push({
        testName,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      });
      console.log(`❌ ${testName}失败:`, error);
    }
  }

  /**
   * 延迟测试
   */
  private async runLatencyTest(): Promise<void> {
    console.log('\n⏱️  3. 延迟测试');
    console.log('-'.repeat(40));

    const testName = '延迟测试';
    const startTime = Date.now();

    try {
      // 测试不同负载下的延迟
      const scenarios = [
        { name: '低负载', rps: 1000, tps: 500 },
        { name: '中负载', rps: 10000, tps: 5000 },
        { name: '高负载', rps: 50000, tps: 25000 }
      ];

      const results = [];
      for (const scenario of scenarios) {
        console.log(`   测试场景: ${scenario.name}`);
        
        await this.simulateLoad({
          duration: 8000,
          requestsPerSecond: scenario.rps,
          transactionsPerSecond: scenario.tps
        });

        const metrics = this.monitor.getCurrentMetrics();
        if (metrics) {
          results.push({
            scenario: scenario.name,
            latency: {
              avg: Math.round(metrics.latency.avg * 100) / 100,
              p50: Math.round(metrics.latency.p50 * 100) / 100,
              p95: Math.round(metrics.latency.p95 * 100) / 100,
              p99: Math.round(metrics.latency.p99 * 100) / 100,
              max: Math.round(metrics.latency.max * 100) / 100
            }
          });
        }

        await this.sleep(2000);
      }

      const result = {
        testName,
        duration: Date.now() - startTime,
        success: true,
        results
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}完成`);
      results.forEach(r => {
        console.log(`   ${r.scenario}: P95=${r.latency.p95}ms, P99=${r.latency.p99}ms`);
      });

    } catch (error) {
      this.testResults.push({
        testName,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      });
      console.log(`❌ ${testName}失败:`, error);
    }
  }

  /**
   * 吞吐量测试
   */
  private async runThroughputTest(): Promise<void> {
    console.log('\n📈 4. 吞吐量测试');
    console.log('-'.repeat(40));

    const testName = '吞吐量测试';
    const startTime = Date.now();

    try {
      // 测试最大吞吐量
      console.log('   寻找最大吞吐量...');
      
      let maxTPS = 0;
      let optimalRPS = 0;
      
      // 二分查找最大TPS
      let low = 10000;
      let high = 300000;
      
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        console.log(`   测试 ${mid} RPS...`);
        
        await this.simulateLoad({
          duration: 5000,
          requestsPerSecond: mid,
          transactionsPerSecond: mid / 2
        });

        const metrics = this.monitor.getCurrentMetrics();
        if (metrics && metrics.latency.p95 < 100 && metrics.errors.errorRate < 1) {
          // 延迟和错误率在可接受范围内
          maxTPS = Math.max(maxTPS, metrics.tps);
          optimalRPS = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }

        await this.sleep(1000);
      }

      const result = {
        testName,
        duration: Date.now() - startTime,
        success: true,
        maxTPS: Math.round(maxTPS),
        optimalRPS,
        targetTPS: 200000
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}完成`);
      console.log(`   最大TPS: ${result.maxTPS}`);
      console.log(`   目标TPS: ${result.targetTPS}`);
      console.log(`   达成率: ${Math.round((result.maxTPS / result.targetTPS) * 100)}%`);

    } catch (error) {
      this.testResults.push({
        testName,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      });
      console.log(`❌ ${testName}失败:`, error);
    }
  }

  /**
   * 可用性测试
   */
  private async runAvailabilityTest(): Promise<void> {
    console.log('\n🛡️  5. 可用性测试');
    console.log('-'.repeat(40));

    const testName = '可用性测试';
    const startTime = Date.now();

    try {
      // 长时间运行测试可用性
      console.log('   运行30秒可用性测试...');
      
      await this.simulateLoad({
        duration: 30000,
        requestsPerSecond: 10000,
        transactionsPerSecond: 5000,
        errorRate: 0.5 // 模拟0.5%错误率
      });

      const metrics = this.monitor.getCurrentMetrics();
      const result = {
        testName,
        duration: Date.now() - startTime,
        success: true,
        availability: metrics ? Math.round(metrics.availability * 100) / 100 : 0,
        targetAvailability: 99.9
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}完成`);
      console.log(`   可用性: ${result.availability}%`);
      console.log(`   目标: ${result.targetAvailability}%`);
      console.log(`   ${result.availability >= result.targetAvailability ? '✅ 达标' : '❌ 未达标'}`);

    } catch (error) {
      this.testResults.push({
        testName,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      });
      console.log(`❌ ${testName}失败:`, error);
    }
  }

  /**
   * 优化器测试
   */
  private async runOptimizerTest(): Promise<void> {
    console.log('\n🔧 6. 优化器测试');
    console.log('-'.repeat(40));

    const testName = '优化器测试';
    const startTime = Date.now();

    try {
      // 启动优化器
      this.optimizer.start();

      // 创建性能问题触发优化
      console.log('   创建性能问题触发优化...');
      
      await this.simulateLoad({
        duration: 10000,
        requestsPerSecond: 100000,
        transactionsPerSecond: 50000,
        errorRate: 2, // 高错误率
        highLatency: true // 高延迟
      });

      // 等待优化器响应
      await this.sleep(5000);

      const optimizationStats = this.optimizer.getOptimizationStats();
      const recommendations = this.optimizer.getOptimizationRecommendations();

      const result = {
        testName,
        duration: Date.now() - startTime,
        success: true,
        optimizationStats,
        recommendationsCount: recommendations.length
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}完成`);
      console.log(`   生成优化动作: ${optimizationStats.total}`);
      console.log(`   执行成功: ${optimizationStats.successful}`);
      console.log(`   优化建议: ${recommendations.length}`);

    } catch (error) {
      this.testResults.push({
        testName,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      });
      console.log(`❌ ${testName}失败:`, error);
    } finally {
      this.optimizer.stop();
    }
  }

  /**
   * 稳定性测试
   */
  private async runStabilityTest(): Promise<void> {
    console.log('\n⏳ 7. 长期稳定性测试');
    console.log('-'.repeat(40));

    const testName = '稳定性测试';
    const startTime = Date.now();

    try {
      console.log('   运行60秒稳定性测试...');
      
      const metricsHistory = [];
      const testDuration = 60000; // 60秒
      const sampleInterval = 5000; // 5秒采样
      
      for (let elapsed = 0; elapsed < testDuration; elapsed += sampleInterval) {
        await this.simulateLoad({
          duration: sampleInterval,
          requestsPerSecond: 20000,
          transactionsPerSecond: 10000
        });

        const metrics = this.monitor.getCurrentMetrics();
        if (metrics) {
          metricsHistory.push({
            timestamp: elapsed,
            tps: metrics.tps,
            latency: metrics.latency.p95,
            availability: metrics.availability,
            errorRate: metrics.errors.errorRate
          });
        }
      }

      // 分析稳定性
      const tpsVariance = this.calculateVariance(metricsHistory.map(m => m.tps));
      const latencyVariance = this.calculateVariance(metricsHistory.map(m => m.latency));
      const avgAvailability = metricsHistory.reduce((sum, m) => sum + m.availability, 0) / metricsHistory.length;

      const result = {
        testName,
        duration: Date.now() - startTime,
        success: true,
        stability: {
          tpsVariance: Math.round(tpsVariance),
          latencyVariance: Math.round(latencyVariance * 100) / 100,
          avgAvailability: Math.round(avgAvailability * 100) / 100,
          samplesCount: metricsHistory.length
        }
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}完成`);
      console.log(`   TPS方差: ${result.stability.tpsVariance}`);
      console.log(`   延迟方差: ${result.stability.latencyVariance}ms`);
      console.log(`   平均可用性: ${result.stability.avgAvailability}%`);

    } catch (error) {
      this.testResults.push({
        testName,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      });
      console.log(`❌ ${testName}失败:`, error);
    }
  }

  /**
   * 模拟负载
   */
  private async simulateLoad(options: {
    duration: number;
    requestsPerSecond: number;
    transactionsPerSecond: number;
    errorRate?: number;
    highLatency?: boolean;
  }): Promise<void> {
    const { duration, requestsPerSecond, transactionsPerSecond, errorRate = 0, highLatency = false } = options;
    
    const startTime = Date.now();
    const requestInterval = 1000 / requestsPerSecond;
    const transactionInterval = 1000 / transactionsPerSecond;
    
    let requestCount = 0;
    let transactionCount = 0;

    // 请求生成器
    const requestGenerator = setInterval(() => {
      const requestId = `req-${Date.now()}-${requestCount++}`;
      this.monitor.startRequest(requestId);
      
      // 模拟请求处理时间
      const processingTime = highLatency ? 50 + Math.random() * 100 : 5 + Math.random() * 20;
      const isError = Math.random() < (errorRate / 100);
      
      setTimeout(() => {
        this.monitor.endRequest(requestId, !isError, isError ? 'Simulated error' : undefined, 1024);
      }, processingTime);
    }, requestInterval);

    // 交易生成器
    const transactionGenerator = setInterval(() => {
      this.monitor.recordTransaction(1);
      transactionCount++;
    }, transactionInterval);

    // 等待测试完成
    await this.sleep(duration);

    // 清理定时器
    clearInterval(requestGenerator);
    clearInterval(transactionGenerator);

    console.log(`   模拟负载完成: ${requestCount}请求, ${transactionCount}交易`);
  }

  /**
   * 计算方差
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * 生成测试报告
   */
  private generateTestReport(): void {
    console.log('\n📋 性能测试报告');
    console.log('='.repeat(60));

    const successful = this.testResults.filter(r => r.success);
    const failed = this.testResults.filter(r => !r.success);

    console.log(`总测试数: ${this.testResults.length}`);
    console.log(`成功: ${successful.length}`);
    console.log(`失败: ${failed.length}`);
    console.log(`成功率: ${Math.round((successful.length / this.testResults.length) * 100)}%`);

    console.log('\n详细结果:');
    this.testResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.testName}: ${result.success ? '✅ 成功' : '❌ 失败'}`);
      if (!result.success && result.error) {
        console.log(`   错误: ${result.error}`);
      }
    });

    // 性能摘要
    const performanceSummary = this.monitor.getPerformanceSummary();
    if (performanceSummary.current) {
      console.log('\n当前性能指标:');
      console.log(`TPS: ${performanceSummary.current.tps}`);
      console.log(`延迟P95: ${performanceSummary.current.latencyP95}ms`);
      console.log(`可用性: ${performanceSummary.current.availability}%`);
      console.log(`错误率: ${performanceSummary.current.errorRate}%`);
    }

    // 目标达成情况
    console.log('\n目标达成情况:');
    const currentMetrics = this.monitor.getCurrentMetrics();
    if (currentMetrics) {
      const tpsTarget = 200000;
      const latencyTarget = 100;
      const availabilityTarget = 99.9;

      console.log(`TPS: ${Math.round(currentMetrics.tps)} / ${tpsTarget} (${Math.round((currentMetrics.tps / tpsTarget) * 100)}%)`);
      console.log(`延迟: ${Math.round(currentMetrics.latency.p95 * 100) / 100}ms / ${latencyTarget}ms (${currentMetrics.latency.p95 <= latencyTarget ? '✅' : '❌'})`);
      console.log(`可用性: ${Math.round(currentMetrics.availability * 100) / 100}% / ${availabilityTarget}% (${currentMetrics.availability >= availabilityTarget ? '✅' : '❌'})`);
    }

    console.log('\n🎯 性能测试完成!');
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 运行性能测试
 */
async function runPerformanceTest(): Promise<void> {
  const testSuite = new PerformanceTestSuite();
  await testSuite.runFullPerformanceTest();
}

// 直接执行测试
runPerformanceTest().catch(console.error);

export { PerformanceTestSuite, runPerformanceTest };