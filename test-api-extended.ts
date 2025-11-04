#!/usr/bin/env node
/**
 * Extended API Endpoint Testing Suite / 扩展的API端点测试套件
 * Comprehensive testing with advanced scenarios, security tests, and performance benchmarks
 * 包含高级场景、安全测试和性能基准的全面测试
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

// Extended test configuration / 扩展测试配置
interface ExtendedTestConfig {
  baseUrl: string;
  gatewayUrl: string;
  timeout: number;
  maxRetries: number;
  concurrentRequests: number;
  performanceThresholds: {
    responseTime: number;
    throughput: number;
    errorRate: number;
  };
  securityTests: boolean;
  loadTests: boolean;
}

const config: ExtendedTestConfig = {
  baseUrl: 'http://localhost:3001',
  gatewayUrl: 'http://localhost:8889',
  timeout: 15000,
  maxRetries: 3,
  concurrentRequests: 50,
  performanceThresholds: {
    responseTime: 1000, // ms
    throughput: 100, // requests per second
    errorRate: 0.05 // 5%
  },
  securityTests: true,
  loadTests: true
};

// Extended test result interface / 扩展测试结果接口
interface ExtendedTestResult {
  name: string;
  category: 'functional' | 'performance' | 'security' | 'integration' | 'edge-case';
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARNING' | 'CRITICAL';
  statusCode?: number;
  responseTime: number;
  error?: string;
  details?: any;
  metrics?: {
    throughput?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

// Performance metrics interface / 性能指标接口
interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number;
  errorRate: number;
}

// Extended API test suite class / 扩展API测试套件类
class ExtendedAPITester {
  private results: ExtendedTestResult[] = [];
  private startTime: number = 0;
  private performanceMetrics: PerformanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    throughput: 0,
    errorRate: 0
  };

  constructor() {
    this.startTime = performance.now();
  }

  // Add test result with enhanced logging / 添加测试结果并增强日志
  private addResult(result: ExtendedTestResult): void {
    this.results.push(result);
    
    // Update performance metrics / 更新性能指标
    this.performanceMetrics.totalRequests++;
    if (result.status === 'PASS') {
      this.performanceMetrics.successfulRequests++;
    } else if (result.status === 'FAIL' || result.status === 'CRITICAL') {
      this.performanceMetrics.failedRequests++;
    }
    
    this.performanceMetrics.minResponseTime = Math.min(this.performanceMetrics.minResponseTime, result.responseTime);
    this.performanceMetrics.maxResponseTime = Math.max(this.performanceMetrics.maxResponseTime, result.responseTime);
    
    const statusIcon = this.getStatusIcon(result.status);
    const categoryIcon = this.getCategoryIcon(result.category);
    
    console.log(`${statusIcon} ${categoryIcon} ${result.name} (${result.responseTime.toFixed(2)}ms)`);
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    }
    if (result.details) {
      console.log(`   📊 Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  }

  // Get status icon / 获取状态图标
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'PASS': return '✅';
      case 'FAIL': return '❌';
      case 'CRITICAL': return '🚨';
      case 'WARNING': return '⚠️';
      case 'SKIP': return '⏭️';
      default: return '❓';
    }
  }

  // Get category icon / 获取分类图标
  private getCategoryIcon(category: string): string {
    switch (category) {
      case 'functional': return '🔧';
      case 'performance': return '⚡';
      case 'security': return '🛡️';
      case 'integration': return '🔗';
      case 'edge-case': return '🎯';
      default: return '📋';
    }
  }

  // Enhanced HTTP request with retry logic / 增强的HTTP请求与重试逻辑
  private async makeRequest(
    method: string, 
    url: string, 
    data?: any, 
    headers?: any,
    retries: number = config.maxRetries
  ): Promise<{ response?: AxiosResponse; error?: AxiosError; responseTime: number }> {
    const startTime = performance.now();
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios({
          method,
          url,
          data,
          headers: {
            'User-Agent': 'TitanChain-API-Tester/1.0',
            'X-Test-ID': crypto.randomUUID(),
            ...headers
          },
          timeout: config.timeout,
          validateStatus: () => true
        });
        
        const responseTime = performance.now() - startTime;
        return { response, responseTime };
      } catch (error) {
        if (attempt === retries) {
          const responseTime = performance.now() - startTime;
          return { error: error as AxiosError, responseTime };
        }
        // Wait before retry / 重试前等待
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    
    const responseTime = performance.now() - startTime;
    return { error: new Error('Max retries exceeded') as any, responseTime };
  }

  // Test blockchain-specific endpoints / 测试区块链特定端点
  async testBlockchainEndpoints(): Promise<void> {
    console.log('\n⛓️ Testing Blockchain-Specific Endpoints / 测试区块链特定端点');
    
    const endpoints = [
      { name: 'Blockchain Status', path: '/api/blockchain/status', expectedFields: ['height', 'hash', 'timestamp'] },
      { name: 'Latest Block', path: '/api/blockchain/blocks/latest', expectedFields: ['hash', 'height', 'transactions'] },
      { name: 'Block by Height', path: '/api/blockchain/blocks/1', expectedFields: ['hash', 'height'] },
      { name: 'Transaction Pool', path: '/api/transactions/pool', expectedFields: ['pending', 'queued'] },
      { name: 'Network Peers', path: '/api/p2p/peers', expectedFields: ['connected', 'total'] },
      { name: 'Consensus Status', path: '/api/consensus/status', expectedFields: ['state', 'validators'] },
      { name: 'Smart Contract State', path: '/api/contracts/state', expectedFields: ['contracts', 'storage'] },
      { name: 'Validator Set', path: '/api/validators/active', expectedFields: ['validators', 'totalStake'] }
    ];

    for (const endpoint of endpoints) {
      const { response, error, responseTime } = await this.makeRequest('GET', `${config.baseUrl}${endpoint.path}`);

      if (error) {
        this.addResult({
          name: endpoint.name,
          category: 'functional',
          endpoint: endpoint.path,
          method: 'GET',
          status: 'FAIL',
          responseTime,
          error: error.message
        });
      } else if (response) {
        const isSuccess = response.status >= 200 && response.status < 300;
        const hasRequiredFields = endpoint.expectedFields.every(field => 
          response.data && typeof response.data === 'object' && field in response.data
        );

        this.addResult({
          name: endpoint.name,
          category: 'functional',
          endpoint: endpoint.path,
          method: 'GET',
          status: isSuccess && hasRequiredFields ? 'PASS' : 'WARNING',
          statusCode: response.status,
          responseTime,
          error: !isSuccess ? `HTTP ${response.status}` : 
                 !hasRequiredFields ? `Missing fields: ${endpoint.expectedFields.filter(f => !(f in (response.data || {})))}` : undefined,
          details: isSuccess ? { fieldsPresent: endpoint.expectedFields.filter(f => f in (response.data || {})) } : undefined
        });
      }
    }
  }

  // Test TitanCore engine endpoints / 测试TitanCore引擎端点
  async testTitanCoreEndpoints(): Promise<void> {
    console.log('\n🚀 Testing TitanCore Engine Endpoints / 测试TitanCore引擎端点');
    
    const endpoints = [
      { name: 'TitanCore Status', path: '/api/titan/status', expectedFields: ['engine', 'performance', 'orderbook'] },
      { name: 'Order Book Snapshot', path: '/api/titan/orderbook/snapshot', expectedFields: ['bids', 'asks', 'spread'] },
      { name: 'Trading Pairs', path: '/api/titan/pairs', expectedFields: ['pairs', 'active'] },
      { name: 'Market Data', path: '/api/titan/market/data', expectedFields: ['price', 'volume', 'change'] },
      { name: 'Performance Metrics', path: '/api/titan/metrics', expectedFields: ['tps', 'latency', 'throughput'] },
      { name: 'Engine Health', path: '/api/titan/health', expectedFields: ['status', 'uptime', 'memory'] }
    ];

    for (const endpoint of endpoints) {
      const { response, error, responseTime } = await this.makeRequest('GET', `${config.baseUrl}${endpoint.path}`);

      const status = this.evaluateEndpointResponse(response, error, responseTime, endpoint.expectedFields);
      
      this.addResult({
        name: endpoint.name,
        category: 'functional',
        endpoint: endpoint.path,
        method: 'GET',
        status,
        statusCode: response?.status,
        responseTime,
        error: error?.message || (response && response.status >= 400 ? `HTTP ${response.status}` : undefined)
      });
    }
  }

  // Test smart sharding endpoints / 测试智能分片端点
  async testSmartShardingEndpoints(): Promise<void> {
    console.log('\n🔀 Testing Smart Sharding Endpoints / 测试智能分片端点');
    
    const endpoints = [
      { name: 'Shard Status', path: '/api/sharding/status', expectedFields: ['shards', 'distribution', 'load'] },
      { name: 'Shard Topology', path: '/api/sharding/topology', expectedFields: ['nodes', 'connections', 'health'] },
      { name: 'Cross-Shard Transactions', path: '/api/sharding/cross-shard', expectedFields: ['pending', 'completed'] },
      { name: 'Load Balancer Status', path: '/api/sharding/load-balancer', expectedFields: ['strategy', 'metrics'] },
      { name: 'Auto Scaling Status', path: '/api/sharding/auto-scaling', expectedFields: ['enabled', 'thresholds'] }
    ];

    for (const endpoint of endpoints) {
      const { response, error, responseTime } = await this.makeRequest('GET', `${config.baseUrl}${endpoint.path}`);

      this.addResult({
        name: endpoint.name,
        category: 'functional',
        endpoint: endpoint.path,
        method: 'GET',
        status: this.evaluateEndpointResponse(response, error, responseTime, endpoint.expectedFields),
        statusCode: response?.status,
        responseTime,
        error: error?.message
      });
    }
  }

  // Test MPC system endpoints / 测试MPC系统端点
  async testMPCEndpoints(): Promise<void> {
    console.log('\n🔐 Testing MPC System Endpoints / 测试MPC系统端点');
    
    const endpoints = [
      { name: 'MPC Status', path: '/api/mpc/status', expectedFields: ['sessions', 'parties', 'protocols'] },
      { name: 'Active Sessions', path: '/api/mpc/sessions', expectedFields: ['active', 'completed', 'failed'] },
      { name: 'Party Management', path: '/api/mpc/parties', expectedFields: ['registered', 'online', 'offline'] },
      { name: 'Threshold Signatures', path: '/api/mpc/signatures', expectedFields: ['pending', 'completed'] },
      { name: 'Secret Sharing Status', path: '/api/mpc/secret-sharing', expectedFields: ['shares', 'threshold'] }
    ];

    for (const endpoint of endpoints) {
      const { response, error, responseTime } = await this.makeRequest('GET', `${config.baseUrl}${endpoint.path}`);

      this.addResult({
        name: endpoint.name,
        category: 'functional',
        endpoint: endpoint.path,
        method: 'GET',
        status: this.evaluateEndpointResponse(response, error, responseTime, endpoint.expectedFields),
        statusCode: response?.status,
        responseTime,
        error: error?.message
      });
    }
  }

  // Test security endpoints / 测试安全端点
  async testSecurityEndpoints(): Promise<void> {
    if (!config.securityTests) {
      console.log('\n🛡️ Security tests disabled, skipping...');
      return;
    }

    console.log('\n🛡️ Testing Security Endpoints / 测试安全端点');
    
    const securityTests = [
      {
        name: 'SQL Injection Protection',
        path: '/api/blockchain/blocks/1\'; DROP TABLE blocks; --',
        expectedStatus: 400
      },
      {
        name: 'XSS Protection',
        path: '/api/search?q=<script>alert("xss")</script>',
        expectedStatus: 400
      },
      {
        name: 'Path Traversal Protection',
        path: '/api/../../../etc/passwd',
        expectedStatus: 404
      },
      {
        name: 'Large Payload Protection',
        method: 'POST',
        path: '/api/transactions/submit',
        data: 'x'.repeat(10000000), // 10MB payload
        expectedStatus: 413
      },
      {
        name: 'Rate Limit Protection',
        path: '/api/health',
        concurrent: 100,
        expectedStatus: 429
      }
    ];

    for (const test of securityTests) {
      if (test.concurrent) {
        // Test rate limiting with concurrent requests / 使用并发请求测试速率限制
        const requests = Array(test.concurrent).fill(null).map(() => 
          this.makeRequest('GET', `${config.baseUrl}${test.path}`)
        );
        
        const results = await Promise.all(requests);
        const rateLimited = results.some(r => r.response?.status === 429);
        
        this.addResult({
          name: test.name,
          category: 'security',
          endpoint: test.path,
          method: 'GET',
          status: rateLimited ? 'PASS' : 'WARNING',
          responseTime: Math.max(...results.map(r => r.responseTime)),
          details: { rateLimited, totalRequests: test.concurrent }
        });
      } else {
        const { response, error, responseTime } = await this.makeRequest(
          test.method || 'GET',
          `${config.baseUrl}${test.path}`,
          test.data
        );

        const isExpectedResponse = response?.status === test.expectedStatus;
        
        this.addResult({
          name: test.name,
          category: 'security',
          endpoint: test.path,
          method: test.method || 'GET',
          status: isExpectedResponse ? 'PASS' : 'WARNING',
          statusCode: response?.status,
          responseTime,
          error: !isExpectedResponse ? `Expected ${test.expectedStatus}, got ${response?.status}` : undefined
        });
      }
    }
  }

  // Test edge cases and boundary conditions / 测试边界条件和极端情况
  async testEdgeCases(): Promise<void> {
    console.log('\n🎯 Testing Edge Cases and Boundary Conditions / 测试边界条件和极端情况');
    
    const edgeCases = [
      {
        name: 'Empty Request Body',
        method: 'POST',
        path: '/api/transactions/submit',
        data: {},
        expectedStatus: 400
      },
      {
        name: 'Null Values',
        method: 'POST',
        path: '/api/transactions/submit',
        data: { from: null, to: null, value: null },
        expectedStatus: 400
      },
      {
        name: 'Very Long String',
        method: 'GET',
        path: `/api/blockchain/blocks/${'a'.repeat(1000)}`,
        expectedStatus: 404
      },
      {
        name: 'Special Characters',
        method: 'GET',
        path: '/api/search?q=!@#$%^&*()_+-=[]{}|;:,.<>?',
        expectedStatus: [200, 400] // Either handled or rejected
      },
      {
        name: 'Unicode Characters',
        method: 'GET',
        path: '/api/search?q=测试中文字符🚀',
        expectedStatus: [200, 400]
      },
      {
        name: 'Negative Numbers',
        method: 'GET',
        path: '/api/blockchain/blocks/-1',
        expectedStatus: 400
      },
      {
        name: 'Zero Values',
        method: 'POST',
        path: '/api/transactions/submit',
        data: { from: '0x0', to: '0x0', value: '0' },
        expectedStatus: [200, 400]
      }
    ];

    for (const testCase of edgeCases) {
      const { response, error, responseTime } = await this.makeRequest(
        testCase.method,
        `${config.baseUrl}${testCase.path}`,
        testCase.data
      );

      const expectedStatuses = Array.isArray(testCase.expectedStatus) ? 
        testCase.expectedStatus : [testCase.expectedStatus];
      const isExpectedResponse = response ? expectedStatuses.includes(response.status) : false;

      this.addResult({
        name: testCase.name,
        category: 'edge-case',
        endpoint: testCase.path,
        method: testCase.method,
        status: isExpectedResponse ? 'PASS' : 'WARNING',
        statusCode: response?.status,
        responseTime,
        error: error?.message || (!isExpectedResponse ? `Expected ${expectedStatuses.join(' or ')}, got ${response?.status}` : undefined)
      });
    }
  }

  // Performance load testing / 性能负载测试
  async testPerformanceLoad(): Promise<void> {
    if (!config.loadTests) {
      console.log('\n⚡ Load tests disabled, skipping...');
      return;
    }

    console.log('\n⚡ Testing Performance Load / 测试性能负载');
    
    const loadTests = [
      {
        name: 'High Concurrency Health Check',
        endpoint: '/api/health',
        method: 'GET',
        concurrency: 100,
        duration: 10000 // 10 seconds
      },
      {
        name: 'Sustained Load Test',
        endpoint: '/api/blockchain/stats',
        method: 'GET',
        concurrency: 50,
        duration: 30000 // 30 seconds
      },
      {
        name: 'Gateway Load Test',
        endpoint: '/health',
        method: 'GET',
        concurrency: 75,
        duration: 15000, // 15 seconds
        gateway: true
      }
    ];

    for (const test of loadTests) {
      console.log(`\n🔥 Running ${test.name}...`);
      
      const baseUrl = test.gateway ? config.gatewayUrl : config.baseUrl;
      const url = `${baseUrl}${test.endpoint}`;
      
      const startTime = performance.now();
      const endTime = startTime + test.duration;
      const requests: Promise<any>[] = [];
      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;
      const responseTimes: number[] = [];

      // Generate load for specified duration / 在指定时间内生成负载
      while (performance.now() < endTime) {
        if (requests.length < test.concurrency) {
          const requestPromise = this.makeRequest(test.method, url)
            .then(result => {
              requestCount++;
              responseTimes.push(result.responseTime);
              if (result.response && result.response.status < 400) {
                successCount++;
              } else {
                errorCount++;
              }
              return result;
            });
          
          requests.push(requestPromise);
        }
        
        // Wait a bit before next batch / 等待一段时间再发送下一批
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for all requests to complete / 等待所有请求完成
      await Promise.all(requests);
      
      const totalTime = performance.now() - startTime;
      const throughput = (requestCount / totalTime) * 1000; // requests per second
      const errorRate = errorCount / requestCount;
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

      const status = throughput >= config.performanceThresholds.throughput && 
                    errorRate <= config.performanceThresholds.errorRate &&
                    avgResponseTime <= config.performanceThresholds.responseTime ? 'PASS' : 'WARNING';

      this.addResult({
        name: test.name,
        category: 'performance',
        endpoint: test.endpoint,
        method: test.method,
        status,
        responseTime: avgResponseTime,
        details: {
          totalRequests: requestCount,
          successfulRequests: successCount,
          failedRequests: errorCount,
          throughput: throughput.toFixed(2),
          errorRate: (errorRate * 100).toFixed(2) + '%',
          duration: totalTime.toFixed(2) + 'ms'
        },
        metrics: {
          throughput,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          cpuUsage: process.cpuUsage().user / 1000 // ms
        }
      });
    }
  }

  // Evaluate endpoint response / 评估端点响应
  private evaluateEndpointResponse(
    response?: AxiosResponse, 
    error?: AxiosError, 
    responseTime?: number,
    expectedFields?: string[]
  ): 'PASS' | 'FAIL' | 'WARNING' | 'CRITICAL' {
    if (error) {
      return 'FAIL';
    }
    
    if (!response) {
      return 'CRITICAL';
    }
    
    if (response.status >= 500) {
      return 'CRITICAL';
    }
    
    if (response.status >= 400) {
      return 'FAIL';
    }
    
    if (responseTime && responseTime > config.performanceThresholds.responseTime) {
      return 'WARNING';
    }
    
    if (expectedFields && response.data) {
      const missingFields = expectedFields.filter(field => !(field in response.data));
      if (missingFields.length > 0) {
        return 'WARNING';
      }
    }
    
    return 'PASS';
  }

  // Run all extended tests / 运行所有扩展测试
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Extended API Testing Suite / 开始扩展API测试套件\n');
    console.log(`📊 Configuration:
    - Base URL: ${config.baseUrl}
    - Gateway URL: ${config.gatewayUrl}
    - Timeout: ${config.timeout}ms
    - Max Retries: ${config.maxRetries}
    - Concurrent Requests: ${config.concurrentRequests}
    - Security Tests: ${config.securityTests ? 'Enabled' : 'Disabled'}
    - Load Tests: ${config.loadTests ? 'Enabled' : 'Disabled'}
    `);
    
    try {
      await this.testBlockchainEndpoints();
      await this.testTitanCoreEndpoints();
      await this.testSmartShardingEndpoints();
      await this.testMPCEndpoints();
      await this.testSecurityEndpoints();
      await this.testEdgeCases();
      await this.testPerformanceLoad();
      
      this.calculateFinalMetrics();
      this.printExtendedSummary();
    } catch (error) {
      console.error('❌ Extended test suite execution failed:', error);
      throw error;
    }
  }

  // Calculate final performance metrics / 计算最终性能指标
  private calculateFinalMetrics(): void {
    const totalTime = performance.now() - this.startTime;
    
    this.performanceMetrics.averageResponseTime = 
      this.results.reduce((sum, r) => sum + r.responseTime, 0) / this.results.length;
    
    this.performanceMetrics.throughput = (this.performanceMetrics.totalRequests / totalTime) * 1000;
    this.performanceMetrics.errorRate = this.performanceMetrics.failedRequests / this.performanceMetrics.totalRequests;
  }

  // Print extended test summary / 打印扩展测试摘要
  private printExtendedSummary(): void {
    const totalTime = performance.now() - this.startTime;
    
    console.log('\n' + '='.repeat(100));
    console.log('📊 EXTENDED API TEST SUMMARY / 扩展API测试摘要');
    console.log('='.repeat(100));
    
    // Test results by category / 按分类统计测试结果
    const categories = ['functional', 'performance', 'security', 'integration', 'edge-case'];
    const categoryStats = categories.map(category => {
      const categoryResults = this.results.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.status === 'PASS').length;
      const total = categoryResults.length;
      
      return {
        category,
        total,
        passed,
        percentage: total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0'
      };
    });

    console.log('\n📋 Results by Category:');
    categoryStats.forEach(stat => {
      if (stat.total > 0) {
        console.log(`  ${this.getCategoryIcon(stat.category)} ${stat.category}: ${stat.passed}/${stat.total} (${stat.percentage}%)`);
      }
    });

    // Overall statistics / 总体统计
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const critical = this.results.filter(r => r.status === 'CRITICAL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    console.log('\n📊 Overall Statistics:');
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`🚨 Critical: ${critical} (${((critical/total)*100).toFixed(1)}%)`);
    console.log(`⚠️  Warnings: ${warnings} (${((warnings/total)*100).toFixed(1)}%)`);
    console.log(`⏭️  Skipped: ${skipped} (${((skipped/total)*100).toFixed(1)}%)`);

    // Performance metrics / 性能指标
    console.log('\n⚡ Performance Metrics:');
    console.log(`Total Execution Time: ${totalTime.toFixed(2)}ms`);
    console.log(`Average Response Time: ${this.performanceMetrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`Min Response Time: ${this.performanceMetrics.minResponseTime.toFixed(2)}ms`);
    console.log(`Max Response Time: ${this.performanceMetrics.maxResponseTime.toFixed(2)}ms`);
    console.log(`Throughput: ${this.performanceMetrics.throughput.toFixed(2)} req/s`);
    console.log(`Error Rate: ${(this.performanceMetrics.errorRate * 100).toFixed(2)}%`);

    // Performance thresholds check / 性能阈值检查
    console.log('\n🎯 Performance Thresholds:');
    const responseTimeOk = this.performanceMetrics.averageResponseTime <= config.performanceThresholds.responseTime;
    const throughputOk = this.performanceMetrics.throughput >= config.performanceThresholds.throughput;
    const errorRateOk = this.performanceMetrics.errorRate <= config.performanceThresholds.errorRate;

    console.log(`Response Time: ${responseTimeOk ? '✅' : '❌'} ${this.performanceMetrics.averageResponseTime.toFixed(2)}ms (threshold: ${config.performanceThresholds.responseTime}ms)`);
    console.log(`Throughput: ${throughputOk ? '✅' : '❌'} ${this.performanceMetrics.throughput.toFixed(2)} req/s (threshold: ${config.performanceThresholds.throughput} req/s)`);
    console.log(`Error Rate: ${errorRateOk ? '✅' : '❌'} ${(this.performanceMetrics.errorRate * 100).toFixed(2)}% (threshold: ${(config.performanceThresholds.errorRate * 100).toFixed(2)}%)`);

    // Critical and failed tests / 关键和失败的测试
    const criticalTests = this.results.filter(r => r.status === 'CRITICAL');
    const failedTests = this.results.filter(r => r.status === 'FAIL');

    if (criticalTests.length > 0) {
      console.log('\n🚨 Critical Issues:');
      criticalTests.forEach(result => {
        console.log(`  - ${result.name}: ${result.error || 'Critical failure'}`);
      });
    }

    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(result => {
        console.log(`  - ${result.name}: ${result.error || 'Test failed'}`);
      });
    }

    // Recommendations / 建议
    console.log('\n💡 Recommendations:');
    if (critical > 0) {
      console.log('  🚨 Critical issues detected - immediate attention required');
    }
    if (failed > 0) {
      console.log('  ❌ Failed tests need investigation and fixes');
    }
    if (!responseTimeOk) {
      console.log('  ⚡ Response times exceed threshold - consider performance optimization');
    }
    if (!throughputOk) {
      console.log('  📈 Throughput below threshold - consider scaling or optimization');
    }
    if (!errorRateOk) {
      console.log('  🔧 Error rate too high - investigate error handling and stability');
    }
    if (critical === 0 && failed === 0 && responseTimeOk && throughputOk && errorRateOk) {
      console.log('  🎉 All tests passed and performance thresholds met!');
    }

    console.log('='.repeat(100));
  }
}

// Main execution function / 主执行函数
async function main(): Promise<void> {
  const tester = new ExtendedAPITester();
  
  try {
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('💥 Extended test suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly / 如果直接调用则运行
main();

export { ExtendedAPITester, ExtendedTestConfig, ExtendedTestResult };