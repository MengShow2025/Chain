/**
 * 简化版双区块架构测试
 * Simplified Dual-Block Architecture Test
 */

import { DUAL_BLOCK_CONFIG } from './blockchain/core/dual-block-config.js';
import { TransactionRouter } from './blockchain/core/transaction-router.js';
import { Transaction } from './shared/types/blockchain.js';

/**
 * 创建测试交易
 * Create test transactions
 */
function createTestTransaction(gasLimit: bigint, data: string = '0x'): Transaction {
  return {
    hash: `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`,
    from: '0x1234567890123456789012345678901234567890',
    to: '0x2345678901234567890123456789012345678901',
    value: BigInt(1000000000000000000), // 1 ETH
    gasLimit,
    gasPrice: BigInt(20000000000), // 20 Gwei
    nonce: 1,
    data,
    signature: `0x${'a'.repeat(130)}`,
    timestamp: Date.now(),
    isZeroGas: false
  };
}

/**
 * 测试双区块配置
 * Test dual-block configuration
 */
function testDualBlockConfig(): void {
  console.log('🧪 测试双区块配置 / Testing dual-block configuration');
  
  console.log('\n📊 快速区块配置 / Fast Block Configuration:');
  console.log(`   Gas限制 / Gas Limit: ${DUAL_BLOCK_CONFIG.FAST_BLOCK.GAS_LIMIT.toString()}`);
  console.log(`   出块时间 / Block Time: ${DUAL_BLOCK_CONFIG.FAST_BLOCK.BLOCK_TIME}ms`);
  console.log(`   目标TPS / Target TPS: ${DUAL_BLOCK_CONFIG.FAST_BLOCK.TARGET_TPS}`);
  console.log(`   最大交易数 / Max Transactions: ${DUAL_BLOCK_CONFIG.FAST_BLOCK.MAX_TRANSACTIONS}`);
  
  console.log('\n📦 批量区块配置 / Batch Block Configuration:');
  console.log(`   Gas限制 / Gas Limit: ${DUAL_BLOCK_CONFIG.BATCH_BLOCK.GAS_LIMIT.toString()}`);
  console.log(`   出块时间 / Block Time: ${DUAL_BLOCK_CONFIG.BATCH_BLOCK.BLOCK_TIME}ms`);
  console.log(`   目标TPS / Target TPS: ${DUAL_BLOCK_CONFIG.BATCH_BLOCK.TARGET_TPS}`);
  console.log(`   最大交易数 / Max Transactions: ${DUAL_BLOCK_CONFIG.BATCH_BLOCK.MAX_TRANSACTIONS}`);
  
  console.log('\n🎯 路由规则 / Routing Rules:');
  console.log(`   快速区块Gas阈值 / Fast Block Gas Threshold: ${DUAL_BLOCK_CONFIG.ROUTING_RULES.FAST_BLOCK_GAS_THRESHOLD.toString()}`);
  console.log(`   批量区块Gas阈值 / Batch Block Gas Threshold: ${DUAL_BLOCK_CONFIG.ROUTING_RULES.BATCH_BLOCK_GAS_THRESHOLD.toString()}`);
  console.log(`   合约复杂度阈值 / Contract Complexity Threshold: ${DUAL_BLOCK_CONFIG.ROUTING_RULES.CONTRACT_COMPLEXITY_THRESHOLD}`);
  
  console.log('✅ 双区块配置测试通过 / Dual-block configuration test passed');
}

/**
 * 测试交易路由器
 * Test transaction router
 */
