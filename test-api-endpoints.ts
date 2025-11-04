#!/usr/bin/env node
// API endpoints testing script / API端点测试脚本

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3001';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  error?: string;
  responseTime: number;
}

class APITester {
  private baseUrl = 'http://localhost:3001';
  private results: TestResult[] = [];

  async testEndpoint(endpoint: string, method: string = 'GET', body?: any): Promise<TestResult> {
    const startTime = Date.now();
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const options: any = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;
      
      const result: TestResult = {
        endpoint,
        method,
        status: response.status,
        success: response.ok,
        responseTime
      };
      
      if (!response.ok) {
        result.error = `HTTP ${response.status} ${response.statusText}`;
      }
      
      this.results.push(result);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const result: TestResult = {
        endpoint,
        method,
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime
      };
      
      this.results.push(result);
      return result;
    }
  }

  async runTests(): Promise<void> {
    console.log('🚀 Starting API endpoint tests...\n');

    // Test basic endpoints / 测试基础端点
    await this.testEndpoint('/api/health');
    await this.testEndpoint('/api/transactions');
    await this.testEndpoint('/api/transactions/pool/stats');
    await this.testEndpoint('/api/blockchain/stats');
    await this.testEndpoint('/api/auth/status');
    
    // Test security endpoints / 测试安全端点
    await this.testEndpoint('/api/security/overview');
    await this.testEndpoint('/api/security/health');
    
    // Test invalid endpoints / 测试无效端点
    await this.testEndpoint('/api/nonexistent');
    
    // Test POST endpoints / 测试POST端点
    await this.testEndpoint('/api/transactions/submit', 'POST', {
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      value: '1000000000000000000',
      gas: '21000',
      gasPrice: '20000000000',
      data: '0x'
    });

    this.printResults();
  }

  private printResults(): void {
    console.log('\n📊 API Test Results:');
    console.log('=' .repeat(80));
    
    let passed = 0;
    let failed = 0;
    
    for (const result of this.results) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const timing = `${result.responseTime}ms`;
      
      console.log(`${status} ${result.method.padEnd(4)} ${result.endpoint.padEnd(30)} ${result.status.toString().padEnd(3)} ${timing}`);
      
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
      
      if (result.success) {
        passed++;
      } else {
        failed++;
      }
    }
    
    console.log('=' .repeat(80));
    console.log(`Total: ${this.results.length} | Passed: ${passed} | Failed: ${failed}`);
    
    if (failed === 0) {
      console.log('🎉 All API tests passed!');
    } else {
      console.log(`⚠️  ${failed} test(s) failed`);
    }
  }
}

// Run tests / 运行测试
async function main() {
  const tester = new APITester();
  
  try {
    await tester.runTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the main function / 运行主函数
main();