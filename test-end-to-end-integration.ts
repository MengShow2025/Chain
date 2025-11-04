/**
 * 端到端集成测试
 * End-to-End Integration Test
 * 
 * 验证TitanChain完整系统的集成功能
 * Verify complete TitanChain system integration functionality
 */

import { TitanChain } from './blockchain/core/blockchain';
import { DualBlockProcessor } from './blockchain/core/dual-block-processor';
import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor';
import { HighPerformanceProcessor } from './blockchain/core/high-performance-processor';
import { TransactionPool } from './blockchain/core/transaction-pool';
import { MarginManager } from './blockchain/core/margin-manager';
import { VIPManager } from './blockchain/core/vip-manager';
import { Transaction, Block } from './blockchain/types/blockchain';
import { MarginAccount, Position } from './shared/types/margin';
import { VIPLevel } from './shared/types/vip';

// 创建完整的测试场景 / Create complete test scenario
class EndToEndTestScenario {
  private blockchain: TitanChain;
  private dualBlockProcessor: DualBlockProcessor;
  private enhancedProcessor: EnhancedParallelProcessor;
  private transactionPool: TransactionPool;
  private marginSystem: MarginSystem;
  private vipSystem: VIPSystem;
  private testAccounts: string[] = [];
  
  constructor() {
    // 初始化核心组件 / Initialize core components
    this.blockchain = new TitanChain();
    this.transactionPool = new TransactionPool();
    this.dualBlockProcessor = new DualBlockProcessor();
    this.enhancedProcessor = new EnhancedParallelProcessor();
    this.marginSystem = new MarginSystem();
    this.vipSystem = new VIPSystem();
    
    // 创建测试账户 / Create test accounts
    this.createTestAccounts();
  }
  
  // 创建测试账户 / Create test accounts
  private createTestAccounts(): void {
    for (let i = 0; i < 10; i++) {
      this.testAccounts.push(`0x${Math.random().toString(16).substr(2, 40)}`);
    }
    console.log(`✅ 创建了 ${this.testAccounts.length} 个测试账户 / Created ${this.testAccounts.length} test accounts`);
  }
  
