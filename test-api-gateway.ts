import { APIGateway, defaultGatewayConfig } from './api/gateway/api-gateway';
import axios from 'axios';

// 测试API网关功能
async function testAPIGateway() {
  console.log('🧪 开始测试API网关...\n');

  // 创建测试配置
  const testConfig = {
    ...defaultGatewayConfig,
    port: 8888, // 使用不同的端口避免冲突
    services: [
      {
        name: 'test-service',
        path: '/api/v1/test',
        target: 'http://httpbin.org', // 使用httpbin作为测试目标
        healthCheckPath: '/status/200',
        timeout: 10000,
        retries: 2,
        circuitBreaker: {
          failureThreshold: 3,
          recoveryTimeout: 30000,
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
      const healthResponse = await axios.get('http://localhost:8888/health');
      console.log('✅ 健康检查通过:', healthResponse.data);
    } catch (error) {
      console.error('❌ 健康检查失败:', error.message);
    }
    console.log();

    // 测试2: 统计信息
    console.log('📊 测试2: 统计信息');
    try {
      const statsResponse = await axios.get('http://localhost:8888/stats');
      console.log('✅ 统计信息获取成功:', {
        totalRequests: statsResponse.data.totalRequests,
        activeConnections: statsResponse.data.activeConnections,
        averageResponseTime: statsResponse.data.averageResponseTime
      });
    } catch (error) {
      console.error('❌ 统计信息获取失败:', error.message);
    }
    console.log();

    // 测试3: 服务发现
    console.log('🔍 测试3: 服务发现');
    try {
      const servicesResponse = await axios.get('http://localhost:8888/services');
      console.log('✅ 服务发现成功:', Object.keys(servicesResponse.data));
    } catch (error) {
      console.error('❌ 服务发现失败:', error.message);
    }
    console.log();

    // 测试4: 负载均衡器状态
    console.log('⚖️ 测试4: 负载均衡器状态');
    try {
      const lbResponse = await axios.get('http://localhost:8888/loadbalancer/status');
      console.log('✅ 负载均衡器状态获取成功:', {
        totalRequests: lbResponse.data.totalRequests,
        activeInstances: lbResponse.data.activeInstances
      });
    } catch (error) {
      console.error('❌ 负载均衡器状态获取失败:', error.message);
    }
    console.log();

    // 测试5: 熔断器状态
    console.log('🔌 测试5: 熔断器状态');
    try {
      const cbResponse = await axios.get('http://localhost:8888/circuit-breakers');
      console.log('✅ 熔断器状态获取成功:', cbResponse.data);
    } catch (error) {
      console.error('❌ 熔断器状态获取失败:', error.message);
    }
    console.log();

    // 测试6: 代理请求（使用httpbin测试）
    console.log('🔄 测试6: 代理请求');
    try {
      const proxyResponse = await axios.get('http://localhost:8888/api/v1/test/get', {
        timeout: 15000
      });
      console.log('✅ 代理请求成功:', {
        status: proxyResponse.status,
        headers: proxyResponse.headers['x-request-id'] ? 'Request ID present' : 'No Request ID'
      });
    } catch (error) {
      console.error('❌ 代理请求失败:', error.message);
    }
    console.log();

    // 测试7: 限流测试
    console.log('🚦 测试7: 限流测试');
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(
        axios.get('http://localhost:8888/health').catch(err => ({
          status: err.response?.status,
          message: err.message
        }))
      );
    }
    
    try {
      const results = await Promise.all(requests);
      const successCount = results.filter(r => r.status === 200 || r.data).length;
      console.log(`✅ 限流测试完成: ${successCount}/5 请求成功`);
    } catch (error) {
      console.error('❌ 限流测试失败:', error.message);
    }
    console.log();

    // 测试8: 错误处理
    console.log('❗ 测试8: 错误处理');
    try {
      await axios.get('http://localhost:8888/nonexistent-path');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ 404错误处理正确');
      } else {
        console.error('❌ 错误处理异常:', error.message);
      }
    }
    console.log();

    // 测试9: CORS测试
    console.log('🌐 测试9: CORS测试');
    try {
      const corsResponse = await axios.options('http://localhost:8888/health', {
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET'
        }
      });
      console.log('✅ CORS预检请求成功:', corsResponse.status);
    } catch (error) {
      console.error('❌ CORS测试失败:', error.message);
    }
    console.log();

    // 测试10: 压缩测试
    console.log('📦 测试10: 压缩测试');
    try {
      const compressionResponse = await axios.get('http://localhost:8888/stats', {
        headers: {
          'Accept-Encoding': 'gzip, deflate'
        }
      });
      const hasCompression = compressionResponse.headers['content-encoding'];
      console.log('✅ 压缩测试:', hasCompression ? `使用${hasCompression}压缩` : '未压缩');
    } catch (error) {
      console.error('❌ 压缩测试失败:', error.message);
    }
    console.log();

    // 性能测试
    console.log('⚡ 性能测试: 并发请求');
    const startTime = Date.now();
    const concurrentRequests = Array(20).fill(0).map(() => 
      axios.get('http://localhost:8888/health').catch(() => null)
    );
    
    try {
      const results = await Promise.all(concurrentRequests);
      const endTime = Date.now();
      const successfulRequests = results.filter(r => r !== null).length;
      const totalTime = endTime - startTime;
      
      console.log(`✅ 性能测试完成:`);
      console.log(`   - 成功请求: ${successfulRequests}/20`);
      console.log(`   - 总耗时: ${totalTime}ms`);
      console.log(`   - 平均响应时间: ${totalTime / 20}ms`);
      console.log(`   - QPS: ${(20 / (totalTime / 1000)).toFixed(2)}`);
    } catch (error) {
      console.error('❌ 性能测试失败:', error.message);
    }
    console.log();

    // 获取最终统计信息
    console.log('📈 最终统计信息:');
    try {
      const finalStats = await axios.get('http://localhost:8888/stats');
      console.log('✅ 最终统计:', {
        总请求数: finalStats.data.totalRequests,
        成功请求数: finalStats.data.successfulRequests,
        失败请求数: finalStats.data.failedRequests,
        平均响应时间: `${finalStats.data.averageResponseTime.toFixed(2)}ms`,
        每秒请求数: finalStats.data.requestsPerSecond.toFixed(2),
        活跃连接数: finalStats.data.activeConnections
      });
    } catch (error) {
      console.error('❌ 获取最终统计失败:', error.message);
    }

  } catch (error) {
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