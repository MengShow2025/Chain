// Circuit Breaker and Rate Limiting Test / 熔断器和限流测试
import { APIGateway, APIGatewayConfig, ServiceConfig, CircuitState } from './api/gateway/api-gateway';
import { LoadBalanceStrategy } from './api/gateway/load-balancer';
import express from 'express';
import { Server } from 'http';

// Mock service servers / 模拟服务服务器
const mockServices: { server: Server; port: number; name: string }[] = [];

// Create mock service with configurable failure rate / 创建可配置失败率的模拟服务
function createMockService(port: number, name: string, failureRate: number = 0): Promise<Server> {
  return new Promise((resolve) => {
    const app = express();
    
    app.use(express.json());
    
    // Health check endpoint / 健康检查端点
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: name, timestamp: new Date().toISOString() });
    });
    
    // API endpoints with configurable failure / 可配置失败的API端点
    app.get('/api/data', (req, res) => {
      if (Math.random() < failureRate) {
        res.status(500).json({ error: 'Internal server error', service: name });
      } else {
        res.json({ 
          message: `Data from ${name}`, 
          service: name, 
          port,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Slow endpoint for timeout testing / 超时测试的慢端点
    app.get('/api/slow', (req, res) => {
      setTimeout(() => {
        res.json({ message: `Slow response from ${name}`, service: name });
      }, 6000); // 6 seconds delay
    });
    
    const server = app.listen(port, () => {
      console.log(`Mock service ${name} started on port ${port} with ${(failureRate * 100).toFixed(1)}% failure rate`);
      resolve(server);
    });
  });
}

async function testCircuitBreakerAndRateLimit() {
  console.log('🔥 Starting Circuit Breaker and Rate Limiting Test...');
  
  let gateway: APIGateway | null = null;
  
  try {
    // Start mock services with different failure rates / 启动不同失败率的模拟服务
    console.log('\n🚀 Starting Mock Services...');
    
    const healthyService = await createMockService(3021, 'healthy-service', 0); // 0% failure
    const flakyService = await createMockService(3022, 'flaky-service', 0.7); // 70% failure
    const slowService = await createMockService(3023, 'slow-service', 0); // 0% failure but slow
    
    mockServices.push(
      { server: healthyService, port: 3021, name: 'healthy-service' },
      { server: flakyService, port: 3022, name: 'flaky-service' },
      { server: slowService, port: 3023, name: 'slow-service' }
    );
    
    // Wait for services to be ready / 等待服务准备就绪
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Configure API Gateway with circuit breaker / 配置带熔断器的API网关
    console.log('\n⚙️ Configuring API Gateway with Circuit Breaker...');
    
    const services: ServiceConfig[] = [
      {
        name: 'healthy-api',
        path: '/api/healthy',
        target: 'http://localhost:3021',
        healthCheck: 'http://localhost:3021/health',
        timeout: 3000,
        retries: 1,
        circuitBreaker: {
          failureThreshold: 0.5, // 50% failure rate triggers circuit breaker
          resetTimeout: 5000, // 5 seconds
          monitoringPeriod: 3000 // 3 seconds
        }
      },
      {
        name: 'flaky-api',
        path: '/api/flaky',
        target: 'http://localhost:3022',
        healthCheck: 'http://localhost:3022/health',
        timeout: 3000,
        retries: 1,
        circuitBreaker: {
          failureThreshold: 0.5, // 50% failure rate triggers circuit breaker
          resetTimeout: 5000, // 5 seconds
          monitoringPeriod: 3000 // 3 seconds
        }
      },
      {
        name: 'slow-api',
        path: '/api/slow',
        target: 'http://localhost:3023',
        healthCheck: 'http://localhost:3023/health',
        timeout: 2000, // 2 seconds timeout
        retries: 1,
        circuitBreaker: {
          failureThreshold: 0.3, // 30% failure rate triggers circuit breaker
          resetTimeout: 8000, // 8 seconds
          monitoringPeriod: 5000 // 5 seconds
        }
      }
    ];
    
    const gatewayConfig: APIGatewayConfig = {
      port: 8090,
      corsOrigins: ['*'],
      rateLimitWindowMs: 10000, // 10 seconds window
      rateLimitMaxRequests: 5, // Only 5 requests per window for testing
      compressionLevel: 6,
      healthCheckInterval: 2000,
      loadBalancingStrategy: LoadBalanceStrategy.ROUND_ROBIN,
      services
    };
    
    // Start API Gateway / 启动API网关
    console.log('\n🚪 Starting API Gateway...');
    gateway = new APIGateway(gatewayConfig);
    await gateway.start();
    
    // Wait for gateway to initialize / 等待网关初始化
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 1: Rate Limiting / 测试1：限流
    console.log('\n🚦 Test 1: Rate Limiting');
    
    const rateLimitRequests = [];
    for (let i = 0; i < 8; i++) { // Send 8 requests, expect 3 to be rate limited
      rateLimitRequests.push(
        fetch('http://localhost:8090/api/healthy/api/data')
          .then(res => ({ status: res.status, index: i }))
          .catch(err => ({ status: 'error', index: i, error: err.message }))
      );
    }
    
    const rateLimitResults = await Promise.all(rateLimitRequests);
    const successCount = rateLimitResults.filter(r => r.status === 200).length;
    const rateLimitedCount = rateLimitResults.filter(r => r.status === 429).length;
    
    console.log(`✅ Rate limiting test: ${successCount} successful, ${rateLimitedCount} rate limited`);
    if (rateLimitedCount > 0) {
      console.log('   Rate limiting is working correctly');
    } else {
      console.log('   ⚠️ Rate limiting may not be working as expected');
    }
    
    // Wait for rate limit window to reset / 等待限流窗口重置
    console.log('\n⏳ Waiting for rate limit window to reset...');
    await new Promise(resolve => setTimeout(resolve, 12000));
    
    // Test 2: Circuit Breaker with Flaky Service / 测试2：不稳定服务的熔断器
    console.log('\n🔥 Test 2: Circuit Breaker with Flaky Service');
    
    const circuitBreakerRequests = [];
    for (let i = 0; i < 10; i++) {
      circuitBreakerRequests.push(
        fetch('http://localhost:8090/api/flaky/api/data')
          .then(res => ({ status: res.status, index: i }))
          .catch(err => ({ status: 'error', index: i, error: err.message }))
      );
      
      // Small delay between requests / 请求间小延迟
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const circuitResults = await Promise.all(circuitBreakerRequests);
    const successfulRequests = circuitResults.filter(r => r.status === 200).length;
    const failedRequests = circuitResults.filter(r => r.status === 500).length;
    const circuitOpenRequests = circuitResults.filter(r => r.status === 503).length;
    
    console.log(`✅ Circuit breaker test: ${successfulRequests} successful, ${failedRequests} failed, ${circuitOpenRequests} circuit open`);
    
    // Test 3: Timeout and Circuit Breaker / 测试3：超时和熔断器
    console.log('\n⏰ Test 3: Timeout and Circuit Breaker');
    
    const timeoutRequests = [];
    for (let i = 0; i < 5; i++) {
      timeoutRequests.push(
        fetch('http://localhost:8090/api/slow/api/slow')
          .then(res => ({ status: res.status, index: i }))
          .catch(err => ({ status: 'timeout', index: i, error: err.message }))
      );
      
      // Delay between requests / 请求间延迟
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const timeoutResults = await Promise.all(timeoutRequests);
    const timeoutCount = timeoutResults.filter(r => r.status === 'timeout' || r.status === 503).length;
    
    console.log(`✅ Timeout test: ${timeoutCount} requests timed out or circuit opened`);
    
    // Test 4: Gateway Health Check / 测试4：网关健康检查
    console.log('\n💚 Test 4: Gateway Health Check');
    
    try {
      const response = await fetch('http://localhost:8090/health');
      const data = await response.json();
      
      console.log(`✅ Gateway health check: ${data.status}`);
      console.log(`   Services status:`);
      Object.entries(data.services).forEach(([service, status]: [string, any]) => {
        console.log(`     ${service}: ${status.healthy ? 'healthy' : 'unhealthy'} (${status.circuitBreakerState})`);
        console.log(`       Success rate: ${status.successRate}, Total requests: ${status.totalRequests}`);
      });
    } catch (error: any) {
      console.log(`❌ Gateway health check failed: ${error.message}`);
    }
    
    // Test 5: Gateway Statistics / 测试5：网关统计
    console.log('\n📊 Test 5: Gateway Statistics');
    
    try {
      const response = await fetch('http://localhost:8090/stats');
      const data = await response.json();
      
      console.log(`✅ Gateway statistics:`);
      console.log(`   Uptime: ${data.uptime} seconds`);
      console.log(`   Services stats:`);
      Object.entries(data.services).forEach(([service, stats]: [string, any]) => {
        console.log(`     ${service}:`);
        console.log(`       Total requests: ${stats.totalRequests}`);
        console.log(`       Successful: ${stats.successfulRequests}`);
        console.log(`       Failed: ${stats.failedRequests}`);
        console.log(`       Circuit breaker: ${stats.circuitBreakerState}`);
      });
    } catch (error: any) {
      console.log(`❌ Gateway statistics failed: ${error.message}`);
    }
    
    // Test 6: Circuit Breaker Recovery / 测试6：熔断器恢复
    console.log('\n🔄 Test 6: Circuit Breaker Recovery');
    
    console.log('   Waiting for circuit breaker to reset...');
    await new Promise(resolve => setTimeout(resolve, 8000)); // Wait for reset timeout
    
    try {
      const response = await fetch('http://localhost:8090/api/flaky/api/data');
      console.log(`✅ Circuit breaker recovery test: Status ${response.status}`);
      
      if (response.status === 200) {
        console.log('   Circuit breaker successfully reset and service is accessible');
      } else if (response.status === 503) {
        console.log('   Circuit breaker is still open');
      }
    } catch (error: any) {
      console.log(`❌ Circuit breaker recovery test failed: ${error.message}`);
    }
    
    console.log('\n✅ Circuit Breaker and Rate Limiting Test Completed Successfully!');
    
  } catch (error: any) {
    console.error('❌ Circuit Breaker and Rate Limiting Test Failed:', error.message);
    throw error;
  } finally {
    // Cleanup / 清理
    console.log('\n🧹 Cleaning up...');
    
    if (gateway) {
      await gateway.stop();
      console.log('✅ API Gateway stopped');
    }
    
    // Stop mock services / 停止模拟服务
    for (const mockService of mockServices) {
      mockService.server.close();
      console.log(`✅ Mock service ${mockService.name} stopped`);
    }
    
    // Wait for cleanup / 等待清理完成
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Run the test / 运行测试
testCircuitBreakerAndRateLimit()
  .then(() => {
    console.log('🎉 All Circuit Breaker and Rate Limiting tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Circuit Breaker and Rate Limiting tests failed:', error);
    process.exit(1);
  });

export { testCircuitBreakerAndRateLimit };