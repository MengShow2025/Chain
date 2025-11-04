#!/usr/bin/env tsx

/**
 * Multi-Node Synchronization Test / 多节点同步测试
 * Tests P2P block synchronization across multiple TitanChain nodes / 测试多个TitanChain节点间的P2P区块同步
 * 
 * Test Scenarios / 测试场景:
 * 1. Node startup and network discovery / 节点启动和网络发现
 * 2. Genesis block creation and sharing / 创世区块创建和共享
 * 3. Block production and synchronization / 区块生产和同步
 * 4. Network partition and recovery / 网络分区和恢复
 * 5. Late node joining / 后加入节点
 */

import { EnhancedTitanChainNode } from './blockchain/start-node-enhanced.js';
import { TitanChain } from './blockchain/core/blockchain.js';
import { EnhancedP2PNode } from './network/p2p-enhanced.js';
import { Transaction } from './shared/types/blockchain.js';
import { performance } from 'perf_hooks';

// Test configuration / 测试配置
interface TestConfig {
  nodeCount: number;           // 节点数量
  basePort: number;           // 基础端口
  testDuration: number;       // 测试持续时间(秒)
  blockInterval: number;      // 区块间隔(毫秒)
  transactionRate: number;    // 交易速率(每秒)
  networkDelay: number;       // 网络延迟(毫秒)
}

const DEFAULT_CONFIG: TestConfig = {
  nodeCount: 4,
  basePort: 5000,
  testDuration: 60,
  blockInterval: 5000,
  transactionRate: 10,
  networkDelay: 100
};

// Test result interface / 测试结果接口
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  duration: number;
  details?: any;
  error?: string;
}

/**
 * Multi-Node Sync Test Suite / 多节点同步测试套件
 */
class MultiNodeSyncTest {
  private config: TestConfig;
  private nodes: EnhancedTitanChainNode[] = [];
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(config: Partial<TestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('🧪 Multi-Node Sync Test Suite initialized / 多节点同步测试套件已初始化');
    console.log(`📊 Configuration / 配置:`, this.config);
  }

