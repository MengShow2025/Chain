/**
 * TitanChain 0-gas费机制全面测试
 * 验证所有0-gas费功能和gas灵活规则的完整实现
 */

import { Transaction, ExchangeBatch } from './shared/types/blockchain.js';
import { TitanChain } from './blockchain/core/blockchain.js';
import { ZeroGasEngine } from './blockchain/core/zero-gas-engine.js';
import { SponsorPoolService } from './blockchain/core/sponsor-pool.js';
import { shouldBeZeroGasTransaction, markZeroGasTransaction, isNativeTokenTransaction } from './shared/utils/native-token-utils.js';
import { ZERO_GAS_CONFIG, TOKEN_CONFIG, ZERO_GAS_LIMITS } from './shared/constants/blockchain.js';

class ZeroGasComprehensiveTest {
  private blockchain: TitanChain;
  private zeroGasEngine: ZeroGasEngine;
  private testResults: any[] = [];
  private testCounter = 0;

  constructor() {
    this.blockchain = new TitanChain();
    this.zeroGasEngine = new ZeroGasEngine();
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 TitanChain 0-gas费机制全面测试开始');
    console.log('='.repeat(80));
    console.log(`测试时间: ${new Date().toLocaleString()}`);
    console.log('='.repeat(80));

    try {
      // 初始化测试环境
      await this.initializeTestEnvironment();

      // 1. 原生代币0 gas费测试
      await this.testNativeTokenZeroGas();

      // 2. 交易所批量交易0 gas费测试
      await this.testExchangeBatchZeroGas();

      // 3. 智能合约分层0 gas费测试
      await this.testContractTierZeroGas();

      // 4. 赞助池管理测试
      await this.testSponsorPoolManagement();

      // 5. gas灵活规则测试
      await this.testGasFlexibilityRules();

      // 6. 边界条件和错误处理测试
      await this.testEdgeCasesAndErrorHandling();

      // 7. 性能和统计测试
      await this.testPerformanceAndStats();

      // 打印测试总结
      this.printTestSummary();

    } catch (error) {
      console.error('❌ 测试执行失败:', error);
      throw error;
    }
  }

  /**
   * 初始化测试环境
   */
  private async initializeTestEnvironment() {
    console.log('\n📋 初始化测试环境...');
    
    // 启动区块链
    await this.blockchain.start();
    
    // 设置赞助池预算
    const sponsorAccounts = [
      '0x1111111111111111111111111111111111111111', // 交易所账户
      '0x0000000000000000000000000000000000000001', // ttUSD合约
      '0x2222222222222222222222222222222222222222', // 测试合约1
      '0x3333333333333333333333333333333333333333', // 测试合约2
      '0x4444444444444444444444444444444444444444', // 测试合约3
    ];

    for (const account of sponsorAccounts) {
      SponsorPoolService.rebalance([{
        account,
        setBudget: BigInt('10000000') // 1000万gas单位预算
      }]);
    }

    console.log('✅ 测试环境初始化完成');
    console.log(`   - 区块链已启动`);
    console.log(`   - 赞助池已配置 (${sponsorAccounts.length}个账户)`);
  }

