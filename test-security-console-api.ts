/**
 * TitanChain安全控制台API测试脚本
 * 测试安全控制台的核心API接口
 */

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
  mode?: string;
}

class SecurityConsoleApiTester {
  private baseUrl = 'http://localhost:3001/api/security';
  private testResults: { [key: string]: boolean } = {};

  async runAllTests(): Promise<void> {
    console.log('🛡️ 开始测试TitanChain安全控制台API接口...\n');

    // 测试各个API端点
    await this.testSystemOverview();
    await this.testSecurityLayers();
    await this.testActiveThreats();
    await this.testActiveDecisions();
    await this.testPerformanceMetrics();
    await this.testSystemHealth();

    // 输出测试结果汇总
    this.printTestSummary();
  }

  private async testSystemOverview(): Promise<void> {
    console.log('📋 1. 测试系统概览API (/overview)...');
    try {
      const response = await fetch(`${this.baseUrl}/overview`);
      const data: ApiResponse = await response.json();
      
      if (data.success && data.data) {
        console.log('✅ 系统概览API测试通过');
        console.log(`   - 系统状态: ${data.data.status}`);
        console.log(`   - 安全评分: ${data.data.securityScore}/100`);
        console.log(`   - 威胁等级: ${data.data.threatLevel}`);
        console.log(`   - 活跃层数: ${data.data.activeLayers}/${data.data.totalLayers}`);
        if (data.mode) console.log(`   - 运行模式: ${data.mode}`);
        this.testResults['overview'] = true;
      } else {
        console.log('❌ 系统概览API测试失败:', data.error);
        this.testResults['overview'] = false;
      }
    } catch (error) {
      console.log('❌ 系统概览API连接失败:', error.message);
      this.testResults['overview'] = false;
    }
    console.log();
  }

  private async testSecurityLayers(): Promise<void> {
    console.log('🔒 2. 测试安全层状态API (/layers/status)...');
    try {
      const response = await fetch(`${this.baseUrl}/layers/status`);
      const data: ApiResponse = await response.json();
      
      if (data.success && data.data) {
        console.log('✅ 安全层状态API测试通过');
        console.log(`   - 安全层数量: ${data.data.length}`);
        data.data.forEach((layer: any) => {
          console.log(`   - ${layer.name}: ${layer.status} (健康度: ${layer.health}%)`);
        });
        this.testResults['layers'] = true;
      } else {
        console.log('❌ 安全层状态API测试失败:', data.error);
        this.testResults['layers'] = false;
      }
    } catch (error) {
      console.log('❌ 安全层状态API连接失败:', error.message);
      this.testResults['layers'] = false;
    }
    console.log();
  }

  private async testActiveThreats(): Promise<void> {
    console.log('⚠️ 3. 测试活跃威胁API (/threats/active)...');
    try {
      const response = await fetch(`${this.baseUrl}/threats/active`);
      const data: ApiResponse = await response.json();
      
      if (data.success) {
        console.log('✅ 活跃威胁API测试通过');
        if (data.data && data.data.length > 0) {
          console.log(`   - 活跃威胁数量: ${data.data.length}`);
          data.data.slice(0, 3).forEach((threat: any) => {
            console.log(`   - ${threat.type}: ${threat.severity} (${threat.status})`);
          });
        } else {
          console.log('   - 当前无活跃威胁');
        }
        this.testResults['threats'] = true;
      } else {
        console.log('❌ 活跃威胁API测试失败:', data.error);
        this.testResults['threats'] = false;
      }
    } catch (error) {
      console.log('❌ 活跃威胁API连接失败:', error.message);
      this.testResults['threats'] = false;
    }
    console.log();
  }

  private async testActiveDecisions(): Promise<void> {
    console.log('🎯 4. 测试活跃决策API (/decisions/active)...');
    try {
      const response = await fetch(`${this.baseUrl}/decisions/active`);
      const data: ApiResponse = await response.json();
      
      if (data.success) {
        console.log('✅ 活跃决策API测试通过');
        if (data.data && data.data.length > 0) {
          console.log(`   - 活跃决策数量: ${data.data.length}`);
          data.data.slice(0, 3).forEach((decision: any) => {
            console.log(`   - ${decision.type}: ${decision.priority} (${decision.status})`);
          });
        } else {
          console.log('   - 当前无活跃决策');
        }
        this.testResults['decisions'] = true;
      } else {
        console.log('❌ 活跃决策API测试失败:', data.error);
        this.testResults['decisions'] = false;
      }
    } catch (error) {
      console.log('❌ 活跃决策API连接失败:', error.message);
      this.testResults['decisions'] = false;
    }
    console.log();
  }

  private async testPerformanceMetrics(): Promise<void> {
    console.log('📊 5. 测试性能指标API (/metrics/performance)...');
    try {
      const response = await fetch(`${this.baseUrl}/metrics/performance`);
      const data: ApiResponse = await response.json();
      
      if (data.success && data.data) {
        console.log('✅ 性能指标API测试通过');
        console.log(`   - CPU使用率: ${data.data.system?.cpu || 'N/A'}%`);
        console.log(`   - 内存使用率: ${data.data.system?.memory || 'N/A'}%`);
        console.log(`   - 区块链TPS: ${data.data.blockchain?.tps || 'N/A'}`);
        this.testResults['performance'] = true;
      } else {
        console.log('❌ 性能指标API测试失败:', data.error);
        this.testResults['performance'] = false;
      }
    } catch (error) {
      console.log('❌ 性能指标API连接失败:', error.message);
      this.testResults['performance'] = false;
    }
    console.log();
  }

  private async testSystemHealth(): Promise<void> {
    console.log('🏥 6. 测试系统健康API (/health)...');
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data: ApiResponse = await response.json();
      
      if (data.success && data.data) {
        console.log('✅ 系统健康API测试通过');
        console.log(`   - 整体状态: ${data.data.overall?.status || 'N/A'}`);
        console.log(`   - 健康评分: ${data.data.overall?.score || 'N/A'}/100`);
        if (data.data.overall?.issues?.length > 0) {
          console.log(`   - 发现问题: ${data.data.overall.issues.length}个`);
        }
        this.testResults['health'] = true;
      } else {
        console.log('❌ 系统健康API测试失败:', data.error);
        this.testResults['health'] = false;
      }
    } catch (error) {
      console.log('❌ 系统健康API连接失败:', error.message);
      this.testResults['health'] = false;
    }
    console.log();
  }

  private printTestSummary(): void {
    console.log('📈 测试结果汇总:');
    console.log('=====================================');
    
    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(result => result).length;
    const failedTests = totalTests - passedTests;
    
    Object.entries(this.testResults).forEach(([test, passed]) => {
      const status = passed ? '✅ 通过' : '❌ 失败';
      console.log(`${test.padEnd(15)} : ${status}`);
    });
    
    console.log('=====================================');
    console.log(`总计: ${totalTests} 个测试`);
    console.log(`通过: ${passedTests} 个`);
    console.log(`失败: ${failedTests} 个`);
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 所有API接口测试通过！安全控制台后端服务运行正常。');
    } else {
      console.log('\n⚠️ 部分API接口测试失败，请检查服务状态。');
    }
  }
}

// 运行测试
async function main() {
  const tester = new SecurityConsoleApiTester();
  await tester.runAllTests();
}

main().catch(console.error);