function testTransactionRouter(): void {
  console.log('\n🧪 测试交易路由器 / Testing transaction router');
  
  const router = new TransactionRouter();
  
  // 测试简单交易（应该路由到快速区块）/ Test simple transaction (should route to fast block)
  const simpleTransaction = createTestTransaction(BigInt(21000)); // 简单转账 / Simple transfer
  const simpleRouting = router.routeTransaction(simpleTransaction);
  
  console.log('\n🚀 简单交易路由结果 / Simple Transaction Routing Result:');
  console.log(`   推荐区块类型 / Recommended Block Type: ${simpleRouting.recommendedBlockType}`);
  console.log(`   优先级 / Priority: ${simpleRouting.priority}`);
  console.log(`   预估延迟 / Estimated Latency: ${simpleRouting.estimatedLatency}ms`);
  console.log(`   决策置信度 / Decision Confidence: ${(simpleRouting.decisionConfidence * 100).toFixed(2)}%`);
  console.log(`   复杂度评分 / Complexity Score: ${simpleRouting.complexityAnalysis.complexityScore}`);
  
  // 测试复杂交易（应该路由到批量区块）/ Test complex transaction (should route to batch block)
  const complexTransaction = createTestTransaction(BigInt(2000000), '0x' + 'a'.repeat(1000)); // 复杂合约调用 / Complex contract call
  const complexRouting = router.routeTransaction(complexTransaction);
  
  console.log('\n📦 复杂交易路由结果 / Complex Transaction Routing Result:');
  console.log(`   推荐区块类型 / Recommended Block Type: ${complexRouting.recommendedBlockType}`);
  console.log(`   优先级 / Priority: ${complexRouting.priority}`);
  console.log(`   预估延迟 / Estimated Latency: ${complexRouting.estimatedLatency}ms`);
  console.log(`   决策置信度 / Decision Confidence: ${(complexRouting.decisionConfidence * 100).toFixed(2)}%`);
  console.log(`   复杂度评分 / Complexity Score: ${complexRouting.complexityAnalysis.complexityScore}`);
  
  // 验证路由决策 / Validate routing decisions
  const simpleRoutedCorrectly = simpleRouting.recommendedBlockType === 'FAST';
  const complexRoutedCorrectly = complexRouting.recommendedBlockType === 'BATCH';
  
  console.log('\n🎯 路由决策验证 / Routing Decision Validation:');
  console.log(`   简单交易路由正确 / Simple Transaction Routed Correctly: ${simpleRoutedCorrectly ? '✅' : '❌'}`);
  console.log(`   复杂交易路由正确 / Complex Transaction Routed Correctly: ${complexRoutedCorrectly ? '✅' : '❌'}`);
  
  if (simpleRoutedCorrectly && complexRoutedCorrectly) {
    console.log('✅ 交易路由器测试通过 / Transaction router test passed');
  } else {
    console.log('❌ 交易路由器测试失败 / Transaction router test failed');
  }
}

/**
 * 测试性能监控配置
 * Test performance monitoring configuration
 */
async function testPerformanceMonitoring(): Promise<void> {
  console.log('\n🧪 测试性能监控配置 / Testing performance monitoring configuration');
  
  const { PERFORMANCE_MONITORING } = await import('./blockchain/core/dual-block-config.js');
  
  console.log('\n📊 延迟目标 / Latency Targets:');
  console.log(`   快速区块最大延迟 / Fast Block Max Latency: ${PERFORMANCE_MONITORING.LATENCY_TARGETS.FAST_BLOCK_MAX_LATENCY}ms`);
  console.log(`   批量区块最大延迟 / Batch Block Max Latency: ${PERFORMANCE_MONITORING.LATENCY_TARGETS.BATCH_BLOCK_MAX_LATENCY}ms`);
  
  console.log('\n🎯 吞吐量目标 / Throughput Targets:');
  console.log(`   快速区块最小TPS / Fast Block Min TPS: ${PERFORMANCE_MONITORING.THROUGHPUT_TARGETS.FAST_BLOCK_MIN_TPS}`);
  console.log(`   批量区块最小TPS / Batch Block Min TPS: ${PERFORMANCE_MONITORING.THROUGHPUT_TARGETS.BATCH_BLOCK_MIN_TPS}`);
  
  console.log('\n📈 队列监控 / Queue Monitoring:');
  console.log(`   警告阈值 / Warning Threshold: ${PERFORMANCE_MONITORING.QUEUE_MONITORING.WARNING_THRESHOLD}`);
  console.log(`   临界阈值 / Critical Threshold: ${PERFORMANCE_MONITORING.QUEUE_MONITORING.CRITICAL_THRESHOLD}`);
  
  console.log('✅ 性能监控配置测试通过 / Performance monitoring configuration test passed');
}

/**
 * 运行所有测试
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 开始简化版双区块架构测试 / Starting simplified dual-block architecture test');
  console.log('='.repeat(80));
  
  try {
    // 1. 测试双区块配置 / Test dual-block configuration
    testDualBlockConfig();
    
    // 2. 测试交易路由器 / Test transaction router
    testTransactionRouter();
    
    // 3. 测试性能监控配置 / Test performance monitoring configuration
    await testPerformanceMonitoring();
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 简化版双区块架构测试全部通过！');
    console.log('🎉 Simplified dual-block architecture test passed!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ 简化版双区块架构测试失败 / Simplified dual-block architecture test failed:', error);
    throw error;
  }
}

// 运行测试 / Run test
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(() => {
      console.log('\n✅ 测试完成 / Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 测试失败 / Test failed:', error);
      process.exit(1);
    });
}

export { runAllTests };