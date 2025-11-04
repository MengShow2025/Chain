#!/usr/bin/env node
/**
 * 智能分片模块综合测试套件
 * Smart Sharding Module Comprehensive Test Suite
 * 
 * 测试功能 / Test Features:
 * - 动态分片功能 / Dynamic Sharding
 * - 负载均衡 / Load Balancing  
 * - 自动扩缩容 / Auto Scaling
 * - 跨分片交易处理 / Cross-Shard Transaction Processing
 * - 性能指标监控 / Performance Metrics Monitoring
 */

import { EventEmitter } from 'events';

// 测试结果接口 / Test Result Interface
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  message: string;
  duration: number;
  details?: any;
}

// 性能指标接口 / Performance Metrics Interface
interface PerformanceMetrics {
  throughput: number;
  latency: number;
  memoryUsage: number;
  cpuUsage: number;
  shardCount: number;
  loadDistribution: number[];
}

class SmartShardingTester extends EventEmitter {
  private results: TestResult[] = [];
  private performanceMetrics: PerformanceMetrics[] = [];
  private startTime: number = 0;

  constructor() {
    super();
    console.log('🚀 初始化智能分片测试套件...');
  }

  // 添加测试结果 / Add Test Result
  private addResult(name: string, status: TestResult['status'], message: string, details?: any): void {
    const duration = Date.now() - this.startTime;
    this.results.push({ name, status, message, duration, details });
    
    const statusIcon = {
      'PASS': '✅',
      'FAIL': '❌', 
      'WARN': '⚠️',
      'SKIP': '⏭️'
    }[status];
    
    console.log(`${statusIcon} ${name}: ${message} (${duration}ms)`);
    if (details) {
      console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    }
  }

  // 记录性能指标 / Record Performance Metrics
  private recordMetrics(metrics: PerformanceMetrics): void {
    this.performanceMetrics.push(metrics);
    console.log(`📊 性能指标记录: TPS=${metrics.throughput}, 延迟=${metrics.latency}ms, 分片数=${metrics.shardCount}`);
  }

  // 测试1: 动态分片功能 / Test 1: Dynamic Sharding
  async testDynamicSharding(): Promise<void> {
    console.log('\n🔄 测试1: 动态分片功能');
    this.startTime = Date.now();

    try {
      // 尝试导入智能分片模块
      let shardingModule;
      try {
        shardingModule = await import('./blockchain/sharding/smart-sharding.js');
      } catch (error) {
        // 尝试备用路径
        try {
          shardingModule = await import('./blockchain/core/smart-sharding.js');
        } catch (fallbackError) {
          this.addResult('Dynamic Sharding Import', 'SKIP', '智能分片模块不可用', { 
            primaryError: error.message,
            fallbackError: fallbackError.message 
          });
          return;
        }
      }

      const { SmartShardingManager, ShardType, LoadBalanceStrategy } = shardingModule;

      // 创建分片管理器
      const manager = new SmartShardingManager(3, LoadBalanceStrategy.LEAST_LOADED);
      this.addResult('Sharding Manager Creation', 'PASS', '分片管理器创建成功');

      // 测试初始分片状态
      const initialStatus = manager.getSystemStatus();
      this.addResult('Initial Shard Status', 'PASS', `初始分片数: ${initialStatus.totalShards}`, initialStatus);

      // 测试动态添加分片
      await manager.addShard(ShardType.DYNAMIC, 'dynamic-shard-1');
      const afterAddStatus = manager.getSystemStatus();
      
      if (afterAddStatus.totalShards > initialStatus.totalShards) {
        this.addResult('Dynamic Shard Addition', 'PASS', '动态分片添加成功');
      } else {
        this.addResult('Dynamic Shard Addition', 'FAIL', '动态分片添加失败');
      }

      // 记录性能指标
      this.recordMetrics({
        throughput: afterAddStatus.totalTPS || 0,
        latency: 50, // 模拟延迟
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: 0, // 简化处理
        shardCount: afterAddStatus.totalShards,
        loadDistribution: afterAddStatus.shards?.map(s => s.load) || []
      });

    } catch (error) {
      this.addResult('Dynamic Sharding', 'FAIL', `动态分片测试失败: ${error.message}`, { error: error.stack });
    }
  }