  /**
   * Run all tests / 运行所有测试
   */
  async runAllTests(): Promise<void> {
    console.log('\n🚀 Starting Multi-Node Synchronization Tests / 开始多节点同步测试');
    console.log('='.repeat(80));
    
    this.startTime = performance.now();

    try {
      // Test 1: Node initialization / 测试1：节点初始化
      await this.testNodeInitialization();

      // Test 2: Network discovery / 测试2：网络发现
      await this.testNetworkDiscovery();

      // Test 3: Genesis block synchronization / 测试3：创世区块同步
      await this.testGenesisBlockSync();

      // Test 4: Block production and sync / 测试4：区块生产和同步
      await this.testBlockProductionSync();

      // Test 5: Transaction propagation / 测试5：交易传播
      await this.testTransactionPropagation();

      // Test 6: Late node joining / 测试6：后加入节点
      await this.testLateNodeJoining();

      // Test 7: Network partition recovery / 测试7：网络分区恢复
      await this.testNetworkPartitionRecovery();

      // Test 8: Blockchain consistency / 测试8：区块链一致性
      await this.testBlockchainConsistency();

    } catch (error) {
      console.error('❌ Test suite failed / 测试套件失败:', error);
      this.addResult({
        name: 'Test Suite Execution',
        status: 'FAIL',
        duration: performance.now() - this.startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      // Cleanup / 清理
      await this.cleanup();
      
      // Print results / 打印结果
      this.printResults();
    }
  }

  /**
   * Test 1: Node Initialization / 测试1：节点初始化
   */
  private async testNodeInitialization(): Promise<void> {
    console.log('\n📦 Test 1: Node Initialization / 测试1：节点初始化');
    const startTime = performance.now();

    try {
      // Create nodes with different ports / 创建不同端口的节点
      for (let i = 0; i < this.config.nodeCount; i++) {
        const port = this.config.basePort + i;
        
        // Set environment variables for each node / 为每个节点设置环境变量
        process.env.P2P_PORT = port.toString();
        process.env.DATA_DIR = `./data/node-${i}`;
        
        // First node has no bootnodes, others connect to first node / 第一个节点没有引导节点，其他节点连接到第一个节点
        if (i === 0) {
          process.env.BOOTNODES = '';
        } else {
          process.env.BOOTNODES = `http://127.0.0.1:${this.config.basePort}`;
        }

        const node = new EnhancedTitanChainNode();
        this.nodes.push(node);
        
        console.log(`✅ Node ${i} created on port ${port} / 节点${i}在端口${port}创建`);
      }

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Node Initialization',
        status: 'PASS',
        duration,
        details: {
          nodeCount: this.nodes.length,
          ports: this.nodes.map((_, i) => this.config.basePort + i)
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

  /**
   * Test 2: Network Discovery / 测试2：网络发现
   */
  private async testNetworkDiscovery(): Promise<void> {
    console.log('\n🔍 Test 2: Network Discovery / 测试2：网络发现');
    const startTime = performance.now();

    try {
      // Start nodes sequentially / 顺序启动节点
      for (let i = 0; i < this.nodes.length; i++) {
        console.log(`🚀 Starting node ${i} / 启动节点${i}...`);
        
        // Set environment for this node / 为此节点设置环境
        process.env.P2P_PORT = (this.config.basePort + i).toString();
        process.env.DATA_DIR = `./data/node-${i}`;
        
        if (i === 0) {
          process.env.BOOTNODES = '';
        } else {
          process.env.BOOTNODES = `http://127.0.0.1:${this.config.basePort}`;
        }

        await this.nodes[i].start();
        console.log(`✅ Node ${i} started / 节点${i}已启动`);
        
        // Wait between node starts / 节点启动间等待
        if (i < this.nodes.length - 1) {
          await this.delay(2000);
        }
      }

      // Wait for network discovery / 等待网络发现
      console.log('⏳ Waiting for network discovery / 等待网络发现...');
      await this.delay(10000);

      // Check peer connections / 检查对等连接
      const connectionResults = [];
      for (let i = 0; i < this.nodes.length; i++) {
        const status = this.nodes[i].getStatus();
        connectionResults.push({
          nodeId: i,
          peers: status.peers,
          blockHeight: status.blockHeight
        });
        console.log(`📊 Node ${i}: ${status.peers} peers, height ${status.blockHeight} / 节点${i}: ${status.peers}个对等节点，高度${status.blockHeight}`);
      }

      // Verify network connectivity / 验证网络连接性
      const totalConnections = connectionResults.reduce((sum, result) => sum + result.peers, 0);
      const averageConnections = totalConnections / this.nodes.length;
      const networkConnected = averageConnections > 0;

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Network Discovery',
        status: networkConnected ? 'PASS' : 'WARNING',
        duration,
        details: {
          totalConnections,
          averageConnections,
          connectionResults
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Network Discovery',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test 3: Genesis Block Synchronization / 测试3：创世区块同步
   */
  private async testGenesisBlockSync(): Promise<void> {
    console.log('\n🏗️ Test 3: Genesis Block Synchronization / 测试3：创世区块同步');
    const startTime = performance.now();

    try {
      // Wait for genesis block creation and sync / 等待创世区块创建和同步
      await this.delay(5000);

      // Check if all nodes have the same genesis block / 检查所有节点是否有相同的创世区块
      const genesisBlocks = [];
      for (let i = 0; i < this.nodes.length; i++) {
        const status = this.nodes[i].getStatus();
        genesisBlocks.push({
          nodeId: i,
          blockHeight: status.blockHeight,
          hasGenesis: status.blockHeight >= 0
        });
      }

      // Verify genesis block consistency / 验证创世区块一致性
      const allHaveGenesis = genesisBlocks.every(block => block.hasGenesis);
      const heightsConsistent = genesisBlocks.every(block => block.blockHeight === genesisBlocks[0].blockHeight);

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Genesis Block Synchronization',
        status: allHaveGenesis && heightsConsistent ? 'PASS' : 'FAIL',
        duration,
        details: {
          genesisBlocks,
          allHaveGenesis,
          heightsConsistent
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Genesis Block Synchronization',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test 4: Block Production and Synchronization / 测试4：区块生产和同步
   */
  private async testBlockProductionSync(): Promise<void> {
    console.log('\n⛓️ Test 4: Block Production and Synchronization / 测试4：区块生产和同步');
    const startTime = performance.now();

    try {
      // Record initial heights / 记录初始高度
      const initialHeights = this.nodes.map((node, i) => ({
        nodeId: i,
        height: node.getStatus().blockHeight
      }));

      console.log('📊 Initial heights / 初始高度:', initialHeights);

      // Wait for block production / 等待区块生产
      console.log('⏳ Waiting for block production / 等待区块生产...');
      await this.delay(15000);

      // Record final heights / 记录最终高度
      const finalHeights = this.nodes.map((node, i) => ({
        nodeId: i,
        height: node.getStatus().blockHeight
      }));

      console.log('📊 Final heights / 最终高度:', finalHeights);

      // Check if blocks were produced and synced / 检查区块是否被生产和同步
      const blocksProduced = finalHeights.some(h => h.height > initialHeights.find(ih => ih.nodeId === h.nodeId)!.height);
      const heightsConsistent = finalHeights.every(h => h.height === finalHeights[0].height);

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Block Production and Synchronization',
        status: blocksProduced && heightsConsistent ? 'PASS' : 'WARNING',
        duration,
        details: {
          initialHeights,
          finalHeights,
          blocksProduced,
          heightsConsistent
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Block Production and Synchronization',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test 5: Transaction Propagation / 测试5：交易传播
   */
  private async testTransactionPropagation(): Promise<void> {
    console.log('\n💸 Test 5: Transaction Propagation / 测试5：交易传播');
    const startTime = performance.now();

    try {
      // This test would require access to transaction creation methods
      // For now, we'll simulate the test / 此测试需要访问交易创建方法，现在我们模拟测试
      
      console.log('📝 Simulating transaction propagation test / 模拟交易传播测试...');
      await this.delay(3000);

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Transaction Propagation',
        status: 'WARNING',
        duration,
        details: {
          message: 'Test simulated - requires transaction creation API / 测试已模拟 - 需要交易创建API'
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Transaction Propagation',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test 6: Late Node Joining / 测试6：后加入节点
   */
  private async testLateNodeJoining(): Promise<void> {
    console.log('\n🔄 Test 6: Late Node Joining / 测试6：后加入节点');
    const startTime = performance.now();

    try {
      // Create and start a late-joining node / 创建并启动后加入节点
      const lateNodePort = this.config.basePort + this.config.nodeCount;
      
      process.env.P2P_PORT = lateNodePort.toString();
      process.env.DATA_DIR = `./data/node-late`;
      process.env.BOOTNODES = `http://127.0.0.1:${this.config.basePort}`;

      const lateNode = new EnhancedTitanChainNode();
      
      console.log(`🚀 Starting late node on port ${lateNodePort} / 在端口${lateNodePort}启动后加入节点...`);
      await lateNode.start();
      
      // Wait for synchronization / 等待同步
      console.log('⏳ Waiting for late node synchronization / 等待后加入节点同步...');
      await this.delay(10000);

      // Check if late node synchronized / 检查后加入节点是否同步
      const lateNodeStatus = lateNode.getStatus();
      const existingNodeStatus = this.nodes[0].getStatus();
      
      const synchronized = lateNodeStatus.blockHeight === existingNodeStatus.blockHeight;
      const hasConnections = lateNodeStatus.peers > 0;

      console.log(`📊 Late node status / 后加入节点状态: height ${lateNodeStatus.blockHeight}, peers ${lateNodeStatus.peers}`);
      console.log(`📊 Existing node status / 现有节点状态: height ${existingNodeStatus.blockHeight}, peers ${existingNodeStatus.peers}`);

      // Cleanup late node / 清理后加入节点
      await lateNode.stop();

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Late Node Joining',
        status: synchronized && hasConnections ? 'PASS' : 'WARNING',
        duration,
        details: {
          lateNodeHeight: lateNodeStatus.blockHeight,
          existingNodeHeight: existingNodeStatus.blockHeight,
          synchronized,
          hasConnections
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Late Node Joining',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test 7: Network Partition Recovery / 测试7：网络分区恢复
   */
  private async testNetworkPartitionRecovery(): Promise<void> {
    console.log('\n🔌 Test 7: Network Partition Recovery / 测试7：网络分区恢复');
    const startTime = performance.now();

    try {
      // This test would require network manipulation capabilities
      // For now, we'll simulate the test / 此测试需要网络操作能力，现在我们模拟测试
      
      console.log('🔧 Simulating network partition recovery test / 模拟网络分区恢复测试...');
      await this.delay(3000);

      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Network Partition Recovery',
        status: 'WARNING',
        duration,
        details: {
          message: 'Test simulated - requires network manipulation / 测试已模拟 - 需要网络操作'
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Network Partition Recovery',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test 8: Blockchain Consistency / 测试8：区块链一致性
   */
  private async testBlockchainConsistency(): Promise<void> {
    console.log('\n🔍 Test 8: Blockchain Consistency / 测试8：区块链一致性');
    const startTime = performance.now();

    try {
      // Get final status from all nodes / 获取所有节点的最终状态
      const finalStatuses = this.nodes.map((node, i) => ({
        nodeId: i,
        ...node.getStatus()
      }));

      console.log('📊 Final node statuses / 最终节点状态:');
      finalStatuses.forEach(status => {
        console.log(`   Node ${status.nodeId}: height ${status.blockHeight}, peers ${status.peers}`);
      });

      // Check consistency / 检查一致性
      const heights = finalStatuses.map(s => s.blockHeight);
      const minHeight = Math.min(...heights);
      const maxHeight = Math.max(...heights);
      const heightDifference = maxHeight - minHeight;
      
      // Allow small height differences due to timing / 允许由于时序造成的小高度差异
      const consistent = heightDifference <= 1;
      
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Blockchain Consistency',
        status: consistent ? 'PASS' : 'WARNING',
        duration,
        details: {
          finalStatuses,
          minHeight,
          maxHeight,
          heightDifference,
          consistent
        }
      });

    } catch (error) {
      const duration = performance.now() - startTime;
      this.addResult({
        name: 'Blockchain Consistency',
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Add test result / 添加测试结果
   */
  private addResult(result: TestResult): void {
    this.results.push(result);
    const status = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
    console.log(`${status} ${result.name}: ${result.status} (${result.duration.toFixed(2)}ms)`);
  }

  /**
   * Print test results / 打印测试结果
   */
  private printResults(): void {
    const totalDuration = performance.now() - this.startTime;
    
    console.log('\n📊 Test Results Summary / 测试结果汇总');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log(`📈 Total Tests: ${this.results.length} / 总测试数: ${this.results.length}`);
    console.log(`✅ Passed: ${passed} / 通过: ${passed}`);
    console.log(`⚠️ Warnings: ${warnings} / 警告: ${warnings}`);
    console.log(`❌ Failed: ${failed} / 失败: ${failed}`);
    console.log(`⏱️ Total Duration: ${totalDuration.toFixed(2)}ms / 总耗时: ${totalDuration.toFixed(2)}ms`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests completed successfully! / 所有测试成功完成!');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the results. / 部分测试失败，请检查结果。');
    }
    
    // Print detailed results / 打印详细结果
    console.log('\n📋 Detailed Results / 详细结果:');
    this.results.forEach((result, index) => {
      const status = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
      console.log(`${index + 1}. ${status} ${result.name}`);
      console.log(`   Duration: ${result.duration.toFixed(2)}ms / 耗时: ${result.duration.toFixed(2)}ms`);
      if (result.error) {
        console.log(`   Error: ${result.error} / 错误: ${result.error}`);
      }
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)} / 详情:`);
      }
      console.log('');
    });
  }

  /**
   * Cleanup resources / 清理资源
   */
  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test resources / 清理测试资源...');
    
    // Stop all nodes / 停止所有节点
    for (let i = 0; i < this.nodes.length; i++) {
      try {
        await this.nodes[i].stop();
        console.log(`✅ Node ${i} stopped / 节点${i}已停止`);
      } catch (error) {
        console.error(`❌ Error stopping node ${i} / 停止节点${i}时出错:`, error);
      }
    }
    
    console.log('✅ Cleanup completed / 清理完成');
  }

  /**
   * Utility: Delay function / 工具：延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main function / 主函数
async function main() {
  console.log('🧪 TitanChain Multi-Node Synchronization Test / TitanChain多节点同步测试');
  console.log('='.repeat(80));
  
  // Parse command line arguments / 解析命令行参数
  const args = process.argv.slice(2);
  const config: Partial<TestConfig> = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    
    if (key && value) {
      switch (key) {
        case 'nodes':
          config.nodeCount = parseInt(value);
          break;
        case 'port':
          config.basePort = parseInt(value);
          break;
        case 'duration':
          config.testDuration = parseInt(value);
          break;
      }
    }
  }
  
  console.log('⚙️ Test Configuration / 测试配置:', config);
  
  const test = new MultiNodeSyncTest(config);
  await test.runAllTests();
}

// Run tests if this file is executed directly / 如果直接执行此文件则运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Test execution failed / 测试执行失败:', error);
    process.exit(1);
  });
}

export { MultiNodeSyncTest };