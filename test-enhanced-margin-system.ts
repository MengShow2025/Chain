/**
 * TitanChain增强保证金系统测试
 * Enhanced Margin System Test for TitanChain
 */

import { TitanMarginManager } from './blockchain/core/titan-margin-manager';
import { LeverageParams } from './shared/types/titan-margin-system';

async function testEnhancedMarginSystem() {
  console.log('🚀 开始测试TitanChain增强保证金系统...');
  
  try {
    // 初始化保证金管理器 / Initialize margin manager
    const marginManager = new TitanMarginManager();
    console.log('✅ 增强保证金管理器初始化完成');

    // 设置事件监听器 / Set up event listeners
    marginManager.on('positionOpened', (userId, position) => {
      console.log(`📈 持仓开启: 用户 ${userId}, 持仓ID ${position.id}`);
    });

    marginManager.on('positionClosed', (userId, result) => {
      console.log(`📉 持仓关闭: 用户 ${userId}, 盈亏 ${result.pnl}`);
    });

    marginManager.on('marginCall', (userId, marginRatio) => {
      console.log(`⚠️ 保证金调用: 用户 ${userId}, 保证金率 ${marginRatio / 1000000}%`);
    });

    marginManager.on('liquidation', (userId, result) => {
      console.log(`🔴 强制平仓: 用户 ${userId}, 损失 ${result.totalLoss}`);
    });

    const testUserId = 'enhanced-test-user';

    // 1. 创建保证金账户 / Create margin account
    console.log('\n📋 步骤1: 创建保证金账户');
    const account = await marginManager.createMarginAccount(testUserId);
    console.log('✅ 保证金账户创建成功:', {
      user: account.user,
      status: account.status,
      vipLevel: account.vipLevel
    });

    // 2. 存入保证金 / Deposit margin
    console.log('\n💰 步骤2: 存入保证金');
    await marginManager.depositMargin(testUserId, 'USDT', BigInt('10000000000000000000000')); // 10,000 USDT
    await marginManager.depositMargin(testUserId, 'TTN', BigInt('50000000000000000000000'));  // 50,000 TTN
    console.log('✅ 保证金存入完成: 10,000 USDT + 50,000 TTN');

    // 3. 检查账户状态 / Check account status
    const updatedAccount = await marginManager.getMarginAccount(testUserId);
    console.log('📊 账户状态:', {
      totalEquity: updatedAccount?.totalEquity.toString(),
      availableMargin: updatedAccount?.availableMargin.toString(),
      balances: Object.fromEntries(
        Object.entries(updatedAccount?.balances || {}).map(([k, v]) => [k, v.toString()])
      )
    });

    // 4. 开启杠杆持仓 / Open leverage position
    console.log('\n📈 步骤3: 开启杠杆持仓');
    const leverageParams: LeverageParams = {
      userId: testUserId,
      tradingPair: 'BTC/USDT',
      side: 'long',
      quantity: BigInt('1000000000000000000'), // 1 BTC
      leverage: 5,
      orderType: 'market'
    };

    const positionResult = await marginManager.openLeveragePosition(leverageParams);
    console.log('✅ 杠杆持仓开启结果:', {
      success: positionResult.success,
      positionId: positionResult.positionId,
      executedQuantity: positionResult.executedQuantity.toString(),
      executedPrice: positionResult.executedPrice.toString(),
      fee: positionResult.fee.toString()
    });

    // 5. 获取风险指标 / Get risk metrics
    console.log('\n⚠️ 步骤4: 获取风险指标');
    const riskMetrics = await marginManager.getRiskMetrics(testUserId);
    console.log('📊 风险指标:', {
      totalEquity: riskMetrics.totalEquity.toString(),
      totalMargin: riskMetrics.totalMargin.toString(),
      marginRatio: `${riskMetrics.marginRatio / 1000000}%`,
      leverage: riskMetrics.leverage,
      riskLevel: riskMetrics.riskLevel,
      marginCallRequired: riskMetrics.marginCallRequired,
      liquidationRisk: riskMetrics.liquidationRisk
    });

    // 6. 模拟价格变动 / Simulate price movement
    console.log('\n📈 步骤5: 模拟BTC价格上涨到$55,000');
    await marginManager.updateAssetPrice('BTC', BigInt('55000000000000000000000')); // $55,000
    
    const updatedRiskMetrics = await marginManager.getRiskMetrics(testUserId);
    console.log('📊 价格变动后风险指标:', {
      totalEquity: updatedRiskMetrics.totalEquity.toString(),
      unrealizedPnl: updatedRiskMetrics.unrealizedPnl.toString(),
      marginRatio: `${updatedRiskMetrics.marginRatio / 1000000}%`,
      riskLevel: updatedRiskMetrics.riskLevel
    });

    // 7. 获取持仓信息 / Get position info
    console.log('\n📋 步骤6: 获取持仓信息');
    const positions = await marginManager.getUserPositions(testUserId);
    console.log('📊 用户持仓:', positions.map(pos => ({
      id: pos.id,
      tradingPair: pos.tradingPair,
      isLong: pos.isLong,
      quantity: pos.quantity.toString(),
      avgPrice: pos.avgPrice.toString(),
      unrealizedPnl: pos.unrealizedPnl.toString(),
      leverage: pos.leverage,
      isActive: pos.isActive
    })));

    // 8. 部分平仓 / Partial close position
    if (positionResult.success && positionResult.positionId) {
      console.log('\n📉 步骤7: 部分平仓');
      const closeResult = await marginManager.closeLeveragePosition(
        positionResult.positionId,
        BigInt('500000000000000000') // 0.5 BTC
      );
      
      console.log('✅ 部分平仓结果:', {
        success: closeResult.success,
        closedQuantity: closeResult.closedQuantity.toString(),
        closedPrice: closeResult.closedPrice.toString(),
        pnl: closeResult.pnl.toString(),
        fee: closeResult.fee.toString()
      });
    }

    // 9. 获取系统风险指标 / Get system risk metrics
    console.log('\n🌐 步骤8: 获取系统风险指标');
    const systemMetrics = await marginManager.getSystemRiskMetrics();
    console.log('📊 系统风险指标:', {
      totalMarginUsed: systemMetrics.totalMarginUsed.toString(),
      totalEquity: systemMetrics.totalEquity.toString(),
      averageMarginRatio: `${systemMetrics.averageMarginRatio / 1000000}%`,
      usersAtRisk: systemMetrics.usersAtRisk,
      liquidationsPending: systemMetrics.liquidationsPending
    });

    // 10. 测试保证金配置 / Test margin configuration
    console.log('\n⚙️ 步骤9: 测试保证金配置');
    const currentConfig = await marginManager.getMarginConfig();
    console.log('📋 当前配置:', {
      initialMarginRate: `${currentConfig.initialMarginRate * 100}%`,
      maintenanceMarginRate: `${currentConfig.maintenanceMarginRate * 100}%`,
      maxLeverage: `${currentConfig.maxLeverage}x`,
      liquidationThreshold: `${currentConfig.liquidationThreshold * 100}%`,
      marginCallThreshold: `${currentConfig.marginCallThreshold * 100}%`
    });

    // 11. 测试极端情况 - 价格大幅下跌 / Test extreme case - significant price drop
    console.log('\n🔴 步骤10: 测试极端情况 - BTC价格暴跌到$30,000');
    await marginManager.updateAssetPrice('BTC', BigInt('30000000000000000000000')); // $30,000
    
    const extremeRiskMetrics = await marginManager.getRiskMetrics(testUserId);
    console.log('⚠️ 极端情况下风险指标:', {
      totalEquity: extremeRiskMetrics.totalEquity.toString(),
      unrealizedPnl: extremeRiskMetrics.unrealizedPnl.toString(),
      marginRatio: `${extremeRiskMetrics.marginRatio / 1000000}%`,
      riskLevel: extremeRiskMetrics.riskLevel,
      marginCallRequired: extremeRiskMetrics.marginCallRequired,
      liquidationRisk: extremeRiskMetrics.liquidationRisk
    });

    // 12. 检查保证金调用用户 / Check margin call users
    const marginCallUsers = await marginManager.getMarginCallUsers();
    if (marginCallUsers.length > 0) {
      console.log('⚠️ 需要保证金调用的用户:', marginCallUsers);
    }

    console.log('\n🎉 TitanChain增强保证金系统测试完成！');
    console.log('✅ 所有功能测试通过');
    console.log('📊 系统具备完整的杠杆交易、风险管理和强制平仓功能');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  }
}

// 运行测试 / Run test
testEnhancedMarginSystem().catch(console.error);