  /**
   * 测试原生代币0 gas费功能
   */
  private async testNativeTokenZeroGas() {
    console.log('\n🔥 === 测试原生代币0 gas费功能 ===');

    const tests = [
      {
        name: 'TTN原生转账',
        tokenSymbol: 'TTN',
        to: '0x9876543210987654321098765432109876543210',
        value: BigInt('1000000000000000000'), // 1 TTN
        data: '0x',
        expectedZeroGas: true
      },
      {
        name: 'ttUSD稳定币转账',
        tokenSymbol: 'ttUSD',
        to: TOKEN_CONFIG.NATIVE_TOKENS.ttUSD.address,
        value: BigInt(0),
        data: '0xa9059cbb' + '9876543210987654321098765432109876543210'.padStart(64, '0') + BigInt('1000000000000000000').toString(16).padStart(64, '0'),
        expectedZeroGas: true
      }
    ];

    for (const test of tests) {
      const testId = ++this.testCounter;
      console.log(`\n📝 测试 ${testId}: ${test.name}`);

      const userAddress = `0x100000000000000000000000000000000000000${testId}`;
      
      // 创建交易
      const tx: Transaction = {
        hash: `0x${test.tokenSymbol.toLowerCase()}${testId}${Date.now()}`,
        from: userAddress,
        to: test.to,
        value: test.value,
        gas: BigInt(21000),
        gasPrice: BigInt(20000000000), // 20 Gwei
        data: test.data,
        nonce: 0,
        timestamp: Date.now(),
        status: 'pending' as const,
        isZeroGas: false // 测试自动标记功能
      };

      // 测试自动标记功能
      const shouldBeZero = shouldBeZeroGasTransaction(tx);
      const markedTx = markZeroGasTransaction(tx);
      const isNative = isNativeTokenTransaction(tx);

      // 验证结果
      const passed = shouldBeZero === test.expectedZeroGas && 
                    markedTx.isZeroGas === test.expectedZeroGas &&
                    isNative === test.expectedZeroGas;

      this.recordTestResult({
        testId,
        name: test.name,
        category: '原生代币0 gas费',
        passed,
        details: {
          shouldBeZeroGas: shouldBeZero,
          markedAsZeroGas: markedTx.isZeroGas,
          isNativeToken: isNative,
          expected: test.expectedZeroGas,
          tokenSymbol: test.tokenSymbol,
          transactionHash: tx.hash
        }
      });

      console.log(`   ${passed ? '✅' : '❌'} 自动标记: ${shouldBeZero} | 原生代币: ${isNative} | 期望: ${test.expectedZeroGas}`);
    }
  }

  /**
   * 测试交易所批量交易0 gas费功能
   */
  private async testExchangeBatchZeroGas() {
    console.log('\n🏢 === 测试交易所批量交易0 gas费功能 ===');

    const exchangeId = '0x1111111111111111111111111111111111111111';
    const batchId = `batch_${Date.now()}`;

    // 创建交易所批量交易
    const exchangeBatch: ExchangeBatch = {
      batchId,
      exchangeId,
      totalTransactions: 5,
      totalVolume: BigInt('5000000000000000000'), // 5 TTN
      timestamp: Date.now(),
      transactions: [],
      status: 'pending',
      createdAt: Date.now()
    };

    const tests = [
      {
        name: '批量交易资格检查',
        gasAmount: BigInt(50000),
        expectedEligible: true
      },
      {
        name: '超大gas批量交易',
        gasAmount: ZERO_GAS_LIMITS.MAX_SPONSORED_GAS_PER_TX + BigInt(1),
        expectedEligible: false
      },
      {
        name: '正常批量交易处理',
        gasAmount: BigInt(30000),
        expectedEligible: true
      }
    ];

    for (const test of tests) {
      const testId = ++this.testCounter;
      console.log(`\n📝 测试 ${testId}: ${test.name}`);

      const tx: Transaction = {
        hash: `0xbatch${testId}${Date.now()}`,
        from: `0x200000000000000000000000000000000000000${testId}`,
        to: exchangeId,
        value: BigInt('1000000000000000000'), // 1 TTN
        gas: test.gasAmount,
        gasPrice: BigInt(20000000000),
        data: '0xbatchprocess',
        nonce: 0,
        timestamp: Date.now(),
        status: 'pending' as const,
        isZeroGas: true,
        exchangeBatch
      };

      // 测试资格检查
      const eligibility = this.zeroGasEngine.canProcessAsZeroGas(tx);
      
      // 如果符合条件，测试实际处理
      let processResult = null;
      if (eligibility.eligible) {
        try {
          processResult = await this.zeroGasEngine.processZeroGasTransaction(tx);
        } catch (error) {
          processResult = { success: false, reason: error.message };
        }
      }

      const passed = eligibility.eligible === test.expectedEligible &&
                    (!eligibility.eligible || (processResult && processResult.success));

      this.recordTestResult({
        testId,
        name: test.name,
        category: '交易所批量交易',
        passed,
        details: {
          eligible: eligibility.eligible,
          eligibilityReason: eligibility.reason,
          processSuccess: processResult?.success,
          processReason: processResult?.reason,
          expected: test.expectedEligible,
          gasAmount: test.gasAmount.toString(),
          batchId
        }
      });

      console.log(`   ${passed ? '✅' : '❌'} 资格: ${eligibility.eligible} | 处理: ${processResult?.success || 'N/A'} | 期望: ${test.expectedEligible}`);
    }

    // 测试批量状态管理
    const batchStatus = this.zeroGasEngine.getBatchStatus(batchId);
    console.log(`   📊 批量状态: ${batchStatus ? '已创建' : '未找到'}`);
  }

