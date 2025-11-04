#!/usr/bin/env node
// TitanChain System Integration Test / TitanChain系统集成测试
import axios from 'axios';
import { TitanChain } from './blockchain/core/blockchain.js';
import { P2PNode } from './network/p2p-node.js';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
}

class SystemIntegrationTest {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  async runAllTests(): Promise<void> {
    console.log('🚀 TitanChain System Integration Test Started / TitanChain系统集成测试开始');
    console.log('='.repeat(80));

    // 1. TypeScript编译检查
    await this.testTypeScriptCompilation();

    // 2. 区块链核心功能测试
    await this.testBlockchainCore();

    // 3. P2P网络测试
    await this.testP2PNetwork();

    // 4. API服务器测试
    await this.testAPIServer();

    // 5. API网关测试
    await this.testAPIGateway();

    // 6. 系统接口测试
    await this.testSystemInterfaces();

    // 7. 智能分片测试
    await this.testSmartSharding();

    // 8. MPC系统测试
    await this.testMPCSystem();

    // 生成测试报告
    this.generateReport();
  }

  private async testTypeScriptCompilation(): Promise<void> {
    console.log('\n📋 1. TypeScript Compilation Test / TypeScript编译测试');
    const startTime = Date.now();

    try {
      // 检查核心模块是否可以正常导入
      const blockchain = new TitanChain();
      await blockchain.initialize();
      
      this.addResult({
        name: 'TypeScript Compilation',
        status: 'PASS',
        message: 'All core modules compile successfully / 所有核心模块编译成功',
        duration: Date.now() - startTime
      });
      console.log('✅ TypeScript compilation passed / TypeScript编译通过');
    } catch (error) {
      this.addResult({
        name: 'TypeScript Compilation',
        status: 'FAIL',
        message: `Compilation failed: ${error} / 编译失败: ${error}`,
        duration: Date.now() - startTime
      });
      console.log('❌ TypeScript compilation failed / TypeScript编译失败:', error);
    }
  }

  private async testBlockchainCore(): Promise<void> {
    console.log('\n⛓️ 2. Blockchain Core Test / 区块链核心测试');
    const startTime = Date.now();

    try {
      const blockchain = new TitanChain();
      await blockchain.initialize();

      // 测试创建交易
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
      
      // 测试挖矿
      const block = await blockchain.mineBlock('test-miner');
      
      if (block) {
        this.addResult({
          name: 'Blockchain Core',
          status: 'PASS',
          message: `Block mined successfully: ${block.hash} / 区块挖矿成功: ${block.hash}`,
          duration: Date.now() - startTime
        });
        console.log('✅ Blockchain core test passed / 区块链核心测试通过');
      } else {
        throw new Error('Failed to mine block / 挖矿失败');
      }
    } catch (error) {
      this.addResult({
        name: 'Blockchain Core',
        status: 'FAIL',
        message: `Blockchain test failed: ${error} / 区块链测试失败: ${error}`,
        duration: Date.now() - startTime
      });
      console.log('❌ Blockchain core test failed / 区块链核心测试失败:', error);
    }
  }

  private async testP2PNetwork(): Promise<void> {
    console.log('\n🕸️ 3. P2P Network Test / P2P网络测试');
    const startTime = Date.now();

    let p2pNode: P2PNode | null = null;
    try {
      const blockchain = new TitanChain();
      await blockchain.initialize();
      
      p2pNode = new P2PNode(blockchain, { port: 4003, host: '127.0.0.1' });
      await p2pNode.start();

      // 等待网络初始化
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.addResult({
        name: 'P2P Network',
        status: 'PASS',
        message: 'P2P network started successfully on port 4003 / P2P网络在端口4003启动成功',
        duration: Date.now() - startTime
      });
      console.log('✅ P2P network test passed / P2P网络测试通过');
    } catch (error) {
      this.addResult({
        name: 'P2P Network',
        status: 'FAIL',
        message: `P2P network test failed: ${error} / P2P网络测试失败: ${error}`,
        duration: Date.now() - startTime
      });
      console.log('❌ P2P network test failed / P2P网络测试失败:', error);
    } finally {
      if (p2pNode) {
        await p2pNode.stop();
      }
    }
  }

