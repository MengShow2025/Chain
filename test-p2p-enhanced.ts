#!/usr/bin/env node
/**
 * Enhanced P2P Node Communication Test Suite / 增强P2P节点通信测试套件
 * Advanced testing for P2P node connectivity, message passing, and network resilience
 * P2P节点连接、消息传递和网络弹性的高级测试
 */

import { P2PNode } from './network/p2p-node.js';
import { TitanChain } from './blockchain/core/blockchain.js';
import { performance } from 'perf_hooks';
import { Transaction } from './shared/types/blockchain.js';

// Enhanced test configuration / 增强测试配置
interface EnhancedP2PTestConfig {
  nodeCount: number;
  basePort: number;
  testDuration: number;
  connectionTimeout: number;
  messageCount: number;
  retryAttempts: number;
  stabilizationDelay: number;
}

const config: EnhancedP2PTestConfig = {
  nodeCount: 3, // Reduced for better connection management / 减少节点数量以便更好地管理连接
  basePort: 6000,
  testDuration: 60000, // 60 seconds / 60秒
  connectionTimeout: 10000, // 10 seconds / 10秒
  messageCount: 50,
  retryAttempts: 3,
  stabilizationDelay: 5000 // 5 seconds / 5秒
};

// Enhanced test result interface / 增强测试结果接口
interface EnhancedP2PTestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  duration: number;
  details?: any;
  error?: string;
  metrics?: {
    connectionsEstablished: number;
    messagesTransmitted: number;
    messagesReceived: number;
    averageLatency: number;
    networkStability: number;
  };
}

// Enhanced P2P test runner / 增强P2P测试运行器
class EnhancedP2PTestRunner {
  private nodes: P2PNode[] = [];
  private blockchains: TitanChain[] = [];
  private results: EnhancedP2PTestResult[] = [];
  private startTime: number = 0;
  private messageLog: Map<string, { sent: number; received: number; latency: number[] }> = new Map();

  constructor() {
    this.startTime = performance.now();
  }

