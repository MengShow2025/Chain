#!/usr/bin/env node

/**
 * Simple API Endpoint Testing Suite / 简化API端点测试套件
 * Tests available endpoints with basic functionality / 测试可用端点的基本功能
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import { performance } from 'perf_hooks';

// Test configuration / 测试配置
interface SimpleTestConfig {
  baseUrl: string;
  gatewayUrl: string;
  timeout: number;
  maxRetries: number;
}

const config: SimpleTestConfig = {
  baseUrl: 'http://localhost:3001',
  gatewayUrl: 'http://localhost:8889',
  timeout: 5000,
  maxRetries: 2
};

// Test result interface / 测试结果接口
interface TestResult {
  name: string;
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  statusCode?: number;
  responseTime: number;
  error?: string;
  data?: any;
}

class SimpleAPITester {
  private results: TestResult[] = [];

  // Make HTTP request with retry logic / 发送HTTP请求并重试
  private async makeRequest(
    method: string, 
    url: string, 
    data?: any
  ): Promise<{ response?: AxiosResponse; error?: AxiosError; responseTime: number }> {
    const startTime = performance.now();
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const response = await axios({
          method,
          url,
          data,
          timeout: config.timeout,
          validateStatus: () => true // Accept all status codes
        });
        
        const responseTime = performance.now() - startTime;
        return { response, responseTime };
      } catch (error) {
        if (attempt === config.maxRetries) {
          const responseTime = performance.now() - startTime;
          return { error: error as AxiosError, responseTime };
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      }
    }
    
    const responseTime = performance.now() - startTime;
    return { error: new Error('Max retries exceeded') as any, responseTime };
  }

  // Add test result / 添加测试结果
  private addResult(result: TestResult): void {
    this.results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${result.name}: ${result.status} (${result.responseTime.toFixed(2)}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  // Test basic API endpoints / 测试基本API端点
  async testBasicEndpoints(): Promise<void> {
    console.log('\n🔍 Testing Basic API Endpoints / 测试基本API端点');
    
    const endpoints = [
      { name: 'Health Check', path: '/api/health' },
      { name: 'API Status', path: '/api/status' },
      { name: 'System Info', path: '/api/info' },
      { name: 'Statistics', path: '/api/stats' }
    ];

    for (const endpoint of endpoints) {
      const { response, error, responseTime } = await this.makeRequest('GET', `${config.baseUrl}${endpoint.path}`);
      
      let status: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
      let errorMsg: string | undefined;
      
      if (error) {
        status = 'FAIL';
        errorMsg = error.message;
      } else if (response) {
        if (response.status >= 200 && response.status < 300) {
          status = 'PASS';
        } else if (response.status >= 400 && response.status < 500) {
          status = 'WARNING';
          errorMsg = `HTTP ${response.status}`;
        } else {
          status = 'FAIL';
          errorMsg = `HTTP ${response.status}`;
        }
      }

      this.addResult({
        name: endpoint.name,
        endpoint: endpoint.path,
        method: 'GET',
        status,
        statusCode: response?.status,
        responseTime,
        error: errorMsg,
        data: response?.data
      });
    }
  }

  // Test gateway endpoints / 测试网关端点
  async testGatewayEndpoints(): Promise<void> {
    console.log('\n🌐 Testing Gateway Endpoints / 测试网关端点');
    
    const endpoints = [
      { name: 'Gateway Health', path: '/health' },
      { name: 'Gateway Stats', path: '/stats' },
      { name: 'Load Balancer Status', path: '/load-balancer/status' },
      { name: 'Circuit Breaker Status', path: '/circuit-breaker/status' }
    ];

    for (const endpoint of endpoints) {
      const { response, error, responseTime } = await this.makeRequest('GET', `${config.gatewayUrl}${endpoint.path}`);
      
      let status: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
      let errorMsg: string | undefined;
      
      if (error) {
        status = 'FAIL';
        errorMsg = error.message;
      } else if (response) {
        if (response.status >= 200 && response.status < 300) {
          status = 'PASS';
        } else if (response.status >= 400 && response.status < 500) {
          status = 'WARNING';
          errorMsg = `HTTP ${response.status}`;
        } else {
          status = 'FAIL';
          errorMsg = `HTTP ${response.status}`;
        }
      }

      this.addResult({
        name: endpoint.name,
        endpoint: endpoint.path,
        method: 'GET',
        status,
        statusCode: response?.status,
        responseTime,
        error: errorMsg,
        data: response?.data
      });
    }
  }

  // Test POST endpoints / 测试POST端点
  async testPostEndpoints(): Promise<void> {
    console.log('\n📝 Testing POST Endpoints / 测试POST端点');
    
    const postTests = [
      {
        name: 'Submit Transaction',
        path: '/api/transactions/submit',
        data: {
          from: '0x1234567890123456789012345678901234567890',
          to: '0x0987654321098765432109876543210987654321',
          value: '1000000000000000000',
          gas: '21000'
        }
      },
      {
        name: 'Create Block',
        path: '/api/blocks/create',
        data: {
          transactions: [],
          timestamp: Date.now(),
          previousHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
        }
      }
    ];

    for (const test of postTests) {
      const { response, error, responseTime } = await this.makeRequest('POST', `${config.baseUrl}${test.path}`, test.data);
      
      let status: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
      let errorMsg: string | undefined;
      
      if (error) {
        status = 'FAIL';
        errorMsg = error.message;
      } else if (response) {
        if (response.status >= 200 && response.status < 300) {
          status = 'PASS';
        } else if (response.status >= 400 && response.status < 500) {
          status = 'WARNING';
          errorMsg = `HTTP ${response.status}`;
        } else {
          status = 'FAIL';
          errorMsg = `HTTP ${response.status}`;
        }
      }

      this.addResult({
        name: test.name,
        endpoint: test.path,
        method: 'POST',
        status,
        statusCode: response?.status,
        responseTime,
        error: errorMsg,
        data: response?.data
      });
    }
  }

  // Test error scenarios / 测试错误场景
  async testErrorScenarios(): Promise<void> {
    console.log('\n🚨 Testing Error Scenarios / 测试错误场景');
    
    const errorTests = [
      {
        name: 'Invalid Endpoint',
        path: '/api/nonexistent',
        expectedStatus: 404
      },
      {
        name: 'Invalid Method',
        path: '/api/health',
        method: 'DELETE',
        expectedStatus: 405
      },
      {
        name: 'Invalid JSON',
        path: '/api/transactions/submit',
        method: 'POST',
        data: 'invalid json',
        expectedStatus: 400
      }
    ];

    for (const test of errorTests) {
      const { response, error, responseTime } = await this.makeRequest(
        test.method || 'GET', 
        `${config.baseUrl}${test.path}`, 
        test.data
      );
      
      let status: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
      let errorMsg: string | undefined;
      
      if (error) {
        status = 'WARNING';
        errorMsg = error.message;
      } else if (response) {
        if (response.status === test.expectedStatus) {
          status = 'PASS';
        } else {
          status = 'WARNING';
          errorMsg = `Expected ${test.expectedStatus}, got ${response.status}`;
        }
      }

      this.addResult({
        name: test.name,
        endpoint: test.path,
        method: test.method || 'GET',
        status,
        statusCode: response?.status,
        responseTime,
        error: errorMsg
      });
    }
  }

  // Print test summary / 打印测试摘要
  private printSummary(): void {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / total;
    const maxResponseTime = Math.max(...this.results.map(r => r.responseTime));
    const minResponseTime = Math.min(...this.results.map(r => r.responseTime));

    console.log('\n' + '='.repeat(80));
    console.log('📊 SIMPLE API TEST SUMMARY / 简化API测试摘要');
    console.log('='.repeat(80));
    
    console.log('\n📋 Test Results:');
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`⚠️  Warnings: ${warnings} (${((warnings/total)*100).toFixed(1)}%)`);
    
    console.log('\n⚡ Performance Metrics:');
    console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Min Response Time: ${minResponseTime.toFixed(2)}ms`);
    console.log(`Max Response Time: ${maxResponseTime.toFixed(2)}ms`);
    
    // Show failed tests / 显示失败的测试
    const failedTests = this.results.filter(r => r.status === 'FAIL');
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(result => {
        console.log(`  - ${result.name}: ${result.error || 'Unknown error'}`);
      });
    }
    
    // Show warnings / 显示警告
    const warningTests = this.results.filter(r => r.status === 'WARNING');
    if (warningTests.length > 0) {
      console.log('\n⚠️  Warning Tests:');
      warningTests.forEach(result => {
        console.log(`  - ${result.name}: ${result.error || 'Warning condition'}`);
      });
    }
    
    console.log('\n💡 Recommendations:');
    if (failed > 0) {
      console.log('  ❌ Some tests failed - check API server status and endpoints');
    }
    if (warnings > 0) {
      console.log('  ⚠️  Some tests have warnings - review endpoint behavior');
    }
    if (avgResponseTime > 1000) {
      console.log('  ⚡ Average response time is high - consider performance optimization');
    }
    if (failed === 0 && warnings === 0) {
      console.log('  🎉 All tests passed successfully!');
    }
    
    console.log('='.repeat(80));
  }

  // Run all tests / 运行所有测试
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Simple API Testing Suite / 开始简化API测试套件\n');
    console.log(`📊 Configuration:
    - Base URL: ${config.baseUrl}
    - Gateway URL: ${config.gatewayUrl}
    - Timeout: ${config.timeout}ms
    - Max Retries: ${config.maxRetries}
    `);
    
    try {
      await this.testBasicEndpoints();
      await this.testGatewayEndpoints();
      await this.testPostEndpoints();
      await this.testErrorScenarios();
      
      this.printSummary();
    } catch (error) {
      console.error('❌ Simple test suite execution failed:', error);
      throw error;
    }
  }
}

// Main execution / 主执行函数
async function main(): Promise<void> {
  try {
    const tester = new SimpleAPITester();
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests / 运行测试
main();

export { SimpleAPITester, SimpleTestConfig, TestResult };