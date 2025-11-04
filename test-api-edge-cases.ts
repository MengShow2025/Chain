#!/usr/bin/env node
/**
 * Edge Cases and Boundary Conditions Testing Suite / 边界条件和极端情况测试套件
 * Comprehensive testing for error handling, limits, and edge scenarios
 * 全面测试错误处理、限制和边界场景
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

// Edge case test configuration / 边界条件测试配置
interface EdgeCaseTestConfig {
  baseUrl: string;
  gatewayUrl: string;
  timeout: number;
  maxRetries: number;
  rateLimitWindow: number;      // Rate limit testing window in ms / 限流测试窗口(毫秒)
  maxPayloadSize: number;       // Maximum payload size for testing / 测试的最大载荷大小
  concurrentRequests: number;   // Concurrent requests for stress testing / 压力测试的并发请求数
  maliciousPatterns: string[];  // Malicious input patterns / 恶意输入模式
}

const config: EdgeCaseTestConfig = {
  baseUrl: 'http://localhost:3001',
  gatewayUrl: 'http://localhost:8889',
  timeout: 30000, // Longer timeout for edge cases / 边界条件的更长超时时间
  maxRetries: 2,
  rateLimitWindow: 60000, // 1 minute / 1分钟
  maxPayloadSize: 50 * 1024 * 1024, // 50MB
  concurrentRequests: 200,
  maliciousPatterns: [
    // SQL Injection patterns / SQL注入模式
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "'; SELECT * FROM information_schema.tables; --",
    "' UNION SELECT username, password FROM users --",
    
    // XSS patterns / XSS模式
    "<script>alert('XSS')</script>",
    "javascript:alert('XSS')",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    
    // Path traversal patterns / 路径遍历模式
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\config\\sam",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    
    // Command injection patterns / 命令注入模式
    "; cat /etc/passwd",
    "| whoami",
    "&& ls -la",
    "`id`",
    
    // NoSQL injection patterns / NoSQL注入模式
    "'; return db.users.find(); var dummy='",
    "'; return this.username == 'admin' && this.password == 'admin'; var dummy='",
    
    // LDAP injection patterns / LDAP注入模式
    "*)(uid=*",
    "*)(|(password=*))",
    
    // XML injection patterns / XML注入模式
    "<?xml version=\"1.0\"?><!DOCTYPE root [<!ENTITY test SYSTEM 'file:///etc/passwd'>]><root>&test;</root>",
    
    // Buffer overflow patterns / 缓冲区溢出模式
    "A".repeat(10000),
    "\x00".repeat(1000),
    
    // Unicode and encoding attacks / Unicode和编码攻击
    "%c0%ae%c0%ae%c0%af",
    "\u0000",
    "\uFEFF",
    
    // Format string attacks / 格式字符串攻击
    "%s%s%s%s%s%s%s%s%s%s",
    "%x%x%x%x%x%x%x%x%x%x"
  ]
};

// Edge case test result interface / 边界条件测试结果接口
interface EdgeCaseTestResult {
  name: string;
  category: 'input_validation' | 'rate_limiting' | 'payload_limits' | 'concurrent_access' | 'malicious_input' | 'network_conditions' | 'resource_exhaustion';
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'CRITICAL' | 'SKIP';
  statusCode?: number;
  responseTime: number;
  error?: string;
  details?: any;
  securityRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation?: string;
}

// Network simulation utilities / 网络模拟工具
class NetworkSimulator {
  // Simulate slow network conditions / 模拟慢网络条件
  static async simulateSlowNetwork<T>(promise: Promise<T>, delay: number = 5000): Promise<T> {
    const slowPromise = new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        promise.then(resolve).catch(reject);
      }, delay);
    });
    
    return slowPromise;
  }

  // Simulate network interruption / 模拟网络中断
  static async simulateNetworkInterruption<T>(promise: Promise<T>, interruptAfter: number = 2000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Network interruption simulated'));
      }, interruptAfter);

      promise
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}

// Payload generator utilities / 载荷生成工具
class PayloadGenerator {
  // Generate large JSON payload / 生成大型JSON载荷
  static generateLargeJSON(sizeInMB: number): any {
    const targetSize = sizeInMB * 1024 * 1024;
    const baseObject = { data: [] };
    const itemSize = JSON.stringify({ id: 1, value: "x".repeat(100) }).length;
    const itemCount = Math.floor(targetSize / itemSize);

    for (let i = 0; i < itemCount; i++) {
      baseObject.data.push({
        id: i,
        value: "x".repeat(100),
        timestamp: Date.now(),
        metadata: {
          index: i,
          hash: crypto.randomBytes(32).toString('hex')
        }
      });
    }

    return baseObject;
  }

  // Generate malformed JSON / 生成格式错误的JSON
  static generateMalformedJSON(): string[] {
    return [
      '{"incomplete": ',
      '{"duplicate": "key", "duplicate": "key"}',
      '{"nested": {"deeply": {"very": {"much": {"too": {"deep": {"structure": {"here": "value"}}}}}}}}',
      '{"circular_ref": {"self": "{{circular_ref}}"}}',
      '{"invalid_escape": "\\z"}',
      '{"trailing_comma": "value",}',
      '{"unquoted_key": value}',
      '{"unicode_issue": "\\uXXXX"}',
      '{null: "null_key"}',
      '{"number_overflow": 1e999}'
    ];
  }

  // Generate boundary value inputs / 生成边界值输入
  static generateBoundaryValues(): any[] {
    return [
      // Numeric boundaries / 数值边界
      0,
      -1,
      1,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      Infinity,
      -Infinity,
      NaN,
      
      // String boundaries / 字符串边界
      "",
      " ",
      "\n",
      "\t",
      "\r\n",
      "null",
      "undefined",
      "true",
      "false",
      
      // Array boundaries / 数组边界
      [],
      [null],
      [undefined],
      new Array(10000).fill("x"),
      
      // Object boundaries / 对象边界
      {},
      { null: null },
      { undefined: undefined },
      Object.create(null)
    ];
  }
}

// Main edge case testing class / 主要边界条件测试类
class EdgeCaseAPITester {
  private results: EdgeCaseTestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = performance.now();
  }

  private addResult(result: EdgeCaseTestResult): void {
    this.results.push(result);
    
    // Print result immediately / 立即打印结果
    const icon = this.getStatusIcon(result.status);
    const riskIcon = result.securityRisk ? this.getSecurityRiskIcon(result.securityRisk) : '';
    
    console.log(`${icon} ${result.name} - ${result.endpoint} (${result.responseTime.toFixed(0)}ms) ${riskIcon}`);
    
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    }
    
    if (result.recommendation) {
      console.log(`   💡 Recommendation: ${result.recommendation}`);
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'PASS': return '✅';
      case 'FAIL': return '❌';
      case 'WARNING': return '⚠️';
      case 'CRITICAL': return '🚨';
      case 'SKIP': return '⏭️';
      default: return '❓';
    }
  }

  private getSecurityRiskIcon(risk: string): string {
    switch (risk) {
      case 'LOW': return '🟢';
      case 'MEDIUM': return '🟡';
      case 'HIGH': return '🟠';
      case 'CRITICAL': return '🔴';
      default: return '';
    }
  }

  private async makeRequest(
    method: string, 
    url: string, 
    data?: any, 
    headers?: any,
    timeout?: number
  ): Promise<{ response?: AxiosResponse; error?: AxiosError; responseTime: number }> {
    const startTime = performance.now();
    
    try {
      const response = await axios({
        method,
        url,
        data,
        headers: {
          'User-Agent': 'TitanChain-EdgeCase-Tester/1.0',
          'X-Test-ID': crypto.randomUUID(),
          'X-Test-Type': 'edge-case',
          ...headers
        },
        timeout: timeout || config.timeout,
        validateStatus: () => true // Accept all status codes / 接受所有状态码
      });
      
      const responseTime = performance.now() - startTime;
      return { response, responseTime };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return { error: error as AxiosError, responseTime };
    }
  }

  // Test input validation / 测试输入验证
  async testInputValidation(): Promise<void> {
    console.log('\n🔍 Testing Input Validation / 测试输入验证');

    const validationTests = [
      // Empty and null inputs / 空值和null输入
      {
        name: 'Empty String Input',
        endpoint: '/api/search',
        method: 'GET',
        params: { q: '' },
        expectedBehavior: 'Should handle empty input gracefully'
      },
      {
        name: 'Null Parameter',
        endpoint: '/api/blockchain/blocks/null',
        method: 'GET',
        expectedBehavior: 'Should reject null parameter'
      },
      {
        name: 'Undefined Parameter',
        endpoint: '/api/blockchain/blocks/undefined',
        method: 'GET',
        expectedBehavior: 'Should reject undefined parameter'
      },
      
      // Type mismatch / 类型不匹配
      {
        name: 'String Instead of Number',
        endpoint: '/api/blockchain/blocks/not-a-number',
        method: 'GET',
        expectedBehavior: 'Should reject non-numeric block ID'
      },
      {
        name: 'Array Instead of String',
        endpoint: '/api/search',
        method: 'POST',
        data: { query: ['array', 'instead', 'of', 'string'] },
        expectedBehavior: 'Should reject array input for string field'
      },
      
      // Boundary values / 边界值
      {
        name: 'Maximum Integer Value',
        endpoint: '/api/blockchain/blocks/' + Number.MAX_SAFE_INTEGER,
        method: 'GET',
        expectedBehavior: 'Should handle maximum safe integer'
      },
      {
        name: 'Negative Block Number',
        endpoint: '/api/blockchain/blocks/-1',
        method: 'GET',
        expectedBehavior: 'Should reject negative block number'
      },
      {
        name: 'Zero Block Number',
        endpoint: '/api/blockchain/blocks/0',
        method: 'GET',
        expectedBehavior: 'Should handle genesis block or reject appropriately'
      }
    ];

    for (const test of validationTests) {
      let url = `${config.baseUrl}${test.endpoint}`;
      
      // Add query parameters if specified / 如果指定则添加查询参数
      if (test.params) {
        const params = new URLSearchParams(test.params as any);
        url += `?${params.toString()}`;
      }

      const { response, error, responseTime } = await this.makeRequest(
        test.method,
        url,
        test.data
      );

      // Evaluate response / 评估响应
      let status: EdgeCaseTestResult['status'] = 'PASS';
      let securityRisk: EdgeCaseTestResult['securityRisk'] = 'LOW';
      let recommendation = '';

      if (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          status = 'SKIP';
          recommendation = 'Service unavailable for testing';
        } else {
          status = 'FAIL';
          recommendation = 'Unexpected error occurred';
        }
      } else if (response) {
        if (response.status === 500) {
          status = 'CRITICAL';
          securityRisk = 'HIGH';
          recommendation = 'Server error indicates poor input validation';
        } else if (response.status === 400) {
          status = 'PASS';
          recommendation = 'Proper input validation implemented';
        } else if (response.status === 200) {
          // Check if this should have been rejected / 检查是否应该被拒绝
          if (test.endpoint.includes('null') || test.endpoint.includes('undefined') || test.endpoint.includes('-1')) {
            status = 'WARNING';
            securityRisk = 'MEDIUM';
            recommendation = 'Consider stricter input validation';
          }
        }
      }

      this.addResult({
        name: test.name,
        category: 'input_validation',
        endpoint: test.endpoint,
        method: test.method,
        status,
        statusCode: response?.status,
        responseTime,
        error: error?.message,
        securityRisk,
        recommendation,
        details: { expectedBehavior: test.expectedBehavior }
      });
    }
  }

  // Test rate limiting / 测试限流
  async testRateLimiting(): Promise<void> {
    console.log('\n🚦 Testing Rate Limiting / 测试限流');

    const rateLimitTests = [
      {
        name: 'Basic Rate Limit Test',
        endpoint: '/api/health',
        method: 'GET',
        requestCount: 100,
        timeWindow: 10000, // 10 seconds / 10秒
        expectedLimit: 50 // Expected to be rate limited after 50 requests / 预期50个请求后被限流
      },
      {
        name: 'API Key Rate Limit',
        endpoint: '/api/blockchain/status',
        method: 'GET',
        requestCount: 200,
        timeWindow: 60000, // 1 minute / 1分钟
        headers: { 'X-API-Key': 'test-api-key' },
        expectedLimit: 100
      },
      {
        name: 'POST Request Rate Limit',
        endpoint: '/api/transactions/submit',
        method: 'POST',
        requestCount: 50,
        timeWindow: 30000, // 30 seconds / 30秒
        data: { from: '0x123', to: '0x456', value: '1000' },
        expectedLimit: 20
      }
    ];

    for (const test of rateLimitTests) {
      console.log(`\n🔥 Running ${test.name} (${test.requestCount} requests in ${test.timeWindow}ms)...`);
      
      const url = `${config.baseUrl}${test.endpoint}`;
      const startTime = performance.now();
      const requests: Promise<any>[] = [];
      let rateLimitedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      // Send requests rapidly / 快速发送请求
      for (let i = 0; i < test.requestCount; i++) {
        const requestPromise = this.makeRequest(
          test.method,
          url,
          test.data,
          test.headers,
          5000 // Shorter timeout for rate limit tests / 限流测试的较短超时时间
        ).then(result => {
          if (result.response) {
            if (result.response.status === 429) {
              rateLimitedCount++;
            } else if (result.response.status >= 200 && result.response.status < 300) {
              successCount++;
            } else {
              errorCount++;
            }
          } else if (result.error) {
            errorCount++;
          }
          return result;
        });

        requests.push(requestPromise);

        // Small delay to avoid overwhelming the system / 小延迟以避免压垮系统
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Wait for all requests to complete / 等待所有请求完成
      await Promise.all(requests);

      const totalTime = performance.now() - startTime;
      const rateLimitRate = rateLimitedCount / test.requestCount;

      // Evaluate rate limiting effectiveness / 评估限流效果
      let status: EdgeCaseTestResult['status'] = 'PASS';
      let securityRisk: EdgeCaseTestResult['securityRisk'] = 'LOW';
      let recommendation = '';

      if (rateLimitedCount === 0) {
        status = 'CRITICAL';
        securityRisk = 'CRITICAL';
        recommendation = 'No rate limiting detected - implement rate limiting to prevent abuse';
      } else if (rateLimitedCount < test.expectedLimit * 0.5) {
        status = 'WARNING';
        securityRisk = 'MEDIUM';
        recommendation = 'Rate limiting may be too lenient';
      } else if (rateLimitedCount > test.requestCount * 0.9) {
        status = 'WARNING';
        securityRisk = 'LOW';
        recommendation = 'Rate limiting may be too strict';
      } else {
        status = 'PASS';
        recommendation = 'Rate limiting appears to be working correctly';
      }

      this.addResult({
        name: test.name,
        category: 'rate_limiting',
        endpoint: test.endpoint,
        method: test.method,
        status,
        responseTime: totalTime / test.requestCount, // Average response time / 平均响应时间
        securityRisk,
        recommendation,
        details: {
          totalRequests: test.requestCount,
          rateLimitedRequests: rateLimitedCount,
          successfulRequests: successCount,
          errorRequests: errorCount,
          rateLimitRate: `${(rateLimitRate * 100).toFixed(1)}%`,
          totalTime: `${totalTime.toFixed(2)}ms`
        }
      });
    }
  }

  // Test payload limits / 测试载荷限制
  async testPayloadLimits(): Promise<void> {
    console.log('\n📦 Testing Payload Limits / 测试载荷限制');

    const payloadTests = [
      {
        name: 'Small JSON Payload',
        endpoint: '/api/transactions/submit',
        method: 'POST',
        payloadSize: 1024, // 1KB
        expectedStatus: [200, 400] // Either accepted or rejected with validation error / 要么接受要么因验证错误被拒绝
      },
      {
        name: 'Medium JSON Payload',
        endpoint: '/api/transactions/submit',
        method: 'POST',
        payloadSize: 1024 * 100, // 100KB
        expectedStatus: [200, 400, 413]
      },
      {
        name: 'Large JSON Payload',
        endpoint: '/api/transactions/submit',
        method: 'POST',
        payloadSize: 1024 * 1024, // 1MB
        expectedStatus: [413, 400] // Should be rejected / 应该被拒绝
      },
      {
        name: 'Very Large JSON Payload',
        endpoint: '/api/transactions/submit',
        method: 'POST',
        payloadSize: 1024 * 1024 * 10, // 10MB
        expectedStatus: [413] // Must be rejected / 必须被拒绝
      },
      {
        name: 'Extremely Large Payload',
        endpoint: '/api/transactions/submit',
        method: 'POST',
        payloadSize: 1024 * 1024 * 50, // 50MB
        expectedStatus: [413] // Must be rejected / 必须被拒绝
      }
    ];

    for (const test of payloadTests) {
      console.log(`\n📊 Testing ${test.name} (${(test.payloadSize / 1024).toFixed(1)}KB)...`);
      
      // Generate payload of specified size / 生成指定大小的载荷
      const payload = PayloadGenerator.generateLargeJSON(test.payloadSize / (1024 * 1024));
      
      const { response, error, responseTime } = await this.makeRequest(
        test.method,
        `${config.baseUrl}${test.endpoint}`,
        payload,
        { 'Content-Type': 'application/json' },
        60000 // Longer timeout for large payloads / 大载荷的更长超时时间
      );

      // Evaluate payload handling / 评估载荷处理
      let status: EdgeCaseTestResult['status'] = 'PASS';
      let securityRisk: EdgeCaseTestResult['securityRisk'] = 'LOW';
      let recommendation = '';

      if (error) {
        if (error.code === 'ECONNABORTED') {
          status = 'WARNING';
          recommendation = 'Request timed out - consider implementing streaming or chunked processing';
        } else {
          status = 'FAIL';
          recommendation = 'Unexpected error handling large payload';
        }
      } else if (response) {
        const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
        
        if (expectedStatuses.includes(response.status)) {
          status = 'PASS';
          if (response.status === 413) {
            recommendation = 'Proper payload size limiting implemented';
          } else if (response.status === 200 && test.payloadSize > 1024 * 1024) {
            status = 'WARNING';
            securityRisk = 'MEDIUM';
            recommendation = 'Consider implementing stricter payload size limits';
          }
        } else {
          status = 'WARNING';
          recommendation = `Unexpected status ${response.status}, expected ${expectedStatuses.join(' or ')}`;
        }

        // Check for memory issues / 检查内存问题
        if (response.status === 500 && test.payloadSize > 1024 * 1024) {
          status = 'CRITICAL';
          securityRisk = 'HIGH';
          recommendation = 'Server error with large payload indicates potential DoS vulnerability';
        }
      }

      this.addResult({
        name: test.name,
        category: 'payload_limits',
        endpoint: test.endpoint,
        method: test.method,
        status,
        statusCode: response?.status,
        responseTime,
        error: error?.message,
        securityRisk,
        recommendation,
        details: {
          payloadSize: `${(test.payloadSize / 1024).toFixed(1)}KB`,
          expectedStatus: test.expectedStatus
        }
      });
    }
  }

  // Test malformed JSON / 测试格式错误的JSON
  async testMalformedJSON(): Promise<void> {
    console.log('\n🔧 Testing Malformed JSON Handling / 测试格式错误的JSON处理');

    const malformedJSONs = PayloadGenerator.generateMalformedJSON();

    for (let i = 0; i < malformedJSONs.length; i++) {
      const malformedJSON = malformedJSONs[i];
      const testName = `Malformed JSON Test ${i + 1}`;

      const { response, error, responseTime } = await this.makeRequest(
        'POST',
        `${config.baseUrl}/api/transactions/submit`,
        malformedJSON,
        { 'Content-Type': 'application/json' }
      );

      // Evaluate malformed JSON handling / 评估格式错误JSON的处理
      let status: EdgeCaseTestResult['status'] = 'PASS';
      let securityRisk: EdgeCaseTestResult['securityRisk'] = 'LOW';
      let recommendation = '';

      if (error) {
        status = 'FAIL';
        recommendation = 'Unexpected error handling malformed JSON';
      } else if (response) {
        if (response.status === 400) {
          status = 'PASS';
          recommendation = 'Proper JSON validation implemented';
        } else if (response.status === 200) {
          status = 'CRITICAL';
          securityRisk = 'HIGH';
          recommendation = 'Malformed JSON was accepted - implement proper JSON validation';
        } else if (response.status === 500) {
          status = 'CRITICAL';
          securityRisk = 'HIGH';
          recommendation = 'Server error with malformed JSON indicates parsing vulnerability';
        }
      }

      this.addResult({
        name: testName,
        category: 'input_validation',
        endpoint: '/api/transactions/submit',
        method: 'POST',
        status,
        statusCode: response?.status,
        responseTime,
        error: error?.message,
        securityRisk,
        recommendation,
        details: {
          malformedJSON: malformedJSON.substring(0, 100) + (malformedJSON.length > 100 ? '...' : '')
        }
      });
    }
  }

  // Test malicious input patterns / 测试恶意输入模式
  async testMaliciousInputs(): Promise<void> {
    console.log('\n🛡️ Testing Malicious Input Patterns / 测试恶意输入模式');

    const endpoints = [
      '/api/search',
      '/api/blockchain/blocks/',
      '/api/transactions/submit',
      '/api/users/profile'
    ];

    for (const pattern of config.maliciousPatterns) {
      for (const endpoint of endpoints) {
        const testName = `Malicious Input: ${pattern.substring(0, 30)}${pattern.length > 30 ? '...' : ''}`;
        
        // Test as query parameter / 作为查询参数测试
        const queryUrl = `${config.baseUrl}${endpoint}?input=${encodeURIComponent(pattern)}`;
        const { response: queryResponse, error: queryError, responseTime: queryTime } = 
          await this.makeRequest('GET', queryUrl);

        // Test as POST data / 作为POST数据测试
        const { response: postResponse, error: postError, responseTime: postTime } = 
          await this.makeRequest('POST', `${config.baseUrl}${endpoint}`, { input: pattern });

        // Evaluate both tests / 评估两个测试
        const responses = [
          { type: 'Query', response: queryResponse, error: queryError, time: queryTime },
          { type: 'POST', response: postResponse, error: postError, time: postTime }
        ];

        for (const test of responses) {
          let status: EdgeCaseTestResult['status'] = 'PASS';
          let securityRisk: EdgeCaseTestResult['securityRisk'] = 'LOW';
          let recommendation = '';

          if (test.error) {
            status = 'FAIL';
            recommendation = 'Unexpected error with malicious input';
          } else if (test.response) {
            if (test.response.status === 400) {
              status = 'PASS';
              recommendation = 'Proper input sanitization implemented';
            } else if (test.response.status === 200) {
              // Check response for signs of successful injection / 检查响应是否有成功注入的迹象
              const responseText = JSON.stringify(test.response.data).toLowerCase();
              
              if (responseText.includes('error') || 
                  responseText.includes('syntax') || 
                  responseText.includes('exception') ||
                  responseText.includes('stack trace')) {
                status = 'WARNING';
                securityRisk = 'MEDIUM';
                recommendation = 'Response may contain error information that could aid attackers';
              } else if (pattern.includes('script') && responseText.includes('script')) {
                status = 'CRITICAL';
                securityRisk = 'CRITICAL';
                recommendation = 'Potential XSS vulnerability detected';
              } else if (pattern.includes('SELECT') && responseText.includes('select')) {
                status = 'CRITICAL';
                securityRisk = 'CRITICAL';
                recommendation = 'Potential SQL injection vulnerability detected';
              }
            } else if (test.response.status === 500) {
              status = 'CRITICAL';
              securityRisk = 'HIGH';
              recommendation = 'Server error with malicious input indicates potential vulnerability';
            }
          }

          this.addResult({
            name: `${testName} (${test.type})`,
            category: 'malicious_input',
            endpoint: endpoint,
            method: test.type === 'Query' ? 'GET' : 'POST',
            status,
            statusCode: test.response?.status,
            responseTime: test.time,
            error: test.error?.message,
            securityRisk,
            recommendation,
            details: {
              inputPattern: pattern,
              testType: test.type
            }
          });
        }
      }
    }
  }

  // Test concurrent access / 测试并发访问
  async testConcurrentAccess(): Promise<void> {
    console.log('\n🔄 Testing Concurrent Access / 测试并发访问');

    const concurrencyTests = [
      {
        name: 'High Concurrency Read Operations',
        endpoint: '/api/blockchain/status',
        method: 'GET',
        concurrency: 100,
        duration: 10000 // 10 seconds / 10秒
      },
      {
        name: 'Concurrent Write Operations',
        endpoint: '/api/transactions/submit',
        method: 'POST',
        data: { from: '0x123', to: '0x456', value: '1000' },
        concurrency: 50,
        duration: 15000 // 15 seconds / 15秒
      },
      {
        name: 'Mixed Read/Write Operations',
        endpoint: '/api/blockchain/blocks/latest',
        method: 'GET',
        concurrency: 75,
        duration: 12000 // 12 seconds / 12秒
      }
    ];

    for (const test of concurrencyTests) {
      console.log(`\n🚀 Running ${test.name} (${test.concurrency} concurrent requests)...`);
      
      const url = `${config.baseUrl}${test.endpoint}`;
      const startTime = performance.now();
      const endTime = startTime + test.duration;
      const requests: Promise<any>[] = [];
      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;
      let timeoutCount = 0;
      const responseTimes: number[] = [];

      // Generate concurrent requests / 生成并发请求
      while (performance.now() < endTime) {
        if (requests.length < test.concurrency) {
          const requestPromise = this.makeRequest(test.method, url, test.data, {}, 10000)
            .then(result => {
              requestCount++;
              responseTimes.push(result.responseTime);
              
              if (result.response && result.response.status >= 200 && result.response.status < 300) {
                successCount++;
              } else if (result.error?.code === 'ECONNABORTED') {
                timeoutCount++;
              } else {
                errorCount++;
              }
              
              return result;
            });
          
          requests.push(requestPromise);
        }
        
        // Small delay to prevent overwhelming / 小延迟以防止压垮
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for all requests to complete / 等待所有请求完成
      await Promise.all(requests);

      const totalTime = performance.now() - startTime;
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const successRate = successCount / requestCount;
      const errorRate = errorCount / requestCount;
      const timeoutRate = timeoutCount / requestCount;

      // Evaluate concurrent access handling / 评估并发访问处理
      let status: EdgeCaseTestResult['status'] = 'PASS';
      let securityRisk: EdgeCaseTestResult['securityRisk'] = 'LOW';
      let recommendation = '';

      if (errorRate > 0.1) { // More than 10% errors / 超过10%的错误
        status = 'CRITICAL';
        securityRisk = 'HIGH';
        recommendation = 'High error rate under concurrent load indicates potential DoS vulnerability';
      } else if (timeoutRate > 0.2) { // More than 20% timeouts / 超过20%的超时
        status = 'WARNING';
        securityRisk = 'MEDIUM';
        recommendation = 'High timeout rate indicates performance issues under load';
      } else if (successRate < 0.8) { // Less than 80% success / 少于80%的成功率
        status = 'WARNING';
        recommendation = 'Low success rate under concurrent load';
      } else {
        status = 'PASS';
        recommendation = 'System handles concurrent access well';
      }

      this.addResult({
        name: test.name,
        category: 'concurrent_access',
        endpoint: test.endpoint,
        method: test.method,
        status,
        responseTime: avgResponseTime,
        securityRisk,
        recommendation,
        details: {
          totalRequests: requestCount,
          successfulRequests: successCount,
          errorRequests: errorCount,
          timeoutRequests: timeoutCount,
          successRate: `${(successRate * 100).toFixed(1)}%`,
          errorRate: `${(errorRate * 100).toFixed(1)}%`,
          timeoutRate: `${(timeoutRate * 100).toFixed(1)}%`,
          avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
          duration: `${totalTime.toFixed(2)}ms`
        }
      });
    }
  }

  // Test network conditions / 测试网络条件
  async testNetworkConditions(): Promise<void> {
    console.log('\n🌐 Testing Network Conditions / 测试网络条件');

    const networkTests = [
      {
        name: 'Slow Network Simulation',
        endpoint: '/api/health',
        method: 'GET',
        networkDelay: 5000, // 5 second delay / 5秒延迟
        expectedBehavior: 'Should handle slow network gracefully'
      },
      {
        name: 'Network Interruption Simulation',
        endpoint: '/api/blockchain/status',
        method: 'GET',
        interruptAfter: 2000, // Interrupt after 2 seconds / 2秒后中断
        expectedBehavior: 'Should handle network interruption'
      },
      {
        name: 'Connection Timeout Test',
        endpoint: '/api/blockchain/blocks/latest',
        method: 'GET',
        timeout: 1000, // Very short timeout / 非常短的超时时间
        expectedBehavior: 'Should timeout gracefully'
      }
    ];

    for (const test of networkTests) {
      let result: { response?: AxiosResponse; error?: AxiosError; responseTime: number };

      if (test.networkDelay) {
        // Simulate slow network / 模拟慢网络
        const requestPromise = this.makeRequest(test.method, `${config.baseUrl}${test.endpoint}`);
        result = await NetworkSimulator.simulateSlowNetwork(requestPromise, test.networkDelay);
      } else if (test.interruptAfter) {
        // Simulate network interruption / 模拟网络中断
        const requestPromise = this.makeRequest(test.method, `${config.baseUrl}${test.endpoint}`);
        result = await NetworkSimulator.simulateNetworkInterruption(requestPromise, test.interruptAfter);
      } else {
        // Normal request with custom timeout / 带自定义超时的正常请求
        result = await this.makeRequest(
          test.method, 
          `${config.baseUrl}${test.endpoint}`, 
          undefined, 
          undefined, 
          test.timeout
        );
      }

      // Evaluate network condition handling / 评估网络条件处理
      let status: EdgeCaseTestResult['status'] = 'PASS';
      let recommendation = '';

      if (result.error) {
        if (result.error.code === 'ECONNABORTED') {
          status = 'PASS';
          recommendation = 'Proper timeout handling implemented';
        } else if (result.error.message.includes('Network interruption')) {
          status = 'PASS';
          recommendation = 'Network interruption handled as expected';
        } else {
          status = 'WARNING';
          recommendation = 'Unexpected error handling network conditions';
        }
      } else if (result.response) {
        status = 'PASS';
        recommendation = 'Request completed despite network conditions';
      }

      this.addResult({
        name: test.name,
        category: 'network_conditions',
        endpoint: test.endpoint,
        method: test.method,
        status,
        statusCode: result.response?.status,
        responseTime: result.responseTime,
        error: result.error?.message,
        recommendation,
        details: {
          expectedBehavior: test.expectedBehavior,
          networkDelay: test.networkDelay,
          interruptAfter: test.interruptAfter,
          timeout: test.timeout
        }
      });
    }
  }

  // Run all edge case tests / 运行所有边界条件测试
  async runAllTests(): Promise<void> {
    console.log('🎯 Starting Edge Cases and Boundary Conditions Testing Suite / 开始边界条件和极端情况测试套件\n');
    console.log(`📊 Configuration:
    - Base URL: ${config.baseUrl}
    - Gateway URL: ${config.gatewayUrl}
    - Timeout: ${config.timeout}ms
    - Max Retries: ${config.maxRetries}
    - Concurrent Requests: ${config.concurrentRequests}
    - Max Payload Size: ${(config.maxPayloadSize / (1024 * 1024)).toFixed(1)}MB
    `);

    try {
      await this.testInputValidation();
      await this.testRateLimiting();
      await this.testPayloadLimits();
      await this.testMalformedJSON();
      await this.testMaliciousInputs();
      await this.testConcurrentAccess();
      await this.testNetworkConditions();

      this.printSummary();
    } catch (error) {
      console.error('❌ Edge case test suite execution failed:', error);
      throw error;
    }
  }

  // Print test summary / 打印测试摘要
  private printSummary(): void {
    const totalTime = performance.now() - this.startTime;

    console.log('\n' + '='.repeat(100));
    console.log('📊 EDGE CASES AND BOUNDARY CONDITIONS TEST SUMMARY / 边界条件和极端情况测试摘要');
    console.log('='.repeat(100));

    // Results by category / 按类别统计结果
    const categories = ['input_validation', 'rate_limiting', 'payload_limits', 'concurrent_access', 'malicious_input', 'network_conditions', 'resource_exhaustion'];
    const categoryStats = categories.map(category => {
      const categoryResults = this.results.filter(r => r.category === category);
      return {
        category,
        total: categoryResults.length,
        passed: categoryResults.filter(r => r.status === 'PASS').length,
        failed: categoryResults.filter(r => r.status === 'FAIL').length,
        warnings: categoryResults.filter(r => r.status === 'WARNING').length,
        critical: categoryResults.filter(r => r.status === 'CRITICAL').length,
        skipped: categoryResults.filter(r => r.status === 'SKIP').length
      };
    }).filter(stat => stat.total > 0);

    console.log('\n📋 Results by Category:');
    categoryStats.forEach(stat => {
      const categoryName = stat.category.replace(/_/g, ' ').toUpperCase();
      console.log(`${categoryName}: ${stat.passed}✅ ${stat.failed}❌ ${stat.warnings}⚠️ ${stat.critical}🚨 ${stat.skipped}⏭️`);
    });

    // Overall statistics / 总体统计
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    const critical = this.results.filter(r => r.status === 'CRITICAL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    console.log('\n📊 Overall Statistics:');
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`🚨 Critical: ${critical} (${((critical/total)*100).toFixed(1)}%)`);
    console.log(`⚠️  Warnings: ${warnings} (${((warnings/total)*100).toFixed(1)}%)`);
    console.log(`⏭️  Skipped: ${skipped} (${((skipped/total)*100).toFixed(1)}%)`);

    // Security risk analysis / 安全风险分析
    const securityRisks = this.results.filter(r => r.securityRisk);
    const criticalRisks = securityRisks.filter(r => r.securityRisk === 'CRITICAL').length;
    const highRisks = securityRisks.filter(r => r.securityRisk === 'HIGH').length;
    const mediumRisks = securityRisks.filter(r => r.securityRisk === 'MEDIUM').length;
    const lowRisks = securityRisks.filter(r => r.securityRisk === 'LOW').length;

    console.log('\n🛡️ Security Risk Analysis:');
    console.log(`🔴 Critical Risks: ${criticalRisks}`);
    console.log(`🟠 High Risks: ${highRisks}`);
    console.log(`🟡 Medium Risks: ${mediumRisks}`);
    console.log(`🟢 Low Risks: ${lowRisks}`);

    // Performance metrics / 性能指标
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / this.results.length;
    const maxResponseTime = Math.max(...this.results.map(r => r.responseTime));
    const minResponseTime = Math.min(...this.results.map(r => r.responseTime));

    console.log('\n⚡ Performance Metrics:');
    console.log(`Total Execution Time: ${totalTime.toFixed(2)}ms`);
    console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Min Response Time: ${minResponseTime.toFixed(2)}ms`);
    console.log(`Max Response Time: ${maxResponseTime.toFixed(2)}ms`);

    // Critical and high-risk issues / 关键和高风险问题
    const criticalIssues = this.results.filter(r => r.status === 'CRITICAL' || r.securityRisk === 'CRITICAL');
    if (criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues Requiring Immediate Attention:');
      criticalIssues.forEach(result => {
        console.log(`  - ${result.name}: ${result.recommendation}`);
      });
    }

    const highRiskIssues = this.results.filter(r => r.securityRisk === 'HIGH');
    if (highRiskIssues.length > 0) {
      console.log('\n🟠 High Risk Security Issues:');
      highRiskIssues.forEach(result => {
        console.log(`  - ${result.name}: ${result.recommendation}`);
      });
    }

    // Recommendations / 建议
    console.log('\n💡 Recommendations:');
    if (criticalRisks > 0) {
      console.log('  🚨 Critical security vulnerabilities detected - immediate remediation required');
    }
    if (highRisks > 0) {
      console.log('  🟠 High-risk security issues found - prioritize fixes');
    }
    if (critical > 0) {
      console.log('  🚨 Critical functionality issues detected - system stability at risk');
    }
    if (failed > 0) {
      console.log('  ❌ Failed tests indicate system reliability issues');
    }
    if (warnings > 0) {
      console.log('  ⚠️ Warning conditions suggest areas for improvement');
    }
    if (avgResponseTime > 5000) {
      console.log('  ⚡ High average response times - consider performance optimization');
    }
    if (criticalRisks === 0 && highRisks === 0 && critical === 0 && failed === 0) {
      console.log('  🎉 No critical issues detected - system appears robust against edge cases!');
    }

    console.log('='.repeat(100));
  }
}

// Main execution function / 主执行函数
async function main(): Promise<void> {
  const tester = new EdgeCaseAPITester();
  
  try {
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('Edge case testing failed:', error);
    process.exit(1);
  }
}

// Run if called directly / 如果直接调用则运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { EdgeCaseAPITester, EdgeCaseTestConfig, EdgeCaseTestResult, NetworkSimulator, PayloadGenerator };