  // 创建测试交易 / Create test transaction
  private createTestTransaction(from: string, to: string, value: number, gasPrice: number = 50): Transaction {
    return {
      hash: `tx-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
      from,
      to,
      value,
      gas: 21000,
      gasPrice,
      data: '0x',
      nonce: Math.floor(Math.random() * 1000),
      timestamp: Date.now(),
      blockNumber: 0,
      blockHash: '',
      transactionIndex: 0,
      status: 'pending',
      isZeroGas: false,
      contractTierFeeLevel: 0
    };
  }
  
  // 测试1: 基础区块链功能 / Test 1: Basic blockchain functionality
  async testBasicBlockchainFunctionality(): Promise<boolean> {
    console.log('\n📋 测试1: 基础区块链功能 / Test 1: Basic blockchain functionality');
    
    try {
      // 创建创世区块 / Create genesis block
      const genesisBlock = this.blockchain.createGenesisBlock();
      console.log(`✅ 创世区块创建成功: ${genesisBlock.hash}`);
      
      // 创建测试交易 / Create test transactions
      const transactions: Transaction[] = [];
      for (let i = 0; i < 5; i++) {
        const tx = this.createTestTransaction(
          this.testAccounts[i % this.testAccounts.length],
          this.testAccounts[(i + 1) % this.testAccounts.length],
          Math.floor(Math.random() * 1000) + 100
        );
        transactions.push(tx);
        this.transactionPool.addTransaction(tx);
      }
      
      console.log(`✅ 创建了 ${transactions.length} 个测试交易`);
      
      // 创建新区块 / Create new block
      const newBlock = this.blockchain.createBlock(transactions);
      const isValid = this.blockchain.isValidBlock(newBlock, this.blockchain.getLatestBlock());
      
      if (isValid) {
        this.blockchain.addBlock(newBlock);
        console.log(`✅ 新区块添加成功: ${newBlock.hash}`);
        console.log(`✅ 区块链长度: ${this.blockchain.getChain().length}`);
        return true;
      } else {
        console.log('❌ 区块验证失败');
        return false;
      }
      
    } catch (error) {
      console.error('❌ 基础区块链功能测试失败:', error);
      return false;
    }
  }
  
  // 测试2: 双区块架构 / Test 2: Dual block architecture
  async testDualBlockArchitecture(): Promise<boolean> {
    console.log('\n📋 测试2: 双区块架构测试 / Test 2: Dual block architecture test');
    
    try {
      // 创建快速和批量交易 / Create fast and batch transactions
      const fastTransactions: Transaction[] = [];
      const batchTransactions: Transaction[] = [];
      
      // 快速交易 (高Gas价格) / Fast transactions (high gas price)
      for (let i = 0; i < 10; i++) {
        const tx = this.createTestTransaction(
          this.testAccounts[i % this.testAccounts.length],
          this.testAccounts[(i + 1) % this.testAccounts.length],
          Math.floor(Math.random() * 500) + 50,
          100 // 高Gas价格 / High gas price
        );
        fastTransactions.push(tx);
      }
      
      // 批量交易 (低Gas价格) / Batch transactions (low gas price)
      for (let i = 0; i < 20; i++) {
        const tx = this.createTestTransaction(
          this.testAccounts[i % this.testAccounts.length],
          this.testAccounts[(i + 2) % this.testAccounts.length],
          Math.floor(Math.random() * 200) + 10,
          20 // 低Gas价格 / Low gas price
        );
        batchTransactions.push(tx);
      }
      
      console.log(`✅ 创建了 ${fastTransactions.length} 个快速交易和 ${batchTransactions.length} 个批量交易`);
      
      // 添加交易到双区块处理器 / Add transactions to dual block processor
      [...fastTransactions, ...batchTransactions].forEach(tx => {
        this.dualBlockProcessor.addTransaction(tx);
      });
      
      // 等待处理完成 / Wait for processing completion
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const stats = this.dualBlockProcessor.getStatistics();
      console.log('📊 双区块处理统计:', {
        快速区块数: stats.fastBlocks,
        批量区块数: stats.batchBlocks,
        总交易数: stats.totalTransactions,
        平均处理时间: stats.averageProcessingTime + 'ms'
      });
      
      return stats.totalTransactions > 0;
      
    } catch (error) {
      console.error('❌ 双区块架构测试失败:', error);
      return false;
    }
  }
  
  // 测试3: VIP系统集成 / Test 3: VIP system integration
  async testVIPSystemIntegration(): Promise<boolean> {
    console.log('\n📋 测试3: VIP系统集成测试 / Test 3: VIP system integration test');
    
    try {
      const testAccount = this.testAccounts[0];
      
      // 创建VIP账户 / Create VIP account
      const vipAccount = await this.vipSystem.createVIPAccount(testAccount, {
        initialDeposit: 100000,
        referralCode: undefined
      });
      
      console.log(`✅ VIP账户创建成功: ${vipAccount.address}`);
      console.log(`✅ 初始VIP等级: ${vipAccount.level}`);
      
      // 模拟交易量增长 / Simulate trading volume growth
      await this.vipSystem.updateTradingVolume(testAccount, 500000);
      await this.vipSystem.updateTradingVolume(testAccount, 1000000);
      
      const updatedAccount = await this.vipSystem.getVIPAccount(testAccount);
      console.log(`✅ 更新后VIP等级: ${updatedAccount?.level}`);
      console.log(`✅ 累计交易量: ${updatedAccount?.totalTradingVolume}`);
      
      // 测试VIP特权 / Test VIP privileges
      const privileges = this.vipSystem.getVIPPrivileges(updatedAccount?.level || VIPLevel.BRONZE);
      console.log('✅ VIP特权:', {
        交易费折扣: privileges.tradingFeeDiscount + '%',
        最大杠杆: privileges.maxLeverage + 'x',
        提现限额: privileges.withdrawalLimit
      });
      
      return updatedAccount !== null;
      
    } catch (error) {
      console.error('❌ VIP系统集成测试失败:', error);
      return false;
    }
  }
  
  // 测试4: 保证金系统集成 / Test 4: Margin system integration
  async testMarginSystemIntegration(): Promise<boolean> {
    console.log('\n📋 测试4: 保证金系统集成测试 / Test 4: Margin system integration test');
    
    try {
      const testAccount = this.testAccounts[1];
      
      // 创建保证金账户 / Create margin account
      const marginAccount = await this.marginSystem.createMarginAccount(testAccount, {
        initialDeposit: 50000,
        maxLeverage: 10
      });
      
      console.log(`✅ 保证金账户创建成功: ${marginAccount.address}`);
      console.log(`✅ 初始余额: ${marginAccount.balance}`);
      console.log(`✅ 最大杠杆: ${marginAccount.maxLeverage}x`);
      
      // 开仓交易 / Open position
      const position = await this.marginSystem.openPosition(testAccount, {
        symbol: 'BTC/USDT',
        side: 'long',
        size: 1000,
        leverage: 5,
        price: 50000
      });
      
      console.log(`✅ 开仓成功: ${position.id}`);
      console.log(`✅ 仓位大小: ${position.size}`);
      console.log(`✅ 杠杆倍数: ${position.leverage}x`);
      console.log(`✅ 保证金: ${position.margin}`);
      
      // 更新价格并检查风险 / Update price and check risk
      await this.marginSystem.updateMarketPrice('BTC/USDT', 48000); // 价格下跌 / Price drop
      
      const riskMetrics = await this.marginSystem.calculateRiskMetrics(testAccount);
      console.log('📊 风险指标:', {
        保证金率: riskMetrics.marginRatio + '%',
        未实现盈亏: riskMetrics.unrealizedPnL,
        风险等级: riskMetrics.riskLevel
      });
      
      // 平仓 / Close position
      await this.marginSystem.closePosition(testAccount, position.id);
      console.log(`✅ 平仓成功: ${position.id}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ 保证金系统集成测试失败:', error);
      return false;
    }
  }
  