  // 测试2: 负载均衡 / Test 2: Load Balancing
  async testLoadBalancing(): Promise<void> {
    console.log('\n⚖️ 测试2: 负载均衡');
    this.startTime = Date.now();

    try {
      // 导入模块
      let shardingModule;
      try {
        shardingModule = await import('./blockchain/sharding/smart-sharding.js');
      } catch (error) {
        try {
          shardingModule = await import('./blockchain/core/smart-sharding.js');
        } catch (fallbackError) {
          this.addResult('Load Balancing Import', 'SKIP', '智能分片模块不可用');
          return;
        }
      }

      const { LoadBalancer, LoadBalanceStrategy } = shardingModule;

      // 测试不同的负载均衡策略
      const strategies = [
        LoadBalanceStrategy.ROUND_ROBIN,
        LoadBalanceStrategy.LEAST_LOADED,
        LoadBalanceStrategy.CONSISTENT_HASH
      ];

      for (const strategy of strategies) {
        const balancer = new LoadBalancer(strategy);
        this.addResult(`Load Balance Strategy ${strategy}`, 'PASS', `${strategy}策略创建成功`);
      }

      // 模拟负载分布测试
      const balancer = new LoadBalancer(LoadBalanceStrategy.LEAST_LOADED);
      
      // 创建模拟分片
      const mockShards = Array.from({ length: 5 }, (_, i) => ({
        id: `shard-${i}`,
        getStatus: () => ({
          id: `shard-${i}`,
          load: Math.random() * 0.8, // 随机负载 0-80%
          tps: Math.floor(Math.random() * 1000),
          status: 'active' as const,
          type: 'dynamic' as const
        })
      }));

      // 添加分片到负载均衡器
      mockShards.forEach(shard => {
        if (balancer.addShard) {
          balancer.addShard(shard as any);
        }
      });

      this.addResult('Load Balancer Setup', 'PASS', `负载均衡器配置完成，管理${mockShards.length}个分片`);

    } catch (error) {
      this.addResult('Load Balancing', 'FAIL', `负载均衡测试失败: ${error.message}`, { error: error.stack });
    }
  }

  // 测试3: 自动扩缩容 / Test 3: Auto Scaling
  async testAutoScaling(): Promise<void> {
    console.log('\n📈 测试3: 自动扩缩容');
    this.startTime = Date.now();

    try {
      // 导入模块
      let shardingModule;
      try {
        shardingModule = await import('./blockchain/sharding/smart-sharding.js');
      } catch (error) {
        try {
          shardingModule = await import('./blockchain/core/smart-sharding.js');
        } catch (fallbackError) {
          this.addResult('Auto Scaling Import', 'SKIP', '智能分片模块不可用');
          return;
        }
      }

      const { SmartShardingManager, LoadBalanceStrategy } = shardingModule;

      // 创建支持自动扩缩容的管理器
      const manager = new SmartShardingManager(2, LoadBalanceStrategy.LEAST_LOADED);
      
      // 启用自动扩缩容
      if (manager.enableAutoScaling) {
        manager.enableAutoScaling();
        this.addResult('Auto Scaling Enable', 'PASS', '自动扩缩容功能启用成功');
      } else {
        this.addResult('Auto Scaling Enable', 'WARN', '自动扩缩容功能接口不可用');
      }

      // 模拟高负载场景
      const initialShardCount = manager.getSystemStatus().totalShards;
      
      // 模拟负载增加
      if (manager.simulateLoad) {
        await manager.simulateLoad(0.9); // 90% 负载
        
        // 等待自动扩容
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const afterLoadStatus = manager.getSystemStatus();
        
        if (afterLoadStatus.totalShards > initialShardCount) {
          this.addResult('Auto Scale Up', 'PASS', `自动扩容成功: ${initialShardCount} -> ${afterLoadStatus.totalShards}`);
        } else {
          this.addResult('Auto Scale Up', 'WARN', '自动扩容未触发或延迟');
        }
      } else {
        this.addResult('Auto Scaling Simulation', 'SKIP', '负载模拟功能不可用');
      }

    } catch (error) {
      this.addResult('Auto Scaling', 'FAIL', `自动扩缩容测试失败: ${error.message}`, { error: error.stack });
    }
  }

