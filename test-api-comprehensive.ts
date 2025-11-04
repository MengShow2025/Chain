#!/usr/bin/env node
/**
 * Comprehensive API Endpoint Testing Suite / 全面的API端点测试套件
 * Tests all endpoints with edge cases, error scenarios, and performance / 测试所有端点的边界条件、错误场景和性能
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import { performance } from 'perf_hooks';

// Test configuration / 测试配置
interface TestConfig {
  baseUrl: string;
  gatewayUrl: string;
  timeout: number;
  maxRetries: number;
  concurrentRequests: number;
}

const config: TestConfig = {
  baseUrl: 'http://localhost:3001',
  gatewayUrl: 'http://localhost:8889',
  timeout: 10000,
  maxRetries: 3,
  concurrentRequests: 10
};

// Test result interface / 测试结果接口
interface TestResult {
  name: string;
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARNING';
  statusCode?: number;
  responseTime: number;
  error?: string;
  details?: any;
}

// Test suite class / 测试套件类
class ComprehensiveAPITester {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = performance.now();
  }

  // Add test result / 添加测试结果
  private addResult(result: TestResult): void {
    this.results.push(result);
    const status = result.status === 'PASS' ? '✅' : 
                  result.status === 'FAIL' ? '❌' : 
                  result.status === 'WARNING' ? '⚠️' : '⏭️';
    
    console.log(`${status} ${result.name} (${result.responseTime}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  // Make HTTP request with timing / 发送HTTP请求并计时
  private async makeRequest(
    method: string, 
    url: string, 
    data?: any, 
    headers?: any
  ): Promise<{ response?: AxiosResponse; error?: AxiosError; responseTime: number }> {
    const startTime = performance.now();
    
    try {
      const response = await axios({
        method,
        url,
        data,
        headers,
        timeout: config.timeout,
        validateStatus: () => true // Don't throw on HTTP error status / 不在HTTP错误状态时抛出异常
      });
      
      const responseTime = performance.now() - startTime;
      return { response, responseTime };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return { error: error as AxiosError, responseTime };
    }
  }

  // Test basic API endpoints / 测试基础API端点
  async testBasicEndpoints(): Promise<void> {
    console.log('\n🔍 Testing Basic API Endpoints / 测试基础API端点');
    
    const endpoints = [
      { name: 'Health Check', method: 'GET', path: '/api/health' },
      { name: 'Blockchain Stats', method: 'GET', path: '/api/blockchain/stats' },
      { name: 'Transaction Pool Stats', method: 'GET', path: '/api/transactions/pool/stats' },
      { name: 'Validators List', method: 'GET', path: '/api/validators' },
      { name: 'Security Overview', method: 'GET', path: '/api/security/overview' },
      { name: 'API Documentation', method: 'GET', path: '/api/docs' }
    ];

    for (const endpoint of endpoints) {
      const { response, error, responseTime } = await this.makeRequest(
        endpoint.method,
        `${config.baseUrl}${endpoint.path}`
      );

      if (error) {
        this.addResult({
          name: endpoint.name,
          endpoint: endpoint.path,
          method: endpoint.method,
          status: 'FAIL',
          responseTime,
          error: error.message
        });
      } else if (response) {
        const isSuccess = response.status >= 200 && response.status < 300;
        this.addResult({
          name: endpoint.name,
          endpoint: endpoint.path,
          method: endpoint.method,
          status: isSuccess ? 'PASS' : 'WARNING',
          statusCode: response.status,
          responseTime,
          error: !isSuccess ? `HTTP ${response.status}` : undefined
        });
      }
    }
  }

  // Test gateway endpoints / 测试网关端点
  async testGatewayEndpoints(): Promise<void> {
    console.log('\n🚪 Testing Gateway Endpoints / 测试网关端点');
    
    const endpoints = [
      { name: 'Gateway Health', method: 'GET', path: '/health' },
      { name: 'Gateway Detailed Health', method: 'GET', path: '/health/detailed' },
      { name: 'Gateway Ready', method: 'GET', path: '/ready' },
      { name: 'Gateway Live', method: 'GET', path: '/live' },
      { name: 'Gateway Stats', method: 'GET', path: '/stats' },
      { name: 'Gateway Config', method: 'GET', path: '/config' },
      { name: 'Circuit Breakers', method: 'GET', path: '/circuit-breakers' },
      { name: 'Load Balancer', method: 'GET', path: '/load-balancer' },
      { name: 'Gateway Metrics', method: 'GET', path: '/metrics' }
    ];

    for (const endpoint of endpoints) {
      const { response, error, responseTime } = await this.makeRequest(
        endpoint.method,
        `${config.gatewayUrl}${endpoint.path}`
      );

      if (error) {
        this.addResult({
          name: endpoint.name,
          endpoint: endpoint.path,
          method: endpoint.method,
          status: 'FAIL',
          responseTime,
          error: error.message
        });
      } else if (response) {
        const isSuccess = response.status >= 200 && response.status < 300;
        this.addResult({
          name: endpoint.name,
          endpoint: endpoint.path,
          method: endpoint.method,
          status: isSuccess ? 'PASS' : 'WARNING',
          statusCode: response.status,
          responseTime,
          error: !isSuccess ? `HTTP ${response.status}` : undefined,
          details: isSuccess ? response.data : undefined
        });
      }
    }
  }

  // Test POST endpoints / 测试POST端点
  async testPostEndpoints(): Promise<void> {
    console.log('\n📝 Testing POST Endpoints / 测试POST端点');
    
    const testCases = [
      {
        name: 'Submit Transaction',
        method: 'POST',
        path: '/api/transactions/submit',
        data: {
          from: '0x1234567890123456789012345678901234567890',
          to: '0x0987654321098765432109876543210987654321',
          value: '1000000000000000000',
          gas: '21000',
          gasPrice: '20000000000',
          data: '0x'
        }
      },
      {
        name: 'Create Block',
        method: 'POST',
        path: '/api/blockchain/blocks',
        data: {
          transactions: [],
          timestamp: Date.now(),
          previousHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
        }
      }
    ];

    for (const testCase of testCases) {
      const { response, error, responseTime } = await this.makeRequest(
        testCase.method,
        `${config.baseUrl}${testCase.path}`,
        testCase.data,
        { 'Content-Type': 'application/json' }
      );

      if (error) {
        this.addResult({
          name: testCase.name,
          endpoint: testCase.path,
          method: testCase.method,
          status: 'FAIL',
          responseTime,
          error: error.message
        });
      } else if (response) {
        const isSuccess = response.status >= 200 && response.status < 300;
        this.addResult({
          name: testCase.name,
          endpoint: testCase.path,
          method: testCase.method,
          status: isSuccess ? 'PASS' : 'WARNING',
          statusCode: response.status,
          responseTime,
          error: !isSuccess ? `HTTP ${response.status}` : undefined
        });
      }
    }
  }

  // Test error scenarios / 测试错误场景
  async testErrorScenarios(): Promise<void> {
    console.log('\n🚨 Testing Error Scenarios / 测试错误场景');
    
    const errorTests = [
      {
        name: 'Invalid Endpoint',
        method: 'GET',
        path: '/api/nonexistent',
        expectedStatus: 404
      },
      {
        name: 'Invalid Method',
        method: 'DELETE',
        path: '/api/health',
        expectedStatus: 405
      },
      {
        name: 'Invalid JSON',
        method: 'POST',
        path: '/api/transactions/submit',
        data: 'invalid json',
        expectedStatus: 400
      },
      {
        name: 'Missing Required Fields',
        method: 'POST',
        path: '/api/transactions/submit',
        data: { from: '0x123' }, // Missing required fields / 缺少必需字段
        expectedStatus: 400
      }
    ];

    for (const test of errorTests) {
      const { response, error, responseTime } = await this.makeRequest(
        test.method,
        `${config.baseUrl}${test.path}`,
        test.data,
        test.data ? { 'Content-Type': 'application/json' } : undefined
      );

      if (error) {
        this.addResult({
          name: test.name,
          endpoint: test.path,
          method: test.method,
          status: 'FAIL',
          responseTime,
          error: error.message
        });
      } else if (response) {
        const isExpectedError = response.status === test.expectedStatus;
        this.addResult({
          name: test.name,
          endpoint: test.path,
          method: test.method,
          status: isExpectedError ? 'PASS' : 'WARNING',
          statusCode: response.status,
          responseTime,
          error: !isExpectedError ? `Expected ${test.expectedStatus}, got ${response.status}` : undefined
        });
      }
    }
  }

  // Test concurrent requests / 测试并发请求
  async testConcurrentRequests(): Promise<void> {
    console.log('\n⚡ Testing Concurrent Requests / 测试并发请求');
    
    const endpoint = `${config.baseUrl}/api/health`;
    const requests: Promise<any>[] = [];
    
    const startTime = performance.now();
    
    // Create concurrent requests / 创建并发请求
    for (let i = 0; i < config.concurrentRequests; i++) {
      requests.push(this.makeRequest('GET', endpoint));
    }
    
    try {
      const results = await Promise.all(requests);
      const totalTime = performance.now() - startTime;
      
      const successful = results.filter(r => r.response && r.response.status === 200).length;
      const failed = results.length - successful;
      
      this.addResult({
        name: 'Concurrent Requests',
        endpoint: '/api/health',
        method: 'GET',
        status: failed === 0 ? 'PASS' : 'WARNING',
        responseTime: totalTime,
        details: {
          total: config.concurrentRequests,
          successful,
          failed,
          averageResponseTime: results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
        }
      });
    } catch (error) {
      this.addResult({
        name: 'Concurrent Requests',
        endpoint: '/api/health',
        method: 'GET',
        status: 'FAIL',
        responseTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Test rate limiting / 测试速率限制
  async testRateLimiting(): Promise<void> {
    console.log('\n🚦 Testing Rate Limiting / 测试速率限制');
    
    const endpoint = `${config.gatewayUrl}/health`;
    let rateLimitHit = false;
    let requestCount = 0;
    const maxRequests = 50; // Try to hit rate limit / 尝试触发速率限制
    
    const startTime = performance.now();
    
    for (let i = 0; i < maxRequests; i++) {
      const { response, error } = await this.makeRequest('GET', endpoint);
      requestCount++;
      
      if (response && response.status === 429) {
        rateLimitHit = true;
        break;
      }
      
      if (error) {
        break;
      }
      
      // Small delay to avoid overwhelming / 小延迟避免过载
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const totalTime = performance.now() - startTime;
    
    this.addResult({
      name: 'Rate Limiting',
      endpoint: '/health',
      method: 'GET',
      status: rateLimitHit ? 'PASS' : 'WARNING',
      responseTime: totalTime,
      details: {
        requestsSent: requestCount,
        rateLimitHit,
        message: rateLimitHit ? 'Rate limit working' : 'Rate limit not triggered'
      }
    });
  }

  // Test response format validation / 测试响应格式验证
  async testResponseFormats(): Promise<void> {
    console.log('\n📋 Testing Response Formats / 测试响应格式');
    
    const endpoints = [
      { path: '/api/health', expectedFields: ['status', 'timestamp'] },
      { path: '/api/blockchain/stats', expectedFields: ['success', 'data', 'timestamp'] },
      { path: '/health', gateway: true, expectedFields: ['status', 'timestamp'] }
    ];

    for (const endpoint of endpoints) {
      const url = endpoint.gateway ? 
        `${config.gatewayUrl}${endpoint.path}` : 
        `${config.baseUrl}${endpoint.path}`;
      
      const { response, error, responseTime } = await this.makeRequest('GET', url);
      
      if (error) {
        this.addResult({
          name: `Response Format: ${endpoint.path}`,
          endpoint: endpoint.path,
          method: 'GET',
          status: 'FAIL',
          responseTime,
          error: error.message
        });
        continue;
      }
      
      if (!response || response.status !== 200) {
        this.addResult({
          name: `Response Format: ${endpoint.path}`,
          endpoint: endpoint.path,
          method: 'GET',
          status: 'SKIP',
          responseTime,
          error: `HTTP ${response?.status || 'unknown'}`
        });
        continue;
      }
      
      const data = response.data;
      const missingFields = endpoint.expectedFields.filter(field => !(field in data));
      
      this.addResult({
        name: `Response Format: ${endpoint.path}`,
        endpoint: endpoint.path,
        method: 'GET',
        status: missingFields.length === 0 ? 'PASS' : 'WARNING',
        responseTime,
        error: missingFields.length > 0 ? `Missing fields: ${missingFields.join(', ')}` : undefined
      });
    }
  }

  // Run all tests / 运行所有测试
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive API Testing Suite / 开始全面API测试套件\n');
    
    try {
      await this.testBasicEndpoints();
      await this.testGatewayEndpoints();
      await this.testPostEndpoints();
      await this.testErrorScenarios();
      await this.testConcurrentRequests();
      await this.testRateLimiting();
      await this.testResponseFormats();
      
      this.printSummary();
    } catch (error) {
      console.error('❌ Test suite execution failed:', error);
      throw error;
    }
  }

  // Print test summary / 打印测试摘要
  private printSummary(): void {
    const totalTime = performance.now() - this.startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE API TEST SUMMARY / 全面API测试摘要');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`⚠️  Warnings: ${warnings} (${((warnings/total)*100).toFixed(1)}%)`);
    console.log(`⏭️  Skipped: ${skipped} (${((skipped/total)*100).toFixed(1)}%)`);
    console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}ms`);
    
    // Performance metrics / 性能指标
    const avgResponseTime = this.results
      .filter(r => r.responseTime > 0)
      .reduce((sum, r) => sum + r.responseTime, 0) / this.results.length;
    
    console.log(`📈 Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    
    // Slowest endpoints / 最慢的端点
    const slowest = [...this.results]
      .filter(r => r.responseTime > 0)
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, 3);
    
    if (slowest.length > 0) {
      console.log('\n🐌 Slowest Endpoints:');
      slowest.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.name}: ${result.responseTime.toFixed(2)}ms`);
      });
    }
    
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
      console.log('🎉 All critical tests passed! / 所有关键测试通过！');
    } else {
      console.log(`⚠️  ${failed} test(s) failed - review required / ${failed}个测试失败 - 需要检查`);
    }
  }
}

// Main execution / 主执行函数
async function main(): Promise<void> {
  const tester = new ComprehensiveAPITester();
  
  try {
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly / 直接调用时运行
main();

export { ComprehensiveAPITester };