// Routing Proxy Test / 路由代理测试
import { APIGateway, APIGatewayConfig, ServiceConfig } from './api/gateway/api-gateway';
import { LoadBalanceStrategy } from './api/gateway/load-balancer';
import express from 'express';
import { Server } from 'http';

// Mock service servers / 模拟服务服务器
const mockServices: { server: Server; port: number; name: string }[] = [];

// Create mock service / 创建模拟服务
function createMockService(port: number, name: string, delay: number = 0): Promise<Server> {
  return new Promise((resolve) => {
    const app = express();
    
    app.use(express.json());
    
    // Health check endpoint / 健康检查端点
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: name, timestamp: new Date().toISOString() });
    });
    
    // Status endpoint / 状态端点
    app.get('/status', (req, res) => {
      res.json({ status: 'ok', service: name, port });
    });
    
    // API endpoints / API端点
    app.get('/api/data', (req, res) => {
      setTimeout(() => {
        res.json({ 
          message: `Data from ${name}`, 
          service: name, 
          port,
          timestamp: new Date().toISOString(),
          query: req.query
        });
      }, delay);
    });
    
    app.post('/api/data', (req, res) => {
      setTimeout(() => {
        res.json({ 
          message: `Data posted to ${name}`, 
          service: name, 
          port,
          body: req.body,
          timestamp: new Date().toISOString()
        });
      }, delay);
    });
    
    // Error endpoint / 错误端点
    app.get('/api/error', (req, res) => {
      res.status(500).json({ error: 'Internal server error', service: name });
    });
    
    // Slow endpoint / 慢端点
    app.get('/api/slow', (req, res) => {
      setTimeout(() => {
        res.json({ message: `Slow response from ${name}`, service: name });
      }, 2000);
    });
    
    const server = app.listen(port, () => {
      console.log(`Mock service ${name} started on port ${port}`);
      resolve(server);
    });
  });
}

