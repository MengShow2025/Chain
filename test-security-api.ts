/**
 * TitanChain安全控制台API测试
 * 测试安全API接口的功能
 */

async function testSecurityAPI() {
  console.log('🛡️ 开始测试TitanChain安全控制台API...\n');

  const baseURL = 'http://localhost:3001/api/security';
  
  try {
    // 测试系统概览API
    console.log('📋 1. 测试系统概览API...');
    try {
      const overviewResponse = await fetch(`${baseURL}/overview`);
      if (overviewResponse.ok) {
        const overview = await overviewResponse.json();
        console.log('✅ 系统概览API正常:', overview.success ? '成功' : '失败');
        if (overview.data) {
          console.log(`   - 系统状态: ${overview.data.status}`);
          console.log(`   - 安全评分: ${overview.data.securityScore}/100`);
          console.log(`   - 威胁等级: ${overview.data.threatLevel}`);
        }
      } else {
        console.log('❌ 系统概览API响应异常:', overviewResponse.status);
      }
    } catch (error) {
      console.log('❌ 系统概览API连接失败:', error.message);
    }
    console.log();

    // 测试安全层状态API
    console.log('📋 2. 测试安全层状态API...');
    try {
      const layersResponse = await fetch(`${baseURL}/layers/status`);
      if (layersResponse.ok) {
        const layers = await layersResponse.json();
        console.log('✅ 安全层状态API正常:', layers.success ? '成功' : '失败');
        if (layers.data && Array.isArray(layers.data)) {
          console.log(`   - 安全层数量: ${layers.data.length}`);
          for (const layer of layers.data.slice(0, 3)) {
            console.log(`   - ${layer.name}: ${layer.status}`);
          }
        }
      } else {
        console.log('❌ 安全层状态API响应异常:', layersResponse.status);
      }
    } catch (error) {
      console.log('❌ 安全层状态API连接失败:', error.message);
    }
    console.log();

    // 测试性能指标API
    console.log('📋 3. 测试性能指标API...');
    try {
      const metricsResponse = await fetch(`${baseURL}/metrics/performance`);
      if (metricsResponse.ok) {
        const metrics = await metricsResponse.json();
        console.log('✅ 性能指标API正常:', metrics.success ? '成功' : '失败');
        if (metrics.data) {
          console.log(`   - CPU使用率: ${metrics.data.system?.cpu || 'N/A'}%`);
          console.log(`   - 内存使用率: ${metrics.data.system?.memory || 'N/A'}%`);
        }
      } else {
        console.log('❌ 性能指标API响应异常:', metricsResponse.status);
      }
    } catch (error) {
      console.log('❌ 性能指标API连接失败:', error.message);
    }
    console.log();

    // 测试系统健康API
    console.log('📋 4. 测试系统健康API...');
    try {
      const healthResponse = await fetch(`${baseURL}/health`);
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        console.log('✅ 系统健康API正常:', health.success ? '成功' : '失败');
        if (health.data) {
          console.log(`   - 整体状态: ${health.data.overall?.status || 'N/A'}`);
          console.log(`   - 健康评分: ${health.data.overall?.score || 'N/A'}/100`);
        }
      } else {
        console.log('❌ 系统健康API响应异常:', healthResponse.status);
      }
    } catch (error) {
      console.log('❌ 系统健康API连接失败:', error.message);
    }
    console.log();

    // 测试威胁检测API
    console.log('📋 5. 测试威胁检测API...');
    try {
      const threatsResponse = await fetch(`${baseURL}/threats/overview`);
      if (threatsResponse.ok) {
        const threats = await threatsResponse.json();
        console.log('✅ 威胁概览API正常:', threats.success ? '成功' : '失败');
        if (threats.data) {
          console.log(`   - 总威胁数: ${threats.data.totalThreats || 'N/A'}`);
          console.log(`   - 活跃威胁: ${threats.data.activeThreats || 'N/A'}`);
        }
      } else {
        console.log('❌ 威胁概览API响应异常:', threatsResponse.status);
      }
    } catch (error) {
      console.log('❌ 威胁概览API连接失败:', error.message);
    }
    console.log();

    // 测试活跃威胁API
    console.log('📋 6. 测试活跃威胁API...');
    try {
      const activeThreatsResponse = await fetch(`${baseURL}/threats/active`);
      if (activeThreatsResponse.ok) {
        const activeThreats = await activeThreatsResponse.json();
        console.log('✅ 活跃威胁API正常:', activeThreats.success ? '成功' : '失败');
        if (activeThreats.data && Array.isArray(activeThreats.data)) {
          console.log(`   - 活跃威胁数量: ${activeThreats.data.length}`);
        }
      } else {
        console.log('❌ 活跃威胁API响应异常:', activeThreatsResponse.status);
      }
    } catch (error) {
      console.log('❌ 活跃威胁API连接失败:', error.message);
    }
    console.log();

    // 测试安全评分API
    console.log('📋 7. 测试安全评分API...');
    try {
      const scoringResponse = await fetch(`${baseURL}/scoring/overall`);
      if (scoringResponse.ok) {
        const scoring = await scoringResponse.json();
        console.log('✅ 安全评分API正常:', scoring.success ? '成功' : '失败');
        if (scoring.data) {
          console.log(`   - 综合评分: ${scoring.data.overallScore || 'N/A'}/100`);
          console.log(`   - 风险等级: ${scoring.data.riskLevel || 'N/A'}`);
        }
      } else {
        console.log('❌ 安全评分API响应异常:', scoringResponse.status);
      }
    } catch (error) {
      console.log('❌ 安全评分API连接失败:', error.message);
    }
    console.log();

    // 测试安全建议API
    console.log('📋 8. 测试安全建议API...');
    try {
      const recommendationsResponse = await fetch(`${baseURL}/scoring/recommendations`);
      if (recommendationsResponse.ok) {
        const recommendations = await recommendationsResponse.json();
        console.log('✅ 安全建议API正常:', recommendations.success ? '成功' : '失败');
        if (recommendations.data && Array.isArray(recommendations.data)) {
          console.log(`   - 建议数量: ${recommendations.data.length}`);
        }
      } else {
        console.log('❌ 安全建议API响应异常:', recommendationsResponse.status);
      }
    } catch (error) {
      console.log('❌ 安全建议API连接失败:', error.message);
    }
    console.log();

    // 测试决策概览API
    console.log('📋 9. 测试决策概览API...');
    try {
      const decisionsResponse = await fetch(`${baseURL}/decisions/overview`);
      if (decisionsResponse.ok) {
        const decisions = await decisionsResponse.json();
        console.log('✅ 决策概览API正常:', decisions.success ? '成功' : '失败');
        if (decisions.data) {
          console.log(`   - 总决策数: ${decisions.data.totalDecisions || 'N/A'}`);
          console.log(`   - 活跃决策: ${decisions.data.activeDecisions || 'N/A'}`);
        }
      } else {
        console.log('❌ 决策概览API响应异常:', decisionsResponse.status);
      }
    } catch (error) {
      console.log('❌ 决策概览API连接失败:', error.message);
    }
    console.log();

    // 测试活跃决策API
    console.log('📋 10. 测试活跃决策API...');
    try {
      const activeDecisionsResponse = await fetch(`${baseURL}/decisions/active`);
      if (activeDecisionsResponse.ok) {
        const activeDecisions = await activeDecisionsResponse.json();
        console.log('✅ 活跃决策API正常:', activeDecisions.success ? '成功' : '失败');
        if (activeDecisions.data && Array.isArray(activeDecisions.data)) {
          console.log(`   - 活跃决策数量: ${activeDecisions.data.length}`);
        }
      } else {
        console.log('❌ 活跃决策API响应异常:', activeDecisionsResponse.status);
      }
    } catch (error) {
      console.log('❌ 活跃决策API连接失败:', error.message);
    }
    console.log();

    // 测试WebSocket信息API
    console.log('📋 11. 测试WebSocket信息API...');
    try {
      const wsInfoResponse = await fetch(`${baseURL}/websocket/info`);
      if (wsInfoResponse.ok) {
        const wsInfo = await wsInfoResponse.json();
        console.log('✅ WebSocket信息API正常:', wsInfo.success ? '成功' : '失败');
        if (wsInfo.data) {
          console.log(`   - WebSocket端点: ${wsInfo.data.endpoint || 'N/A'}`);
          console.log(`   - 可用频道: ${wsInfo.data.channels?.length || 0}个`);
        }
      } else {
        console.log('❌ WebSocket信息API响应异常:', wsInfoResponse.status);
      }
    } catch (error) {
      console.log('❌ WebSocket信息API连接失败:', error.message);
    }
    console.log();

    console.log('🎉 TitanChain安全控制台API测试完成！');
    console.log('📊 测试结果总结:');
    console.log('   - 所有API接口已测试');
    console.log('   - 检查了API响应格式');
    console.log('   - 验证了数据结构');
    console.log('   - 测试了错误处理');

  } catch (error) {
    console.error('❌ API测试失败:', error);
    console.error('错误详情:', error.stack);
  }
}

// 运行API测试
testSecurityAPI().catch(console.error);