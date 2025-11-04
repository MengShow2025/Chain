// Load Balancer Test / 负载均衡器测试
import { 
  LoadBalancer, 
  LoadBalancerConfig, 
  LoadBalanceStrategy, 
  ServiceInstance, 
  ServiceStatus, 
  RequestContext 
} from './api/gateway/load-balancer';

async function testLoadBalancer() {
  console.log('⚖️ Starting Load Balancer Test...');
  
  // Test configuration / 测试配置
  const config: LoadBalancerConfig = {
    strategy: LoadBalanceStrategy.ROUND_ROBIN,
    healthCheckInterval: 5000,
    maxRetries: 3,
    retryDelay: 1000,
    sessionAffinity: false,
    stickySessionTtl: 300000,
    circuitBreakerEnabled: true,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 30000
  };
  
  const loadBalancer = new LoadBalancer(config);
  
  try {
    // Test 1: Add service instances / 测试1：添加服务实例
    console.log('\n📝 Test 1: Adding Service Instances');
    
    const instances: ServiceInstance[] = [
      {
        id: 'service-1',
        host: 'localhost',
        port: 3001,
        protocol: 'http',
        weight: 100,
        status: ServiceStatus.HEALTHY,
        metadata: {
          version: '1.0.0',
          region: 'us-east-1',
          zone: 'us-east-1a',
          tags: ['api', 'v1'],
          capabilities: ['http']
        },
        healthScore: 100,
        lastHealthCheck: Date.now(),
        connections: 0,
        responseTime: 50
      },
      {
        id: 'service-2',
        host: 'localhost',
        port: 3002,
        protocol: 'http',
        weight: 150,
        status: ServiceStatus.HEALTHY,
        metadata: {
          version: '1.1.0',
          region: 'us-east-1',
          zone: 'us-east-1b',
          tags: ['api', 'v1.1'],
          capabilities: ['http', 'websocket']
        },
        healthScore: 95,
        lastHealthCheck: Date.now(),
        connections: 0,
        responseTime: 30
      },
      {
        id: 'service-3',
        host: 'localhost',
        port: 3003,
        protocol: 'http',
        weight: 80,
        status: ServiceStatus.HEALTHY,
        metadata: {
          version: '1.0.0',
          region: 'us-west-1',
          zone: 'us-west-1a',
          tags: ['api', 'v1'],
          capabilities: ['http']
        },
        healthScore: 90,
        lastHealthCheck: Date.now(),
        connections: 0,
        responseTime: 70
      }
    ];
    
    instances.forEach(instance => {
      loadBalancer.addInstance(instance);
      console.log(`✅ Added instance: ${instance.id} (${instance.host}:${instance.port})`);
    });
    
    console.log(`Total instances: ${loadBalancer.getAllInstances().length}`);
    console.log(`Healthy instances: ${loadBalancer.getHealthyInstances().length}`);
    
    // Test 2: Round Robin Strategy / 测试2：轮询策略
    console.log('\n🔄 Test 2: Round Robin Load Balancing');
    
    const requestContext: RequestContext = {
      clientIp: '192.168.1.100',
      headers: { 'user-agent': 'test-client' },
      path: '/api/test',
      method: 'GET',
      timestamp: Date.now()
    };
    
    console.log('Round Robin selections:');
    for (let i = 0; i < 6; i++) {
      const selected = loadBalancer.getNextInstance(requestContext);
      if (selected) {
        console.log(`  Request ${i + 1}: ${selected.id} (${selected.host}:${selected.port})`);
      }
    }
    
    // Test 3: Weighted Round Robin Strategy / 测试3：加权轮询策略
    console.log('\n⚖️ Test 3: Weighted Round Robin Load Balancing');
    
    loadBalancer.updateConfig({ strategy: LoadBalanceStrategy.WEIGHTED_ROUND_ROBIN });
    
    const weightedSelections: { [key: string]: number } = {};
    console.log('Weighted Round Robin selections (20 requests):');
    
    for (let i = 0; i < 20; i++) {
      const selected = loadBalancer.getNextInstance(requestContext);
      if (selected) {
        weightedSelections[selected.id] = (weightedSelections[selected.id] || 0) + 1;
      }
    }
    
    Object.entries(weightedSelections).forEach(([instanceId, count]) => {
      const instance = loadBalancer.getInstance(instanceId);
      console.log(`  ${instanceId}: ${count} requests (weight: ${instance?.weight})`);
    });
    
    // Test 4: Least Connections Strategy / 测试4：最少连接策略
    console.log('\n🔗 Test 4: Least Connections Load Balancing');
    
    loadBalancer.updateConfig({ strategy: LoadBalanceStrategy.LEAST_CONNECTIONS });
    
    // Simulate different connection loads / 模拟不同的连接负载
    loadBalancer.startConnection('service-1');
    loadBalancer.startConnection('service-1');
    loadBalancer.startConnection('service-2');
    
    console.log('Current connections:');
    loadBalancer.getAllInstances().forEach(instance => {
      console.log(`  ${instance.id}: ${instance.connections} connections`);
    });
    
    console.log('Least connections selections:');
    for (let i = 0; i < 5; i++) {
      const selected = loadBalancer.getNextInstance(requestContext);
      if (selected) {
        console.log(`  Request ${i + 1}: ${selected.id} (${selected.connections} connections)`);
        loadBalancer.startConnection(selected.id);
      }
    }
    
    // Test 5: IP Hash Strategy / 测试5：IP哈希策略
    console.log('\n🔢 Test 5: IP Hash Load Balancing');
    
    loadBalancer.updateConfig({ strategy: LoadBalanceStrategy.IP_HASH });
    
    const clientIps = ['192.168.1.100', '192.168.1.101', '192.168.1.102', '10.0.0.1', '10.0.0.2'];
    
    console.log('IP Hash selections:');
    clientIps.forEach(ip => {
      const context = { ...requestContext, clientIp: ip };
      const selected = loadBalancer.getNextInstance(context);
      if (selected) {
        console.log(`  IP ${ip}: ${selected.id}`);
      }
    });
    
    // Test 6: Health-based Strategy / 测试6：基于健康的策略
    console.log('\n💚 Test 6: Health-based Load Balancing');
    
    loadBalancer.updateConfig({ strategy: LoadBalanceStrategy.HEALTH_BASED });
    
    // Update health scores / 更新健康分数
    loadBalancer.updateInstanceStatus('service-1', ServiceStatus.HEALTHY, 85);
    loadBalancer.updateInstanceStatus('service-2', ServiceStatus.HEALTHY, 95);
    loadBalancer.updateInstanceStatus('service-3', ServiceStatus.HEALTHY, 75);
    
    console.log('Health scores:');
    loadBalancer.getAllInstances().forEach(instance => {
      console.log(`  ${instance.id}: ${instance.healthScore} health score`);
    });
    
    const healthSelections: { [key: string]: number } = {};
    for (let i = 0; i < 10; i++) {
      const selected = loadBalancer.getNextInstance(requestContext);
      if (selected) {
        healthSelections[selected.id] = (healthSelections[selected.id] || 0) + 1;
      }
    }
    
    console.log('Health-based selections:');
    Object.entries(healthSelections).forEach(([instanceId, count]) => {
      const instance = loadBalancer.getInstance(instanceId);
      console.log(`  ${instanceId}: ${count} requests (health: ${instance?.healthScore})`);
    });
    
    // Test 7: Circuit Breaker / 测试7：断路器
    console.log('\n⚡ Test 7: Circuit Breaker');
    
    loadBalancer.updateConfig({ strategy: LoadBalanceStrategy.ROUND_ROBIN });
    
    // Simulate failures for service-1 / 模拟service-1的失败
    console.log('Simulating failures for service-1...');
    for (let i = 0; i < 6; i++) {
      loadBalancer.recordRequest('service-1', false, 1000);
    }
    
    console.log('Selections after circuit breaker activation:');
    for (let i = 0; i < 5; i++) {
      const selected = loadBalancer.getNextInstance(requestContext);
      if (selected) {
        console.log(`  Request ${i + 1}: ${selected.id}`);
      }
    }
    
    // Test 8: Session Affinity / 测试8：会话亲和性
    console.log('\n🔒 Test 8: Session Affinity');
    
    loadBalancer.updateConfig({ 
      strategy: LoadBalanceStrategy.ROUND_ROBIN,
      sessionAffinity: true 
    });
    
    const sessionContext: RequestContext = {
      ...requestContext,
      sessionId: 'session-123'
    };
    
    console.log('Session affinity selections:');
    for (let i = 0; i < 5; i++) {
      const selected = loadBalancer.getNextInstance(sessionContext);
      if (selected) {
        console.log(`  Request ${i + 1}: ${selected.id} (session: ${sessionContext.sessionId})`);
      }
    }
    
    // Test 9: Statistics / 测试9：统计信息
    console.log('\n📊 Test 9: Load Balancer Statistics');
    
    // Record some requests / 记录一些请求
    loadBalancer.recordRequest('service-2', true, 45);
    loadBalancer.recordRequest('service-2', true, 55);
    loadBalancer.recordRequest('service-3', true, 65);
    loadBalancer.recordRequest('service-3', false, 200);
    
    const stats = loadBalancer.getStats();
    console.log('Load Balancer Statistics:');
    console.log(`- Total Requests: ${stats.totalRequests}`);
    console.log(`- Successful Requests: ${stats.successfulRequests}`);
    console.log(`- Failed Requests: ${stats.failedRequests}`);
    console.log(`- Average Response Time: ${stats.averageResponseTime}ms`);
    console.log(`- Active Connections: ${stats.activeConnections}`);
    
    console.log('Instance Statistics:');
    stats.instanceStats.forEach((instanceStats, instanceId) => {
      console.log(`  ${instanceId}:`);
      console.log(`    - Requests: ${instanceStats.requests}`);
      console.log(`    - Successes: ${instanceStats.successes}`);
      console.log(`    - Failures: ${instanceStats.failures}`);
      console.log(`    - Avg Response Time: ${instanceStats.averageResponseTime}ms`);
      console.log(`    - Connections: ${instanceStats.connections}`);
    });
    
    // Test 10: Instance Management / 测试10：实例管理
    console.log('\n🔧 Test 10: Instance Management');
    
    console.log('Removing service-3...');
    loadBalancer.removeInstance('service-3');
    console.log(`Remaining instances: ${loadBalancer.getAllInstances().length}`);
    
    console.log('Updating service-2 status to unhealthy...');
    loadBalancer.updateInstanceStatus('service-2', ServiceStatus.UNHEALTHY);
    console.log(`Healthy instances: ${loadBalancer.getHealthyInstances().length}`);
    
    console.log('Final instance status:');
    loadBalancer.getAllInstances().forEach(instance => {
      console.log(`  ${instance.id}: ${instance.status} (health: ${instance.healthScore})`);
    });
    
    console.log('\n✅ Load Balancer Test Completed Successfully!');
    
  } catch (error: any) {
    console.error('❌ Load Balancer Test Failed:', error.message);
    throw error;
  } finally {
    // Stop load balancer / 停止负载均衡器
    loadBalancer.stop();
    console.log('🛑 Load Balancer stopped');
  }
}

// Run the test / 运行测试
testLoadBalancer()
  .then(() => {
    console.log('🎉 All Load Balancer tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Load Balancer tests failed:', error);
    process.exit(1);
  });

export { testLoadBalancer };