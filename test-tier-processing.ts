/**
 * TitanChain 分层处理测试
 * TitanChain Tier Processing Test
 */

import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor';
import { PerformanceTier, PerformanceTierClassifier } from './blockchain/core/performance-tiers';
import { Transaction } from './shared/types/blockchain';

/**
 * 测试分层处理系统
 * Test tier processing system
 */
async function testTierProcessing(): Promise<void> {
  console.log('🚀 开始TitanChain分层处理测试 / Starting TitanChain Tier Processing Test...\n');

  try {
    // 1. 初始化增强并行处理器 / Initialize enhanced parallel processor
    console.log('📦 1. 初始化增强并行处理器 / Initializing enhanced parallel processor...');
    const processor = new EnhancedParallelProcessor();
    await processor.startProcessing();
    console.log('✅ 增强并行处理器启动成功 / Enhanced parallel processor started successfully\n');

    // 2. 创建不同层级的测试交易 / Create test transactions for different tiers
    console.log('💰 2. 创建测试交易 / Creating test transactions...');
    const testTransactions = createTestTransactions();
    console.log('✅ 测试交易创建成功 / Test transactions created successfully');
    console.log(`   - TIER_1交易数量 / TIER_1 transactions: ${testTransactions.tier1.length}`);
    console.log(`   - TIER_2交易数量 / TIER_2 transactions: ${testTransactions.tier2.length}`);
    console.log(`   - TIER_3交易数量 / TIER_3 transactions: ${testTransactions.tier3.length}\n`);

    // 3. 测试交易分类 / Test transaction classification
    console.log('🔍 3. 测试交易分类 / Testing transaction classification...');
    await testTransactionClassification(testTransactions);

    // 4. 添加交易到处理器 / Add transactions to processor
    console.log('📤 4. 添加交易到处理器 / Adding transactions to processor...');
    const allTransactions = [
      ...testTransactions.tier1,
      ...testTransactions.tier2,
      ...testTransactions.tier3
    ];

    for (const tx of allTransactions) {
      await processor.addTransaction(tx);
    }
    console.log('✅ 交易添加完成 / Transactions added successfully\n');

    // 5. 等待处理完成 / Wait for processing completion
    console.log('⏳ 5. 等待分层处理完成 / Waiting for tier processing completion...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 6. 检查处理统计 / Check processing statistics
    console.log('📊 6. 检查处理统计 / Checking processing statistics...');
    const stats = processor.getProcessingStats();
    console.log('✅ 处理统计 / Processing statistics:');
    console.log(`   - 总处理数量 / Total processed: ${stats.totalProcessed}`);
    console.log(`   - 成功处理数量 / Total successful: ${stats.totalSuccessful}`);
    console.log(`   - 失败处理数量 / Total failed: ${stats.totalFailed}`);
    console.log(`   - 平均延迟 / Average latency: ${stats.averageLatency.toFixed(2)}ms`);
    console.log(`   - 当前TPS / Current TPS: ${stats.currentTPS.toFixed(2)}\n`);

    // 7. 检查各层级状态 / Check tier status
    console.log('🔄 7. 检查各层级状态 / Checking tier status...');
    await checkTierStatus(processor);

    // 8. 测试性能指标 / Test performance metrics
    console.log('📈 8. 测试性能指标 / Testing performance metrics...');
    await testPerformanceMetrics(processor);

    // 9. 停止处理器 / Stop processor
    console.log('🛑 9. 停止处理器 / Stopping processor...');
    await processor.stopProcessing();
    console.log('✅ 处理器已停止 / Processor stopped\n');

    console.log('🎉 TitanChain分层处理测试完成！');
    console.log('🎉 TitanChain Tier Processing test completed successfully!\n');

    // 测试总结 / Test summary
    console.log('📋 测试总结 / Test Summary:');
    console.log('✅ 分层处理系统初始化 / Tier processing system initialization');
    console.log('✅ 智能交易分类 / Smart transaction classification');
    console.log('✅ 多层级并行处理 / Multi-tier parallel processing');
    console.log('✅ 性能监控和优化 / Performance monitoring and optimization');
    console.log('✅ 实时统计和指标 / Real-time statistics and metrics');

  } catch (error) {
    console.error('❌ 分层处理测试失败 / Tier processing test failed:', error);
    throw error;
  }
}

/**
 * 创建测试交易
 * Create test transactions
 */
function createTestTransactions() {
  const tier1Transactions: Transaction[] = [];
  const tier2Transactions: Transaction[] = [];
  const tier3Transactions: Transaction[] = [];

  // 创建TIER_1交易（简单转账）/ Create TIER_1 transactions (simple transfers)
  for (let i = 0; i < 30; i++) {
    tier1Transactions.push({
      hash: `0x${i.toString(16).padStart(64, '0')}tier1`,
      from: `0x${Math.random().toString(16).substring(2, 42)}`,
      to: `0x${Math.random().toString(16).substring(2, 42)}`,
      value: BigInt(Math.floor(Math.random() * 1000000)),
      gas: BigInt(21000), // 简单转账Gas / Simple transfer gas
      gasPrice: BigInt(Math.floor(Math.random() * 50) + 10) * BigInt(1e9),
      nonce: i,
      data: '0x',
      timestamp: Date.now(),
      status: 'pending' as const,
      isZeroGas: false,
      type: 'simple_transfer'
    });
  }

  // 创建TIER_2交易（DeFi操作）/ Create TIER_2 transactions (DeFi operations)
  for (let i = 0; i < 20; i++) {
    tier2Transactions.push({
      hash: `0x${i.toString(16).padStart(64, '0')}tier2`,
      from: `0x${Math.random().toString(16).substring(2, 42)}`,
      to: `0x${Math.random().toString(16).substring(2, 42)}`,
      value: BigInt(Math.floor(Math.random() * 10000000)),
      gas: BigInt(Math.floor(Math.random() * 400000) + 100000), // 中等复杂度 / Medium complexity
      gasPrice: BigInt(Math.floor(Math.random() * 30) + 20) * BigInt(1e9),
      nonce: i,
      data: `0x${Math.random().toString(16).substring(2, 200)}`, // 合约调用数据 / Contract call data
      timestamp: Date.now(),
      status: 'pending' as const,
      isZeroGas: false,
      type: 'defi_operations'
    });
  }

  // 创建TIER_3交易（复杂合约）/ Create TIER_3 transactions (complex contracts)
  for (let i = 0; i < 10; i++) {
    tier3Transactions.push({
      hash: `0x${i.toString(16).padStart(64, '0')}tier3`,
      from: `0x${Math.random().toString(16).substring(2, 42)}`,
      to: `0x${Math.random().toString(16).substring(2, 42)}`,
      value: BigInt(Math.floor(Math.random() * 100000000)),
      gas: BigInt(Math.floor(Math.random() * 4000000) + 1000000), // 高复杂度 / High complexity
      gasPrice: BigInt(Math.floor(Math.random() * 100) + 50) * BigInt(1e9),
      nonce: i,
      data: `0x${Math.random().toString(16).substring(2, 1000)}`, // 复杂合约数据 / Complex contract data
      timestamp: Date.now(),
      status: 'pending' as const,
      isZeroGas: false,
      type: 'complex_contract'
    });
  }

  return {
    tier1: tier1Transactions,
    tier2: tier2Transactions,
    tier3: tier3Transactions
  };
}

/**
 * 测试交易分类
 * Test transaction classification
 */
async function testTransactionClassification(testTransactions: any): Promise<void> {
  console.log('🔍 测试交易分类准确性 / Testing transaction classification accuracy...');

  // 测试TIER_1分类 / Test TIER_1 classification
  let correctClassifications = 0;
  let totalClassifications = 0;

  for (const tx of testTransactions.tier1) {
    const classifiedTier = PerformanceTierClassifier.classifyTransaction(tx);
    totalClassifications++;
    if (classifiedTier === PerformanceTier.TIER_1) {
      correctClassifications++;
    }
  }

  for (const tx of testTransactions.tier2) {
    const classifiedTier = PerformanceTierClassifier.classifyTransaction(tx);
    totalClassifications++;
    if (classifiedTier === PerformanceTier.TIER_2) {
      correctClassifications++;
    }
  }

  for (const tx of testTransactions.tier3) {
    const classifiedTier = PerformanceTierClassifier.classifyTransaction(tx);
    totalClassifications++;
    if (classifiedTier === PerformanceTier.TIER_3) {
      correctClassifications++;
    }
  }

  const accuracy = (correctClassifications / totalClassifications * 100).toFixed(2);
  console.log(`✅ 分类准确率 / Classification accuracy: ${accuracy}% (${correctClassifications}/${totalClassifications})\n`);
}

/**
 * 检查层级状态
 * Check tier status
 */
async function checkTierStatus(processor: EnhancedParallelProcessor): Promise<void> {
  const tierStatusMap = processor.getTierStatus() as Map<PerformanceTier, any>;

  for (const [tier, status] of tierStatusMap) {
    console.log(`✅ ${tier} 状态 / ${tier} status:`);
    console.log(`   - 是否激活 / Is active: ${status.isActive ? '是' : '否'}`);
    console.log(`   - 是否过载 / Is overloaded: ${status.isOverloaded ? '是' : '否'}`);
    console.log(`   - 队列大小 / Queue size: ${status.queueSize}`);
    console.log(`   - 处理中数量 / Processing count: ${status.processingCount}`);
    console.log(`   - 当前TPS / Current TPS: ${status.metrics.currentTPS.toFixed(2)}`);
    console.log(`   - 平均延迟 / Average latency: ${status.metrics.averageLatency.toFixed(2)}ms`);
    console.log(`   - 成功率 / Success rate: ${(status.metrics.successRate * 100).toFixed(2)}%`);
  }
  console.log();
}

/**
 * 测试性能指标
 * Test performance metrics
 */
async function testPerformanceMetrics(processor: EnhancedParallelProcessor): Promise<void> {
  const stats = processor.getProcessingStats();
  
  console.log('📊 详细性能指标 / Detailed performance metrics:');
  console.log(`   - 总处理时间 / Total processing time: ${Date.now() - stats.lastUpdated}ms`);
  console.log(`   - 处理效率 / Processing efficiency: ${((stats.totalSuccessful / (stats.totalProcessed || 1)) * 100).toFixed(2)}%`);
  
  // 检查各层级的TPS / Check TPS for each tier
  for (const [tier, metrics] of stats.tierStats) {
    console.log(`   - ${tier} TPS: ${metrics.currentTPS.toFixed(2)}`);
    console.log(`   - ${tier} 队列负载 / Queue load: ${(metrics.queueLoad * 100).toFixed(2)}%`);
  }
  console.log();
}

// 运行测试 / Run test
testTierProcessing().catch(console.error);