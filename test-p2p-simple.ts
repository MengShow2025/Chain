#!/usr/bin/env node
// Simple P2P Connection Test / 简单P2P连接测试
import { TitanChain } from './blockchain/core/blockchain.js';
import { P2PNode } from './network/p2p-node.js';

async function testSimpleP2P() {
  console.log('🧪 Starting Simple P2P Connection Test / 开始简单P2P连接测试');
  
  let node1: P2PNode | null = null;
  let blockchain1: TitanChain | null = null;

  try {
    // Create blockchain instance / 创建区块链实例
    console.log('\n📦 Creating blockchain instance / 创建区块链实例...');
    blockchain1 = new TitanChain();
    await blockchain1.initialize();
    console.log('✅ Blockchain instance created / 区块链实例创建完成');

    // Create P2P node / 创建P2P节点
    console.log('\n🕸️ Creating P2P node / 创建P2P节点...');
    node1 = new P2PNode(blockchain1, { port: 4003, host: '127.0.0.1' });

    // Start node / 启动节点
    console.log('\n🚀 Starting P2P node / 启动P2P节点...');
    await node1.start();
    console.log('✅ P2P node started on port 4003 / P2P节点在端口4003启动成功');

    // Wait a bit / 等待一下
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check node status / 检查节点状态
    console.log('\n🔍 Checking node status / 检查节点状态:');
    const peers = node1.getPeers();
    console.log(`Connected peers: ${peers.length} / 连接的对等节点: ${peers.length}`);

    console.log('\n🎉 Simple P2P Test Completed Successfully / 简单P2P测试成功完成!');
    
  } catch (error) {
    console.error('❌ Simple P2P Test Failed / 简单P2P测试失败:', error);
    throw error;
  } finally {
    // Cleanup / 清理
    console.log('\n🧹 Cleaning up / 清理资源...');
    
    if (node1) {
      await node1.stop();
      console.log('✅ P2P node stopped / P2P节点已停止');
    }
    
    console.log('✅ Cleanup completed / 清理完成');
  }
}

// Run the test / 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testSimpleP2P()
    .then(() => {
      console.log('\n✅ Simple P2P test passed / 简单P2P测试通过');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Simple P2P test failed / 简单P2P测试失败:', error);
      process.exit(1);
    });
}

export { testSimpleP2P };