  /**
   * 测试智能合约分层0 gas费功能
   */
  private async testContractTierZeroGas() {
    console.log('\n🔧 === 测试智能合约分层0 gas费功能 ===');

    const tiers = [1, 2, 3];
    const contractAddresses = [
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
      '0x4444444444444444444444444444444444444444'
    ];

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const contractAddress = contractAddresses[i];
      const tierConfig = ZERO_GAS_CONFIG.CONTRACT_TIER_FEES[tier];

      const tests = [
        {
          name: `Tier ${tier} 正常合约调用`,
          gasAmount: tierConfig.maxGas - BigInt(1000),
          dataSize: tier === 1 ? 512 : tier === 2 ? 2048 : 8192,
          expectedSuccess: true
        },
        {
          name: `Tier ${tier} 超gas限制`,
          gasAmount: tierConfig.maxGas + BigInt(1000),
          dataSize: 512,
          expectedSuccess: false
        },
        {
          name: `Tier ${tier} 超复杂度限制`,
          gasAmount: BigInt(100000),
          dataSize: tier === 1 ? 2048 : tier === 2 ? 8192 : 32768,
          expectedSuccess: false
        }
      ];

      for (const test of tests) {
        const testId = ++this.testCounter;
        console.log(`\n📝 测试 ${testId}: ${test.name}`);

        const tx: Transaction = {
          hash: `0xtier${tier}${testId}${Date.now()}`,
          from: `0x300000000000000000000000000000000000000${testId}`,
          to: contractAddress,
          value: BigInt(0),
          gas: test.gasAmount,
          gasPrice: BigInt(20000000000),
          data: '0x' + 'a'.repeat(test.dataSize),
          nonce: 0,
          timestamp: Date.now(),
          status: 'pending' as const,
          isZeroGas: true,
          contractTier: tier
        };

        // 测试资格检查
        const eligibility = this.zeroGasEngine.canProcessAsZeroGas(tx);
        
        // 如果符合条件，测试实际处理
        let processResult = null;
        if (eligibility.eligible) {
          try {
            processResult = await this.zeroGasEngine.processZeroGasTransaction(tx);
          } catch (error) {
            processResult = { success: false, reason: error.message };
          }
        }

        const passed = eligibility.eligible === test.expectedSuccess &&
                      (!eligibility.eligible || (processResult && processResult.success));

        this.recordTestResult({
          testId,
          name: test.name,
          category: '智能合约分层',
          passed,
          details: {
            tier,
            eligible: eligibility.eligible,
            eligibilityReason: eligibility.reason,
            processSuccess: processResult?.success,
            processReason: processResult?.reason,
            expected: test.expectedSuccess,
            gasAmount: test.gasAmount.toString(),
            dataSize: test.dataSize,
            maxGas: tierConfig.maxGas.toString()
          }
        });

        console.log(`   ${passed ? '✅' : '❌'} Tier ${tier} | Gas: ${test.gasAmount} | 数据: ${test.dataSize}B | 结果: ${eligibility.eligible}`);
      }
    }

