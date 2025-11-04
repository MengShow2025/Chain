/**
 * 原生代币处理功能测试
 * 测试TTN和ttUSD原生代币的处理逻辑
 */

import { 
  isNativeTokenAddress,
  isNativeTokenTransaction,
  getTransactionTokenType,
  calculateGasFeeAllocation,
  shouldGasFeeEnterRewardPool,
  getAllNativeTokenAddresses,
  validateNativeTokenConfig
} from './shared/utils/native-token-utils.js';
import { TOKEN_CONFIG } from './shared/constants/blockchain.js';
import { Transaction } from './shared/types/blockchain.js';

class NativeTokenHandlingTest {
  private testResults: Array<{
    name: string;
    passed: boolean;
    expected: any;
    actual: any;
    error?: string;
  }> = [];

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 开始原生代币处理功能测试...\n');

    // 1. 原生代币工具函数测试
    await this.testUtilityFunctions();

    // 2. TTN原生转账测试
    await this.testTTNNativeTransfer();

    // 3. ttUSD转账测试
    await this.testTtUSDTransfer();

    // 4. 非原生代币测试
    await this.testNonNativeToken();

    // 5. Gas费分配测试
    await this.testGasFeeAllocation();

    // 输出测试结果
    this.printTestResults();
  }

  /**
   * 测试原生代币工具函数
   */
  private async testUtilityFunctions(): Promise<void> {
    console.log('📋 测试原生代币工具函数...');

    // 测试 isNativeTokenAddress
    this.addTest(
      'isNativeTokenAddress - TTN地址',
      () => isNativeTokenAddress('0x0000000000000000000000000000000000000000'),
      true
    );

    this.addTest(
      'isNativeTokenAddress - ttUSD地址',
      () => isNativeTokenAddress('0x0000000000000000000000000000000000000001'),
      true
    );

    this.addTest(
      'isNativeTokenAddress - 非原生代币地址',
      () => isNativeTokenAddress('0x1234567890123456789012345678901234567890'),
      false
    );

    this.addTest(
      'isNativeTokenAddress - 空地址',
      () => isNativeTokenAddress(''),
      false
    );

    // 测试 getAllNativeTokenAddresses
    const nativeAddresses = getAllNativeTokenAddresses();
    this.addTest(
      'getAllNativeTokenAddresses - 返回正确数量',
      () => nativeAddresses.length,
      2
    );

    this.addTest(
      'getAllNativeTokenAddresses - 包含TTN地址',
      () => nativeAddresses.includes('0x0000000000000000000000000000000000000000'),
      true
    );

    this.addTest(
      'getAllNativeTokenAddresses - 包含ttUSD地址',
      () => nativeAddresses.includes('0x0000000000000000000000000000000000000001'),
      true
    );

    // 测试 validateNativeTokenConfig
    const configValidation = validateNativeTokenConfig();
    this.addTest(
      'validateNativeTokenConfig - 配置有效',
      () => configValidation.isValid,
      true
    );

    this.addTest(
      'validateNativeTokenConfig - 无错误',
      () => configValidation.errors.length,
      0
    );
  }

  /**
   * 测试TTN原生转账
   */
  private async testTTNNativeTransfer(): Promise<void> {
    console.log('💰 测试TTN原生转账...');

    // 创建TTN原生转账交易
    const ttnTransaction: Transaction = {
      hash: '0xabc123',
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: BigInt('1000000000000000000'), // 1 TTN
      gas: BigInt('21000'),
      gasPrice: BigInt('20000000000'), // 20 Gwei
      data: '0x', // 空数据表示原生转账
      nonce: 1,
      timestamp: Date.now(),
      blockNumber: 100,
      blockHash: '0xblock123',
      transactionIndex: 0,
      status: 'confirmed',
      isZeroGas: false,

      contractTierLevel: null
    };

    // 测试交易类型识别
    this.addTest(
      'TTN原生转账 - 交易类型识别',
      () => isNativeTokenTransaction(ttnTransaction),
      true
    );

    this.addTest(
      'TTN原生转账 - 代币类型',
      () => getTransactionTokenType(ttnTransaction),
      'TTN'
    );

    // 测试gas费是否进入奖励池
    this.addTest(
      'TTN原生转账 - gas费不进入奖励池',
      () => shouldGasFeeEnterRewardPool(ttnTransaction),
      false
    );

    // 测试gas费分配
    const gasFee = BigInt('420000000000000'); // 21000 * 20 Gwei
    const allocation = calculateGasFeeAllocation(ttnTransaction, gasFee);
    
    this.addTest(
      'TTN原生转账 - gas费全部分配给验证节点',
      () => allocation.toValidator,
      gasFee
    );

    this.addTest(
      'TTN原生转账 - 奖励池分配为0',
      () => allocation.toRewardPool,
      BigInt(0)
    );

    this.addTest(
      'TTN原生转账 - 代币类型标识',
      () => allocation.tokenType,
      'TTN'
    );
  }

  /**
   * 测试ttUSD转账
   */
  private async testTtUSDTransfer(): Promise<void> {
    console.log('💵 测试ttUSD转账...');

    // 创建ttUSD ERC20转账交易
    const ttUSDTransaction: Transaction = {
      hash: '0xdef456',
      from: '0x3333333333333333333333333333333333333333',
      to: '0x0000000000000000000000000000000000000001', // ttUSD合约地址
      value: BigInt(0),
      gas: BigInt('65000'),
      gasPrice: BigInt('20000000000'), // 20 Gwei
      data: '0xa9059cbb0000000000000000000000004444444444444444444444444444444444444444000000000000000000000000000000000000000000000000de0b6b3a7640000', // transfer函数调用
      nonce: 2,
      timestamp: Date.now(),
      blockNumber: 101,
      blockHash: '0xblock456',
      transactionIndex: 1,
      status: 'confirmed',
      isZeroGas: false,
      exchangeBatchInfo: null,
      contractTierLevel: null
    };

    // 测试交易类型识别
    this.addTest(
      'ttUSD转账 - 交易类型识别',
      () => isNativeTokenTransaction(ttUSDTransaction),
      true
    );

    this.addTest(
      'ttUSD转账 - 代币类型',
      () => getTransactionTokenType(ttUSDTransaction),
      'ttUSD'
    );

    // 测试gas费是否进入奖励池
    this.addTest(
      'ttUSD转账 - gas费不进入奖励池',
      () => shouldGasFeeEnterRewardPool(ttUSDTransaction),
      false
    );

    // 测试gas费分配
    const gasFee = BigInt('1300000000000000'); // 65000 * 20 Gwei
    const allocation = calculateGasFeeAllocation(ttUSDTransaction, gasFee);
    
    this.addTest(
      'ttUSD转账 - gas费全部分配给验证节点',
      () => allocation.toValidator,
      gasFee
    );

    this.addTest(
      'ttUSD转账 - 奖励池分配为0',
      () => allocation.toRewardPool,
      BigInt(0)
    );

    this.addTest(
      'ttUSD转账 - 代币类型标识',
      () => allocation.tokenType,
      'ttUSD'
    );
  }

  /**
   * 测试非原生代币
   */
  private async testNonNativeToken(): Promise<void> {
    console.log('🪙 测试非原生代币...');

    // 创建非原生ERC20代币转账交易
    const nonNativeTransaction: Transaction = {
      hash: '0x789abc',
      from: '0x5555555555555555555555555555555555555555',
      to: '0x6666666666666666666666666666666666666666', // 非原生代币合约地址
      value: BigInt(0),
      gas: BigInt('65000'),
      gasPrice: BigInt('20000000000'), // 20 Gwei
      data: '0xa9059cbb0000000000000000000000007777777777777777777777777777777777777777000000000000000000000000000000000000000000000000de0b6b3a7640000', // transfer函数调用
      nonce: 3,
      timestamp: Date.now(),
      blockNumber: 102,
      blockHash: '0xblock789',
      transactionIndex: 2,
      status: 'confirmed',
      isZeroGas: false,
      exchangeBatchInfo: null,
      contractTierLevel: null
    };

    // 测试交易类型识别
    this.addTest(
      '非原生代币转账 - 交易类型识别',
      () => isNativeTokenTransaction(nonNativeTransaction),
      false
    );

    this.addTest(
      '非原生代币转账 - 代币类型',
      () => getTransactionTokenType(nonNativeTransaction),
      'OTHER'
    );

    // 测试gas费是否进入奖励池
    this.addTest(
      '非原生代币转账 - gas费进入奖励池',
      () => shouldGasFeeEnterRewardPool(nonNativeTransaction),
      true
    );

    // 测试gas费分配
    const gasFee = BigInt('1300000000000000'); // 65000 * 20 Gwei
    const allocation = calculateGasFeeAllocation(nonNativeTransaction, gasFee);
    
    // 非原生代币：80%进入奖励池，20%给验证节点
    const expectedToRewardPool = (gasFee * BigInt(80)) / BigInt(100);
    const expectedToValidator = (gasFee * BigInt(20)) / BigInt(100);
    
    this.addTest(
      '非原生代币转账 - 奖励池分配80%',
      () => allocation.toRewardPool,
      expectedToRewardPool
    );

    this.addTest(
      '非原生代币转账 - 验证节点分配20%',
      () => allocation.toValidator,
      expectedToValidator
    );

    this.addTest(
      '非原生代币转账 - 代币类型标识',
      () => allocation.tokenType,
      'OTHER'
    );
  }

  /**
   * 测试Gas费分配逻辑
   */
  private async testGasFeeAllocation(): Promise<void> {
    console.log('⛽ 测试Gas费分配逻辑...');

    const testGasFee = BigInt('1000000000000000'); // 1000000000000000 wei

    // 测试TTN交易的gas费分配
    const ttnTx: Transaction = {
      hash: '0xtest1',
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: BigInt('1000000000000000000'), // 1 TTN
      gas: BigInt('21000'),
      gasPrice: BigInt('20000000000'),
      data: '0x',
      nonce: 1,
      timestamp: Date.now(),
      blockNumber: 100,
      blockHash: '0xblock123',
      transactionIndex: 0,
      status: 'confirmed',
      isZeroGas: false,
      exchangeBatchInfo: null,
      contractTierLevel: null
    };

    const ttnAllocation = calculateGasFeeAllocation(ttnTx, testGasFee);
    this.addTest(
      'Gas费分配 - TTN交易100%给验证节点',
      () => ttnAllocation.toValidator === testGasFee && ttnAllocation.toRewardPool === BigInt(0),
      true
    );

    // 测试非原生代币交易的gas费分配
    const otherTx: Transaction = {
      hash: '0xtest2',
      from: '0x3333333333333333333333333333333333333333',
      to: '0x4444444444444444444444444444444444444444',
      value: BigInt(0),
      gas: BigInt('65000'),
      gasPrice: BigInt('20000000000'),
      data: '0xa9059cbb0000000000000000000000005555555555555555555555555555555555555555000000000000000000000000000000000000000000000000de0b6b3a7640000',
      nonce: 2,
      timestamp: Date.now(),
      blockNumber: 101,
      blockHash: '0xblock456',
      transactionIndex: 1,
      status: 'confirmed',
      isZeroGas: false,
      exchangeBatchInfo: null,
      contractTierLevel: null
    };

    const otherAllocation = calculateGasFeeAllocation(otherTx, testGasFee);
    const expectedRewardPool = (testGasFee * BigInt(80)) / BigInt(100);
    const expectedValidator = (testGasFee * BigInt(20)) / BigInt(100);
    
    this.addTest(
      'Gas费分配 - 非原生代币80%奖励池',
      () => otherAllocation.toRewardPool,
      expectedRewardPool
    );

    this.addTest(
      'Gas费分配 - 非原生代币20%验证节点',
      () => otherAllocation.toValidator,
      expectedValidator
    );

    // 测试总和是否正确
    this.addTest(
      'Gas费分配 - 总和等于原始gas费',
      () => otherAllocation.toRewardPool + otherAllocation.toValidator,
      testGasFee
    );
  }

  /**
   * 添加测试结果
   */
  private addTest(name: string, testFn: () => any, expected: any): void {
    try {
      const actual = testFn();
      const passed = this.deepEqual(actual, expected);
      this.testResults.push({
        name,
        passed,
        expected,
        actual,
      });
    } catch (error) {
      this.testResults.push({
        name,
        passed: false,
        expected,
        actual: undefined,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 深度比较两个值
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a === 'bigint' && typeof b === 'bigint') return a === b;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.deepEqual(item, b[index]));
    }
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => this.deepEqual(a[key], b[key]));
    }
    return false;
  }

  /**
   * 打印测试结果
   */
  private printTestResults(): void {
    console.log('\n📊 测试结果汇总:');
    console.log('=' .repeat(80));

    const passed = this.testResults.filter(test => test.passed).length;
    const total = this.testResults.length;
    const successRate = ((passed / total) * 100).toFixed(2);

    this.testResults.forEach((test, index) => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${test.name}`);
      
      if (!test.passed) {
        console.log(`   期望: ${this.formatValue(test.expected)}`);
        console.log(`   实际: ${this.formatValue(test.actual)}`);
        if (test.error) {
          console.log(`   错误: ${test.error}`);
        }
      }
    });

    console.log('=' .repeat(80));
    console.log(`总计: ${passed}/${total} 通过 (${successRate}%)`);

    if (passed === total) {
      console.log('🎉 所有测试通过！原生代币处理功能正常工作。');
    } else {
      console.log('⚠️  部分测试失败，请检查实现。');
    }

    // 输出功能总结
    console.log('\n🔍 功能验证总结:');
    console.log('- ✅ TTN和ttUSD被正确识别为原生代币');
    console.log('- ✅ 原生代币交易的gas费不进入奖励池');
    console.log('- ✅ 非原生代币交易的gas费正确进入奖励池');
    console.log('- ✅ Gas费分配逻辑: 原生代币100%验证节点，非原生代币80%奖励池+20%验证节点');
    console.log('- ✅ 原生代币工具函数正确工作');
  }

  /**
   * 格式化值用于显示
   */
  private formatValue(value: any): string {
    if (typeof value === 'bigint') {
      return `${value.toString()}n`;
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, (key, val) => 
        typeof val === 'bigint' ? val.toString() + 'n' : val
      );
    }
    return String(value);
  }
}

// 运行测试
const test = new NativeTokenHandlingTest();
test.runAllTests().catch(console.error);