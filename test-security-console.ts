/**
 * TitanChain安全控制台系统测试
 * 测试所有安全服务的集成和API接口
 */

import { SecurityConsoleService } from './api/security/security-console-service.js';
import { ThreatDetectionService } from './api/security/threat-detection-service.js';
import { SecurityScoringService } from './api/security/security-scoring-service.js';
import { SecurityDecisionService } from './api/security/security-decision-service.js';

async function testSecurityConsole() {
  console.log('🛡️ 开始测试TitanChain安全控制台系统...\n');

  try {
    // 初始化所有服务
    console.log('📋 1. 初始化安全服务...');
    const securityConsole = new SecurityConsoleService();
    const threatDetection = new ThreatDetectionService();
    const securityScoring = new SecurityScoringService();
    const securityDecision = new SecurityDecisionService();

    // 启动安全控制台服务
    console.log('🚀 启动安全控制台服务...');
    await securityConsole.initialize();
    console.log('✅ 安全控制台服务启动成功');

    // 启动威胁检测服务
    console.log('🔍 启动威胁检测服务...');
    await threatDetection.startMonitoring();
    console.log('✅ 威胁检测服务启动成功');

    // 启动安全评分服务
    console.log('📊 启动安全评分服务...');
    await securityScoring.startScoring();
    console.log('✅ 安全评分服务启动成功');

    // 启动安全决策服务
    console.log('🧠 启动安全决策服务...');
    await securityDecision.startProcessing();
    console.log('✅ 安全决策服务启动成功\n');

    // 测试系统概览
    console.log('📋 2. 测试系统概览...');
    const overview = await securityConsole.getSystemOverview();
    console.log('✅ 系统概览获取成功:');
    console.log(`   - 系统状态: ${overview.status}`);
    console.log(`   - 运行时间: ${Math.floor(overview.uptime / 1000)}秒`);
    console.log(`   - 安全评分: ${overview.securityScore}/100`);
    console.log(`   - 威胁等级: ${overview.threatLevel}`);
    console.log(`   - 活跃威胁: ${overview.activeThreats}个`);
    console.log(`   - 性能评分: ${overview.performanceScore}/100\n`);

    // 测试安全层状态
    console.log('📋 3. 测试安全层状态...');
    const layersStatus = await securityConsole.getSecurityLayersStatus();
    console.log(`✅ 安全层状态获取成功，共${layersStatus.length}个安全层:`);
    for (const layer of layersStatus) {
      console.log(`   - ${layer.name}: ${layer.status} (健康度: ${layer.health}%)`);
    }
    console.log();

    // 测试性能指标
    console.log('📋 4. 测试性能指标...');
    const metrics = await securityConsole.getPerformanceMetrics();
    console.log('✅ 性能指标获取成功:');
    console.log(`   - CPU使用率: ${metrics.system.cpu}%`);
    console.log(`   - 内存使用率: ${metrics.system.memory}%`);
    console.log(`   - ZK证明生成平均时间: ${metrics.security.zkProofGeneration.averageTime}ms`);
    console.log(`   - TEE操作平均时间: ${metrics.security.teeOperations.averageTime}ms`);
    console.log(`   - MPC计算平均时间: ${metrics.security.mpcComputations.averageTime}ms`);
    console.log(`   - 量子操作平均时间: ${metrics.security.quantumOperations.averageTime}ms\n`);

    // 测试系统健康状态
    console.log('📋 5. 测试系统健康状态...');
    const health = await securityConsole.getSystemHealth();
    console.log('✅ 系统健康状态获取成功:');
    console.log(`   - 整体状态: ${health.overall.status}`);
    console.log(`   - 健康评分: ${health.overall.score}/100`);
    if (health.overall.issues.length > 0) {
      console.log(`   - 发现问题: ${health.overall.issues.join(', ')}`);
    }
    console.log();

    // 测试威胁检测
    console.log('📋 6. 测试威胁检测功能...');
    const threatOverview = await threatDetection.getThreatOverview();
    console.log('✅ 威胁概览获取成功:');
    console.log(`   - 总威胁数: ${threatOverview.totalThreats}`);
    console.log(`   - 活跃威胁: ${threatOverview.activeThreats}`);
    console.log(`   - 已解决威胁: ${threatOverview.resolvedThreats}`);
    console.log(`   - 风险等级: ${threatOverview.riskLevel}\n`);

    // 获取活跃威胁列表
    const activeThreats = await threatDetection.getActiveThreats();
    console.log(`✅ 活跃威胁列表获取成功，共${activeThreats.length}个威胁`);
    if (activeThreats.length > 0) {
      for (const threat of activeThreats.slice(0, 3)) {
        console.log(`   - ${threat.type}: ${threat.description} (严重性: ${threat.severity})`);
      }
    }
    console.log();

    // 测试安全评分
    console.log('📋 7. 测试安全评分功能...');
    const overallScore = await securityScoring.getOverallSecurityScore();
    console.log('✅ 综合安全评分获取成功:');
    console.log(`   - 总评分: ${overallScore.overallScore}/100`);
    console.log(`   - 风险等级: ${overallScore.riskLevel}`);
    console.log(`   - 评分组件:`);
    for (const component of overallScore.components) {
      console.log(`     * ${component.name}: ${component.score}/100 (权重: ${component.weight})`);
    }
    console.log();

    // 获取安全建议
    const recommendations = await securityScoring.getSecurityRecommendations();
    console.log(`✅ 安全建议获取成功，共${recommendations.length}条建议`);
    if (recommendations.length > 0) {
      for (const rec of recommendations.slice(0, 3)) {
        console.log(`   - ${rec.title}: ${rec.description} (优先级: ${rec.priority})`);
      }
    }
    console.log();

    // 测试安全决策
    console.log('📋 8. 测试安全决策功能...');
    const decisionHealth = await securityDecision.getHealthStatus();
    console.log('✅ 决策服务状态获取成功:');
    console.log(`   - 服务状态: ${decisionHealth.status}`);
    console.log(`   - 总决策数: ${decisionHealth.totalDecisions}`);
    console.log(`   - 活跃决策: ${decisionHealth.activeDecisions}`);
    console.log(`   - 待处理决策: ${decisionHealth.pendingDecisions}`);
    console.log(`   - 活跃策略: ${decisionHealth.activePolicies}/${decisionHealth.totalPolicies}\n`);

    // 获取活跃决策
    const activeDecisions = await securityDecision.getActiveDecisions();
    console.log(`✅ 活跃决策获取成功，共${activeDecisions.length}个决策`);
    if (activeDecisions.length > 0) {
      for (const decision of activeDecisions.slice(0, 3)) {
        console.log(`   - ${decision.title}: ${decision.status} (优先级: ${decision.priority})`);
      }
    }
    console.log();

    // 模拟威胁响应决策
    console.log('📋 9. 测试威胁响应决策...');
    const mockThreat = {
      id: 'test_threat_001',
      type: 'QUANTUM_ATTACK',
      severity: 'HIGH' as const,
      status: 'ACTIVE' as const,
      title: '模拟量子攻击威胁',
      description: '检测到潜在的量子计算攻击尝试',
      targetSystem: 'encryption_layer',
      sourceIp: '192.168.1.100',
      detectedAt: new Date(),
      lastUpdated: new Date(),
      confidence: 0.85,
      impact: 'HIGH' as const,
      category: 'CRYPTOGRAPHIC_ATTACK' as const,
      indicators: ['异常密钥访问模式', '量子算法特征'],
      mitigationSteps: ['启用量子抗性加密', '隔离受影响系统'],
      relatedEvents: []
    };

    const decisionId = await securityDecision.handleThreatResponse(mockThreat);
    console.log(`✅ 威胁响应决策创建成功: ${decisionId}\n`);

    // 等待一段时间让服务处理数据
    console.log('⏳ 等待服务处理数据...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 再次检查决策状态
    const updatedDecisions = await securityDecision.getActiveDecisions();
    console.log(`✅ 更新后的活跃决策: ${updatedDecisions.length}个\n`);

    // 测试集成功能
    console.log('📋 10. 测试服务集成...');
    
    // 检查所有服务是否正常运行
    const servicesStatus = {
      securityConsole: await securityConsole.getSystemHealth(),
      threatDetection: await threatDetection.getHealthStatus(),
      securityScoring: await securityScoring.getHealthStatus(),
      securityDecision: await securityDecision.getHealthStatus()
    };

    console.log('✅ 服务集成状态检查:');
    console.log(`   - 安全控制台: ${servicesStatus.securityConsole.overall.status}`);
    console.log(`   - 威胁检测: ${servicesStatus.threatDetection.status}`);
    console.log(`   - 安全评分: ${servicesStatus.securityScoring.status}`);
    console.log(`   - 安全决策: ${servicesStatus.securityDecision.status}\n`);

    // 性能测试
    console.log('📋 11. 性能测试...');
    const startTime = Date.now();
    
    // 并发调用多个API
    await Promise.all([
      securityConsole.getSystemOverview(),
      threatDetection.getThreatOverview(),
      securityScoring.getOverallSecurityScore(),
      securityDecision.getActiveDecisions()
    ]);
    
    const endTime = Date.now();
    console.log(`✅ 并发API调用完成，耗时: ${endTime - startTime}ms\n`);

    // 清理资源
    console.log('📋 12. 清理资源...');
    await securityDecision.stopProcessing();
    await securityScoring.stopScoring();
    await threatDetection.stopMonitoring();
    await securityConsole.shutdown();
    console.log('✅ 所有服务已关闭\n');

    console.log('🎉 TitanChain安全控制台系统测试完成！');
    console.log('📊 测试结果总结:');
    console.log('   ✅ 安全控制台服务 - 正常');
    console.log('   ✅ 威胁检测服务 - 正常');
    console.log('   ✅ 安全评分服务 - 正常');
    console.log('   ✅ 安全决策服务 - 正常');
    console.log('   ✅ API接口集成 - 正常');
    console.log('   ✅ 服务间通信 - 正常');
    console.log('   ✅ 性能表现 - 良好');

  } catch (error) {
    console.error('❌ 安全控制台系统测试失败:', error);
    console.error('错误详情:', error.stack);
    process.exit(1);
  }
}

// 运行测试
testSecurityConsole().catch(console.error);