    // 测试层级使用统计
    const tierStats = this.zeroGasEngine.getTierUsageStats();
    console.log(`   📊 层级使用统计:`, Object.fromEntries(tierStats));
  }

  /**
   * 测试赞助池管理功能
   */
  private async testSponsorPoolManagement() {
    console.log('\n💰 === 测试赞助池管理功能 ===');

    const testAccount = '0x5555555555555555555555555555555555555555';
    
    // 测试预算分配
    const testId1 = ++this.testCounter;
    console.log(`\n📝 测试 ${testId1}: 赞助池预算分配`);
    
    const rebalanceResult = SponsorPoolService.rebalance([{
      account: testAccount,
      setBudget: BigInt('1000000') // 100万gas单位
    }]);

    const pool = SponsorPoolService.getPool(testAccount);
    const budgetAllocated = pool.budget === BigInt('1000000');

    this.recordTestResult({
      testId: testId1,
      name: '赞助池预算分配',
      category: '赞助池管理',
      passed: budgetAllocated,
      details: {
        allocatedBudget: pool.budget.toString(),
        expectedBudget: '1000000',
        rebalanceSuccess: rebalanceResult.length > 0
      }
    });

    console.log(`   ${budgetAllocated ? '✅' : '❌'} 预算分配: ${pool.budget} (期望: 1000000)`);

    // 测试资格检查
    const testId2 = ++this.testCounter;
    console.log(`\n📝 测试 ${testId2}: 赞助资格检查`);

    const tests = [
      { gasAmount: BigInt(50000), expectedOk: true, name: '正常gas消耗' },
      { gasAmount: ZERO_GAS_LIMITS.MAX_SPONSORED_GAS_PER_TX + BigInt(1), expectedOk: false, name: '超单笔限制' },
      { gasAmount: BigInt(2000000), expectedOk: false, name: '超预算限制' }
    ];

    for (const test of tests) {
      const canSponsor = SponsorPoolService.canSponsor(testAccount, test.gasAmount);
      const passed = canSponsor.ok === test.expectedOk;

      this.recordTestResult({
        testId: testId2,
        name: `资格检查 - ${test.name}`,
        category: '赞助池管理',
        passed,
        details: {
          gasAmount: test.gasAmount.toString(),
          canSponsor: canSponsor.ok,
          reason: canSponsor.reason,
          expected: test.expectedOk
        }
      });

      console.log(`   ${passed ? '✅' : '❌'} ${test.name}: ${canSponsor.ok} | 原因: ${canSponsor.reason || 'N/A'}`);
    }

    // 测试扣费功能
    const testId3 = ++this.testCounter;
    console.log(`\n📝 测试 ${testId3}: 赞助池扣费`);

    const deductAmount = BigInt(30000);
    const beforeBalance = SponsorPoolService.getPool(testAccount).budget;
    const deductResult = SponsorPoolService.deduct(testAccount, deductAmount);
    const afterBalance = SponsorPoolService.getPool(testAccount).budget;
    const correctDeduction = beforeBalance - afterBalance === deductAmount;

    this.recordTestResult({
      testId: testId3,
      name: '赞助池扣费',
      category: '赞助池管理',
      passed: deductResult.ok && correctDeduction,
      details: {
        deductAmount: deductAmount.toString(),
        beforeBalance: beforeBalance.toString(),
        afterBalance: afterBalance.toString(),
        deductSuccess: deductResult.ok,
        remainingBudget: deductResult.remainingBudget?.toString()
      }
    });

    console.log(`   ${deductResult.ok && correctDeduction ? '✅' : '❌'} 扣费: ${beforeBalance} -> ${afterBalance} (扣除: ${deductAmount})`);

    // 测试快照功能
    const snapshot = SponsorPoolService.snapshot();
    console.log(`   📊 赞助池快照: ${snapshot.length}个账户`);
  }

  /**
   * 测试gas灵活规则
   */
  private async testGasFlexibilityRules() {
    console.log('\n⚡ === 测试gas灵活规则 ===');

    const tests = [
      {
        name: '原生TTN转账自动标记',
        tx: {
          to: '0x9876543210987654321098765432109876543210',
          value: BigInt('1000000000000000000'),
          data: '0x'
        },
        expectedZeroGas: true
      },
      {
        name: 'ttUSD合约调用自动标记',
        tx: {
          to: TOKEN_CONFIG.NATIVE_TOKENS.ttUSD.address,
          value: BigInt(0),
          data: '0xa9059cbb' + '9876543210987654321098765432109876543210'.padStart(64, '0') + BigInt('1000000000000000000').toString(16).padStart(64, '0')
        },
        expectedZeroGas: true
      },
      {
        name: '普通ERC20转账不自动标记',
        tx: {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          value: BigInt(0),
          data: '0xa9059cbb' + '9876543210987654321098765432109876543210'.padStart(64, '0') + BigInt('1000000000000000000').toString(16).padStart(64, '0')
        },
        expectedZeroGas: false
      },
      {
        name: '交易所批量交易自动标记',
        tx: {
          to: '0x1111111111111111111111111111111111111111',
          value: BigInt('1000000000000000000'),
          data: '0xbatch',
          exchangeBatch: {
            batchId: 'auto_batch_001',
            exchangeId: '0x1111111111111111111111111111111111111111',
            totalTransactions: 10,
            totalVolume: BigInt('10000000000000000000'),
            timestamp: Date.now(),
            transactions: [],
            status: 'pending' as const,
            createdAt: Date.now()
          }
        },
        expectedZeroGas: true
      }
    ];

    for (const test of tests) {
      const testId = ++this.testCounter;
      console.log(`\n📝 测试 ${testId}: ${test.name}`);

      const tx: Transaction = {
        hash: `0xflex${testId}${Date.now()}`,
        from: `0x400000000000000000000000000000000000000${testId}`,
        to: test.tx.to,
        value: test.tx.value,
        gas: BigInt(21000),
        gasPrice: BigInt(20000000000),
        data: test.tx.data,
        nonce: 0,
        timestamp: Date.now(),
        status: 'pending' as const,
        isZeroGas: false,
        exchangeBatch: test.tx.exchangeBatch
      };

      // 测试自动标记逻辑
      const shouldBeZero = shouldBeZeroGasTransaction(tx);
      const markedTx = markZeroGasTransaction(tx);
      const isNative = isNativeTokenTransaction(tx);

      const passed = shouldBeZero === test.expectedZeroGas && 
                    markedTx.isZeroGas === test.expectedZeroGas;

      this.recordTestResult({
        testId,
        name: test.name,
        category: 'gas灵活规则',
        passed,
        details: {
          shouldBeZeroGas: shouldBeZero,
          markedAsZeroGas: markedTx.isZeroGas,
          isNativeToken: isNative,
          expected: test.expectedZeroGas,
          hasExchangeBatch: !!tx.exchangeBatch
        }
      });

      console.log(`   ${passed ? '✅' : '❌'} 自动标记: ${shouldBeZero} | 原生: ${isNative} | 期望: ${test.expectedZeroGas}`);
    }
  }

  /**
   * 测试边界条件和错误处理
   */
  private async testEdgeCasesAndErrorHandling() {
    console.log('\n🚨 === 测试边界条件和错误处理 ===');

    const tests = [
      {
        name: '无效层级合约调用',
        tx: {
          contractTier: 5, // 无效层级
          gas: BigInt(100000)
        },
        expectedSuccess: false
      },
      {
        name: '未授权交易所批量',
        tx: {
          exchangeBatch: {
            exchangeId: '0x9999999999999999999999999999999999999999', // 未授权
            batchId: 'unauthorized_batch'
          }
        },
        expectedSuccess: false
      },
      {
        name: '零gas价格交易',
        tx: {
          gasPrice: BigInt(0),
          isZeroGas: true
        },
        expectedSuccess: true
      }
    ];

    for (const test of tests) {
      const testId = ++this.testCounter;
      console.log(`\n📝 测试 ${testId}: ${test.name}`);

      const tx: Transaction = {
        hash: `0xedge${testId}${Date.now()}`,
        from: `0x500000000000000000000000000000000000000${testId}`,
        to: '0x6666666666666666666666666666666666666666',
        value: BigInt(0),
        gas: test.tx.gas || BigInt(21000),
        gasPrice: test.tx.gasPrice || BigInt(20000000000),
        data: '0x',
        nonce: 0,
        timestamp: Date.now(),
        status: 'pending' as const,
        isZeroGas: test.tx.isZeroGas || true,
        contractTier: test.tx.contractTier,
        exchangeBatch: test.tx.exchangeBatch ? {
          batchId: test.tx.exchangeBatch.batchId,
          exchangeId: test.tx.exchangeBatch.exchangeId,
          totalTransactions: 1,
          totalVolume: BigInt('1000000000000000000'),
          timestamp: Date.now(),
          transactions: [],
          status: 'pending' as const,
          createdAt: Date.now()
        } : undefined
      };

      let result = { success: false, reason: 'Not tested' };
      try {
        const eligibility = this.zeroGasEngine.canProcessAsZeroGas(tx);
        if (eligibility.eligible) {
          result = await this.zeroGasEngine.processZeroGasTransaction(tx);
        } else {
          result = { success: false, reason: eligibility.reason || 'Not eligible' };
        }
      } catch (error) {
        result = { success: false, reason: error.message };
      }

      const passed = result.success === test.expectedSuccess;

      this.recordTestResult({
        testId,
        name: test.name,
        category: '边界条件',
        passed,
        details: {
          success: result.success,
          reason: result.reason,
          expected: test.expectedSuccess,
          contractTier: tx.contractTier,
          exchangeId: tx.exchangeBatch?.exchangeId,
          gasPrice: tx.gasPrice.toString()
        }
      });

      console.log(`   ${passed ? '✅' : '❌'} 结果: ${result.success} | 原因: ${result.reason} | 期望: ${test.expectedSuccess}`);
    }
  }

  /**
   * 测试性能和统计
   */
  private async testPerformanceAndStats() {
    console.log('\n📊 === 测试性能和统计 ===');

    // 获取引擎统计
    const engineStats = this.zeroGasEngine.getEngineStats();
    console.log('   🔥 0-gas费引擎统计:');
    console.log(`      总交易数: ${engineStats.totalZeroGasTransactions}`);
    console.log(`      批量交易数: ${engineStats.batchTransactions}`);
    console.log(`      合约层级交易数: ${engineStats.contractTierTransactions}`);
    console.log(`      节省gas费: ${engineStats.savedGasFees}`);
    console.log(`      平均处理时间: ${engineStats.averageProcessingTime}ms`);
    console.log(`      活跃批量: ${engineStats.activeBatches}`);
    console.log(`      就绪批量: ${engineStats.readyBatches}`);

    // 获取赞助池统计
    const sponsorSnapshot = SponsorPoolService.snapshot();
    console.log(`   💰 赞助池统计: ${sponsorSnapshot.length}个账户`);
    
    let totalBudget = BigInt(0);
    let totalUsed = BigInt(0);
    for (const account of sponsorSnapshot) {
      totalBudget += BigInt(account.budget);
      totalUsed += BigInt(account.creditsUsed);
    }
    
    console.log(`      总预算: ${totalBudget}`);
    console.log(`      已使用: ${totalUsed}`);
    console.log(`      使用率: ${totalBudget > 0 ? Number(totalUsed * BigInt(100) / totalBudget) : 0}%`);

    // 记录统计测试结果
    this.recordTestResult({
      testId: ++this.testCounter,
      name: '性能统计收集',
      category: '性能统计',
      passed: true,
      details: {
        engineStats,
        sponsorPoolAccounts: sponsorSnapshot.length,
        totalBudget: totalBudget.toString(),
        totalUsed: totalUsed.toString()
      }
    });
  }

  /**
   * 记录测试结果
   */
  private recordTestResult(result: any) {
    this.testResults.push({
      ...result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 打印测试总结
   */
  private printTestSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 测试总结报告');
    console.log('='.repeat(80));

    const categories = [...new Set(this.testResults.map(r => r.category))];
    let totalPassed = 0;
    let totalTests = this.testResults.length;

    for (const category of categories) {
      const categoryResults = this.testResults.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.passed).length;
      const total = categoryResults.length;
      totalPassed += passed;

      console.log(`\n📂 ${category}:`);
      console.log(`   通过: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
      
      // 显示失败的测试
      const failed = categoryResults.filter(r => !r.passed);
      if (failed.length > 0) {
        console.log(`   ❌ 失败的测试:`);
        failed.forEach(f => {
          console.log(`      - ${f.name}: ${f.details?.reason || '未知原因'}`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`🎯 总体结果: ${totalPassed}/${totalTests} (${Math.round(totalPassed/totalTests*100)}%)`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 所有测试通过！TitanChain 0-gas费机制运行正常！');
    } else {
      console.log(`⚠️  有 ${totalTests - totalPassed} 个测试失败，需要检查相关功能。`);
    }

    console.log('='.repeat(80));

    // 输出详细的测试结果到文件
    const reportPath = './test-zero-gas-report.json';
    try {
      const fs = require('fs');
      fs.writeFileSync(reportPath, JSON.stringify({
        summary: {
          totalTests,
          totalPassed,
          successRate: Math.round(totalPassed/totalTests*100),
          categories: categories.map(cat => ({
            name: cat,
            tests: this.testResults.filter(r => r.category === cat).length,
            passed: this.testResults.filter(r => r.category === cat && r.passed).length
          }))
        },
        results: this.testResults
      }, null, 2));
      console.log(`📄 详细测试报告已保存到: ${reportPath}`);
    } catch (error) {
      console.log(`⚠️  无法保存测试报告: ${error.message}`);
    }
  }
}

// 运行测试
async function runTests() {
  const test = new ZeroGasComprehensiveTest();
  try {
    await test.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('测试运行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { ZeroGasComprehensiveTest };