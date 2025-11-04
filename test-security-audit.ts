/**
 * TitanChain安全审计测试
 * TitanChain Security Audit Test
 * 
 * 验证系统的安全性和抗攻击能力
 * Verify system security and attack resistance
 */

import { EnhancedParallelProcessor } from './blockchain/core/enhanced-parallel-processor';
import { TransactionPool } from './blockchain/core/transaction-pool';
import { Transaction } from './shared/types/blockchain';

// 安全测试结果接口 / Security Test Result Interface
interface SecurityTestResult {
  testName: string;
  passed: boolean;
  details: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations?: string[];
}

// 创建恶意交易 / Create malicious transaction
function createMaliciousTransaction(type: string, index: number): Transaction {
  const baseTransaction = {
    hash: `malicious-${type}-${index}-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
    from: `0x${'1'.repeat(40)}`, // 固定发送方 / Fixed sender
    to: `0x${'0'.repeat(40)}`, // 零地址 / Zero address
    value: 0,
    gas: 21000,
    gasPrice: 1,
    data: '0x',
    nonce: index,
    timestamp: Date.now(),
    blockNumber: 0,
    blockHash: '',
    transactionIndex: 0,
    status: 'pending',
    isZeroGas: false,
    contractTierFeeLevel: 0 as 0 | 1 | 2
  };

  switch (type) {
    case 'spam':
      // 垃圾交易攻击 / Spam transaction attack
      return {
        ...baseTransaction,
        value: 1, // 极小金额 / Minimal amount
        gasPrice: 1 // 极低Gas价格 / Minimal gas price
      };
      
    case 'gas_limit':
      // Gas限制攻击 / Gas limit attack
      return {
        ...baseTransaction,
        gas: 10000000, // 极高Gas限制 / Extremely high gas limit
        gasPrice: 1000
      };
      
    case 'zero_value':
      // 零值攻击 / Zero value attack
      return {
        ...baseTransaction,
        value: 0,
        gasPrice: 0
      };
      
    case 'invalid_nonce':
      // 无效Nonce攻击 / Invalid nonce attack
      return {
        ...baseTransaction,
        nonce: -1 // 无效nonce / Invalid nonce
      };
      
    case 'large_data':
      // 大数据攻击 / Large data attack
      return {
        ...baseTransaction,
        data: '0x' + 'a'.repeat(10000), // 大量数据 / Large amount of data
        gas: 1000000
      };
      
    default:
      return baseTransaction;
  }
}

// 创建正常交易 / Create normal transaction
function createNormalTransaction(index: number): Transaction {
  return {
    hash: `normal-tx-${index}-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`,
    from: `0x${Math.random().toString(16).substr(2, 40)}`,
    to: `0x${Math.random().toString(16).substr(2, 40)}`,
    value: Math.floor(Math.random() * 1000) + 100,
    gas: 21000 + Math.floor(Math.random() * 50000),
    gasPrice: 20 + Math.floor(Math.random() * 80),
    data: '0x',
    nonce: index,
    timestamp: Date.now(),
    blockNumber: 0,
    blockHash: '',
    transactionIndex: 0,
    status: 'pending',
    isZeroGas: index % 20 === 0,
    contractTierFeeLevel: Math.floor(Math.random() * 3) as 0 | 1 | 2
  };
}

// 安全审计测试类 / Security Audit Test Class
class SecurityAuditTest {
  private processor: EnhancedParallelProcessor;
  private transactionPool: TransactionPool;
  private testResults: SecurityTestResult[] = [];
  
  constructor() {
    this.processor = new EnhancedParallelProcessor();
    this.transactionPool = new TransactionPool();
  }
  
  // 运行所有安全测试 / Run all security tests
  async runAllSecurityTests(): Promise<SecurityTestResult[]> {
    console.log('🔒 开始TitanChain安全审计测试');
    console.log('='.repeat(60));
    
    try {
      await this.processor.startProcessing();
      console.log('✅ 安全测试环境已启动');
      
      // 1. 垃圾交易防护测试 / Spam transaction protection test
      await this.testSpamProtection();
      
      // 2. Gas限制攻击防护测试 / Gas limit attack protection test
      await this.testGasLimitProtection();
      
      // 3. 零值交易处理测试 / Zero value transaction handling test
      await this.testZeroValueHandling();
      
      // 4. 无效交易过滤测试 / Invalid transaction filtering test
      await this.testInvalidTransactionFiltering();
      
      // 5. 大数据攻击防护测试 / Large data attack protection test
      await this.testLargeDataProtection();
      
      // 6. 并发攻击防护测试 / Concurrent attack protection test
      await this.testConcurrentAttackProtection();
      
      // 7. 内存泄漏检测测试 / Memory leak detection test
      await this.testMemoryLeakDetection();
      
      // 8. 系统稳定性测试 / System stability test
      await this.testSystemStability();
      
      await this.processor.stopProcessing();
      console.log('✅ 安全测试环境已停止');
      
      return this.testResults;
      
    } catch (error) {
      console.error('❌ 安全审计测试执行失败:', error);
      throw error;
    }
  }
  
  // 垃圾交易防护测试 / Spam transaction protection test
  private async testSpamProtection(): Promise<void> {
    console.log('\n🛡️ 测试1: 垃圾交易防护 / Test 1: Spam Transaction Protection');
    
    const spamTransactions: Transaction[] = [];
    const normalTransactions: Transaction[] = [];
    
    // 创建大量垃圾交易 / Create many spam transactions
    for (let i = 0; i < 100; i++) {
      spamTransactions.push(createMaliciousTransaction('spam', i));
    }
    
    // 创建少量正常交易 / Create few normal transactions
    for (let i = 0; i < 20; i++) {
      normalTransactions.push(createNormalTransaction(i));
    }
    
    const startTime = Date.now();
    
    // 发送垃圾交易 / Send spam transactions
    let spamAccepted = 0;
    for (const tx of spamTransactions) {
      const accepted = await this.transactionPool.addTransaction(tx);
      if (accepted) spamAccepted++;
    }
    
    // 发送正常交易 / Send normal transactions
    let normalAccepted = 0;
    for (const tx of normalTransactions) {
      const accepted = await this.transactionPool.addTransaction(tx);
      if (accepted) normalAccepted++;
    }
    
    const processingTime = Date.now() - startTime;
    const spamRejectionRate = ((spamTransactions.length - spamAccepted) / spamTransactions.length) * 100;
    const normalAcceptanceRate = (normalAccepted / normalTransactions.length) * 100;
    
    const passed = spamRejectionRate >= 80 && normalAcceptanceRate >= 90;
    
    this.testResults.push({
      testName: '垃圾交易防护',
      passed,
      details: `垃圾交易拒绝率: ${spamRejectionRate.toFixed(2)}%, 正常交易接受率: ${normalAcceptanceRate.toFixed(2)}%, 处理时间: ${processingTime}ms`,
      riskLevel: passed ? 'low' : 'high',
      recommendations: passed ? [] : ['增强反垃圾邮件过滤机制', '实施更严格的交易验证']
    });
    
    console.log(`📊 垃圾交易拒绝率: ${spamRejectionRate.toFixed(2)}%`);
    console.log(`📊 正常交易接受率: ${normalAcceptanceRate.toFixed(2)}%`);
    console.log(`⏱️ 处理时间: ${processingTime}ms`);
    console.log(`${passed ? '✅' : '❌'} 垃圾交易防护测试${passed ? '通过' : '失败'}`);
  }
  
  // Gas限制攻击防护测试 / Gas limit attack protection test
  private async testGasLimitProtection(): Promise<void> {
    console.log('\n🛡️ 测试2: Gas限制攻击防护 / Test 2: Gas Limit Attack Protection');
    
    const gasAttackTransactions: Transaction[] = [];
    
    // 创建Gas攻击交易 / Create gas attack transactions
    for (let i = 0; i < 50; i++) {
      gasAttackTransactions.push(createMaliciousTransaction('gas_limit', i));
    }
    
    const startTime = Date.now();
    let attackAccepted = 0;
    
    // 发送Gas攻击交易 / Send gas attack transactions
    for (const tx of gasAttackTransactions) {
      const accepted = await this.transactionPool.addTransaction(tx);
      if (accepted) attackAccepted++;
    }
    
    const processingTime = Date.now() - startTime;
    const attackRejectionRate = ((gasAttackTransactions.length - attackAccepted) / gasAttackTransactions.length) * 100;
    
    const passed = attackRejectionRate >= 70;
    
    this.testResults.push({
      testName: 'Gas限制攻击防护',
      passed,
      details: `Gas攻击拒绝率: ${attackRejectionRate.toFixed(2)}%, 处理时间: ${processingTime}ms`,
      riskLevel: passed ? 'low' : 'medium',
      recommendations: passed ? [] : ['实施Gas限制检查', '添加异常Gas使用监控']
    });
    
    console.log(`📊 Gas攻击拒绝率: ${attackRejectionRate.toFixed(2)}%`);
    console.log(`⏱️ 处理时间: ${processingTime}ms`);
    console.log(`${passed ? '✅' : '❌'} Gas限制攻击防护测试${passed ? '通过' : '失败'}`);
  }
  
  // 零值交易处理测试 / Zero value transaction handling test
  private async testZeroValueHandling(): Promise<void> {
    console.log('\n🛡️ 测试3: 零值交易处理 / Test 3: Zero Value Transaction Handling');
    
    const zeroValueTransactions: Transaction[] = [];
    
    // 创建零值攻击交易 / Create zero value attack transactions
    for (let i = 0; i < 30; i++) {
      zeroValueTransactions.push(createMaliciousTransaction('zero_value', i));
    }
    
    const startTime = Date.now();
    let zeroValueAccepted = 0;
    
    // 发送零值交易 / Send zero value transactions
    for (const tx of zeroValueTransactions) {
      const accepted = await this.transactionPool.addTransaction(tx);
      if (accepted) zeroValueAccepted++;
    }
    
    const processingTime = Date.now() - startTime;
    const zeroValueHandlingRate = (zeroValueAccepted / zeroValueTransactions.length) * 100;
    
    // 零值交易应该被适当处理，不是完全拒绝 / Zero value transactions should be properly handled, not completely rejected
    const passed = zeroValueHandlingRate >= 50 && zeroValueHandlingRate <= 90;
    
    this.testResults.push({
      testName: '零值交易处理',
      passed,
      details: `零值交易处理率: ${zeroValueHandlingRate.toFixed(2)}%, 处理时间: ${processingTime}ms`,
      riskLevel: passed ? 'low' : 'medium',
      recommendations: passed ? [] : ['优化零值交易处理逻辑', '实施零值交易限制']
    });
    
    console.log(`📊 零值交易处理率: ${zeroValueHandlingRate.toFixed(2)}%`);
    console.log(`⏱️ 处理时间: ${processingTime}ms`);
    console.log(`${passed ? '✅' : '❌'} 零值交易处理测试${passed ? '通过' : '失败'}`);
  }
  
  // 无效交易过滤测试 / Invalid transaction filtering test
  private async testInvalidTransactionFiltering(): Promise<void> {
    console.log('\n🛡️ 测试4: 无效交易过滤 / Test 4: Invalid Transaction Filtering');
    
    const invalidTransactions: Transaction[] = [];
    
    // 创建无效交易 / Create invalid transactions
    for (let i = 0; i < 40; i++) {
      invalidTransactions.push(createMaliciousTransaction('invalid_nonce', i));
    }
    
    const startTime = Date.now();
    let invalidAccepted = 0;
    
    // 发送无效交易 / Send invalid transactions
    for (const tx of invalidTransactions) {
      const accepted = await this.transactionPool.addTransaction(tx);
      if (accepted) invalidAccepted++;
    }
    
    const processingTime = Date.now() - startTime;
    const invalidRejectionRate = ((invalidTransactions.length - invalidAccepted) / invalidTransactions.length) * 100;
    
    const passed = invalidRejectionRate >= 85;
    
    this.testResults.push({
      testName: '无效交易过滤',
      passed,
      details: `无效交易拒绝率: ${invalidRejectionRate.toFixed(2)}%, 处理时间: ${processingTime}ms`,
      riskLevel: passed ? 'low' : 'high',
      recommendations: passed ? [] : ['加强交易验证逻辑', '实施更严格的格式检查']
    });
    
    console.log(`📊 无效交易拒绝率: ${invalidRejectionRate.toFixed(2)}%`);
    console.log(`⏱️ 处理时间: ${processingTime}ms`);
    console.log(`${passed ? '✅' : '❌'} 无效交易过滤测试${passed ? '通过' : '失败'}`);
  }
  
  // 大数据攻击防护测试 / Large data attack protection test
  private async testLargeDataProtection(): Promise<void> {
    console.log('\n🛡️ 测试5: 大数据攻击防护 / Test 5: Large Data Attack Protection');
    
    const largeDataTransactions: Transaction[] = [];
    
    // 创建大数据攻击交易 / Create large data attack transactions
    for (let i = 0; i < 20; i++) {
      largeDataTransactions.push(createMaliciousTransaction('large_data', i));
    }
    
    const startTime = Date.now();
    let largeDataAccepted = 0;
    
    // 发送大数据交易 / Send large data transactions
    for (const tx of largeDataTransactions) {
      const accepted = await this.transactionPool.addTransaction(tx);
      if (accepted) largeDataAccepted++;
    }
    
    const processingTime = Date.now() - startTime;
    const largeDataRejectionRate = ((largeDataTransactions.length - largeDataAccepted) / largeDataTransactions.length) * 100;
    
    const passed = largeDataRejectionRate >= 60;
    
    this.testResults.push({
      testName: '大数据攻击防护',
      passed,
      details: `大数据攻击拒绝率: ${largeDataRejectionRate.toFixed(2)}%, 处理时间: ${processingTime}ms`,
      riskLevel: passed ? 'low' : 'medium',
      recommendations: passed ? [] : ['实施数据大小限制', '添加数据内容验证']
    });
    
    console.log(`📊 大数据攻击拒绝率: ${largeDataRejectionRate.toFixed(2)}%`);
    console.log(`⏱️ 处理时间: ${processingTime}ms`);
    console.log(`${passed ? '✅' : '❌'} 大数据攻击防护测试${passed ? '通过' : '失败'}`);
  }
  
  // 并发攻击防护测试 / Concurrent attack protection test
  private async testConcurrentAttackProtection(): Promise<void> {
    console.log('\n🛡️ 测试6: 并发攻击防护 / Test 6: Concurrent Attack Protection');
    
    const startTime = Date.now();
    const concurrentPromises: Promise<boolean>[] = [];
    
    // 并发发送多种类型的攻击交易 / Concurrently send multiple types of attack transactions
    for (let i = 0; i < 50; i++) {
      const attackType = ['spam', 'gas_limit', 'zero_value', 'large_data'][i % 4];
      const tx = createMaliciousTransaction(attackType, i);
      concurrentPromises.push(this.transactionPool.addTransaction(tx));
    }
    
    // 同时发送正常交易 / Send normal transactions simultaneously
    for (let i = 0; i < 20; i++) {
      const tx = createNormalTransaction(i);
      concurrentPromises.push(this.transactionPool.addTransaction(tx));
    }
    
    const results = await Promise.all(concurrentPromises);
    const processingTime = Date.now() - startTime;
    
    const acceptedCount = results.filter(result => result).length;
    const totalCount = results.length;
    const acceptanceRate = (acceptedCount / totalCount) * 100;
    
    // 在并发攻击下，系统应该保持稳定并适当过滤 / Under concurrent attacks, system should remain stable and filter appropriately
    const passed = acceptanceRate >= 20 && acceptanceRate <= 60 && processingTime < 10000;
    
    this.testResults.push({
      testName: '并发攻击防护',
      passed,
      details: `并发处理接受率: ${acceptanceRate.toFixed(2)}%, 处理时间: ${processingTime}ms`,
      riskLevel: passed ? 'low' : 'high',
      recommendations: passed ? [] : ['优化并发处理机制', '实施更好的负载均衡']
    });
    
    console.log(`📊 并发处理接受率: ${acceptanceRate.toFixed(2)}%`);
    console.log(`⏱️ 处理时间: ${processingTime}ms`);
    console.log(`${passed ? '✅' : '❌'} 并发攻击防护测试${passed ? '通过' : '失败'}`);
  }
  
  // 内存泄漏检测测试 / Memory leak detection test
  private async testMemoryLeakDetection(): Promise<void> {
    console.log('\n🛡️ 测试7: 内存泄漏检测 / Test 7: Memory Leak Detection');
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // 大量交易处理 / Process large number of transactions
    for (let batch = 0; batch < 5; batch++) {
      const transactions: Transaction[] = [];
      
      for (let i = 0; i < 100; i++) {
        transactions.push(createNormalTransaction(batch * 100 + i));
      }
      
      // 处理交易批次 / Process transaction batch
      for (const tx of transactions) {
        this.processor.addTransaction(tx);
      }
      
      // 等待处理 / Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 等待垃圾回收 / Wait for garbage collection
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
    
    // 内存增长应该在合理范围内 / Memory growth should be within reasonable range
    const passed = memoryIncreasePercent < 50;
    
    this.testResults.push({
      testName: '内存泄漏检测',
      passed,
      details: `内存增长: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${memoryIncreasePercent.toFixed(2)}%)`,
      riskLevel: passed ? 'low' : 'medium',
      recommendations: passed ? [] : ['检查内存管理', '优化对象生命周期']
    });
    
    console.log(`📊 初始内存: ${Math.round(initialMemory / 1024 / 1024)}MB`);
    console.log(`📊 最终内存: ${Math.round(finalMemory / 1024 / 1024)}MB`);
    console.log(`📊 内存增长: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${memoryIncreasePercent.toFixed(2)}%)`);
    console.log(`${passed ? '✅' : '❌'} 内存泄漏检测测试${passed ? '通过' : '失败'}`);
  }
  
  // 系统稳定性测试 / System stability test
  private async testSystemStability(): Promise<void> {
    console.log('\n🛡️ 测试8: 系统稳定性 / Test 8: System Stability');
    
    const startTime = Date.now();
    let errorCount = 0;
    let successCount = 0;
    
    try {
      // 持续负载测试 / Continuous load test
      for (let i = 0; i < 200; i++) {
        try {
          const tx = createNormalTransaction(i);
          const accepted = await this.transactionPool.addTransaction(tx);
          if (accepted) {
            successCount++;
          }
          
          // 每10个交易检查一次处理器状态 / Check processor status every 10 transactions
          if (i % 10 === 0) {
            const stats = this.processor.getProcessingStats();
            if (stats.totalFailed > stats.totalProcessed * 0.5) {
              errorCount++;
            }
          }
          
          // 短暂延迟 / Brief delay
          if (i % 20 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
        } catch (error) {
          errorCount++;
        }
      }
      
      const processingTime = Date.now() - startTime;
      const errorRate = (errorCount / 200) * 100;
      const successRate = (successCount / 200) * 100;
      
      // 系统应该保持稳定运行 / System should maintain stable operation
      const passed = errorRate < 10 && successRate > 70 && processingTime < 30000;
      
      this.testResults.push({
        testName: '系统稳定性',
        passed,
        details: `错误率: ${errorRate.toFixed(2)}%, 成功率: ${successRate.toFixed(2)}%, 运行时间: ${processingTime}ms`,
        riskLevel: passed ? 'low' : 'high',
        recommendations: passed ? [] : ['检查系统稳定性', '优化错误处理机制']
      });
      
      console.log(`📊 错误率: ${errorRate.toFixed(2)}%`);
      console.log(`📊 成功率: ${successRate.toFixed(2)}%`);
      console.log(`⏱️ 运行时间: ${processingTime}ms`);
      console.log(`${passed ? '✅' : '❌'} 系统稳定性测试${passed ? '通过' : '失败'}`);
      
    } catch (error) {
      console.error('❌ 系统稳定性测试出现严重错误:', error);
      
      this.testResults.push({
        testName: '系统稳定性',
        passed: false,
        details: `系统崩溃: ${error}`,
        riskLevel: 'critical',
        recommendations: ['立即检查系统稳定性', '修复关键错误']
      });
    }
  }
}

// 主测试函数 / Main test function
async function runSecurityAudit(): Promise<void> {
  console.log('🔒 开始TitanChain安全审计 / Starting TitanChain Security Audit');
  console.log('='.repeat(80));
  
  const auditTest = new SecurityAuditTest();
  
  try {
    const results = await auditTest.runAllSecurityTests();
    
    // 生成安全审计报告 / Generate security audit report
    console.log('\n📋 TitanChain安全审计报告 / TitanChain Security Audit Report');
    console.log('='.repeat(80));
    
    let passedTests = 0;
    let criticalIssues = 0;
    let highRiskIssues = 0;
    let mediumRiskIssues = 0;
    
    results.forEach((result, index) => {
      console.log(`\n🔍 测试 ${index + 1}: ${result.testName}`);
      console.log(`  状态: ${result.passed ? '✅ 通过' : '❌ 失败'}`);
      console.log(`  详情: ${result.details}`);
      console.log(`  风险等级: ${result.riskLevel.toUpperCase()}`);
      
      if (result.recommendations && result.recommendations.length > 0) {
        console.log(`  建议:`);
        result.recommendations.forEach(rec => {
          console.log(`    - ${rec}`);
        });
      }
      
      if (result.passed) passedTests++;
      
      switch (result.riskLevel) {
        case 'critical': criticalIssues++; break;
        case 'high': highRiskIssues++; break;
        case 'medium': mediumRiskIssues++; break;
      }
    });
    
    // 总体安全评估 / Overall security assessment
    const passRate = (passedTests / results.length) * 100;
    
    console.log('\n🎯 总体安全评估:');
    console.log(`测试通过率: ${passRate.toFixed(2)}% (${passedTests}/${results.length})`);
    console.log(`关键风险: ${criticalIssues}`);
    console.log(`高风险: ${highRiskIssues}`);
    console.log(`中等风险: ${mediumRiskIssues}`);
    
    // 安全等级评估 / Security grade assessment
    let securityGrade = 'F';
    let securityDescription = '安全性不达标';
    
    if (criticalIssues === 0 && highRiskIssues === 0 && passRate >= 90) {
      securityGrade = 'A+';
      securityDescription = '卓越安全性';
    } else if (criticalIssues === 0 && highRiskIssues <= 1 && passRate >= 80) {
      securityGrade = 'A';
      securityDescription = '优秀安全性';
    } else if (criticalIssues === 0 && highRiskIssues <= 2 && passRate >= 70) {
      securityGrade = 'B';
      securityDescription = '良好安全性';
    } else if (criticalIssues === 0 && passRate >= 60) {
      securityGrade = 'C';
      securityDescription = '及格安全性';
    } else if (criticalIssues <= 1 && passRate >= 50) {
      securityGrade = 'D';
      securityDescription = '基础安全性';
    }
    
    console.log(`\n🛡️ 安全等级: ${securityGrade} - ${securityDescription}`);
    
    if (securityGrade >= 'C') {
      console.log('\n🎉 安全审计通过! / Security audit PASSED!');
      console.log('✅ TitanChain系统具备良好的安全防护能力 / TitanChain system has good security protection capabilities');
    } else {
      console.log('\n⚠️ 安全审计需要改进 / Security audit needs improvement');
      console.log('❌ 系统存在安全风险，需要立即处理 / System has security risks that need immediate attention');
    }
    
  } catch (error) {
    console.error('❌ 安全审计过程中出现错误:', error);
    throw error;
  }
}

// 执行安全审计 / Execute security audit
runSecurityAudit()
  .then(() => {
    console.log('\n✅ 安全审计完成 / Security audit completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 安全审计失败 / Security audit failed:', error);
    process.exit(1);
  });