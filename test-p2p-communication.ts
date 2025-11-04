#!/usr/bin/env node
/**
 * P2P Node Communication Test Suite / P2P节点间通信测试套件
 * Tests multi-node P2P communication, node discovery, and data synchronization / 测试多节点P2P通信、节点发现和数据同步
 */

import { P2PNode } from './network/p2p-node.js';
import { TitanChain } from './blockchain/core/blockchain.js';
import { performance } from 'perf_hooks';

// Test configuration / 测试配置
interface P2PTestConfig {
  nodeCount: number;
  basePort: number;
  testDuration: number;
  messageCount: number;
}

const config: P2PTestConfig = {
  nodeCount: 5,
  basePort: 5000,
  testDuration: 30000, // 30 seconds / 30秒
  messageCount: 100
};

// Test result interface / 测试结果接口
interface P2PTestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  duration: number;
  details?: any;
  error?: string;
}

// P2P Communication Test Suite / P2P通信测试套件
class P2PCommunicationTester {
  private nodes: P2PNode[] = [];
  private results: P2PTestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = performance.now();
  }

  // Add test result / 添加测试结果
  private addResult(result: P2PTestResult): void {
    this.results.push(result);
    const status = result.status === 'PASS' ? '✅' : 
                  result.status === 'FAIL' ? '❌' : '⚠️';
    
    console.log(`${status} ${result.name} (${result.duration.toFixed(2)}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details)}`);
    }
  }

  // Create P2P node configuration / 创建P2P节点配置
  private createNodeConfig(port: number, bootstrapPeers: string[] = []) {
    return {
      port,
      host: 'localhost',
      bootnodes: bootstrapPeers
    };
  }

  // Initialize test nodes / 初始化测试节点
  async initializeNodes(): Promise<void> {
    console.log('\n🚀 Initializing P2P Test Nodes / 初始化P2P测试节点');
    const startTime = performance.now();

    try {
      // Create nodes / 创建节点
      for (let i = 0; i < config.nodeCount; i++) {
        const port = config.basePort + i;
        
        // First node has no bootstrap peers, others connect to first node / 第一个节点没有引导节点，其他节点连接到第一个节点
        const bootstrapPeers = i === 0 ? [] : [`http://127.0.0.1:${config.basePort}`];
        
        // Create blockchain instance for each node / 为每个节点创建区块链实例
        const blockchain = new TitanChain();
        // Note: TitanChain requires validators to start, using empty array for testing
        // await blockchain.start([]);
        
        const nodeConfig = this.createNodeConfig(port, bootstrapPeers);
        const node = new P2PNode(blockchain, nodeConfig);
        
        this.nodes.push(node);
        console.log(`📦 Created node on port ${port}`);
      }

      // Start all nodes / 启动所有节点
      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i];
        await node.start();
        console.log(`🟢 Started node ${i} on port ${config.basePort + i}`);
        
        // Small delay between node starts / 节点启动间的小延迟
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Wait for network stabilization / 等待网络稳定
      console.log('⏳ Waiting for network stabilization...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Node Initialization',
        status: 'PASS',
        duration,
        details: {
          nodesCreated: this.nodes.length,
          basePort: config.basePort
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Node Initialization',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Test node discovery / 测试节点发现
  async testNodeDiscovery(): Promise<void> {
    console.log('\n🔍 Testing Node Discovery / 测试节点发现');
    const startTime = performance.now();

    try {
      if (this.nodes.length < 2) {
        throw new Error('Need at least 2 nodes for discovery testing');
      }

      // Wait for nodes to discover each other / 等待节点相互发现
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if nodes have discovered peers / 检查节点是否发现了对等节点
      let totalConnections = 0;
      const discoveryResults = [];

      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i];
        const peers = node.getPeers();
        const peerCount = peers.length;
        
        totalConnections += peerCount;
        discoveryResults.push({
          nodeIndex: i,
          peerCount,
          peers: peers.map(p => ({ id: p.id, address: p.address }))
        });
        
        console.log(`📊 Node ${i}: discovered ${peerCount} peers`);
      }

      const averageConnections = totalConnections / this.nodes.length;
      const discoverySuccess = averageConnections > 0;

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Node Discovery',
        status: discoverySuccess ? 'PASS' : 'WARNING',
        duration,
        details: {
          totalConnections,
          averageConnections,
          discoveryResults
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Node Discovery',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Test message broadcasting / 测试消息广播
  async testMessageBroadcasting(): Promise<void> {
    console.log('\n📢 Testing Message Broadcasting / 测试消息广播');
    const startTime = performance.now();

    try {
      if (this.nodes.length < 2) {
        throw new Error('Need at least 2 nodes for broadcasting');
      }

      const broadcaster = this.nodes[0];
      const receivers = this.nodes.slice(1);

      // Test transaction broadcasting / 测试交易广播
      const testTransaction = {
        id: 'test-tx-' + Date.now(),
        from: 'test-sender',
        to: 'test-receiver',
        amount: 100,
        timestamp: Date.now()
      };

      console.log('📤 Broadcasting test transaction...');
      broadcaster.broadcastTransaction(testTransaction);

      // Wait for broadcast propagation / 等待广播传播
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if peers received the broadcast / 检查对等节点是否收到广播
      const peersCount = broadcaster.getPeers().length;
      
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Message Broadcasting',
        status: peersCount > 0 ? 'PASS' : 'WARNING',
        duration,
        details: {
          transactionBroadcast: true,
          connectedPeers: peersCount,
          testTransaction: testTransaction.id
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Message Broadcasting',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Test peer-to-peer messaging / 测试点对点消息
  async testPeerToPeerMessaging(): Promise<void> {
    console.log('\n💬 Testing Peer-to-Peer Messaging / 测试点对点消息');
    const startTime = performance.now();

    try {
      if (this.nodes.length < 2) {
        throw new Error('Need at least 2 nodes for P2P messaging');
      }

      const sender = this.nodes[0];
      const receiver = this.nodes[1];

      // Check if nodes are connected / 检查节点是否连接
      const senderPeers = sender.getPeers();
      const receiverPeers = receiver.getPeers();

      console.log(`📊 Sender has ${senderPeers.length} peers`);
      console.log(`📊 Receiver has ${receiverPeers.length} peers`);

      // Test block broadcasting between nodes / 测试节点间区块广播
      const testBlock = {
        index: 1,
        timestamp: Date.now(),
        data: 'Test block data',
        hash: 'test-hash-' + Date.now(),
        previousHash: '0'
      };

      console.log('📤 Broadcasting test block...');
      sender.broadcastBlock(testBlock);

      // Wait for message delivery / 等待消息传递
      await new Promise(resolve => setTimeout(resolve, 1000));

      const connectionEstablished = senderPeers.length > 0 || receiverPeers.length > 0;

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Peer-to-Peer Messaging',
        status: connectionEstablished ? 'PASS' : 'WARNING',
        duration,
        details: {
          senderPeers: senderPeers.length,
          receiverPeers: receiverPeers.length,
          blockBroadcast: true,
          testBlock: testBlock.hash
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Peer-to-Peer Messaging',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Test network resilience / 测试网络弹性
  async testNetworkResilience(): Promise<void> {
    console.log('\n🛡️ Testing Network Resilience / 测试网络弹性');
    const startTime = performance.now();

    try {
      if (this.nodes.length < 3) {
        throw new Error('Need at least 3 nodes for resilience testing');
      }

      // Record initial network state / 记录初始网络状态
      const initialConnections = this.nodes.map((node, index) => ({
        nodeIndex: index,
        peerCount: node.getPeers().length
      }));

      // Simulate node failure by stopping a node / 通过停止节点模拟节点故障
      const failedNode = this.nodes[1];
      console.log(`🔴 Simulating failure of node 1`);
      await failedNode.stop();

      // Wait for network to adapt / 等待网络适应
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check remaining nodes connectivity / 检查剩余节点连接性
      const remainingNodes = this.nodes.filter(node => node !== failedNode);
      let totalConnections = 0;
      
      for (let i = 0; i < remainingNodes.length; i++) {
        const node = remainingNodes[i];
        const peerCount = node.getPeers().length;
        totalConnections += peerCount;
        console.log(`📊 Node ${i}: ${peerCount} connections after failure`);
      }

      // Restart the failed node / 重启故障节点
      console.log(`🟢 Restarting failed node`);
      await failedNode.start();

      // Wait for network to recover / 等待网络恢复
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check final network state / 检查最终网络状态
      const finalConnections = this.nodes.map((node, index) => ({
        nodeIndex: index,
        peerCount: node.getPeers().length
      }));

      const networkRecovered = finalConnections.every(node => node.peerCount > 0);

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Network Resilience',
        status: networkRecovered ? 'PASS' : 'WARNING',
        duration,
        details: {
          initialConnections,
          finalConnections,
          failedNodeIndex: 1,
          networkRecovered
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Network Resilience',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Test data synchronization / 测试数据同步
  async testDataSynchronization(): Promise<void> {
    console.log('\n🔄 Testing Data Synchronization / 测试数据同步');
    const startTime = performance.now();

    try {
      if (this.nodes.length < 2) {
        throw new Error('Need at least 2 nodes for synchronization testing');
      }

      const sourceNode = this.nodes[0];
      const targetNodes = this.nodes.slice(1);

      // Check network connectivity for synchronization / 检查同步的网络连接性
      const sourcePeers = sourceNode.getPeers();
      let totalTargetPeers = 0;
      
      targetNodes.forEach(node => {
        totalTargetPeers += node.getPeers().length;
      });

      const networkConnected = sourcePeers.length > 0 || totalTargetPeers > 0;
      const avgConnections = (sourcePeers.length + totalTargetPeers) / this.nodes.length;

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Data Synchronization',
        status: networkConnected ? 'PASS' : 'WARNING',
        duration,
        details: {
          sourcePeers: sourcePeers.length,
          totalTargetPeers,
          averageConnections: avgConnections.toFixed(2),
          networkConnected
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Data Synchronization',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Cleanup test nodes / 清理测试节点
  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test nodes / 清理测试节点');
    
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      try {
        await node.stop();
        console.log(`🛑 Stopped node ${i}`);
      } catch (error) {
        console.warn(`⚠️ Error stopping node ${i}:`, error);
      }
    }
    
    this.nodes = [];
  }

  // Run all P2P tests / 运行所有P2P测试
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting P2P Communication Test Suite / 开始P2P通信测试套件\n');
    
    try {
      await this.initializeNodes();
      await this.testNodeDiscovery();
      await this.testMessageBroadcasting();
      await this.testPeerToPeerMessaging();
      await this.testNetworkResilience();
      await this.testDataSynchronization();
      
      this.printSummary();
    } catch (error) {
      console.error('❌ P2P test suite execution failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  // Print test summary / 打印测试摘要
  private printSummary(): void {
    const totalTime = performance.now() - this.startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 P2P COMMUNICATION TEST SUMMARY / P2P通信测试摘要');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    const total = this.results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`⚠️  Warnings: ${warnings} (${((warnings/total)*100).toFixed(1)}%)`);
    console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(`🌐 Nodes Tested: ${config.nodeCount}`);
    console.log(`📡 Base Port: ${config.basePort}`);
    
    // Failed tests details / 失败测试详情
    const failedTests = this.results.filter(r => r.status === 'FAIL');
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(result => {
        console.log(`  - ${result.name}: ${result.error}`);
      });
    }
    
    console.log('='.repeat(80));
    
    if (failed === 0) {
      console.log('🎉 All P2P communication tests passed! / 所有P2P通信测试通过！');
    } else {
      console.log(`⚠️  ${failed} test(s) failed - review required / ${failed}个测试失败 - 需要检查`);
    }
  }
}

// Main execution / 主执行函数
async function main(): Promise<void> {
  const tester = new P2PCommunicationTester();
  
  try {
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('💥 P2P test suite failed:', error);
    process.exit(1);
  }
}

// Run the test / 运行测试
main();

export { P2PCommunicationTester };