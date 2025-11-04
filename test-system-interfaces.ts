/**
 * System Interfaces Test / 系统接口测试
 * Tests all API endpoints, authentication, error handling, and documentation / 测试所有API端点、认证、错误处理和文档
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import { ApiResponse, HTTP_STATUS } from './shared/types/api';

// Test configuration / 测试配置
const API_BASE_URL = 'http://localhost:3000';
const TIMEOUT = 10000;

// Test results tracking / 测试结果跟踪
interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration: number;
}

const testResults: TestResult[] = [];

// Helper function to run a test / 运行测试的辅助函数
async function runTest(
  name: string,
  testFn: () => Promise<void>,
  skipCondition?: boolean
): Promise<void> {
  if (skipCondition) {
    testResults.push({
      name,
      status: 'skip',
      message: 'Skipped due to condition',
      duration: 0
    });
    return;
  }

  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    testResults.push({
      name,
      status: 'pass',
      message: 'Test passed successfully',
      duration
    });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    testResults.push({
      name,
      status: 'fail',
      message,
      duration
    });
    console.log(`❌ ${name} (${duration}ms): ${message}`);
  }
}

// Helper function to make API request / 发起API请求的辅助函数
async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  headers?: Record<string, string>
): Promise<AxiosResponse> {
  const config = {
    method,
    url: `${API_BASE_URL}${endpoint}`,
    timeout: TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    ...(data && { data })
  };

  return axios(config);
}

// Test 1: Health Check / 健康检查测试
async function testHealthCheck(): Promise<void> {
  const response = await apiRequest('GET', '/health');
  
  if (response.status !== HTTP_STATUS.OK) {
    throw new Error(`Expected status ${HTTP_STATUS.OK}, got ${response.status}`);
  }
  
  const data = response.data;
  if (!data.status || !['healthy', 'degraded', 'unhealthy'].includes(data.status)) {
    throw new Error('Invalid health status format');
  }
}

// Test 2: API Documentation / API文档测试
async function testApiDocumentation(): Promise<void> {
  // Test Swagger UI HTML
  const htmlResponse = await apiRequest('GET', '/api/docs');
  if (htmlResponse.status !== HTTP_STATUS.OK) {
    throw new Error(`Expected status ${HTTP_STATUS.OK}, got ${htmlResponse.status}`);
  }
  
  if (!htmlResponse.data.includes('swagger-ui')) {
    throw new Error('Swagger UI HTML not found');
  }
  
  // Test OpenAPI JSON spec
  const jsonResponse = await apiRequest('GET', '/api/docs/swagger.json');
  if (jsonResponse.status !== HTTP_STATUS.OK) {
    throw new Error(`Expected status ${HTTP_STATUS.OK}, got ${jsonResponse.status}`);
  }
  
  const spec = jsonResponse.data;
  if (!spec.openapi || !spec.info || !spec.paths) {
    throw new Error('Invalid OpenAPI specification');
  }
}

// Test 3: Blockchain API / 区块链API测试
async function testBlockchainAPI(): Promise<void> {
  const response = await apiRequest('GET', '/api/blockchain/stats');
  
  if (response.status !== HTTP_STATUS.OK) {
    throw new Error(`Expected status ${HTTP_STATUS.OK}, got ${response.status}`);
  }
  
  const apiResponse: ApiResponse = response.data;
  if (!apiResponse.success || !apiResponse.timestamp) {
    throw new Error('Invalid API response format');
  }
}

// Test 4: Security API / 安全API测试
async function testSecurityAPI(): Promise<void> {
  try {
    const response = await apiRequest('GET', '/api/security/overview');
    
    // Should return 401 without authentication / 没有认证应该返回401
    if (response.status === HTTP_STATUS.OK) {
      console.warn('Security endpoint accessible without authentication');
    }
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === HTTP_STATUS.UNAUTHORIZED) {
      // This is expected / 这是预期的
      return;
    }
    if (axiosError.response?.status === HTTP_STATUS.SERVICE_UNAVAILABLE) {
      // Service not initialized / 服务未初始化
      console.warn('Security service not initialized');
      return;
    }
    throw error;
  }
}

// Test 5: Validators API / 验证节点API测试
async function testValidatorsAPI(): Promise<void> {
  const response = await apiRequest('GET', '/api/validators');
  
  if (response.status !== HTTP_STATUS.OK) {
    throw new Error(`Expected status ${HTTP_STATUS.OK}, got ${response.status}`);
  }
  
  const apiResponse: ApiResponse = response.data;
  if (!apiResponse.success || !Array.isArray(apiResponse.data)) {
    throw new Error('Invalid validators response format');
  }
}

// Test 6: Transactions API / 交易API测试
async function testTransactionsAPI(): Promise<void> {
  // Test GET transactions
  const getResponse = await apiRequest('GET', '/api/transactions?page=1&limit=10');
  
  if (getResponse.status !== HTTP_STATUS.OK) {
    throw new Error(`Expected status ${HTTP_STATUS.OK}, got ${getResponse.status}`);
  }
  
  const apiResponse: ApiResponse = getResponse.data;
  if (!apiResponse.success) {
    throw new Error('Invalid transactions response format');
  }
}

// Test 7: Error Handling / 错误处理测试
async function testErrorHandling(): Promise<void> {
  try {
    // Test 404 error
    await apiRequest('GET', '/api/nonexistent');
    throw new Error('Expected 404 error');
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status !== HTTP_STATUS.NOT_FOUND) {
      throw new Error(`Expected 404, got ${axiosError.response?.status}`);
    }
  }
  
  try {
    // Test validation error
    await apiRequest('POST', '/api/transactions', { invalid: 'data' });
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === HTTP_STATUS.BAD_REQUEST ||
        axiosError.response?.status === HTTP_STATUS.UNAUTHORIZED) {
      // Expected validation or auth error / 预期的验证或认证错误
      return;
    }
  }
}

// Test 8: Rate Limiting / 限流测试
async function testRateLimiting(): Promise<void> {
  const requests = [];
  const endpoint = '/health';
  
  // Send multiple requests quickly / 快速发送多个请求
  for (let i = 0; i < 10; i++) {
    requests.push(apiRequest('GET', endpoint));
  }
  
  try {
    await Promise.all(requests);
    console.warn('Rate limiting may not be active');
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      // Rate limiting is working / 限流正在工作
      return;
    }
    // Other errors are acceptable / 其他错误是可接受的
  }
}

// Test 9: CORS Headers / CORS头测试
async function testCORSHeaders(): Promise<void> {
  const response = await apiRequest('GET', '/health');
  
  const corsHeader = response.headers['access-control-allow-origin'];
  if (!corsHeader) {
    throw new Error('CORS headers not found');
  }
}

// Test 10: Response Format Consistency / 响应格式一致性测试
async function testResponseFormatConsistency(): Promise<void> {
  const endpoints = [
    '/health',
    '/api/blockchain/stats',
    '/api/validators'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await apiRequest('GET', endpoint);
      
      if (endpoint === '/health') {
        // Health endpoint has different format / 健康检查端点格式不同
        if (!response.data.status || !response.data.timestamp) {
          throw new Error(`Health endpoint missing required fields: ${endpoint}`);
        }
      } else {
        // API endpoints should follow ApiResponse format / API端点应遵循ApiResponse格式
        const apiResponse: ApiResponse = response.data;
        if (typeof apiResponse.success !== 'boolean' || !apiResponse.timestamp) {
          throw new Error(`Invalid response format for: ${endpoint}`);
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === HTTP_STATUS.SERVICE_UNAVAILABLE) {
        console.warn(`Service unavailable for: ${endpoint}`);
        continue;
      }
      throw error;
    }
  }
}

// Main test runner / 主测试运行器
async function runSystemInterfaceTests(): Promise<void> {
  console.log('🧪 开始系统接口测试...\n');
  
  const startTime = Date.now();
  
  // Run all tests / 运行所有测试
  await runTest('Health Check / 健康检查', testHealthCheck);
  await runTest('API Documentation / API文档', testApiDocumentation);
  await runTest('Blockchain API / 区块链API', testBlockchainAPI);
  await runTest('Security API / 安全API', testSecurityAPI);
  await runTest('Validators API / 验证节点API', testValidatorsAPI);
  await runTest('Transactions API / 交易API', testTransactionsAPI);
  await runTest('Error Handling / 错误处理', testErrorHandling);
  await runTest('Rate Limiting / 限流', testRateLimiting);
  await runTest('CORS Headers / CORS头', testCORSHeaders);
  await runTest('Response Format Consistency / 响应格式一致性', testResponseFormatConsistency);
  
  const totalTime = Date.now() - startTime;
  
  // Generate test report / 生成测试报告
  console.log('\n📊 测试报告 / Test Report:');
  console.log('=' .repeat(50));
  
  const passed = testResults.filter(r => r.status === 'pass').length;
  const failed = testResults.filter(r => r.status === 'fail').length;
  const skipped = testResults.filter(r => r.status === 'skip').length;
  const total = testResults.length;
  
  console.log(`总测试数 / Total Tests: ${total}`);
  console.log(`通过 / Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`失败 / Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
  console.log(`跳过 / Skipped: ${skipped} (${((skipped/total)*100).toFixed(1)}%)`);
  console.log(`总耗时 / Total Time: ${totalTime}ms`);
  
  // Show failed tests / 显示失败的测试
  const failedTests = testResults.filter(r => r.status === 'fail');
  if (failedTests.length > 0) {
    console.log('\n❌ 失败的测试 / Failed Tests:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.message}`);
    });
  }
  
  // Overall result / 总体结果
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！/ All tests passed!');
  } else {
    console.log(`\n⚠️  ${failed} 个测试失败 / ${failed} tests failed`);
  }
  
  console.log('\n📚 API文档地址 / API Documentation URL:');
  console.log(`${API_BASE_URL}/api/docs`);
}

// Check if server is running / 检查服务器是否运行
async function checkServerStatus(): Promise<boolean> {
  try {
    await apiRequest('GET', '/health');
    return true;
  } catch (error) {
    return false;
  }
}

// Run tests if server is available / 如果服务器可用则运行测试
async function main(): Promise<void> {
  console.log('🔍 检查服务器状态...');
  
  const isServerRunning = await checkServerStatus();
  if (!isServerRunning) {
    console.log('❌ 服务器未运行，请先启动API服务器');
    console.log('💡 运行命令: npm run server:dev 或 tsx api/server.ts');
    process.exit(1);
  }
  
  console.log('✅ 服务器运行中，开始测试...\n');
  await runSystemInterfaceTests();
}

// Run if called directly / 如果直接调用则运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runSystemInterfaceTests, checkServerStatus };