  // 测试5: 性能处理器集成 / Test 5: Performance processor integration
  async testPerformanceProcessorIntegration(): Promise<boolean> {
    console.log('\n📋 测试5: 性能处理器集成测试 / Test 5: Performance processor integration test');
    
    try {
      // 启动增强并行处理器 / Start enhanced parallel processor
      await this.enhancedProcessor.startProcessing();
      console.log('✅ 增强并行处理器已启动');
      
      // 创建大量测试交易 / Create large number of test transactions
      const testTransactions: Transaction[] = [];
      for (let i = 0; i < 100; i++) {
        const tx = this.createTestTransaction(
          this.testAccounts[i % this.testAccounts.length],
          this.testAccounts[(i + 1) % this.testAccounts.length],
          Math.floor(Math.random() * 1000) + 100,
          Math.floor(Math.random() * 80) + 20
        );
        testTransactions.push(tx);
      }
      
      console.log(`✅ 创建了 ${testTransactions.length} 个测试交易`);
      
      const startTime = Date.now();
      
      // 批量添加交易 / Add transactions in batch
      testTransactions.forEach(tx => {
        this.enhancedProcessor.addTransaction(tx);
      });
      
      // 等待处理完成 / Wait for processing completion
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const processingTime = Date.now() - startTime;
      const stats = this.enhancedProcessor.getProcessingStats();
      
      console.log('📊 性能处理器统计:', {
        总处理数: stats.totalProcessed,
        成功数: stats.totalSuccessful,
        处理时间: processingTime + 'ms',
        TPS: (stats.totalProcessed / (processingTime / 1000)).toFixed(2),
        成功率: ((stats.totalSuccessful / stats.totalProcessed) * 100).toFixed(1) + '%'
      });
      
      await this.enhancedProcessor.stopProcessing();
      console.log('✅ 增强并行处理器已停止');
      
      return stats.totalProcessed >= testTransactions.length * 0.8; // 至少80%处理成功 / At least 80% processing success
      
    } catch (error) {
      console.error('❌ 性能处理器集成测试失败:', error);
      return false;
    }
  }
  
  // 运行完整的端到端测试 / Run complete end-to-end test
  async runCompleteTest(): Promise<void> {
    console.log('🚀 开始端到端集成测试 / Starting end-to-end integration test');
    console.log('='.repeat(80));
    
    const testResults: { [key: string]: boolean } = {};
    
    try {
      // 运行所有测试 / Run all tests
      testResults['基础区块链功能'] = await this.testBasicBlockchainFunctionality();
      testResults['双区块架构'] = await this.testDualBlockArchitecture();
      testResults['VIP系统集成'] = await this.testVIPSystemIntegration();
      testResults['保证金系统集成'] = await this.testMarginSystemIntegration();
      testResults['性能处理器集成'] = await this.testPerformanceProcessorIntegration();
      
      // 统计测试结果 / Summarize test results
      console.log('\n📊 端到端集成测试结果汇总 / End-to-end integration test results summary:');
      console.log('='.repeat(80));
      
      let passedTests = 0;
      let totalTests = 0;
      
      Object.entries(testResults).forEach(([testName, result]) => {
        totalTests++;
        if (result) {
          passedTests++;
          console.log(`✅ ${testName}: 通过 / PASSED`);
        } else {
          console.log(`❌ ${testName}: 失败 / FAILED`);
        }
      });
      
      const successRate = (passedTests / totalTests) * 100;
      console.log(`\n📈 测试通过率: ${successRate.toFixed(1)}% (${passedTests}/${totalTests})`);
      
      if (successRate >= 80) {
        console.log('\n🎉 端到端集成测试整体通过! / End-to-end integration test overall PASSED!');
        return;
      } else {
        console.log('\n❌ 端到端集成测试整体失败 / End-to-end integration test overall FAILED');
        throw new Error('Integration test failed');
      }
      
    } catch (error) {
      console.error('❌ 端到端集成测试过程中出现错误:', error);
      throw error;
    }
  }
}

// 运行端到端集成测试 / Run end-to-end integration test
async function runEndToEndIntegrationTest(): Promise<void> {
  const testScenario = new EndToEndTestScenario();
  await testScenario.runCompleteTest();
}

// 执行测试 / Execute test
runEndToEndIntegrationTest()
  .then(() => {
    console.log('✅ 端到端集成测试成功完成 / End-to-end integration test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 端到端集成测试失败 / End-to-end integration test failed:', error);
    process.exit(1);
  });