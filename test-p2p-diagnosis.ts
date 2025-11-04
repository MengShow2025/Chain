#!/usr/bin/env node
/**
 * P2P Network Diagnosis Test / P2P网络诊断测试
 * Simple diagnostic test to identify P2P connection issues
 * 简单的诊断测试以识别P2P连接问题
 */

import { P2PNode } from './network/p2p-node.js';
import { TitanChain } from './blockchain/core/blockchain.js';

// Simple diagnostic test / 简单诊断测试
class P2PDiagnosticTest {
  private nodes: P2PNode[] = [];
  private blockchains: TitanChain[] = [];

  async runDiagnostics(): Promise<void> {
    console.log('🔍 Starting P2P Network Diagnostics / 开始P2P网络诊断');
    
    try {
      // Test 1: Create single node / 测试1：创建单个节点
      console.log('\n📦 Test 1: Creating single node / 测试1：创建单个节点');
      await this.testSingleNodeCreation();

      // Test 2: Create two nodes / 测试2：创建两个节点
      console.log('\n📦 Test 2: Creating two nodes / 测试2：创建两个节点');
      await this.testTwoNodeCreation();

      // Test 3: Check node configuration / 测试3：检查节点配置
      console.log('\n⚙️ Test 3: Checking node configurations / 测试3：检查节点配置');
      await this.checkNodeConfigurations();

      console.log('\n✅ P2P Diagnostics completed / P2P诊断完成');

    } catch (error) {
      console.error('❌ P2P Diagnostics failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async testSingleNodeCreation(): Promise<void> {
    try {
      // Create blockchain / 创建区块链
      const blockchain = new TitanChain();
      await blockchain.initialize();
      this.blockchains.push(blockchain);
      console.log('✅ Blockchain created successfully');

      // Create P2P node / 创建P2P节点
      const nodeConfig = {
        port: 7000,
        host: '127.0.0.1',
        bootnodes: []
      };

      const node = new P2PNode(blockchain, nodeConfig);
      this.nodes.push(node);
      console.log('✅ P2P Node created successfully');

      // Start node / 启动节点
      await node.start();
      console.log('✅ P2P Node started successfully on port 7000');

      // Check node status / 检查节点状态
      const peers = node.getPeers();
      console.log(`📊 Node status: ${peers.length} peers connected`);

    } catch (error) {
      console.error('❌ Single node creation failed:', error);
      throw error;
    }
  }

  async testTwoNodeCreation(): Promise<void> {
    try {
      // Create second blockchain / 创建第二个区块链
      const blockchain2 = new TitanChain();
      await blockchain2.initialize();
      this.blockchains.push(blockchain2);
      console.log('✅ Second blockchain created');

      // Create second node with first node as bootstrap / 创建第二个节点，以第一个节点为引导
      const nodeConfig2 = {
        port: 7001,
        host: '127.0.0.1',
        bootnodes: ['http://127.0.0.1:7000']
      };

      const node2 = new P2PNode(blockchain2, nodeConfig2);
      this.nodes.push(node2);
      console.log('✅ Second P2P Node created');

      // Start second node / 启动第二个节点
      await node2.start();
      console.log('✅ Second P2P Node started on port 7001');

      // Wait for connection / 等待连接
      console.log('⏳ Waiting 5 seconds for nodes to connect...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check both nodes / 检查两个节点
      for (let i = 0; i < this.nodes.length; i++) {
        const peers = this.nodes[i].getPeers();
        console.log(`📊 Node ${i} (port ${7000 + i}): ${peers.length} peers connected`);
        if (peers.length > 0) {
          peers.forEach((peer, index) => {
            console.log(`   Peer ${index}: ${peer.id}`);
          });
        }
      }

    } catch (error) {
      console.error('❌ Two node creation failed:', error);
      throw error;
    }
  }

  async checkNodeConfigurations(): Promise<void> {
    try {
      console.log('🔍 Checking node configurations:');
      
      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i];
        console.log(`\n📋 Node ${i} configuration:`);
        
        // Check if node has methods we expect / 检查节点是否有我们期望的方法
        console.log(`   - getPeers method: ${typeof node.getPeers === 'function' ? '✅' : '❌'}`);
        console.log(`   - start method: ${typeof node.start === 'function' ? '✅' : '❌'}`);
        console.log(`   - stop method: ${typeof node.stop === 'function' ? '✅' : '❌'}`);
        console.log(`   - broadcastTransaction method: ${typeof node.broadcastTransaction === 'function' ? '✅' : '❌'}`);
        
        // Try to get peers / 尝试获取对等节点
        try {
          const peers = node.getPeers();
          console.log(`   - Current peers: ${peers.length}`);
        } catch (error) {
          console.log(`   - Error getting peers: ${error}`);
        }
      }

    } catch (error) {
      console.error('❌ Configuration check failed:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up diagnostic test nodes...');
    
    for (let i = 0; i < this.nodes.length; i++) {
      try {
        await this.nodes[i].stop();
        console.log(`🛑 Stopped node ${i}`);
      } catch (error) {
        console.log(`⚠️ Error stopping node ${i}:`, error);
      }
    }
    
    console.log('✅ Cleanup completed');
  }
}

// Main execution / 主执行
async function main(): Promise<void> {
  console.log('🚀 TitanChain P2P Network Diagnostics / TitanChain P2P网络诊断');
  
  const diagnostics = new P2PDiagnosticTest();
  
  try {
    await diagnostics.runDiagnostics();
  } catch (error) {
    console.error('Diagnostics failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly / 如果直接执行此文件则运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { P2PDiagnosticTest };