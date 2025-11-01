import axios from 'axios';
import { performance } from 'perf_hooks';

/**
 * 网关测试脚本
 */
class GatewayTester {
  private baseUrl: string;
  private results: any[] = [];

  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 开始网关测试...\n');

    try {
      await this.testHealthCheck();
      await this.testLoadBalancing();
      await this.testRateLimit();
      await this.testServiceDiscovery();
      await this.testPerformance();
      
      this.printResults();
    } catch (error) {
      console.error('❌ 测试失败:', error);
    }
  }

  /**
   * 测试健康检查
   */
  async testHealthCheck(): Promise<void> {
    console.log('🏥 测试健康检查...');
    
    try {
      const start = performance.now();
      const response = await axios.get(`${this.baseUrl}/health`);
      const duration = performance.now() - start;
      
      this.results.push({
        test: '健康检查',
        status: response.status === 200 ? '✅ 通过' : '❌ 失败',
        duration: `${duration.toFixed(2)}ms`,
        data: response.data
      });
      
      console.log(`   状态: ${response.status}`);
      console.log(`   响应时间: ${duration.toFixed(2)}ms`);
      console.log(`   数据:`, response.data);
      
    } catch (error) {
      this.results.push({
        test: '健康检查',
        status: '❌ 失败',
        error: error.message
      });
      console.log('   ❌ 健康检查失败:', error.message);
    }
    
    console.log('');
  }

  /**
   * 测试负载均衡
   */
  async testLoadBalancing(): Promise<void> {
    console.log('⚖️ 测试负载均衡...');
    
    const requests = 10;
    const responses: any[] = [];
    
    try {
      for (let i = 0; i < requests; i++) {
        const start = performance.now();
        const response = await axios.get(`${this.baseUrl}/api/blockchain/status`);
        const duration = performance.now() - start;
        
        responses.push({
          request: i + 1,
          status: response.status,
          duration: duration.toFixed(2),
          server: response.headers['x-served-by'] || 'unknown'
        });
      }
      
      // 分析负载分布
      const serverCounts = responses.reduce((acc, res) => {
        acc[res.server] = (acc[res.server] || 0) + 1;
        return acc;
      }, {});
      
      const avgDuration = responses.reduce((sum, res) => sum + parseFloat(res.duration), 0) / responses.length;
      
      this.results.push({
        test: '负载均衡',
        status: '✅ 通过',
        requests,
        avgDuration: `${avgDuration.toFixed(2)}ms`,
        serverDistribution: serverCounts
      });
      
      console.log(`   请求数: ${requests}`);
      console.log(`   平均响应时间: ${avgDuration.toFixed(2)}ms`);
      console.log(`   服务器分布:`, serverCounts);
      
    } catch (error) {
      this.results.push({
        test: '负载均衡',
        status: '❌ 失败',
        error: error.message
      });
      console.log('   ❌ 负载均衡测试失败:', error.message);
    }
    
    console.log('');
  }

  /**
   * 测试限流
   */
  async testRateLimit(): Promise<void> {
    console.log('🚦 测试限流...');
    
    const rapidRequests = 20;
    let successCount = 0;
    let rateLimitCount = 0;
    
    try {
      const promises = Array.from({ length: rapidRequests }, async (_, i) => {
        try {
          const response = await axios.get(`${this.baseUrl}/api/blockchain/status`);
          if (response.status === 200) {
            successCount++;
          }
        } catch (error) {
          if (error.response?.status === 429) {
            rateLimitCount++;
          }
        }
      });
      
      await Promise.all(promises);
      
      this.results.push({
        test: '限流测试',
        status: rateLimitCount > 0 ? '✅ 通过' : '⚠️ 警告',
        totalRequests: rapidRequests,
        successCount,
        rateLimitCount
      });
      
      console.log(`   总请求数: ${rapidRequests}`);
      console.log(`   成功请求: ${successCount}`);
      console.log(`   被限流请求: ${rateLimitCount}`);
      
    } catch (error) {
      this.results.push({
        test: '限流测试',
        status: '❌ 失败',
        error: error.message
      });
      console.log('   ❌ 限流测试失败:', error.message);
    }
    
    console.log('');
  }

  /**
   * 测试服务发现
   */
  async testServiceDiscovery(): Promise<void> {
    console.log('🔍 测试服务发现...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/gateway/services`);
      
      this.results.push({
        test: '服务发现',
        status: response.status === 200 ? '✅ 通过' : '❌ 失败',
        services: response.data
      });
      
      console.log(`   状态: ${response.status}`);
      console.log(`   发现的服务:`, response.data);
      
    } catch (error) {
      this.results.push({
        test: '服务发现',
        status: '❌ 失败',
        error: error.message
      });
      console.log('   ❌ 服务发现测试失败:', error.message);
    }
    
    console.log('');
  }

  /**
   * 测试性能
   */
  async testPerformance(): Promise<void> {
    console.log('🚀 测试性能...');
    
    const concurrentUsers = 50;
    const requestsPerUser = 10;
    const totalRequests = concurrentUsers * requestsPerUser;
    
    try {
      const startTime = performance.now();
      
      const userPromises = Array.from({ length: concurrentUsers }, async () => {
        const userRequests = Array.from({ length: requestsPerUser }, async () => {
          const start = performance.now();
          await axios.get(`${this.baseUrl}/api/blockchain/status`);
          return performance.now() - start;
        });
        
        return Promise.all(userRequests);
      });
      
      const allResults = await Promise.all(userPromises);
      const allDurations = allResults.flat();
      
      const totalTime = performance.now() - startTime;
      const avgDuration = allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
      const minDuration = Math.min(...allDurations);
      const maxDuration = Math.max(...allDurations);
      const throughput = (totalRequests / totalTime) * 1000; // requests per second
      
      this.results.push({
        test: '性能测试',
        status: '✅ 完成',
        totalRequests,
        totalTime: `${totalTime.toFixed(2)}ms`,
        avgDuration: `${avgDuration.toFixed(2)}ms`,
        minDuration: `${minDuration.toFixed(2)}ms`,
        maxDuration: `${maxDuration.toFixed(2)}ms`,
        throughput: `${throughput.toFixed(2)} req/s`
      });
      
      console.log(`   总请求数: ${totalRequests}`);
      console.log(`   总耗时: ${totalTime.toFixed(2)}ms`);
      console.log(`   平均响应时间: ${avgDuration.toFixed(2)}ms`);
      console.log(`   最小响应时间: ${minDuration.toFixed(2)}ms`);
      console.log(`   最大响应时间: ${maxDuration.toFixed(2)}ms`);
      console.log(`   吞吐量: ${throughput.toFixed(2)} req/s`);
      
    } catch (error) {
      this.results.push({
        test: '性能测试',
        status: '❌ 失败',
        error: error.message
      });
      console.log('   ❌ 性能测试失败:', error.message);
    }
    
    console.log('');
  }

  /**
   * 打印测试结果
   */
  private printResults(): void {
    console.log('📊 测试结果汇总:');
    console.log('='.repeat(50));
    
    this.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.test}: ${result.status}`);
      
      Object.keys(result).forEach(key => {
        if (key !== 'test' && key !== 'status') {
          console.log(`   ${key}: ${JSON.stringify(result[key])}`);
        }
      });
      
      console.log('');
    });
    
    const passedTests = this.results.filter(r => r.status.includes('✅')).length;
    const totalTests = this.results.length;
    
    console.log(`🎯 测试通过率: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  }
}

// 运行测试
async function main() {
  const tester = new GatewayTester();
  await tester.runAllTests();
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { GatewayTester };