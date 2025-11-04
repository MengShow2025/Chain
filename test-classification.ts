/**
 * 交易分类测试
 * Transaction Classification Test
 */

import { PerformanceTierClassifier, PerformanceTier } from './blockchain/core/performance-tiers.js';

// 创建测试交易 / Create test transactions
function createTestTransaction(hash: string, gasLimit: bigint, data: string = '0x'): any {
  return {
    hash,
    from: '0x1234567890123456789012345678901234567890',
    to: '0x0987654321098765432109876543210987654321',
    gasLimit,
    gasPrice: BigInt('20000000000'),
    data,
    value: BigInt('1000000000000000000'),
    nonce: 1
  };
}

console.log('🧪 开始交易分类测试 / Starting transaction classification test');
console.log('='.repeat(80));

// 测试1: Tier 1 交易 / Test 1: Tier 1 transactions
console.log('\n📋 测试1: Tier 1 交易分类 / Test 1: Tier 1 transaction classification');

const tier1Tx1 = createTestTransaction('tier1-simple', BigInt('21000'), '0x');
const tier1Classification1 = PerformanceTierClassifier.classifyTransaction(tier1Tx1);
console.log(`简单转账 (21000 gas, 无数据): ${tier1Classification1} / Simple transfer (21000 gas, no data): ${tier1Classification1}`);

const tier1Tx2 = createTestTransaction('tier1-token', BigInt('50000'), '0xa9059cbb' + '0'.repeat(56));
const tier1Classification2 = PerformanceTierClassifier.classifyTransaction(tier1Tx2);
console.log(`代币转账 (50000 gas, token transfer): ${tier1Classification2} / Token transfer (50000 gas, token transfer): ${tier1Classification2}`);

// 测试2: Tier 2 交易 / Test 2: Tier 2 transactions
console.log('\n📋 测试2: Tier 2 交易分类 / Test 2: Tier 2 transaction classification');

const tier2Tx1 = createTestTransaction('tier2-defi', BigInt('200000'), '0x095ea7b3' + '0'.repeat(56));
const tier2Classification1 = PerformanceTierClassifier.classifyTransaction(tier2Tx1);
console.log(`DeFi操作 (200000 gas, approve): ${tier2Classification1} / DeFi operation (200000 gas, approve): ${tier2Classification1}`);

const tier2Tx2 = createTestTransaction('tier2-swap', BigInt('300000'), '0x38ed1739' + '0'.repeat(56));
const tier2Classification2 = PerformanceTierClassifier.classifyTransaction(tier2Tx2);
console.log(`基础交换 (300000 gas, swap): ${tier2Classification2} / Basic swap (300000 gas, swap): ${tier2Classification2}`);

// 测试3: Tier 3 交易 / Test 3: Tier 3 transactions
console.log('\n📋 测试3: Tier 3 交易分类 / Test 3: Tier 3 transaction classification');

const tier3Tx1 = createTestTransaction('tier3-complex', BigInt('500000'), '0x12345678' + 'a'.repeat(200));
const tier3Classification1 = PerformanceTierClassifier.classifyTransaction(tier3Tx1);
console.log(`复杂合约 (500000 gas, 复杂数据): ${tier3Classification1} / Complex contract (500000 gas, complex data): ${tier3Classification1}`);

const tier3Tx2 = createTestTransaction('tier3-deployment', BigInt('2000000'), '0x608060405234801561001057600080fd5b50');
const tier3Tx2Modified = { ...tier3Tx2, to: null }; // 合约部署 / Contract deployment
const tier3Classification2 = PerformanceTierClassifier.classifyTransaction(tier3Tx2Modified);
console.log(`合约部署 (2000000 gas, 部署数据): ${tier3Classification2} / Contract deployment (2000000 gas, deployment data): ${tier3Classification2}`);

// 测试4: 边界情况 / Test 4: Edge cases
console.log('\n📋 测试4: 边界情况测试 / Test 4: Edge case testing');

const edgeTx1 = createTestTransaction('edge-gas-limit', BigInt('100000'), '0x');
const edgeClassification1 = PerformanceTierClassifier.classifyTransaction(edgeTx1);
console.log(`边界Gas (100000): ${edgeClassification1} / Edge gas (100000): ${edgeClassification1}`);

const edgeTx2 = createTestTransaction('edge-gas-limit2', BigInt('500000'), '0x');
const edgeClassification2 = PerformanceTierClassifier.classifyTransaction(edgeTx2);
console.log(`边界Gas (500000): ${edgeClassification2} / Edge gas (500000): ${edgeClassification2}`);

console.log('\n🎉 交易分类测试完成! / Transaction classification test completed!');
console.log('='.repeat(80));