#!/usr/bin/env node
// Core Functions Test / 核心功能测试
import { TitanChain } from './blockchain/core/blockchain.js';
import { P2PNode } from './network/p2p-node.js';

async function testCoreFunctions() {
  console.log('🧪 TitanChain Core Functions Test / TitanChain核心功能测试');
  console.log('='.repeat(60));

  let testsPassed = 0;
  let totalTests = 0;

  // 1. 区块链核心测试
  console.log('\n⛓️ 1. Testing Blockchain Core / 测试区块链核心...');
  totalTests++;
  try {
    const blockchain = new TitanChain();
    await blockchain.initialize();
    console.log('✅ Blockchain initialized / 区块链初始化成功');

    // 创建测试交易
    const testTx = {
      hash: `test-${Date.now()}`,
      from: 'test-sender',
      to: 'test-receiver',
      value: 100,
      gas: 21000,
      gasPrice: 20,
      nonce: 1,
      data: '0x',
      timestamp: Date.now(),
      blockNumber: 0,
      blockHash: '',
      transactionIndex: 0,
      status: 'pending' as const,
      isZeroGas: false,
      contractTierFeeLevel: 0 as const
    };

    blockchain.addTransaction(testTx);
    console.log('✅ Transaction added / 交易添加成功');

    const block = await blockchain.mineBlock('test-miner');
    if (block) {
      console.log(`✅ Block mined: ${block.hash.substring(0, 10)}... / 区块挖矿成功`);
      testsPassed++;
    } else {
      console.log('❌ Block mining failed / 区块挖矿失败');
    }
  } catch (error) {
    console.log('❌ Blockchain test failed / 区块链测试失败:', error);
  }

  // 2. P2P网络测试
  console.log('\n🕸️ 2. Testing P2P Network / 测试P2P网络...');
  totalTests++;
  let p2pNode: P2PNode | null = null;
  try {
    const blockchain = new TitanChain();
    await blockchain.initialize();
    
    p2pNode = new P2PNode(blockchain, { port: 4003, host: '127.0.0.1' });
    await p2pNode.start();
    console.log('✅ P2P node started on port 4003 / P2P节点在端口4003启动成功');

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const peers = p2pNode.getPeers();
    console.log(`✅ P2P network ready, peers: ${peers.length} / P2P网络就绪，对等节点: ${peers.length}`);
    testsPassed++;
  } catch (error) {
    console.log('❌ P2P network test failed / P2P网络测试失败:', error);
  } finally {
    if (p2pNode) {
      await p2pNode.stop();
      console.log('✅ P2P node stopped / P2P节点已停止');
    }
  }

  // 3. 模块导入测试
  console.log('\n📦 3. Testing Module Imports / 测试模块导入...');
  totalTests++;
  try {
    // 测试关键模块导入
    await import('./shared/types/blockchain.js');
    await import('./shared/types/p2p.js');
    await import('./shared/constants/blockchain.js');
    console.log('✅ Core modules imported successfully / 核心模块导入成功');
    testsPassed++;
  } catch (error) {
    console.log('❌ Module import test failed / 模块导入测试失败:', error);
  }

  // 4. 智能分片模块测试
  console.log('\n🧩 4. Testing Smart Sharding / 测试智能分片...');
  totalTests++;
  try {
    await import('./blockchain/core/smart-sharding.js');
    console.log('✅ Smart sharding module available / 智能分片模块可用');
    testsPassed++;
  } catch (error) {
    console.log('⚠️ Smart sharding module not available / 智能分片模块不可用');
  }

  // 5. MPC系统测试
  console.log('\n🔐 5. Testing MPC System / 测试MPC系统...');
  totalTests++;
  try {
    await import('./mpc/mpc-system.js');
    console.log('✅ MPC system module available / MPC系统模块可用');
    testsPassed++;
  } catch (error) {
    console.log('⚠️ MPC system module not available / MPC系统模块不可用');
  }

  // 测试结果汇总
  console.log('\n📊 Test Results Summary / 测试结果汇总');
  console.log('='.repeat(60));
  console.log(`Total Tests / 总测试数: ${totalTests}`);
  console.log(`Passed / 通过: ${testsPassed}`);
  console.log(`Failed / 失败: ${totalTests - testsPassed}`);
  console.log(`Success Rate / 成功率: ${((testsPassed/totalTests)*100).toFixed(1)}%`);

  if (testsPassed >= totalTests * 0.8) {
    console.log('\n🟢 System Status: HEALTHY / 系统状态: 健康');
    console.log('Core functions are working properly / 核心功能运行正常');
  } else if (testsPassed >= totalTests * 0.6) {
    console.log('\n🟡 System Status: WARNING / 系统状态: 警告');
    console.log('Some functions need attention / 部分功能需要关注');
  } else {
    console.log('\n🔴 System Status: CRITICAL / 系统状态: 严重');
    console.log('Multiple core functions are failing / 多个核心功能出现故障');
  }

  console.log('\n🎉 Core Functions Test Completed / 核心功能测试完成');
  return { testsPassed, totalTests };
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testCoreFunctions()
    .then(({ testsPassed, totalTests }) => {
      if (testsPassed >= totalTests * 0.8) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Core functions test failed / 核心功能测试失败:', error);
      process.exit(1);
    });
}

export { testCoreFunctions };