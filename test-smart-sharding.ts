#!/usr/bin/env node
// Smart Sharding System Test Suite /智能分片系统测试套件

import { ShardManager, DEFAULT_SHARDING_CONFIG, createShardManager } from './blockchain/core/smart-sharding.js';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  duration: number;
}

class SmartShardingTester {
  private results: TestResult[] = [];
  private shardManager: ShardManager;

  constructor() {
    this.shardManager = createShardManager({
      minShards: 2,
      maxShards: 5,
      targetLoadPerShard: 50,
      rebalanceThreshold: 30,
      heartbeatInterval: 2000,
      syncTimeout: 10000,
      maxRetries: 2
    });
  }

  private addResult(name: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, duration: number): void {
    this.results.push({ name, status, message, duration });
    const statusColor = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
    console.log(`${statusColor}[${status}]\x1b[0m ${name}: ${message} (${duration}ms)`);
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.addResult(name, 'PASS', 'Test completed successfully', duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult(name, 'FAIL', error instanceof Error ? error.message : String(error), duration);
    }
  }

  // Test shard manager initialization /测试分片管理器初始化
  async testShardManagerInitialization(): Promise<void> {
    await this.runTest('Shard Manager Initialization', async () => {
      await this.shardManager.initialize();
      
      const shards = this.shardManager.getAllShards();
      if (shards.length < 2) {
        throw new Error(`Expected at least 2 shards, got ${shards.length}`);
      }

      const activeShards = shards.filter(s => s.status === 'active');
      if (activeShards.length !== shards.length) {
        throw new Error(`Not all shards are active: ${activeShards.length}/${shards.length}`);
      }
    });
  }

  // Test shard creation and removal /测试分片创建和删除
  async testShardManagement(): Promise<void> {
    await this.runTest('Shard Creation and Removal', async () => {
      const initialCount = this.shardManager.getAllShards().length;
      
      // Create new shard /创建新分片
      const newShard = await this.shardManager.createShard('test-shard-1', 'test-node-1');
      if (!newShard || newShard.id !== 'test-shard-1') {
        throw new Error('Failed to create new shard');
      }

      const afterCreateCount = this.shardManager.getAllShards().length;
      if (afterCreateCount !== initialCount + 1) {
        throw new Error(`Shard count mismatch after creation: expected ${initialCount + 1}, got ${afterCreateCount}`);
      }

      // Remove shard /删除分片
      const removed = await this.shardManager.removeShard('test-shard-1');
      if (!removed) {
        throw new Error('Failed to remove shard');
      }

      const afterRemoveCount = this.shardManager.getAllShards().length;
      if (afterRemoveCount !== initialCount) {
        throw new Error(`Shard count mismatch after removal: expected ${initialCount}, got ${afterRemoveCount}`);
      }
    });
  }

  // Test transaction processing /测试交易处理
  async testTransactionProcessing(): Promise<void> {
    await this.runTest('Transaction Processing', async () => {
      const transactionId = 'test-tx-' + Date.now();
      const transactionData = { amount: 100, from: 'user1', to: 'user2' };

      const processed = await this.shardManager.processTransaction(transactionId, transactionData);
      if (!processed) {
        throw new Error('Failed to process transaction');
      }

      // Verify transaction was assigned to a shard /验证交易被分配到分片
      const targetShard = this.shardManager.getShardForTransaction(transactionId);
      if (!targetShard) {
        throw new Error('Transaction not assigned to any shard');
      }

      if (!targetShard.transactions.includes(transactionId)) {
        throw new Error('Transaction not found in target shard');
      }
    });
  }

  // Test cross-shard transaction /测试跨分片交易
  async testCrossShardTransaction(): Promise<void> {
    await this.runTest('Cross-Shard Transaction', async () => {
      const shards = this.shardManager.getAllShards();
      if (shards.length < 2) {
        throw new Error('Need at least 2 shards for cross-shard transaction test');
      }

      const fromShardId = shards[0].id;
      const toShardId = shards[1].id;
      const transactionData = { amount: 50, from: 'user1', to: 'user2' };

      const processed = await this.shardManager.processCrossShardTransaction(
        fromShardId, 
        toShardId, 
        transactionData
      );

      if (!processed) {
        throw new Error('Failed to process cross-shard transaction');
      }
    });
  }

