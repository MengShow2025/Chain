#!/usr/bin/env node
/**
 * Automated API Testing Suite / 自动化API测试套件
 * Comprehensive automated testing with test case generation, data simulation, and result analysis
 * 全面的自动化测试，包括测试用例生成、数据模拟和结果分析
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Automation test configuration / 自动化测试配置
interface AutomationTestConfig {
  baseUrl: string;
  gatewayUrl: string;
  timeout: number;
  maxRetries: number;
  testDataSize: number;           // Number of test data entries to generate / 生成的测试数据条目数
  performanceThreshold: number;   // Performance threshold in ms / 性能阈值(毫秒)
  regressionBaseline: string;     // Path to baseline results file / 基线结果文件路径
  reportOutputPath: string;       // Path for test reports / 测试报告输出路径
  enableRegression: boolean;      // Enable regression testing / 启用回归测试
  enablePerformanceBenchmark: boolean; // Enable performance benchmarking / 启用性能基准测试
}

const config: AutomationTestConfig = {
  baseUrl: 'http://localhost:3001',
  gatewayUrl: 'http://localhost:8889',
  timeout: 30000,
  maxRetries: 3,
  testDataSize: 1000,
  performanceThreshold: 2000, // 2 seconds / 2秒
  regressionBaseline: './test-results/baseline.json',
  reportOutputPath: './test-results',
  enableRegression: true,
  enablePerformanceBenchmark: true
};

// Test case interfaces / 测试用例接口
interface TestCase {
  id: string;
  name: string;
  category: string;
  endpoint: string;
  method: string;
  data?: any;
  headers?: any;
  expectedStatus?: number;
  expectedResponseTime?: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tags: string[];
  description: string;
}

interface TestResult {
  testCaseId: string;
  name: string;
  category: string;
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';
  statusCode?: number;
  responseTime: number;
  timestamp: string;
  error?: string;
  performanceScore?: number;
  memoryUsage?: number;
  details?: any;
}

interface PerformanceBenchmark {
  endpoint: string;
  method: string;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // requests per second / 每秒请求数
  errorRate: number;
  timestamp: string;
}

interface RegressionResult {
  testCaseId: string;
  baseline: TestResult;
  current: TestResult;
  performanceDelta: number; // Percentage change / 性能变化百分比
  statusChanged: boolean;
  regressionType: 'PERFORMANCE' | 'FUNCTIONAL' | 'NONE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Test data generator / 测试数据生成器
class TestDataGenerator {
  // Generate realistic blockchain addresses / 生成真实的区块链地址
  static generateAddress(): string {
    return '0x' + crypto.randomBytes(20).toString('hex');
  }

  // Generate transaction hash / 生成交易哈希
  static generateTxHash(): string {
    return '0x' + crypto.randomBytes(32).toString('hex');
  }

  // Generate block hash / 生成区块哈希
  static generateBlockHash(): string {
    return '0x' + crypto.randomBytes(32).toString('hex');
  }

  // Generate random amount / 生成随机金额
  static generateAmount(min: number = 1, max: number = 1000000): string {
    const amount = Math.floor(Math.random() * (max - min + 1)) + min;
    return amount.toString();
  }

  // Generate realistic user data / 生成真实的用户数据
  static generateUserData(): any {
    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    
    return {
      id: crypto.randomUUID(),
      username: `user_${Math.random().toString(36).substr(2, 8)}`,
      email: `test${Math.random().toString(36).substr(2, 5)}@example.com`,
      firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
      lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
      address: this.generateAddress(),
      balance: this.generateAmount(),
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  // Generate transaction data / 生成交易数据
  static generateTransactionData(): any {
    return {
      id: crypto.randomUUID(),
      hash: this.generateTxHash(),
      from: this.generateAddress(),
      to: this.generateAddress(),
      value: this.generateAmount(),
      gasPrice: Math.floor(Math.random() * 100) + 20,
      gasLimit: Math.floor(Math.random() * 100000) + 21000,
      nonce: Math.floor(Math.random() * 1000),
      data: '0x' + crypto.randomBytes(Math.floor(Math.random() * 100)).toString('hex'),
      timestamp: new Date().toISOString()
    };
  }

  // Generate block data / 生成区块数据
  static generateBlockData(): any {
    return {
      number: Math.floor(Math.random() * 1000000),
      hash: this.generateBlockHash(),
      parentHash: this.generateBlockHash(),
      timestamp: new Date().toISOString(),
      miner: this.generateAddress(),
      difficulty: Math.floor(Math.random() * 1000000000000),
      gasUsed: Math.floor(Math.random() * 8000000),
      gasLimit: 8000000,
      transactions: Array.from({ length: Math.floor(Math.random() * 50) }, () => this.generateTxHash())
    };
  }

  // Generate test dataset / 生成测试数据集
  static generateTestDataset(size: number): any {
    return {
      users: Array.from({ length: size }, () => this.generateUserData()),
      transactions: Array.from({ length: size * 2 }, () => this.generateTransactionData()),
      blocks: Array.from({ length: Math.floor(size / 10) }, () => this.generateBlockData()),
      addresses: Array.from({ length: size }, () => this.generateAddress()),
      amounts: Array.from({ length: size }, () => this.generateAmount())
    };
  }
}

// Test case generator / 测试用例生成器
class TestCaseGenerator {
  private testData: any;

  constructor(testData: any) {
    this.testData = testData;
  }

  // Generate comprehensive test cases / 生成全面的测试用例
  generateTestCases(): TestCase[] {
    const testCases: TestCase[] = [];

    // Blockchain API test cases / 区块链API测试用例
    testCases.push(...this.generateBlockchainTestCases());
    
    // Transaction API test cases / 交易API测试用例
    testCases.push(...this.generateTransactionTestCases());
    
    // Wallet API test cases / 钱包API测试用例
    testCases.push(...this.generateWalletTestCases());
    
    // Validator API test cases / 验证者API测试用例
    testCases.push(...this.generateValidatorTestCases());
    
    // Security API test cases / 安全API测试用例
    testCases.push(...this.generateSecurityTestCases());
    
    // Performance test cases / 性能测试用例
    testCases.push(...this.generatePerformanceTestCases());

    return testCases;
  }

  private generateBlockchainTestCases(): TestCase[] {
    const cases: TestCase[] = [];
    
    // Basic blockchain operations / 基本区块链操作
    cases.push({
      id: 'blockchain-001',
      name: 'Get Blockchain Status',
      category: 'blockchain',
      endpoint: '/api/blockchain/status',
      method: 'GET',
      expectedStatus: 200,
      expectedResponseTime: 1000,
      priority: 'HIGH',
      tags: ['blockchain', 'status', 'basic'],
      description: 'Verify blockchain status endpoint returns current network state'
    });

    cases.push({
      id: 'blockchain-002',
      name: 'Get Latest Block',
      category: 'blockchain',
      endpoint: '/api/blockchain/blocks/latest',
      method: 'GET',
      expectedStatus: 200,
      expectedResponseTime: 1500,
      priority: 'HIGH',
      tags: ['blockchain', 'blocks', 'latest'],
      description: 'Retrieve the most recent block from the blockchain'
    });

    // Dynamic block queries / 动态区块查询
    this.testData.blocks.slice(0, 10).forEach((block: any, index: number) => {
      cases.push({
        id: `blockchain-block-${index + 3}`,
        name: `Get Block by Number ${block.number}`,
        category: 'blockchain',
        endpoint: `/api/blockchain/blocks/${block.number}`,
        method: 'GET',
        expectedStatus: 200,
        expectedResponseTime: 1200,
        priority: 'MEDIUM',
        tags: ['blockchain', 'blocks', 'query'],
        description: `Retrieve specific block by number: ${block.number}`
      });
    });

    return cases;
  }

  private generateTransactionTestCases(): TestCase[] {
    const cases: TestCase[] = [];
    
    // Transaction submission / 交易提交
    this.testData.transactions.slice(0, 20).forEach((tx: any, index: number) => {
      cases.push({
        id: `transaction-submit-${index + 1}`,
        name: `Submit Transaction ${index + 1}`,
        category: 'transactions',
        endpoint: '/api/transactions/submit',
        method: 'POST',
        data: {
          from: tx.from,
          to: tx.to,
          value: tx.value,
          gasPrice: tx.gasPrice,
          gasLimit: tx.gasLimit,
          data: tx.data
        },
        expectedStatus: 200,
        expectedResponseTime: 2000,
        priority: 'CRITICAL',
        tags: ['transactions', 'submit', 'write'],
        description: `Submit a new transaction from ${tx.from} to ${tx.to}`
      });
    });

    // Transaction queries / 交易查询
    this.testData.transactions.slice(0, 15).forEach((tx: any, index: number) => {
      cases.push({
        id: `transaction-query-${index + 1}`,
        name: `Get Transaction ${tx.hash}`,
        category: 'transactions',
        endpoint: `/api/transactions/${tx.hash}`,
        method: 'GET',
        expectedStatus: 200,
        expectedResponseTime: 1000,
        priority: 'HIGH',
        tags: ['transactions', 'query', 'read'],
        description: `Retrieve transaction details for hash: ${tx.hash}`
      });
    });

    return cases;
  }

  private generateWalletTestCases(): TestCase[] {
    const cases: TestCase[] = [];
    
    // Wallet operations / 钱包操作
    this.testData.addresses.slice(0, 10).forEach((address: string, index: number) => {
      cases.push({
        id: `wallet-balance-${index + 1}`,
        name: `Get Wallet Balance ${address}`,
        category: 'wallet',
        endpoint: `/api/wallet/balance/${address}`,
        method: 'GET',
        expectedStatus: 200,
        expectedResponseTime: 800,
        priority: 'HIGH',
        tags: ['wallet', 'balance', 'query'],
        description: `Get balance for wallet address: ${address}`
      });
    });

    // Wallet creation / 钱包创建
    for (let i = 0; i < 5; i++) {
      cases.push({
        id: `wallet-create-${i + 1}`,
        name: `Create New Wallet ${i + 1}`,
        category: 'wallet',
        endpoint: '/api/wallet/create',
        method: 'POST',
        data: {
          password: `test_password_${i}`,
          keystore: true
        },
        expectedStatus: 201,
        expectedResponseTime: 3000,
        priority: 'CRITICAL',
        tags: ['wallet', 'create', 'write'],
        description: `Create a new wallet with keystore`
      });
    }

    return cases;
  }

  private generateValidatorTestCases(): TestCase[] {
    const cases: TestCase[] = [];
    
    // Validator status / 验证者状态
    cases.push({
      id: 'validator-001',
      name: 'Get Validator List',
      category: 'validators',
      endpoint: '/api/validators',
      method: 'GET',
      expectedStatus: 200,
      expectedResponseTime: 1500,
      priority: 'HIGH',
      tags: ['validators', 'list', 'query'],
      description: 'Retrieve list of active validators'
    });

    // Staking operations / 质押操作
    this.testData.addresses.slice(0, 5).forEach((address: string, index: number) => {
      const amount = this.testData.amounts[index];
      cases.push({
        id: `validator-stake-${index + 1}`,
        name: `Stake Tokens ${address}`,
        category: 'validators',
        endpoint: '/api/validators/stake',
        method: 'POST',
        data: {
          validatorAddress: address,
          amount: amount,
          delegator: TestDataGenerator.generateAddress()
        },
        expectedStatus: 200,
        expectedResponseTime: 2500,
        priority: 'CRITICAL',
        tags: ['validators', 'stake', 'write'],
        description: `Stake ${amount} tokens to validator ${address}`
      });
    });

    return cases;
  }

  private generateSecurityTestCases(): TestCase[] {
    const cases: TestCase[] = [];
    
    // Authentication tests / 认证测试
    cases.push({
      id: 'security-001',
      name: 'Authentication Required',
      category: 'security',
      endpoint: '/api/admin/settings',
      method: 'GET',
      expectedStatus: 401,
      expectedResponseTime: 500,
      priority: 'CRITICAL',
      tags: ['security', 'auth', 'access-control'],
      description: 'Verify authentication is required for admin endpoints'
    });

    // Rate limiting tests / 限流测试
    cases.push({
      id: 'security-002',
      name: 'Rate Limiting Check',
      category: 'security',
      endpoint: '/api/health',
      method: 'GET',
      expectedStatus: 429,
      expectedResponseTime: 100,
      priority: 'HIGH',
      tags: ['security', 'rate-limit', 'protection'],
      description: 'Verify rate limiting is enforced'
    });

    return cases;
  }

  private generatePerformanceTestCases(): TestCase[] {
    const cases: TestCase[] = [];
    
    // Load testing scenarios / 负载测试场景
    cases.push({
      id: 'performance-001',
      name: 'High Load Blockchain Status',
      category: 'performance',
      endpoint: '/api/blockchain/status',
      method: 'GET',
      expectedStatus: 200,
      expectedResponseTime: 1000,
      priority: 'MEDIUM',
      tags: ['performance', 'load', 'blockchain'],
      description: 'Test blockchain status under high load'
    });

    cases.push({
      id: 'performance-002',
      name: 'Concurrent Transaction Submission',
      category: 'performance',
      endpoint: '/api/transactions/submit',
      method: 'POST',
      data: TestDataGenerator.generateTransactionData(),
      expectedStatus: 200,
      expectedResponseTime: 2000,
      priority: 'HIGH',
      tags: ['performance', 'concurrent', 'transactions'],
      description: 'Test concurrent transaction submission performance'
    });

    return cases;
  }
}

// Performance benchmark analyzer / 性能基准分析器
class PerformanceBenchmarkAnalyzer {
  private benchmarks: PerformanceBenchmark[] = [];

  addBenchmark(benchmark: PerformanceBenchmark): void {
    this.benchmarks.push(benchmark);
  }

  // Analyze performance trends / 分析性能趋势
  analyzePerformanceTrends(): any {
    const endpointGroups = this.groupByEndpoint();
    const analysis: any = {};

    for (const [endpoint, benchmarks] of Object.entries(endpointGroups)) {
      const sortedBenchmarks = (benchmarks as PerformanceBenchmark[]).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      if (sortedBenchmarks.length < 2) continue;

      const latest = sortedBenchmarks[sortedBenchmarks.length - 1];
      const previous = sortedBenchmarks[sortedBenchmarks.length - 2];

      const responseTimeTrend = ((latest.avgResponseTime - previous.avgResponseTime) / previous.avgResponseTime) * 100;
      const throughputTrend = ((latest.throughput - previous.throughput) / previous.throughput) * 100;
      const errorRateTrend = ((latest.errorRate - previous.errorRate) / (previous.errorRate || 0.01)) * 100;

      analysis[endpoint] = {
        current: latest,
        previous: previous,
        trends: {
          responseTime: {
            change: responseTimeTrend,
            status: this.getTrendStatus(responseTimeTrend, 'responseTime')
          },
          throughput: {
            change: throughputTrend,
            status: this.getTrendStatus(throughputTrend, 'throughput')
          },
          errorRate: {
            change: errorRateTrend,
            status: this.getTrendStatus(errorRateTrend, 'errorRate')
          }
        },
        recommendation: this.generatePerformanceRecommendation(latest, responseTimeTrend, throughputTrend, errorRateTrend)
      };
    }

    return analysis;
  }

  private groupByEndpoint(): { [key: string]: PerformanceBenchmark[] } {
    return this.benchmarks.reduce((groups, benchmark) => {
      const key = `${benchmark.method} ${benchmark.endpoint}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(benchmark);
      return groups;
    }, {} as { [key: string]: PerformanceBenchmark[] });
  }

  private getTrendStatus(change: number, metric: string): string {
    if (metric === 'responseTime' || metric === 'errorRate') {
      // Lower is better for response time and error rate / 响应时间和错误率越低越好
      if (change <= -10) return 'EXCELLENT';
      if (change <= -5) return 'GOOD';
      if (change <= 5) return 'STABLE';
      if (change <= 15) return 'CONCERNING';
      return 'CRITICAL';
    } else {
      // Higher is better for throughput / 吞吐量越高越好
      if (change >= 10) return 'EXCELLENT';
      if (change >= 5) return 'GOOD';
      if (change >= -5) return 'STABLE';
      if (change >= -15) return 'CONCERNING';
      return 'CRITICAL';
    }
  }

  private generatePerformanceRecommendation(
    benchmark: PerformanceBenchmark,
    responseTimeTrend: number,
    throughputTrend: number,
    errorRateTrend: number
  ): string {
    const recommendations: string[] = [];

    if (benchmark.avgResponseTime > config.performanceThreshold) {
      recommendations.push('Response time exceeds threshold - consider optimization');
    }

    if (responseTimeTrend > 15) {
      recommendations.push('Response time degrading - investigate performance bottlenecks');
    }

    if (throughputTrend < -15) {
      recommendations.push('Throughput declining - check system resources and scaling');
    }

    if (benchmark.errorRate > 0.05) {
      recommendations.push('High error rate detected - investigate error causes');
    }

    if (errorRateTrend > 50) {
      recommendations.push('Error rate increasing rapidly - immediate investigation required');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance metrics within acceptable ranges');
    }

    return recommendations.join('; ');
  }
}

// Regression test analyzer / 回归测试分析器
class RegressionTestAnalyzer {
  // Compare current results with baseline / 将当前结果与基线比较
  async compareWithBaseline(currentResults: TestResult[]): Promise<RegressionResult[]> {
    try {
      const baselineData = await fs.readFile(config.regressionBaseline, 'utf-8');
      const baselineResults: TestResult[] = JSON.parse(baselineData);
      
      return this.performRegressionAnalysis(baselineResults, currentResults);
    } catch (error) {
      console.log('📝 No baseline found, creating new baseline...');
      await this.saveBaseline(currentResults);
      return [];
    }
  }

  private performRegressionAnalysis(baseline: TestResult[], current: TestResult[]): RegressionResult[] {
    const regressions: RegressionResult[] = [];
    
    // Create lookup maps / 创建查找映射
    const baselineMap = new Map(baseline.map(r => [r.testCaseId, r]));
    const currentMap = new Map(current.map(r => [r.testCaseId, r]));

    // Analyze each test case / 分析每个测试用例
    for (const [testCaseId, currentResult] of currentMap) {
      const baselineResult = baselineMap.get(testCaseId);
      
      if (!baselineResult) {
        // New test case / 新测试用例
        continue;
      }

      const performanceDelta = ((currentResult.responseTime - baselineResult.responseTime) / baselineResult.responseTime) * 100;
      const statusChanged = currentResult.status !== baselineResult.status;
      
      let regressionType: RegressionResult['regressionType'] = 'NONE';
      let severity: RegressionResult['severity'] = 'LOW';

      // Determine regression type and severity / 确定回归类型和严重程度
      if (statusChanged) {
        regressionType = 'FUNCTIONAL';
        if (baselineResult.status === 'PASS' && currentResult.status === 'FAIL') {
          severity = 'CRITICAL';
        } else if (baselineResult.status === 'PASS' && currentResult.status === 'ERROR') {
          severity = 'HIGH';
        } else {
          severity = 'MEDIUM';
        }
      } else if (Math.abs(performanceDelta) > 20) {
        regressionType = 'PERFORMANCE';
        if (Math.abs(performanceDelta) > 50) {
          severity = 'HIGH';
        } else if (Math.abs(performanceDelta) > 30) {
          severity = 'MEDIUM';
        } else {
          severity = 'LOW';
        }
      }

      if (regressionType !== 'NONE') {
        regressions.push({
          testCaseId,
          baseline: baselineResult,
          current: currentResult,
          performanceDelta,
          statusChanged,
          regressionType,
          severity
        });
      }
    }

    return regressions;
  }

  private async saveBaseline(results: TestResult[]): Promise<void> {
    try {
      await fs.mkdir(path.dirname(config.regressionBaseline), { recursive: true });
      await fs.writeFile(config.regressionBaseline, JSON.stringify(results, null, 2));
      console.log(`✅ Baseline saved to ${config.regressionBaseline}`);
    } catch (error) {
      console.error('❌ Failed to save baseline:', error);
    }
  }
}

// Main automation test runner / 主自动化测试运行器
class AutomatedAPITester {
  private results: TestResult[] = [];
  private benchmarks: PerformanceBenchmark[] = [];
  private startTime: number = 0;
  private testData: any;
  private performanceAnalyzer: PerformanceBenchmarkAnalyzer;
  private regressionAnalyzer: RegressionTestAnalyzer;

  constructor() {
    this.testData = TestDataGenerator.generateTestDataset(config.testDataSize);
    this.performanceAnalyzer = new PerformanceBenchmarkAnalyzer();
    this.regressionAnalyzer = new RegressionTestAnalyzer();
  }

  // Execute automated test suite / 执行自动化测试套件
  async runAutomatedTests(): Promise<void> {
    this.startTime = performance.now();
    
    console.log('🚀 Starting Automated API Testing Suite / 启动自动化API测试套件');
    console.log(`📊 Configuration:
    - Base URL: ${config.baseUrl}
    - Gateway URL: ${config.gatewayUrl}
    - Test Data Size: ${config.testDataSize}
    - Performance Threshold: ${config.performanceThreshold}ms
    - Regression Testing: ${config.enableRegression ? 'Enabled' : 'Disabled'}
    - Performance Benchmarking: ${config.enablePerformanceBenchmark ? 'Enabled' : 'Disabled'}
    `);

    try {
      // Generate test cases / 生成测试用例
      const generator = new TestCaseGenerator(this.testData);
      const testCases = generator.generateTestCases();
      
      console.log(`📋 Generated ${testCases.length} test cases`);

      // Execute test cases / 执行测试用例
      await this.executeTestCases(testCases);

      // Performance benchmarking / 性能基准测试
      if (config.enablePerformanceBenchmark) {
        await this.runPerformanceBenchmarks();
      }

      // Regression analysis / 回归分析
      if (config.enableRegression) {
        await this.runRegressionAnalysis();
      }

      // Generate reports / 生成报告
      await this.generateReports();

      this.printSummary();
    } catch (error) {
      console.error('❌ Automated test suite execution failed:', error);
      throw error;
    }
  }

  private async executeTestCases(testCases: TestCase[]): Promise<void> {
    console.log('\n🔄 Executing Test Cases / 执行测试用例');
    
    // Group test cases by priority / 按优先级分组测试用例
    const priorityGroups = this.groupTestCasesByPriority(testCases);
    
    // Execute in priority order / 按优先级顺序执行
    for (const priority of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      const cases = priorityGroups[priority] || [];
      if (cases.length === 0) continue;
      
      console.log(`\n🎯 Executing ${priority} priority tests (${cases.length} cases)...`);
      
      // Execute test cases in parallel batches / 并行批次执行测试用例
      const batchSize = 10;
      for (let i = 0; i < cases.length; i += batchSize) {
        const batch = cases.slice(i, i + batchSize);
        const batchPromises = batch.map(testCase => this.executeTestCase(testCase));
        await Promise.all(batchPromises);
        
        // Small delay between batches / 批次间小延迟
        if (i + batchSize < cases.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  }

  private async executeTestCase(testCase: TestCase): Promise<void> {
    const startTime = performance.now();
    
    try {
      const url = `${config.baseUrl}${testCase.endpoint}`;
      
      const response = await axios({
        method: testCase.method as any,
        url,
        data: testCase.data,
        headers: {
          'User-Agent': 'TitanChain-Automation-Tester/1.0',
          'X-Test-ID': testCase.id,
          'X-Test-Category': testCase.category,
          ...testCase.headers
        },
        timeout: config.timeout,
        validateStatus: () => true // Accept all status codes / 接受所有状态码
      });

      const responseTime = performance.now() - startTime;
      
      // Determine test result status / 确定测试结果状态
      let status: TestResult['status'] = 'PASS';
      
      if (testCase.expectedStatus && response.status !== testCase.expectedStatus) {
        status = 'FAIL';
      } else if (testCase.expectedResponseTime && responseTime > testCase.expectedResponseTime) {
        status = 'FAIL';
      } else if (response.status >= 500) {
        status = 'ERROR';
      }

      // Calculate performance score / 计算性能分数
      const performanceScore = this.calculatePerformanceScore(responseTime, testCase.expectedResponseTime);

      this.results.push({
        testCaseId: testCase.id,
        name: testCase.name,
        category: testCase.category,
        endpoint: testCase.endpoint,
        method: testCase.method,
        status,
        statusCode: response.status,
        responseTime,
        timestamp: new Date().toISOString(),
        performanceScore,
        memoryUsage: process.memoryUsage().heapUsed,
        details: {
          expectedStatus: testCase.expectedStatus,
          expectedResponseTime: testCase.expectedResponseTime,
          priority: testCase.priority,
          tags: testCase.tags,
          responseSize: JSON.stringify(response.data).length
        }
      });

    } catch (error: any) {
      const responseTime = performance.now() - startTime;
      
      this.results.push({
        testCaseId: testCase.id,
        name: testCase.name,
        category: testCase.category,
        endpoint: testCase.endpoint,
        method: testCase.method,
        status: 'ERROR',
        responseTime,
        timestamp: new Date().toISOString(),
        error: error.message,
        memoryUsage: process.memoryUsage().heapUsed,
        details: {
          expectedStatus: testCase.expectedStatus,
          expectedResponseTime: testCase.expectedResponseTime,
          priority: testCase.priority,
          tags: testCase.tags,
          errorCode: error.code
        }
      });
    }
  }

  private calculatePerformanceScore(responseTime: number, expectedTime?: number): number {
    if (!expectedTime) return 100;
    
    const ratio = responseTime / expectedTime;
    if (ratio <= 0.5) return 100;
    if (ratio <= 0.8) return 90;
    if (ratio <= 1.0) return 80;
    if (ratio <= 1.5) return 60;
    if (ratio <= 2.0) return 40;
    return 20;
  }

  private groupTestCasesByPriority(testCases: TestCase[]): { [key: string]: TestCase[] } {
    return testCases.reduce((groups, testCase) => {
      if (!groups[testCase.priority]) groups[testCase.priority] = [];
      groups[testCase.priority].push(testCase);
      return groups;
    }, {} as { [key: string]: TestCase[] });
  }

  private async runPerformanceBenchmarks(): Promise<void> {
    console.log('\n⚡ Running Performance Benchmarks / 运行性能基准测试');
    
    // Collect performance data from test results / 从测试结果收集性能数据
    const endpointGroups = this.groupResultsByEndpoint();
    
    for (const [endpoint, results] of Object.entries(endpointGroups)) {
      const responseTimes = (results as TestResult[]).map(r => r.responseTime);
      const successfulResults = (results as TestResult[]).filter(r => r.status === 'PASS');
      
      if (responseTimes.length === 0) continue;
      
      responseTimes.sort((a, b) => a - b);
      
      const benchmark: PerformanceBenchmark = {
        endpoint: (results as TestResult[])[0].endpoint,
        method: (results as TestResult[])[0].method,
        avgResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        minResponseTime: responseTimes[0],
        maxResponseTime: responseTimes[responseTimes.length - 1],
        p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)],
        p99ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.99)],
        throughput: successfulResults.length / ((performance.now() - this.startTime) / 1000),
        errorRate: ((results as TestResult[]).length - successfulResults.length) / (results as TestResult[]).length,
        timestamp: new Date().toISOString()
      };
      
      this.benchmarks.push(benchmark);
      this.performanceAnalyzer.addBenchmark(benchmark);
    }
  }

  private groupResultsByEndpoint(): { [key: string]: TestResult[] } {
    return this.results.reduce((groups, result) => {
      const key = `${result.method} ${result.endpoint}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(result);
      return groups;
    }, {} as { [key: string]: TestResult[] });
  }

  private async runRegressionAnalysis(): Promise<void> {
    console.log('\n🔍 Running Regression Analysis / 运行回归分析');
    
    const regressions = await this.regressionAnalyzer.compareWithBaseline(this.results);
    
    if (regressions.length > 0) {
      console.log(`\n⚠️ Found ${regressions.length} regressions:`);
      
      regressions.forEach(regression => {
        const icon = regression.severity === 'CRITICAL' ? '🚨' : 
                    regression.severity === 'HIGH' ? '🔴' : 
                    regression.severity === 'MEDIUM' ? '🟡' : '🟢';
        
        console.log(`${icon} ${regression.testCaseId}: ${regression.regressionType} regression (${regression.severity})`);
        
        if (regression.regressionType === 'PERFORMANCE') {
          console.log(`   Performance change: ${regression.performanceDelta.toFixed(1)}%`);
        }
        
        if (regression.statusChanged) {
          console.log(`   Status changed: ${regression.baseline.status} → ${regression.current.status}`);
        }
      });
    } else {
      console.log('✅ No regressions detected');
    }
  }

  private async generateReports(): Promise<void> {
    console.log('\n📊 Generating Test Reports / 生成测试报告');
    
    try {
      await fs.mkdir(config.reportOutputPath, { recursive: true });
      
      // Generate detailed test results report / 生成详细测试结果报告
      const resultsReport = {
        summary: this.generateSummaryStats(),
        results: this.results,
        benchmarks: this.benchmarks,
        performanceAnalysis: this.performanceAnalyzer.analyzePerformanceTrends(),
        timestamp: new Date().toISOString(),
        config: config
      };
      
      const resultsPath = path.join(config.reportOutputPath, `test-results-${Date.now()}.json`);
      await fs.writeFile(resultsPath, JSON.stringify(resultsReport, null, 2));
      
      // Generate HTML report / 生成HTML报告
      const htmlReport = this.generateHTMLReport(resultsReport);
      const htmlPath = path.join(config.reportOutputPath, `test-report-${Date.now()}.html`);
      await fs.writeFile(htmlPath, htmlReport);
      
      console.log(`✅ Reports generated:
      - JSON: ${resultsPath}
      - HTML: ${htmlPath}`);
      
    } catch (error) {
      console.error('❌ Failed to generate reports:', error);
    }
  }

  private generateSummaryStats(): any {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    
    const responseTimes = this.results.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    return {
      total,
      passed,
      failed,
      errors,
      skipped,
      passRate: (passed / total) * 100,
      avgResponseTime,
      totalExecutionTime: performance.now() - this.startTime
    };
  }

  private generateHTMLReport(reportData: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TitanChain API Automation Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .results-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .results-table th, .results-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .results-table th { background-color: #f8f9fa; font-weight: bold; }
        .status-pass { color: #28a745; font-weight: bold; }
        .status-fail { color: #dc3545; font-weight: bold; }
        .status-error { color: #fd7e14; font-weight: bold; }
        .status-skip { color: #6c757d; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 TitanChain API Automation Test Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.total}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.passed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.passRate.toFixed(1)}%</div>
                <div class="stat-label">Pass Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reportData.summary.avgResponseTime.toFixed(0)}ms</div>
                <div class="stat-label">Avg Response Time</div>
            </div>
        </div>
        
        <h2>📋 Test Results</h2>
        <table class="results-table">
            <thead>
                <tr>
                    <th>Test Case</th>
                    <th>Category</th>
                    <th>Endpoint</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Response Time</th>
                    <th>Performance Score</th>
                </tr>
            </thead>
            <tbody>
                ${reportData.results.map((result: TestResult) => `
                    <tr>
                        <td>${result.name}</td>
                        <td>${result.category}</td>
                        <td>${result.endpoint}</td>
                        <td>${result.method}</td>
                        <td class="status-${result.status.toLowerCase()}">${result.status}</td>
                        <td>${result.responseTime.toFixed(0)}ms</td>
                        <td>${result.performanceScore || 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
    `;
  }

  private printSummary(): void {
    const totalTime = performance.now() - this.startTime;
    const stats = this.generateSummaryStats();

    console.log('\n' + '='.repeat(100));
    console.log('📊 AUTOMATED API TESTING SUMMARY / 自动化API测试摘要');
    console.log('='.repeat(100));

    console.log('\n📋 Test Execution Results:');
    console.log(`Total Tests: ${stats.total}`);
    console.log(`✅ Passed: ${stats.passed} (${stats.passRate.toFixed(1)}%)`);
    console.log(`❌ Failed: ${stats.failed} (${((stats.failed/stats.total)*100).toFixed(1)}%)`);
    console.log(`🚨 Errors: ${stats.errors} (${((stats.errors/stats.total)*100).toFixed(1)}%)`);
    console.log(`⏭️  Skipped: ${stats.skipped} (${((stats.skipped/stats.total)*100).toFixed(1)}%)`);

    console.log('\n⚡ Performance Metrics:');
    console.log(`Total Execution Time: ${totalTime.toFixed(2)}ms`);
    console.log(`Average Response Time: ${stats.avgResponseTime.toFixed(2)}ms`);
    console.log(`Test Data Generated: ${config.testDataSize} entries`);

    // Category breakdown / 分类统计
    const categories = [...new Set(this.results.map(r => r.category))];
    console.log('\n📊 Results by Category:');
    categories.forEach(category => {
      const categoryResults = this.results.filter(r => r.category === category);
      const categoryPassed = categoryResults.filter(r => r.status === 'PASS').length;
      const categoryTotal = categoryResults.length;
      const categoryPassRate = (categoryPassed / categoryTotal) * 100;
      
      console.log(`  ${category}: ${categoryPassed}/${categoryTotal} (${categoryPassRate.toFixed(1)}%)`);
    });

    // Performance benchmarks summary / 性能基准摘要
    if (this.benchmarks.length > 0) {
      console.log('\n🏆 Performance Benchmarks:');
      this.benchmarks.forEach(benchmark => {
        console.log(`  ${benchmark.method} ${benchmark.endpoint}:`);
        console.log(`    Avg: ${benchmark.avgResponseTime.toFixed(2)}ms, P95: ${benchmark.p95ResponseTime.toFixed(2)}ms`);
        console.log(`    Throughput: ${benchmark.throughput.toFixed(2)} req/s, Error Rate: ${(benchmark.errorRate * 100).toFixed(2)}%`);
      });
    }

    console.log('\n💡 Recommendations:');
    if (stats.passRate < 80) {
      console.log('  🚨 Low pass rate - investigate failing tests and improve system reliability');
    }
    if (stats.avgResponseTime > config.performanceThreshold) {
      console.log('  ⚡ High average response time - consider performance optimization');
    }
    if (stats.errors > 0) {
      console.log('  🔧 Error conditions detected - review error handling and system stability');
    }
    if (stats.passRate >= 95 && stats.avgResponseTime <= config.performanceThreshold) {
      console.log('  🎉 Excellent test results - system performing well!');
    }

    console.log('='.repeat(100));
  }
}

// Main execution function / 主执行函数
async function main(): Promise<void> {
  console.log('🚀 TitanChain Automated API Testing Suite / TitanChain自动化API测试套件');
  
  try {
    const tester = new AutomatedAPITester();
    await tester.runAutomatedTests();
  } catch (error) {
    console.error('Automated testing failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly / 如果直接执行此文件则运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { 
  AutomatedAPITester, 
  TestCaseGenerator, 
  TestDataGenerator, 
  PerformanceBenchmarkAnalyzer, 
  RegressionTestAnalyzer,
  AutomationTestConfig,
  TestCase,
  TestResult,
  PerformanceBenchmark,
  RegressionResult
};