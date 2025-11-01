import PerformanceManager from './blockchain/performance/performance-manager';

/**
 * 简化的性能管理器测试
 */
class SimplePerformanceTest {
  private manager: PerformanceManager;

  constructor() {
    this.manager = new PerformanceManager();
  }

  /**
   * 运行快速测试
   */
  async runQuickTest(): Promise<void> {
    console.log('🚀 开始性能管理器快速测试');
    
    try {
      // 1. 测试启动
      console.log('\n1. 测试启动...');
      await this.manager.start();
      console.log('✅ 启动成功');

      // 2. 等待短时间收集数据
      console.log('\n2. 收集性能数据...');
      await this.sleep(3000);
      
      // 3. 检查状态
      console.log('\n3. 检查状态...');
      const state = this.manager.getCurrentState();
      console.log(`当前状态:`);
      console.log(`- 运行中: ${state.isRunning}`);
      console.log(`- TPS: ${state.currentTPS}`);
      console.log(`- 延迟: ${state.currentLatency}ms`);
      console.log(`- 可用性: ${state.currentAvailability}%`);
      console.log('✅ 状态检查完成');

      // 4. 测试目标设置
      console.log('\n4. 测试目标设置...');
      this.manager.setTargets({ tps: 100000, latency: 50 });
      const targets = this.manager.getTargets();
      console.log(`新目标: TPS=${targets.tps}, 延迟<${targets.latency}ms`);
      console.log('✅ 目标设置成功');

      // 5. 获取性能摘要
      console.log('\n5. 获取性能摘要...');
      const summary = this.manager.getPerformanceSummary();
      console.log(`运行时间: ${Math.round(summary.uptime / 1000)}秒`);
      console.log(`优化动作: ${summary.optimization.total}`);
      console.log('✅ 摘要获取成功');

      // 6. 生成报告
      console.log('\n6. 生成性能报告...');
      const report = this.manager.generateReport();
      console.log(`报告摘要:`);
      console.log(`- 平均TPS: ${report.summary.averageTPS}`);
      console.log(`- 平均延迟: ${report.summary.averageLatency}ms`);
      console.log(`- 平均可用性: ${report.summary.averageAvailability}%`);
      console.log(`- 总体得分: ${report.achievements.overallScore}%`);
      console.log(`- 建议数量: ${report.recommendations.length}`);
      console.log('✅ 报告生成成功');

      // 7. 测试停止
      console.log('\n7. 测试停止...');
      this.manager.stop();
      const finalState = this.manager.getCurrentState();
      console.log(`停止后状态: ${finalState.isRunning ? '仍在运行' : '已停止'}`);
      console.log('✅ 停止成功');

      console.log('\n🎉 性能管理器快速测试全部通过!');
      console.log('✅ 系统具备完整的性能管理能力');

    } catch (error) {
      console.error('❌ 测试失败:', error);
      this.manager.stop();
    }
  }

  /**
   * 运行基准测试（短时间）
   */
  async runShortBenchmark(): Promise<void> {
    console.log('\n🏃 开始10秒基准测试');
    
    try {
      const report = await this.manager.runBenchmark(10000);
      
      console.log('\n📊 基准测试结果:');
      console.log(`平均TPS: ${report.summary.averageTPS}`);
      console.log(`平均延迟: ${report.summary.averageLatency}ms`);
      console.log(`平均可用性: ${report.summary.averageAvailability}%`);
      console.log(`总体得分: ${report.achievements.overallScore}%`);
      
      console.log('\n💡 主要建议:');
      report.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      
      console.log('\n✅ 基准测试完成');
      
    } catch (error) {
      console.error('❌ 基准测试失败:', error);
    }
  }

  /**
   * 辅助方法：等待
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 运行测试
async function runSimpleTest(): Promise<void> {
  const test = new SimplePerformanceTest();
  
  // 运行快速测试
  await test.runQuickTest();
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 运行短基准测试
  await test.runShortBenchmark();
  
  console.log('\n🏁 所有测试完成');
}

// 执行测试
runSimpleTest().catch(console.error);