  // Test load balancing /测试负载均衡
  async testLoadBalancing(): Promise<void> {
    await this.runTest('Load Balancing', async () => {
      // Process multiple transactions to test load distribution /处理多个交易测试负载分布
      const transactionPromises = [];
      for (let i = 0; i < 10; i++) {
        const transactionId = `load-test-tx-${i}`;
        const transactionData = { amount: 10 + i, from: `user${i}`, to: `user${i + 1}` };
        transactionPromises.push(
          this.shardManager.processTransaction(transactionId, transactionData)
        );
      }

      const results = await Promise.all(transactionPromises);
      const successCount = results.filter(r => r).length;
      
      if (successCount < 8) {
        throw new Error(`Too many transaction failures: ${10 - successCount}/10 failed`);
      }

      // Check load distribution /检查负载分布
      const shards = this.shardManager.getAllShards();
      const totalLoad = shards.reduce((sum, shard) => sum + shard.currentLoad, 0);
      
      if (totalLoad < successCount) {
        throw new Error(`Load distribution issue: total load ${totalLoad} < successful transactions ${successCount}`);
      }
    });
  }

  // Test system statistics /测试系统统计
  async testSystemStatistics(): Promise<void> {
    await this.runTest('System Statistics', async () => {
      const stats = this.shardManager.getStatistics();
      
      const requiredFields = ['totalShards', 'activeShards', 'averageLoad', 'totalTransactions', 'systemHealth'];
      for (const field of requiredFields) {
        if (!(field in stats)) {
          throw new Error(`Missing statistics field: ${field}`);
        }
      }

      if (stats.totalShards <= 0) {
        throw new Error(`Invalid total shards count: ${stats.totalShards}`);
      }

      if (stats.activeShards > stats.totalShards) {
        throw new Error(`Active shards (${stats.activeShards}) cannot exceed total shards (${stats.totalShards})`);
      }

      if (!['healthy', 'degraded'].includes(stats.systemHealth)) {
        throw new Error(`Invalid system health status: ${stats.systemHealth}`);
      }
    });
  }

  // Test event system /测试事件系统
  async testEventSystem(): Promise<void> {
    await this.runTest('Event System', async () => {
      let eventReceived = false;
      let eventData: any = null;

      // Subscribe to shard creation events /订阅分片创建事件
      this.shardManager.on('shard_created', (shard) => {
        eventReceived = true;
        eventData = shard;
      });

      // Create a new shard to trigger event /创建新分片触发事件
      const testShard = await this.shardManager.createShard('event-test-shard', 'event-test-node');

      // Wait a bit for event to be processed /等待事件处理
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!eventReceived) {
        throw new Error('Shard creation event was not received');
      }

      if (!eventData || eventData.id !== 'event-test-shard') {
        throw new Error('Event data is incorrect');
      }

      // Clean up /清理
      await this.shardManager.removeShard('event-test-shard');
    });
  }

  // Run all tests /运行所有测试
  async runAllTests(): Promise<void> {
    console.log('\n🚀 Starting Smart Sharding System Tests...\n');

    await this.testShardManagerInitialization();
    await this.testShardManagement();
    await this.testTransactionProcessing();
    await this.testCrossShardTransaction();
    await this.testLoadBalancing();
    await this.testSystemStatistics();
    await this.testEventSystem();

    // Cleanup /清理
    await this.shardManager.shutdown();

    this.printSummary();
  }

  // Print test summary /打印测试摘要
  private printSummary(): void {
    console.log('\n📊 Smart Sharding Test Summary:');
    console.log('=' .repeat(50));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warned = this.results.filter(r => r.status === 'WARN').length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`\x1b[32mPassed: ${passed}\x1b[0m`);
    console.log(`\x1b[31mFailed: ${failed}\x1b[0m`);
    console.log(`\x1b[33mWarnings: ${warned}\x1b[0m`);

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`Total Duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.name}: ${r.message}`));
    }

    const successRate = ((passed / total) * 100).toFixed(1);
    console.log(`\nSuccess Rate: ${successRate}%`);
    
    if (failed === 0) {
      console.log('\n✅ All Smart Sharding tests passed successfully!');
    } else {
      console.log('\n⚠️  Some Smart Sharding tests failed. Please check the implementation.');
    }
  }
}

// Main execution /主执行函数
async function main(): Promise<void> {
  const tester = new SmartShardingTester();
  await tester.runAllTests();
}

// Run tests if this file is executed directly /如果直接执行此文件则运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SmartShardingTester };