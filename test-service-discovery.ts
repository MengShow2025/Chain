// Service Discovery Test / 服务发现测试
import { 
  ServiceDiscovery, 
  ServiceInstance, 
  ServiceRegistration, 
  ServiceStatus, 
  HealthCheckType,
  ServiceQuery
} from './api/gateway/service-discovery';

async function testServiceDiscovery() {
  console.log('🔍 Starting Service Discovery Test...');
  
  const discovery = new ServiceDiscovery();
  
  try {
    // Start service discovery / 启动服务发现
    discovery.start();
    console.log('✅ Service Discovery started');
    
    // Test 1: Register a service / 测试1：注册服务
    console.log('\n📝 Test 1: Service Registration');
    
    const testService: ServiceInstance = {
      id: 'test-service-1',
      host: 'localhost',
      port: 3001,
      protocol: 'http',
      weight: 100,
      status: ServiceStatus.HEALTHY,
      metadata: {
        version: '1.0.0',
        region: 'us-east-1',
        zone: 'us-east-1a',
        tags: ['api', 'test'],
        capabilities: ['http', 'websocket']
      }
    };
    
    const registration: ServiceRegistration = {
      serviceName: 'test-api',
      instance: testService,
      ttl: 30000,
      tags: ['api', 'test'],
      checks: [
        {
          type: HealthCheckType.HTTP,
          url: 'http://httpbin.org/status/200',
          interval: 5000,
          timeout: 3000
        }
      ]
    };
    
    await discovery.registerService(registration);
    console.log('✅ Service registered successfully');
    
    // Test 2: Get service / 测试2：获取服务
    console.log('\n🔍 Test 2: Service Retrieval');
    const services = discovery.getService('test-api');
    console.log(`Found ${services.length} instances for test-api`);
    console.log('Service details:', services[0]);
    
    // Test 3: Register another service instance / 测试3：注册另一个服务实例
    console.log('\n📝 Test 3: Multiple Service Instances');
    
    const testService2: ServiceInstance = {
      id: 'test-service-2',
      host: 'localhost',
      port: 3002,
      protocol: 'http',
      weight: 80,
      status: ServiceStatus.HEALTHY,
      metadata: {
        version: '1.0.1',
        region: 'us-east-1',
        zone: 'us-east-1b',
        tags: ['api', 'test', 'v2'],
        capabilities: ['http', 'grpc']
      }
    };
    
    const registration2: ServiceRegistration = {
      serviceName: 'test-api',
      instance: testService2,
      ttl: 30000,
      tags: ['api', 'test', 'v2'],
      checks: [
        {
          type: HealthCheckType.TCP,
          interval: 10000,
          timeout: 2000
        }
      ]
    };
    
    await discovery.registerService(registration2);
    console.log('✅ Second service instance registered');
    
    const allServices = discovery.getService('test-api');
    console.log(`Now found ${allServices.length} instances for test-api`);
    
    // Test 4: Service Query / 测试4：服务查询
    console.log('\n🔍 Test 4: Service Query');
    
    // Query by tags / 按标签查询
    const queryByTags: ServiceQuery = {
      tags: ['v2']
    };
    const v2Services = discovery.queryServices(queryByTags);
    console.log(`Found ${v2Services.length} services with 'v2' tag`);
    
    // Query by region / 按区域查询
    const queryByRegion: ServiceQuery = {
      region: 'us-east-1'
    };
    const regionServices = discovery.queryServices(queryByRegion);
    console.log(`Found ${regionServices.length} services in us-east-1 region`);
    
    // Query healthy services / 查询健康服务
    const queryHealthy: ServiceQuery = {
      healthy: true
    };
    const healthyServices = discovery.queryServices(queryHealthy);
    console.log(`Found ${healthyServices.length} healthy services`);
    
    // Test 5: Service Catalog / 测试5：服务目录
    console.log('\n📋 Test 5: Service Catalog');
    const catalog = discovery.getAllServices();
    console.log(`Service catalog contains ${catalog.services.size} service types`);
    console.log('Services in catalog:', Array.from(catalog.services.keys()));
    
    // Test 6: Statistics / 测试6：统计信息
    console.log('\n📊 Test 6: Service Statistics');
    const stats = discovery.getStats();
    console.log('Service Discovery Statistics:');
    console.log(`- Total Services: ${stats.totalServices}`);
    console.log(`- Total Instances: ${stats.totalInstances}`);
    console.log(`- Healthy Services: ${stats.healthyServices}`);
    console.log(`- Unhealthy Services: ${stats.unhealthyServices}`);
    console.log(`- Registrations: ${stats.registrations}`);
    console.log(`- Health Checks: ${stats.healthChecks}`);
    
    // Test 7: Event Handling / 测试7：事件处理
    console.log('\n🎯 Test 7: Event Handling');
    
    discovery.on('service_registered', (event) => {
      console.log(`📢 Event: Service ${event.serviceName} registered (${event.instance.id})`);
    });
    
    discovery.on('service_deregistered', (event) => {
      console.log(`📢 Event: Service ${event.serviceName} deregistered (${event.instance.id})`);
    });
    
    discovery.on('health_changed', (event) => {
      console.log(`📢 Event: Health changed for ${event.serviceName} (${event.instance.id}) - Status: ${event.instance.status}`);
    });
    
    // Wait for health checks / 等待健康检查
    console.log('\n⏳ Waiting for health checks...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Test 8: Service Deregistration / 测试8：服务注销
    console.log('\n🗑️ Test 8: Service Deregistration');
    await discovery.deregisterService('test-api', 'test-service-1');
    console.log('✅ Service deregistered');
    
    const remainingServices = discovery.getService('test-api');
    console.log(`Remaining instances: ${remainingServices.length}`);
    
    // Final statistics / 最终统计
    console.log('\n📊 Final Statistics:');
    const finalStats = discovery.getStats();
    console.log('Final Service Discovery Statistics:');
    console.log(`- Total Services: ${finalStats.totalServices}`);
    console.log(`- Total Instances: ${finalStats.totalInstances}`);
    console.log(`- Registrations: ${finalStats.registrations}`);
    console.log(`- Deregistrations: ${finalStats.deregistrations}`);
    console.log(`- Health Checks: ${finalStats.healthChecks}`);
    
    console.log('\n✅ Service Discovery Test Completed Successfully!');
    
  } catch (error: any) {
    console.error('❌ Service Discovery Test Failed:', error.message);
    throw error;
  } finally {
    // Stop service discovery / 停止服务发现
    await discovery.stop();
    console.log('🛑 Service Discovery stopped');
  }
}

// Run the test / 运行测试
testServiceDiscovery()
  .then(() => {
    console.log('🎉 All Service Discovery tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Service Discovery tests failed:', error);
    process.exit(1);
  });

export { testServiceDiscovery };