#!/usr/bin/env node
// P2P Network Test Script / P2P网络测试脚本
import { TitanChain } from './blockchain/core/blockchain.js';
import { P2PNode } from './network/p2p-node.js';
import { Transaction } from './shared/types/blockchain.js';
import { Block } from './shared/types/blockchain.js';

async function testP2PNetwork() {
  console.log('🧪 Starting P2P Network Test / 开始P2P网络测试');
  
  let node1: P2PNode | null = null;
  let node2: P2PNode | null = null;
  let blockchain1: TitanChain | null = null;
  let blockchain2: TitanChain | null = null;

  try {
    // Create two blockchain instances / 创建两个区块链实例
    console.log('\n📦 Creating blockchain instances / 创建区块链实例...');
    blockchain1 = new TitanChain();
    blockchain2 = new TitanChain();
    
    // Initialize blockchains / 初始化区块链
    await blockchain1.initialize();
    await blockchain2.initialize();
    console.log('✅ Blockchain instances created / 区块链实例创建完成');

    // Create P2P nodes with different ports / 创建不同端口的P2P节点
    console.log('\n🕸️ Creating P2P nodes / 创建P2P节点...');
    node1 = new P2PNode(blockchain1, { port: 4003, host: '127.0.0.1' });
    node2 = new P2PNode(blockchain2, { 
      port: 4004, 
      host: '127.0.0.1',
      bootnodes: ['http://127.0.0.1:4003'] // Node2 connects to Node1 / Node2连接到Node1
    });

    // Start nodes / 启动节点
    console.log('\n🚀 Starting P2P nodes / 启动P2P节点...');
    await node1.start();
    console.log('✅ Node 1 started on port 4003 / 节点1在端口4003启动');
    
    // Wait a bit before starting node2 / 等待一下再启动节点2
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await node2.start();
    console.log('✅ Node 2 started on port 4004 / 节点2在端口4004启动');

    // Wait for connection establishment / 等待连接建立
    console.log('\n⏳ Waiting for peer connection / 等待节点连接...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check peer connections / 检查节点连接
    console.log('\n🔍 Checking peer connections / 检查节点连接:');
    const peers1 = node1.getPeers();
    const peers2 = node2.getPeers();
    
    console.log(`Node 1 peers: ${peers1.length} / 节点1的对等节点: ${peers1.length}`);
    console.log(`Node 2 peers: ${peers2.length} / 节点2的对等节点: ${peers2.length}`);
    
    if (peers1.length > 0 || peers2.length > 0) {
      console.log('✅ Peer connection established / 节点连接已建立');
    } else {
      console.log('⚠️ No peer connections found / 未发现节点连接');
    }

    // Test transaction broadcasting / 测试交易广播
    console.log('\n📡 Testing transaction broadcast / 测试交易广播...');
    const testTx: Transaction = {
      hash: `test-tx-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
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
      status: 'pending',
      isZeroGas: false,
      contractTierFeeLevel: 0
    };
    
    // Add transaction to node1's blockchain / 将交易添加到节点1的区块链
    blockchain1.addTransaction(testTx);
    
    // Broadcast transaction / 广播交易
    node1.broadcastTransaction(testTx);
    console.log('✅ Transaction broadcasted / 交易已广播');

    // Wait for propagation / 等待传播
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test block creation and broadcasting / 测试区块创建和广播
    console.log('\n⛏️ Testing block mining and broadcast / 测试区块挖矿和广播...');
    
    // Mine a block on node1 / 在节点1上挖矿
    const newBlock = await blockchain1.mineBlock('test-miner');
    if (newBlock) {
      console.log(`✅ Block mined: ${newBlock.hash} / 区块已挖出: ${newBlock.hash}`);
      
      // Broadcast the block / 广播区块
      node1.broadcastBlock(newBlock);
      console.log('✅ Block broadcasted / 区块已广播');
      
      // Wait for propagation / 等待传播
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if block was received by node2 / 检查节点2是否收到区块
      const chain1Length = blockchain1.getChain().length;
      const chain2Length = blockchain2.getChain().length;
      
      console.log(`\n📊 Blockchain sync status / 区块链同步状态:`);
      console.log(`Node 1 chain length: ${chain1Length} / 节点1链长度: ${chain1Length}`);
      console.log(`Node 2 chain length: ${chain2Length} / 节点2链长度: ${chain2Length}`);
      
      if (chain1Length === chain2Length) {
        console.log('✅ Blockchains are synchronized / 区块链已同步');
      } else {
        console.log('⚠️ Blockchains are not synchronized / 区块链未同步');
      }
    }

    // Performance test / 性能测试
    console.log('\n⚡ Running performance test / 运行性能测试...');
    const startTime = Date.now();
    
    // Send multiple transactions / 发送多个交易
    for (let i = 0; i < 10; i++) {
      const tx: Transaction = {
        hash: `perf-tx-${i}-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
        from: `sender-${i}`,
        to: `receiver-${i}`,
        value: Math.floor(Math.random() * 1000),
        gas: 21000,
        gasPrice: 20,
        nonce: i + 2,
        data: '0x',
        timestamp: Date.now(),
        blockNumber: 0,
        blockHash: '',
        transactionIndex: 0,
        status: 'pending',
        isZeroGas: false,
        contractTierFeeLevel: 0
      };
      blockchain1.addTransaction(tx);
      node1.broadcastTransaction(tx);
    }
    
    const endTime = Date.now();
    console.log(`✅ Performance test completed in ${endTime - startTime}ms / 性能测试完成，耗时 ${endTime - startTime}ms`);

    console.log('\n🎉 P2P Network Test Completed Successfully / P2P网络测试成功完成!');
    
  } catch (error) {
    console.error('❌ P2P Network Test Failed / P2P网络测试失败:', error);
    throw error;
  } finally {
    // Cleanup / 清理
    console.log('\n🧹 Cleaning up / 清理资源...');
    
    if (node1) {
      await node1.stop();
      console.log('✅ Node 1 stopped / 节点1已停止');
    }
    
    if (node2) {
      await node2.stop();
      console.log('✅ Node 2 stopped / 节点2已停止');
    }
    
    console.log('✅ Cleanup completed / 清理完成');
  }
}

// Run the test / 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testP2PNetwork()
    .then(() => {
      console.log('\n✅ All P2P tests passed / 所有P2P测试通过');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ P2P test failed / P2P测试失败:', error);
      process.exit(1);
    });
}

export { testP2PNetwork };