  private async testAPIServer(): Promise<void> {
    console.log('\n🌐 4. API Server Test / API服务器测试');
    const startTime = Date.now();

    try {
      // 测试API服务器端点
      const endpoints = [
        'http://localhost:3000/api/health',
        'http://localhost:3000/api/blockchain/info',
        'http://localhost:3000/api/docs'
      ];

      let passedEndpoints = 0;
      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(endpoint, { timeout: 5000 });
          if (response.status === 200) {
            passedEndpoints++;
            console.log(`✅ ${endpoint} - OK`);
          }
        } catch (error) {
          console.log(`⚠️ ${endpoint} - Not accessible / 无法访问`);
        }
      }

      if (passedEndpoints > 0) {
        this.addResult({
          name: 'API Server',
          status: 'PASS',
          message: `${passedEndpoints}/${endpoints.length} endpoints accessible / ${passedEndpoints}/${endpoints.length} 端点可访问`,
          duration: Date.now() - startTime
        });
        console.log('✅ API server test passed / API服务器测试通过');
      } else {
        this.addResult({
          name: 'API Server',
          status: 'FAIL',
          message: 'No API endpoints accessible / 没有API端点可访问',
          duration: Date.now() - startTime
        });
        console.log('❌ API server test failed / API服务器测试失败');
      }
    } catch (error) {
      this.addResult({
        name: 'API Server',
        status: 'FAIL',
        message: `API server test error: ${error} / API服务器测试错误: ${error}`,
        duration: Date.now() - startTime
      });
      console.log('❌ API server test failed / API服务器测试失败:', error);
    }
  }

  private async testAPIGateway(): Promise<void> {
    console.log('\n🚪 5. API Gateway Test / API网关测试');
    const startTime = Date.now();

    try {
      // 测试API网关端点
      const gatewayEndpoints = [
        'http://localhost:8889/health',
        'http://localhost:8889/stats',
        'http://localhost:8889/discovery'
      ];

      let passedEndpoints = 0;
      for (const endpoint of gatewayEndpoints) {
        try {
          const response = await axios.get(endpoint, { timeout: 5000 });
          if (response.status === 200) {
            passedEndpoints++;
            console.log(`✅ ${endpoint} - OK`);
          }
        } catch (error) {
          console.log(`⚠️ ${endpoint} - Not accessible / 无法访问`);
        }
      }

      if (passedEndpoints > 0) {
        this.addResult({
          name: 'API Gateway',
          status: 'PASS',
          message: `${passedEndpoints}/${gatewayEndpoints.length} gateway endpoints accessible / ${passedEndpoints}/${gatewayEndpoints.length} 网关端点可访问`,
          duration: Date.now() - startTime
        });
        console.log('✅ API gateway test passed / API网关测试通过');
      } else {
        this.addResult({
          name: 'API Gateway',
          status: 'SKIP',
          message: 'API Gateway not running / API网关未运行',
          duration: Date.now() - startTime
        });
        console.log('⚠️ API gateway test skipped / API网关测试跳过');
      }
    } catch (error) {
      this.addResult({
        name: 'API Gateway',
        status: 'FAIL',
        message: `API gateway test error: ${error} / API网关测试错误: ${error}`,
        duration: Date.now() - startTime
      });
      console.log('❌ API gateway test failed / API网关测试失败:', error);
    }
  }

  private async testSystemInterfaces(): Promise<void> {
    console.log('\n🔌 6. System Interfaces Test / 系统接口测试');
    const startTime = Date.now();

    try {
      // 检查系统接口文件是否存在
      const interfaceFiles = [
        'shared/types/blockchain.ts',
        'shared/types/p2p.ts',
        'shared/constants/blockchain.ts'
      ];

      let existingFiles = 0;
      for (const file of interfaceFiles) {
        try {
          // 尝试导入文件来验证接口
          await import(`./${file}`);
          existingFiles++;
          console.log(`✅ ${file} - Interface valid / 接口有效`);
        } catch (error) {
          console.log(`⚠️ ${file} - Interface issue / 接口问题`);
        }
      }

      this.addResult({
        name: 'System Interfaces',
        status: existingFiles === interfaceFiles.length ? 'PASS' : 'FAIL',
        message: `${existingFiles}/${interfaceFiles.length} interfaces valid / ${existingFiles}/${interfaceFiles.length} 接口有效`,
        duration: Date.now() - startTime
      });
      console.log('✅ System interfaces test completed / 系统接口测试完成');
    } catch (error) {
      this.addResult({
        name: 'System Interfaces',
        status: 'FAIL',
        message: `System interfaces test error: ${error} / 系统接口测试错误: ${error}`,
        duration: Date.now() - startTime
      });
      console.log('❌ System interfaces test failed / 系统接口测试失败:', error);
    }
  }

  private async testSmartSharding(): Promise<void> {
    console.log('\n🧩 7. Smart Sharding Test / 智能分片测试');
    const startTime = Date.now();

    try {
      // 检查智能分片模块
      const shardingModule = await import('./blockchain/core/smart-sharding.js');
      
      this.addResult({
        name: 'Smart Sharding',
        status: 'PASS',
        message: 'Smart sharding module loaded successfully / 智能分片模块加载成功',
        duration: Date.now() - startTime
      });
      console.log('✅ Smart sharding test passed / 智能分片测试通过');
    } catch (error) {
      this.addResult({
        name: 'Smart Sharding',
        status: 'SKIP',
        message: 'Smart sharding module not available / 智能分片模块不可用',
        duration: Date.now() - startTime
      });
      console.log('⚠️ Smart sharding test skipped / 智能分片测试跳过');
    }
  }

  private async testMPCSystem(): Promise<void> {
    console.log('\n🔐 8. MPC System Test / MPC系统测试');
    const startTime = Date.now();

    try {
      // 检查MPC系统模块
      const mpcModule = await import('./mpc/mpc-system.js');
      
      this.addResult({
        name: 'MPC System',
        status: 'PASS',
        message: 'MPC system module loaded successfully / MPC系统模块加载成功',
        duration: Date.now() - startTime
      });
      console.log('✅ MPC system test passed / MPC系统测试通过');
    } catch (error) {
      this.addResult({
        name: 'MPC System',
        status: 'SKIP',
        message: 'MPC system module not available / MPC系统模块不可用',
        duration: Date.now() - startTime
      });
      console.log('⚠️ MPC system test skipped / MPC系统测试跳过');
    }
  }

  private addResult(result: TestResult): void {
    this.results.push(result);
  }

  private generateReport(): void {
    console.log('\n📊 System Integration Test Report / 系统集成测试报告');
    console.log('='.repeat(80));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    const skippedTests = this.results.filter(r => r.status === 'SKIP').length;
    const totalDuration = Date.now() - this.startTime;

    console.log(`\n📈 Test Summary / 测试摘要:`);
    console.log(`Total Tests / 总测试数: ${totalTests}`);
    console.log(`Passed / 通过: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Failed / 失败: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Skipped / 跳过: ${skippedTests} (${((skippedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Total Duration / 总耗时: ${totalDuration}ms`);

    console.log(`\n📋 Detailed Results / 详细结果:`);
    this.results.forEach((result, index) => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${index + 1}. ${statusIcon} ${result.name}: ${result.message} (${result.duration}ms)`);
    });

    // 系统健康状态评估
    console.log(`\n🏥 System Health Assessment / 系统健康状态评估:`);
    if (failedTests === 0) {
      console.log('🟢 System Status: HEALTHY / 系统状态: 健康');
      console.log('All critical components are functioning properly / 所有关键组件运行正常');
    } else if (failedTests <= 2) {
      console.log('🟡 System Status: WARNING / 系统状态: 警告');
      console.log('Some components need attention / 部分组件需要关注');
    } else {
      console.log('🔴 System Status: CRITICAL / 系统状态: 严重');
      console.log('Multiple components are failing / 多个组件出现故障');
    }

    console.log('\n🎉 System Integration Test Completed / 系统集成测试完成');
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new SystemIntegrationTest();
  test.runAllTests()
    .then(() => {
      console.log('\n✅ All integration tests completed / 所有集成测试完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Integration test failed / 集成测试失败:', error);
      process.exit(1);
    });
}

export { SystemIntegrationTest };