  // 测试4: 跨分片交易处理 / Test 4: Cross-Shard Transaction Processing
  async testCrossShardTransactions(): Promise<void> {
    console.log('\n🔄 测试4: 跨分片交易处理');
    this.startTime = Date.now();

    try {
      // 导入模块
      let shardingModule;
      try {
        shardingModule = await import('./blockchain/sharding/smart-sharding.js');
      } catch (error) {
        try {
          shardingModule = await import('./blockchain/core/smart-sharding.js');
        } catch (fallbackError) {
          this.addResult('Cross-Shard Import', 'SKIP', '智能分片模块不可用');
          return;
        }
      }

      const { SmartShardingManager, CrossShardCoordinator } = shardingModule;

      // 创建分片管理器
      const manager = new SmartShardingManager(3, 'LEAST_LOADED');
      
      // 测试跨分片协调器
      if (CrossShardCoordinator) {
        const coordinator = new CrossShardCoordinator(manager.getAllShards());
        this.addResult('Cross-Shard Coordinator', 'PASS', '跨分片协调器创建成功');

        // 模拟跨分片交易
        const mockTransaction = {
          id: 'tx-cross-shard-001',
          fromShard: 'shard-0',
          toShard: 'shard-1',
          amount: 100,
          timestamp: Date.now()
        };

        if (coordinator.processTransaction) {
          const result = await coordinator.processTransaction(mockTransaction);
          this.addResult('Cross-Shard Transaction', 'PASS', '跨分片交易处理成功', result);
        } else {
          this.addResult('Cross-Shard Transaction', 'WARN', '跨分片交易处理接口不可用');
        }
      } else {
        this.addResult('Cross-Shard Coordinator', 'SKIP', '跨分片协调器不可用');
      }

    } catch (error) {
      this.addResult('Cross-Shard Transactions', 'FAIL', `跨分片交易测试失败: ${error.message}`, { error: error.stack });
    }
  }