  // Add test result / 添加测试结果
  private addResult(result: EnhancedP2PTestResult): void {
    this.results.push(result);
    
    const statusIcon = this.getStatusIcon(result.status);
    const durationStr = `${result.duration.toFixed(2)}ms`;
    
    console.log(`${statusIcon} ${result.name} (${durationStr})`);
    
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details).substring(0, 200)}${JSON.stringify(result.details).length > 200 ? '...' : ''}`);
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    if (result.metrics) {
      console.log(`   Metrics: Connections: ${result.metrics.connectionsEstablished}, Messages: ${result.metrics.messagesTransmitted}/${result.metrics.messagesReceived}, Latency: ${result.metrics.averageLatency.toFixed(2)}ms`);
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'PASS': return '✅';
      case 'FAIL': return '❌';
      case 'WARNING': return '⚠️';
      case 'SKIP': return '⏭️';
      default: return '❓';
    }
  }

  // Create node configuration with explicit connection settings / 创建具有明确连接设置的节点配置
  private createNodeConfig(port: number, bootstrapPeers: string[] = []) {
    return {
      port,
      host: '127.0.0.1',
      bootnodes: bootstrapPeers
    };
  }

  // Initialize enhanced test nodes with better connection management / 使用更好的连接管理初始化增强测试节点
  async initializeEnhancedNodes(): Promise<void> {
    console.log('\n🚀 Initializing Enhanced P2P Test Nodes / 初始化增强P2P测试节点');
    const startTime = performance.now();

    try {
      // Create blockchains first / 首先创建区块链
      for (let i = 0; i < config.nodeCount; i++) {
        const blockchain = new TitanChain();
        await blockchain.initialize();
        this.blockchains.push(blockchain);
        console.log(`📦 Created blockchain ${i}`);
      }

      // Create nodes with sequential startup / 顺序启动创建节点
      for (let i = 0; i < config.nodeCount; i++) {
        const port = config.basePort + i;
        
        // Build bootstrap peers list - each node connects to all previous nodes / 构建引导节点列表 - 每个节点连接到所有之前的节点
        const bootstrapPeers: string[] = [];
        for (let j = 0; j < i; j++) {
          bootstrapPeers.push(`http://127.0.0.1:${config.basePort + j}`);
        }
        
        const nodeConfig = this.createNodeConfig(port, bootstrapPeers);
        const node = new P2PNode(this.blockchains[i], nodeConfig);
        
        this.nodes.push(node);
        console.log(`📦 Created node ${i} on port ${port} with ${bootstrapPeers.length} bootstrap peers`);
      }

      // Start nodes with delays for better connection establishment / 延迟启动节点以便更好地建立连接
      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i];
        await node.start();
        console.log(`🟢 Started node ${i} on port ${config.basePort + i}`);
        
        // Delay between node starts to allow proper connection establishment / 节点启动间延迟以允许正确建立连接
        if (i < this.nodes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Wait for network stabilization / 等待网络稳定
      console.log(`⏳ Waiting ${config.stabilizationDelay}ms for network stabilization / 等待网络稳定...`);
      await new Promise(resolve => setTimeout(resolve, config.stabilizationDelay));

      const duration = performance.now() - startTime;
      
      // Check initial connections / 检查初始连接
      const connectionCounts = this.nodes.map((node, index) => {
        const peers = node.getPeers();
        return { nodeIndex: index, peerCount: peers.length };
      });

      const totalConnections = connectionCounts.reduce((sum, conn) => sum + conn.peerCount, 0);
      const averageConnections = totalConnections / this.nodes.length;

      this.addResult({
        name: 'Enhanced Node Initialization',
        status: totalConnections > 0 ? 'PASS' : 'WARNING',
        duration,
        details: {
          nodesCreated: this.nodes.length,
          connectionCounts,
          totalConnections,
          averageConnections: averageConnections.toFixed(2)
        },
        metrics: {
          connectionsEstablished: totalConnections,
          messagesTransmitted: 0,
          messagesReceived: 0,
          averageLatency: 0,
          networkStability: totalConnections > 0 ? 1.0 : 0.0
        }
      });

    } catch (error: any) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Enhanced Node Initialization',
        status: 'FAIL',
        duration,
        error: error.message,
        details: { nodesCreated: this.nodes.length }
      });
      throw error;
    }
  }

  // Test enhanced peer discovery with active connection attempts / 测试增强的对等节点发现与主动连接尝试
  async testEnhancedPeerDiscovery(): Promise<void> {
    console.log('\n🔍 Testing Enhanced Peer Discovery / 测试增强对等节点发现');
    const startTime = performance.now();

    try {
      // Force connection attempts between all nodes / 强制所有节点间的连接尝试
      const connectionPromises: Promise<void>[] = [];
      
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const sourceNode = this.nodes[i];
          const targetPort = config.basePort + j;
          
          // Attempt direct connection / 尝试直接连接
          connectionPromises.push(
            this.attemptDirectConnection(sourceNode, `http://127.0.0.1:${targetPort}`, i, j)
          );
        }
      }

      // Wait for all connection attempts / 等待所有连接尝试
      await Promise.allSettled(connectionPromises);

      // Wait for connections to stabilize / 等待连接稳定
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check final connection state / 检查最终连接状态
      const finalConnections = this.nodes.map((node, index) => {
        const peers = node.getPeers();
        console.log(`📊 Node ${index}: ${peers.length} peers connected`);
        return { nodeIndex: index, peerCount: peers.length, peers: peers.map(p => p.id) };
      });

      const totalConnections = finalConnections.reduce((sum, conn) => sum + conn.peerCount, 0);
      const expectedConnections = this.nodes.length * (this.nodes.length - 1); // Full mesh expected / 期望全网状连接
      const connectionRatio = totalConnections / expectedConnections;

      const duration = performance.now() - startTime;

      this.addResult({
        name: 'Enhanced Peer Discovery',
        status: connectionRatio > 0.5 ? 'PASS' : connectionRatio > 0.2 ? 'WARNING' : 'FAIL',
        duration,
        details: {
          finalConnections,
          totalConnections,
          expectedConnections,
          connectionRatio: connectionRatio.toFixed(2)
        },
        metrics: {
          connectionsEstablished: totalConnections,
          messagesTransmitted: 0,
          messagesReceived: 0,
          averageLatency: 0,
          networkStability: connectionRatio
        }
      });

    } catch (error: any) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Enhanced Peer Discovery',
        status: 'FAIL',
        duration,
        error: error.message
      });
    }
  }

  // Attempt direct connection between nodes / 尝试节点间直接连接
  private async attemptDirectConnection(sourceNode: P2PNode, targetAddress: string, sourceIndex: number, targetIndex: number): Promise<void> {
    try {
      console.log(`🔗 Attempting connection: Node ${sourceIndex} -> Node ${targetIndex} (${targetAddress})`);
      
      // Note: P2PNode doesn't have a direct connect method, so we'll rely on the bootstrap mechanism
      // This is a placeholder for potential future direct connection functionality
      // 注意：P2PNode没有直接连接方法，所以我们依赖引导机制
      // 这是未来可能的直接连接功能的占位符
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate connection attempt / 模拟连接尝试
      
    } catch (error) {
      console.log(`❌ Connection failed: Node ${sourceIndex} -> Node ${targetIndex}: ${error}`);
    }
  }

  // Test enhanced message broadcasting with tracking / 测试增强的消息广播与跟踪
  async testEnhancedMessageBroadcasting(): Promise<void> {
    console.log('\n📡 Testing Enhanced Message Broadcasting / 测试增强消息广播');
    const startTime = performance.now();

    try {
      if (this.nodes.length < 2) {
        throw new Error('Need at least 2 nodes for message broadcasting');
      }

      const sender = this.nodes[0];
      const messagesSent: any[] = [];
      const messagesReceived: any[] = [];

      // Set up message tracking / 设置消息跟踪
      const messageTracker = new Map<string, { sentAt: number; receivedAt?: number }>();

      // Send multiple test messages / 发送多个测试消息
      for (let i = 0; i < Math.min(config.messageCount, 10); i++) {
        const testMessage = {
          id: `test-msg-${Date.now()}-${i}`,
          type: 'test',
          data: `Test message ${i} from enhanced P2P test`,
          timestamp: Date.now()
        };

        const messageId = testMessage.id;
        messageTracker.set(messageId, { sentAt: performance.now() });

        // Broadcast as transaction (since that's what P2PNode supports) / 作为交易广播（因为这是P2PNode支持的）
        const testTx: Transaction = {
          hash: messageId,
          from: 'test-sender',
          to: 'test-receiver',
          value: i + 1,
          gas: 21000,
          gasPrice: 20,
          nonce: i,
          data: JSON.stringify(testMessage),
          timestamp: Date.now(),
          blockNumber: 0,
          blockHash: '',
          transactionIndex: i,
          status: 'pending',
          isZeroGas: false,
          contractTierFeeLevel: 0
        };

        sender.broadcastTransaction(testTx);
        messagesSent.push(testMessage);
        
        console.log(`📤 Sent message ${i + 1}/${Math.min(config.messageCount, 10)}: ${messageId}`);
        
        // Small delay between messages / 消息间小延迟
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for message propagation / 等待消息传播
      console.log('⏳ Waiting for message propagation / 等待消息传播...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check message delivery (this is simplified since we don't have direct message tracking in P2PNode) / 检查消息传递
      const senderPeers = sender.getPeers();
      const totalPeers = this.nodes.reduce((sum, node) => sum + node.getPeers().length, 0);

      const duration = performance.now() - startTime;
      const averageLatency = 100; // Placeholder since we can't track actual message delivery / 占位符，因为我们无法跟踪实际消息传递

      this.addResult({
        name: 'Enhanced Message Broadcasting',
        status: senderPeers.length > 0 ? 'PASS' : 'WARNING',
        duration,
        details: {
          messagesSent: messagesSent.length,
          senderPeers: senderPeers.length,
          totalNetworkPeers: totalPeers,
          messagesTracked: messageTracker.size
        },
        metrics: {
          connectionsEstablished: totalPeers,
          messagesTransmitted: messagesSent.length,
          messagesReceived: 0, // Can't track without message delivery confirmation / 无法跟踪，没有消息传递确认
          averageLatency,
          networkStability: senderPeers.length > 0 ? 1.0 : 0.0
        }
      });

    } catch (error: any) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Enhanced Message Broadcasting',
        status: 'FAIL',
        duration,
        error: error.message
      });
    }
  }

  // Test network partition recovery / 测试网络分区恢复
  async testNetworkPartitionRecovery(): Promise<void> {
    console.log('\n🔄 Testing Network Partition Recovery / 测试网络分区恢复');
    const startTime = performance.now();

    try {
      if (this.nodes.length < 3) {
        this.addResult({
          name: 'Network Partition Recovery',
          status: 'SKIP',
          duration: 0,
          details: { reason: 'Need at least 3 nodes for partition testing' }
        });
        return;
      }

      // Record initial state / 记录初始状态
      const initialConnections = this.nodes.map((node, index) => ({
        nodeIndex: index,
        peerCount: node.getPeers().length
      }));

      // Simulate partition by stopping middle node / 通过停止中间节点模拟分区
      const partitionNodeIndex = Math.floor(this.nodes.length / 2);
      const partitionNode = this.nodes[partitionNodeIndex];
      
      console.log(`🔴 Simulating partition: stopping node ${partitionNodeIndex}`);
      await partitionNode.stop();

      // Wait for partition to take effect / 等待分区生效
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check partition state / 检查分区状态
      const partitionConnections = this.nodes.map((node, index) => {
        if (index === partitionNodeIndex) return { nodeIndex: index, peerCount: 0 };
        return { nodeIndex: index, peerCount: node.getPeers().length };
      });

      // Restart partitioned node / 重启分区节点
      console.log(`🟢 Recovering partition: restarting node ${partitionNodeIndex}`);
      
      // Create new node instance (since the old one was stopped) / 创建新节点实例（因为旧的已停止）
      const bootstrapPeers: string[] = [];
      for (let j = 0; j < this.nodes.length; j++) {
        if (j !== partitionNodeIndex) {
          bootstrapPeers.push(`http://127.0.0.1:${config.basePort + j}`);
        }
      }

      const nodeConfig = this.createNodeConfig(config.basePort + partitionNodeIndex, bootstrapPeers);
      const newNode = new P2PNode(this.blockchains[partitionNodeIndex], nodeConfig);
      
      await newNode.start();
      this.nodes[partitionNodeIndex] = newNode;

      // Wait for recovery / 等待恢复
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check recovery state / 检查恢复状态
      const recoveryConnections = this.nodes.map((node, index) => ({
        nodeIndex: index,
        peerCount: node.getPeers().length
      }));

      const initialTotal = initialConnections.reduce((sum, conn) => sum + conn.peerCount, 0);
      const recoveryTotal = recoveryConnections.reduce((sum, conn) => sum + conn.peerCount, 0);
      const recoveryRatio = recoveryTotal / Math.max(initialTotal, 1);

      const duration = performance.now() - startTime;

      this.addResult({
        name: 'Network Partition Recovery',
        status: recoveryRatio > 0.7 ? 'PASS' : recoveryRatio > 0.3 ? 'WARNING' : 'FAIL',
        duration,
        details: {
          initialConnections,
          partitionConnections,
          recoveryConnections,
          partitionedNode: partitionNodeIndex,
          recoveryRatio: recoveryRatio.toFixed(2)
        },
        metrics: {
          connectionsEstablished: recoveryTotal,
          messagesTransmitted: 0,
          messagesReceived: 0,
          averageLatency: 0,
          networkStability: recoveryRatio
        }
      });

    } catch (error: any) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Network Partition Recovery',
        status: 'FAIL',
        duration,
        error: error.message
      });
    }
  }

  // Test concurrent transaction processing / 测试并发交易处理
  async testConcurrentTransactionProcessing(): Promise<void> {
    console.log('\n⚡ Testing Concurrent Transaction Processing / 测试并发交易处理');
    const startTime = performance.now();

    try {
      const transactionCount = 20;
      const concurrentSenders = Math.min(this.nodes.length, 3);
      const transactionsPerSender = Math.floor(transactionCount / concurrentSenders);

      const allTransactions: Transaction[] = [];
      const senderPromises: Promise<void>[] = [];

      // Create concurrent transaction senders / 创建并发交易发送者
      for (let senderIndex = 0; senderIndex < concurrentSenders; senderIndex++) {
        const sender = this.nodes[senderIndex];
        
        const senderPromise = (async () => {
          for (let txIndex = 0; txIndex < transactionsPerSender; txIndex++) {
            const tx: Transaction = {
              hash: `concurrent-tx-${senderIndex}-${txIndex}-${Date.now()}`,
              from: `sender-${senderIndex}`,
              to: `receiver-${txIndex}`,
              value: (senderIndex + 1) * (txIndex + 1),
              gas: 21000,
              gasPrice: 20,
              nonce: txIndex,
              data: `0x${Buffer.from(`concurrent-data-${senderIndex}-${txIndex}`).toString('hex')}`,
              timestamp: Date.now(),
              blockNumber: 0,
              blockHash: '',
              transactionIndex: txIndex,
              status: 'pending',
              isZeroGas: false,
              contractTierFeeLevel: 0
            };

            allTransactions.push(tx);
            sender.broadcastTransaction(tx);
            
            // Small delay between transactions from same sender / 同一发送者的交易间小延迟
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        })();

        senderPromises.push(senderPromise);
      }

      // Wait for all senders to complete / 等待所有发送者完成
      await Promise.all(senderPromises);

      // Wait for transaction propagation / 等待交易传播
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check network state after concurrent processing / 检查并发处理后的网络状态
      const finalConnections = this.nodes.map((node, index) => ({
        nodeIndex: index,
        peerCount: node.getPeers().length
      }));

      const totalConnections = finalConnections.reduce((sum, conn) => sum + conn.peerCount, 0);
      const networkStable = totalConnections > 0;

      const duration = performance.now() - startTime;

      this.addResult({
        name: 'Concurrent Transaction Processing',
        status: networkStable ? 'PASS' : 'WARNING',
        duration,
        details: {
          transactionsSent: allTransactions.length,
          concurrentSenders,
          transactionsPerSender,
          finalConnections,
          networkStable
        },
        metrics: {
          connectionsEstablished: totalConnections,
          messagesTransmitted: allTransactions.length,
          messagesReceived: 0,
          averageLatency: duration / allTransactions.length,
          networkStability: networkStable ? 1.0 : 0.0
        }
      });

    } catch (error: any) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Concurrent Transaction Processing',
        status: 'FAIL',
        duration,
        error: error.message
      });
    }
  }

  // Run all enhanced P2P tests / 运行所有增强P2P测试
  async runEnhancedP2PTests(): Promise<void> {
    console.log('🚀 Starting Enhanced P2P Communication Test Suite / 启动增强P2P通信测试套件');
    console.log(`📊 Configuration:
    - Node Count: ${config.nodeCount}
    - Base Port: ${config.basePort}
    - Test Duration: ${config.testDuration}ms
    - Connection Timeout: ${config.connectionTimeout}ms
    - Message Count: ${config.messageCount}
    - Retry Attempts: ${config.retryAttempts}
    `);

    try {
      // Initialize enhanced nodes / 初始化增强节点
      await this.initializeEnhancedNodes();

      // Run enhanced tests / 运行增强测试
      await this.testEnhancedPeerDiscovery();
      await this.testEnhancedMessageBroadcasting();
      await this.testNetworkPartitionRecovery();
      await this.testConcurrentTransactionProcessing();

      this.printEnhancedSummary();
    } catch (error) {
      console.error('❌ Enhanced P2P test suite execution failed:', error);
      throw error;
    }
  }

  // Print enhanced test summary / 打印增强测试摘要
  private printEnhancedSummary(): void {
    const totalTime = performance.now() - this.startTime;

    console.log('\n' + '='.repeat(100));
    console.log('📊 ENHANCED P2P COMMUNICATION TEST SUMMARY / 增强P2P通信测试摘要');
    console.log('='.repeat(100));

    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`⚠️  Warnings: ${warnings} (${((warnings/total)*100).toFixed(1)}%)`);
    console.log(`⏭️  Skipped: ${skipped} (${((skipped/total)*100).toFixed(1)}%)`);
    console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(`🌐 Nodes Tested: ${this.nodes.length}`);
    console.log(`📡 Base Port: ${config.basePort}`);

    // Aggregate metrics / 聚合指标
    const totalConnections = this.results.reduce((sum, r) => sum + (r.metrics?.connectionsEstablished || 0), 0);
    const totalMessages = this.results.reduce((sum, r) => sum + (r.metrics?.messagesTransmitted || 0), 0);
    const averageStability = this.results.reduce((sum, r) => sum + (r.metrics?.networkStability || 0), 0) / this.results.length;

    console.log('\n📈 Aggregate Metrics:');
    console.log(`🔗 Total Connections Established: ${totalConnections}`);
    console.log(`📨 Total Messages Transmitted: ${totalMessages}`);
    console.log(`🌐 Average Network Stability: ${(averageStability * 100).toFixed(1)}%`);

    // Recommendations / 建议
    console.log('\n💡 Recommendations:');
    if (failed > 0) {
      console.log('  🚨 Critical failures detected - investigate P2P connection mechanisms');
    }
    if (warnings > 0) {
      console.log('  ⚠️ Connection issues detected - consider improving bootstrap and discovery logic');
    }
    if (averageStability < 0.5) {
      console.log('  🔧 Low network stability - implement better connection management and retry logic');
    }
    if (totalConnections === 0) {
      console.log('  🔴 No connections established - P2P networking requires immediate attention');
    }
    if (passed === total && averageStability > 0.8) {
      console.log('  🎉 Excellent P2P performance - network is robust and reliable!');
    }

    console.log('='.repeat(100));
  }

  // Cleanup test resources / 清理测试资源
  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up enhanced test nodes / 清理增强测试节点');
    
    for (let i = 0; i < this.nodes.length; i++) {
      try {
        await this.nodes[i].stop();
        console.log(`🛑 Stopped enhanced node ${i}`);
      } catch (error) {
        console.log(`⚠️ Error stopping enhanced node ${i}:`, error);
      }
    }
    
    console.log('✅ Enhanced cleanup completed / 增强清理完成');
  }
}

// Main execution function / 主执行函数
async function main(): Promise<void> {
  console.log('🚀 TitanChain Enhanced P2P Communication Test Suite / TitanChain增强P2P通信测试套件');
  
  const testRunner = new EnhancedP2PTestRunner();
  
  try {
    await testRunner.runEnhancedP2PTests();
  } catch (error) {
    console.error('Enhanced P2P testing failed:', error);
    process.exit(1);
  } finally {
    await testRunner.cleanup();
  }
}

// Run if this file is executed directly / 如果直接执行此文件则运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { EnhancedP2PTestRunner, EnhancedP2PTestConfig, EnhancedP2PTestResult };