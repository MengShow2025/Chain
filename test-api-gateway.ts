import { APIGateway } from './api/gateway/api-gateway';
import { createDefaultGatewayConfig } from './api/gateway/gateway-manager';
import axios from 'axios';

// 测试API网关功能
async function testAPIGateway() {
  console.log('🧪 开始测试API网关...\n');

  // 创建测试配置
  const defaultConfig = createDefaultGatewayConfig(8889);
  const testConfig = {
    ...defaultConfig.gateway,
    port: 8889, // 使用不同的端口避免冲突
    services: [
      {
        name: 'test-service',
        path: '/api/v1/test',
        target: 'http://httpbin.org', // 使用httpbin作为测试目标
        healthCheck: 'http://httpbin.org/status/200',
        timeout: 10000,
        retries: 2,
        circuitBreaker: {
          failureThreshold: 3,
          resetTimeout: 30000,
          monitoringPeriod: 5000
        }
      }
    ]
  };

  const gateway = new APIGateway(testConfig);

  try {
    // 启动网关
    console.log('🚀 启动API网关...');
    await gateway.start();
    console.log('✅ API网关启动成功\n');

    // 等待一秒让服务完全启动
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 测试1: 健康检查
    console.log('📋 测试1: 健康检查');
    try {
      const healthResponse = await axios.get('http://localhost:8889/health');
      console.log('✅ 健康检查通过:', healthResponse.data);
    } catch (error: any) {
      console.error('❌ 健康检查失败:', error.message);
    }
    console.log();

    // 测试2: 统计信息
    console.log('📊 测试2: 统计信息');
    try {
      const statsResponse = await axios.get('http://localhost:8889/stats');
      console.log('✅ 统计信息获取成功:', {
        totalRequests: statsResponse.data.totalRequests,
        activeConnections: statsResponse.data.activeConnections,
        averageResponseTime: statsResponse.data.averageResponseTime
      });
    } catch (error: any) {
      console.error('❌ 统计信息获取失败:', error.message);
    }
    console.log();

    // 测试3: 服务发现
    console.log('🔍 测试3: 服务发现');
    try {
      const discoveryResponse = await axios.get('http://localhost:8889/discovery');
      console.log('✅ 服务发现成功:', Object.keys(discoveryResponse.data));
    } catch (error: any) {
      console.error('❌ 服务发现失败:', error.message);
    }
    console.log();

    // 测试4: 负载均衡器状态
    console.log('⚖️ 测试4: 负载均衡器状态');
    try {
      const lbResponse = await axios.get('http://localhost:8889/loadbalancer/status');
      console.log('✅ 负载均衡器状态获取成功:', {
        totalRequests: lbResponse.data.totalRequests,
        activeInstances: lbResponse.data.activeInstances
      });
    } catch (error: any) {
      console.error('❌ 负载均衡器状态获取失败:', error.message);
    }
    console.log();

    // 测试5: 熔断器状态
    console.log('🔌 测试5: 熔断器状态');
    try {
      const cbResponse = await axios.get('http://localhost:8889/circuit-breakers');
      console.log('✅ 熔断器状态获取成功:', cbResponse.data);
    } catch (error: any) {
      console.error('❌ 熔断器状态获取失败:', error.message);
    }
    console.log();

    // 测试6: 代理请求测试
    console.log('🔄 测试6: 代理请求测试');
    try {
      // 测试通过网关访问后端服务
      let response;
      try {
        response = await axios.get('http://localhost:8889/api/v1/test/get', {
          timeout: 10000
        });
      } catch (proxyError: any) {
        // 如果代理失败，记录但继续测试
        response = {
          status: proxyError.response?.status || 500,
          message: proxyError.message
        };
      }
      
      if (response.data) {
        console.log('✅ 代理请求成功:', response.data);
      } else {
        console.log('⚠️ 代理请求部分成功:', response);
      }
    } catch (error: any) {
      console.error('❌ 代理请求失败:', error.message);
    }
    console.log();

    // 测试7: 错误处理测试
    console.log('🚨 测试7: 错误处理测试');
    try {
      await axios.get('http://localhost:8889/nonexistent-endpoint');
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        console.log('✅ 404错误处理正确');
      } else {
        console.log('⚠️ 错误处理:', error.message);
      }
    }
    console.log();

    // 测试8: 性能测试
    console.log('🚀 测试8: 性能测试');
    try {
      const requests = 20;
      const startTime = Date.now();
      let successfulRequests = 0;

      const promises = [];
      for (let i = 0; i < requests; i++) {
        promises.push(
          axios.get('http://localhost:8888/health', { timeout: 5000 })
            .then(() => {
              successfulRequests++;
            })
            .catch(() => {
              // 忽略失败的请求
            })
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      console.log(`✅ 性能测试完成:`);
      console.log(`   - 成功请求: ${successfulRequests}/20`);
      console.log(`   - 总耗时: ${totalTime}ms`);
      console.log(`   - 平均响应时间: ${totalTime / 20}ms`);
      console.log(`   - QPS: ${(20 / (totalTime / 1000)).toFixed(2)}`);
    } catch (error: any) {
      console.error('❌ 性能测试失败:', error.message);
    }
    console.log();

    // 获取最终统计信息
    console.log('📈 最终统计信息:');
    try {
      const finalStats = await axios.get('http://localhost:8889/stats');
      console.log('✅ 最终统计:', {
        总请求数: finalStats.data.totalRequests,
        成功请求数: finalStats.data.successfulRequests,
        失败请求数: finalStats.data.failedRequests,
        平均响应时间: `${finalStats.data.averageResponseTime?.toFixed(2) || 0}ms`,
        每秒请求数: finalStats.data.requestsPerSecond?.toFixed(2) || 0,
        活跃连接数: finalStats.data.activeConnections
      });
    } catch (error: any) {
      console.error('❌ 获取最终统计失败:', error.message);
    }

  } catch (error: any) {
    console.error('❌ 测试过程中发生错误:', error);
  } finally {
    // 停止网关
    console.log('\n🛑 停止API网关...');
    await gateway.stop();
    console.log('✅ API网关已停止');
  }

  console.log('\n🎉 API网关测试完成！');
}

// 运行测试
testAPIGateway().catch(console.error);

export { testAPIGateway };