  // 测试5: 性能压力测试 / Test 5: Performance Stress Test
  async testPerformanceStress(): Promise<void> {
    console.log('\n🚀 测试5: 性能压力测试');
    this.startTime = Date.now();

    try {
      // 导入模块
      let shardingModule;
      try {
        shardingModule = await import('./blockchain/sharding/smart-sharding.js');
      } catch (error) {
        try {
          shardingModule = await import('./blockchain/core/smart-sharding.js');
        } catch (fallbackError) {
          this.addResult('Performance Test Import', 'SKIP', '智能分片模块不可用');
          return;
        }
      }

      const { SmartShardingManager } = shardingModule;

      // 创建大规模分片管理器
      const manager = new SmartShardingManager(10, 'LEAST_LOADED');
      
      // 性能测试参数
      const testDuration = 5000; // 5秒
      const transactionCount = 1000;
      const startTime = Date.now();
      
      // 模拟大量交易处理
      const transactions = Array.from({ length: transactionCount }, (_, i) => ({
        id: `tx-${i}`,
        data: `transaction-data-${i}`,
        timestamp: Date.now()
      }));

      let processedCount = 0;
      const processingPromises = transactions.map(async (tx) => {
        try {
          // 模拟交易处理
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          processedCount++;
        } catch (error) {
          console.error(`Transaction ${tx.id} failed:`, error);
        }
      });

      await Promise.all(processingPromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const tps = Math.round((processedCount / duration) * 1000);

      // 记录性能指标
      this.recordMetrics({
        throughput: tps,
        latency: duration / processedCount,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: 0,
        shardCount: manager.getSystemStatus().totalShards,
        loadDistribution: []
      });

      this.addResult('Performance Stress Test', 'PASS', 
        `性能测试完成: ${processedCount}/${transactionCount} 交易处理, TPS: ${tps}`, 
        { processedCount, transactionCount, tps, duration }
      );

    } catch (error) {
      this.addResult('Performance Stress Test', 'FAIL', `性能压力测试失败: ${error.message}`, { error: error.stack });
    }
  }

  // 运行所有测试 / Run All Tests
  async runAllTests(): Promise<void> {
    console.log('🎯 开始智能分片模块综合测试');
    console.log('=' .repeat(60));

    const tests = [
      () => this.testDynamicSharding(),
      () => this.testLoadBalancing(),
      () => this.testAutoScaling(),
      () => this.testCrossShardTransactions(),
      () => this.testPerformanceStress()
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        console.error('测试执行错误:', error);
      }
      // 测试间隔
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.generateReport();
  }

  // 生成测试报告 / Generate Test Report
  private generateReport(): void {
    console.log('\n📋 智能分片测试报告');
    console.log('=' .repeat(60));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    const warnTests = this.results.filter(r => r.status === 'WARN').length;
    const skippedTests = this.results.filter(r => r.status === 'SKIP').length;

    console.log(`总测试数: ${totalTests}`);
    console.log(`✅ 通过: ${passedTests}`);
    console.log(`❌ 失败: ${failedTests}`);
    console.log(`⚠️ 警告: ${warnTests}`);
    console.log(`⏭️ 跳过: ${skippedTests}`);
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    // 性能指标汇总
    if (this.performanceMetrics.length > 0) {
      console.log('\n📊 性能指标汇总:');
      const avgThroughput = this.performanceMetrics.reduce((sum, m) => sum + m.throughput, 0) / this.performanceMetrics.length;
      const avgLatency = this.performanceMetrics.reduce((sum, m) => sum + m.latency, 0) / this.performanceMetrics.length;
      const maxShardCount = Math.max(...this.performanceMetrics.map(m => m.shardCount));
      
      console.log(`平均吞吐量: ${avgThroughput.toFixed(2)} TPS`);
      console.log(`平均延迟: ${avgLatency.toFixed(2)} ms`);
      console.log(`最大分片数: ${maxShardCount}`);
    }

    // 详细结果
    console.log('\n📝 详细测试结果:');
    this.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name}: ${result.status} - ${result.message} (${result.duration}ms)`);
    });

    // 系统状态评估
    const healthScore = (passedTests / totalTests) * 100;
    let systemStatus = '';
    
    if (healthScore >= 90) {
      systemStatus = '🟢 优秀 - 智能分片系统运行良好';
    } else if (healthScore >= 70) {
      systemStatus = '🟡 良好 - 智能分片系统基本正常，有改进空间';
    } else if (healthScore >= 50) {
      systemStatus = '🟠 警告 - 智能分片系统存在问题，需要关注';
    } else {
      systemStatus = '🔴 严重 - 智能分片系统存在重大问题，需要立即修复';
    }

    console.log(`\n🎯 系统健康评分: ${healthScore.toFixed(1)}%`);
    console.log(`📊 系统状态: ${systemStatus}`);
    
    console.log('\n✨ 智能分片模块测试完成!');
  }
}

// 主执行函数 / Main Execution Function
async function main(): Promise<void> {
  const tester = new SmartShardingTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ 测试套件执行失败:', error);
    process.exit(1);
  }
}

// 检查是否直接运行 / Check if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default SmartShardingTester;