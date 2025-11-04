#!/usr/bin/env node
// Quick System Check / 快速系统检查
console.log('🔍 TitanChain Quick System Check / TitanChain快速系统检查');
console.log('='.repeat(50));

async function quickCheck() {
  let checks = 0;
  let passed = 0;

  // 1. 检查核心模块
  console.log('\n📦 Checking Core Modules / 检查核心模块...');
  checks++;
  try {
    await import('./blockchain/core/blockchain.js');
    console.log('✅ Blockchain module OK / 区块链模块正常');
    passed++;
  } catch (error) {
    console.log('❌ Blockchain module failed / 区块链模块失败');
  }

  // 2. 检查P2P模块
  checks++;
  try {
    await import('./network/p2p-node.js');
    console.log('✅ P2P module OK / P2P模块正常');
    passed++;
  } catch (error) {
    console.log('❌ P2P module failed / P2P模块失败');
  }

  // 3. 检查类型定义
  checks++;
  try {
    await import('./shared/types/blockchain.js');
    console.log('✅ Type definitions OK / 类型定义正常');
    passed++;
  } catch (error) {
    console.log('❌ Type definitions failed / 类型定义失败');
  }

  // 4. 检查API模块
  checks++;
  try {
    await import('./api/api-server.js');
    console.log('✅ API module OK / API模块正常');
    passed++;
  } catch (error) {
    console.log('❌ API module failed / API模块失败');
  }

  console.log(`\n📊 Results / 结果: ${passed}/${checks} modules OK`);
  
  if (passed === checks) {
    console.log('🟢 All modules loaded successfully / 所有模块加载成功');
  } else {
    console.log('🟡 Some modules have issues / 部分模块存在问题');
  }

  return { passed, checks };
}

quickCheck().catch(console.error);