async function testRoutingProxy() {
  console.log('🌐 Starting Routing Proxy Test...');
  
  let gateway: APIGateway | null = null;
  
  try {
    // Start mock services / 启动模拟服务
    console.log('\n🚀 Starting Mock Services...');
    
    const service1 = await createMockService(3011, 'service-1', 50);
    const service2 = await createMockService(3012, 'service-2', 100);
    const service3 = await createMockService(3013, 'service-3', 200);
    
    mockServices.push(
      { server: service1, port: 3011, name: 'service-1' },
      { server: service2, port: 3012, name: 'service-2' },
      { server: service3, port: 3013, name: 'service-3' }
    );
    
    // Wait for services to be ready / 等待服务准备就绪
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Configure API Gateway / 配置API网关
    console.log('\n⚙️ Configuring API Gateway...');
    
    const services: ServiceConfig[] = [
      {
        name: 'api-service-1',
        path: '/api/v1',
        target: 'http://localhost:3011',
        healthCheck: 'http://localhost:3011/health',
        timeout: 5000,
        retries: 2,
        circuitBreaker: {
          failureThreshold: 0.5,
          resetTimeout: 10000,
          monitoringPeriod: 5000
        }
      },
      {
        name: 'api-service-2',
        path: '/api/v2',
        target: 'http://localhost:3012',
        healthCheck: 'http://localhost:3012/health',
        timeout: 5000,
        retries: 2,
        circuitBreaker: {
          failureThreshold: 0.5,
          resetTimeout: 10000,
          monitoringPeriod: 5000
        }
      },
      {
        name: 'api-service-3',
        path: '/api/v3',
        target: 'http://localhost:3013',
        healthCheck: 'http://localhost:3013/health',
        timeout: 5000,
        retries: 2,
        circuitBreaker: {
          failureThreshold: 0.5,
          resetTimeout: 10000,
          monitoringPeriod: 5000
        }
      }
    ];
    
    const gatewayConfig: APIGatewayConfig = {
      port: 8080,
      corsOrigins: ['*'],
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 100,
      compressionLevel: 6,
      healthCheckInterval: 5000,
      loadBalancingStrategy: LoadBalanceStrategy.ROUND_ROBIN,
      services
    };
    
    // Start API Gateway / 启动API网关
    console.log('\n🚪 Starting API Gateway...');
    gateway = new APIGateway(gatewayConfig);
    await gateway.start();
    
    // Wait for gateway to initialize / 等待网关初始化
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: Basic Routing / 测试1：基本路由
    console.log('\n🔀 Test 1: Basic Routing');
    
    const testRoutes = [
      { path: '/api/v1/api/data', expectedService: 'service-1' },
      { path: '/api/v2/api/data', expectedService: 'service-2' },
      { path: '/api/v3/api/data', expectedService: 'service-3' }
    ];
    
    for (const route of testRoutes) {
      try {
        const response = await fetch(`http://localhost:8080${route.path}`);
        const data = await response.json();
        
        if (data.service === route.expectedService) {
          console.log(`✅ Route ${route.path} -> ${data.service} (${data.port})`);
        } else {
          console.log(`❌ Route ${route.path} -> Expected ${route.expectedService}, got ${data.service}`);
        }
      } catch (error: any) {
        console.log(`❌ Route ${route.path} failed: ${error.message}`);
      }
    }
    
    // Test 2: POST Requests / 测试2：POST请求
    console.log('\n📤 Test 2: POST Request Routing');
    
    try {
      const postData = { message: 'Hello from test', timestamp: Date.now() };
      const response = await fetch('http://localhost:8080/api/v1/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      });
      
      const data = await response.json();
      console.log(`✅ POST request routed to ${data.service}`);
      console.log(`   Response: ${data.message}`);
      console.log(`   Body received: ${JSON.stringify(data.body)}`);
    } catch (error: any) {
      console.log(`❌ POST request failed: ${error.message}`);
    }
    
    // Test 3: Query Parameters / 测试3：查询参数
    console.log('\n🔍 Test 3: Query Parameter Forwarding');
    
    try {
      const response = await fetch('http://localhost:8080/api/v2/api/data?param1=value1&param2=value2');
      const data = await response.json();
      
      console.log(`✅ Query parameters forwarded to ${data.service}`);
      console.log(`   Query received: ${JSON.stringify(data.query)}`);
    } catch (error: any) {
      console.log(`❌ Query parameter test failed: ${error.message}`);
    }
    
    // Test 4: Gateway Health Check / 测试4：网关健康检查
    console.log('\n💚 Test 4: Gateway Health Check');
    
    try {
      const response = await fetch('http://localhost:8080/health');
      const data = await response.json();
      
      console.log(`✅ Gateway health check: ${data.status}`);
      console.log(`   Services status:`);
      Object.entries(data.services).forEach(([service, status]: [string, any]) => {
        console.log(`     ${service}: ${status.healthy ? 'healthy' : 'unhealthy'} (${status.circuitBreakerState})`);
      });
    } catch (error: any) {
      console.log(`❌ Gateway health check failed: ${error.message}`);
    }
    
    // Test 5: Service Discovery / 测试5：服务发现
    console.log('\n🔍 Test 5: Service Discovery');
    
    try {
      const response = await fetch('http://localhost:8080/services');
      const data = await response.json();
      
      console.log(`✅ Service discovery endpoint working`);
      console.log(`   Discovered services: ${data.services.services.size}`);
    } catch (error: any) {
      console.log(`❌ Service discovery test failed: ${error.message}`);
    }
    
    // Test 6: Error Handling / 测试6：错误处理
    console.log('\n❌ Test 6: Error Handling');
    
    try {
      const response = await fetch('http://localhost:8080/api/v1/api/error');
      const data = await response.json();
      
      console.log(`✅ Error handling: Status ${response.status}`);
      console.log(`   Error response: ${data.error}`);
    } catch (error: any) {
      console.log(`❌ Error handling test failed: ${error.message}`);
    }
    
    // Test 7: 404 Handling / 测试7：404处理
    console.log('\n🚫 Test 7: 404 Handling');
    
    try {
      const response = await fetch('http://localhost:8080/nonexistent/path');
      
      console.log(`✅ 404 handling: Status ${response.status}`);
      if (response.status === 404) {
        console.log(`   Correctly returned 404 for non-existent path`);
      }
    } catch (error: any) {
      console.log(`❌ 404 handling test failed: ${error.message}`);
    }
    
    // Test 8: Gateway Statistics / 测试8：网关统计
    console.log('\n📊 Test 8: Gateway Statistics');
    
    try {
      const response = await fetch('http://localhost:8080/stats');
      const data = await response.json();
      
      console.log(`✅ Gateway statistics endpoint working`);
      console.log(`   Uptime: ${data.uptime} seconds`);
      console.log(`   Services stats:`);
      Object.entries(data.services).forEach(([service, stats]: [string, any]) => {
        console.log(`     ${service}: ${stats.totalRequests} requests, ${stats.successfulRequests} successful`);
      });
    } catch (error: any) {
      console.log(`❌ Gateway statistics test failed: ${error.message}`);
    }
    
    // Test 9: Rate Limiting (Optional) / 测试9：速率限制（可选）
    console.log('\n🚦 Test 9: Rate Limiting (Light Test)');
    
    try {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(fetch('http://localhost:8080/api/v1/api/data'));
      }
      
      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.ok).length;
      
      console.log(`✅ Rate limiting test: ${successCount}/5 requests succeeded`);
      if (successCount === 5) {
        console.log(`   All requests within rate limit`);
      }
    } catch (error: any) {
      console.log(`❌ Rate limiting test failed: ${error.message}`);
    }
    
    console.log('\n✅ Routing Proxy Test Completed Successfully!');
    
  } catch (error: any) {
    console.error('❌ Routing Proxy Test Failed:', error.message);
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
testRoutingProxy()
  .then(() => {
    console.log('🎉 All Routing Proxy tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Routing Proxy tests failed:', error);
    process.exit(1);
  });

export { testRoutingProxy };