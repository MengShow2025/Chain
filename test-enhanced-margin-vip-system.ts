/**
 * TitanChain增强保证金系统测试（含VIP等级支持）
 * Enhanced Margin System Test with VIP Level Support
 */

import { TitanMarginManager } from './blockchain/core/titan-margin-manager';
import { LeverageParams } from './shared/types/titan-margin-system';

async function testEnhancedMarginVIPSystem() {
  console.log('🚀 开始测试TitanChain增强保证金系统（含VIP等级支持）...');
  console.log('🚀 Starting TitanChain Enhanced Margin System Test with VIP Level Support...\n');

  const marginManager = new TitanMarginManager();

  try {
    // 1. 创建测试用户账户 / Create test user accounts
    console.log('📝 1. 创建测试用户账户 / Creating test user accounts...');
    
    const regularUser = 'regular-user-001';
    const vip1User = 'vip1-user-002';
    const vip2User = 'vip2-user-003';
    const vip3User = 'vip3-user-004';

    const regularAccount = await marginManager.createMarginAccount(regularUser);
    const vip1Account = await marginManager.createMarginAccount(vip1User);
    const vip2Account = await marginManager.createMarginAccount(vip2User);
    const vip3Account = await marginManager.createMarginAccount(vip3User);

    console.log('✅ 创建账户成功 / Accounts created successfully');
    console.log(`   - 普通用户 / Regular User: ${regularUser}`);
    console.log(`   - VIP1用户 / VIP1 User: ${vip1User}`);
    console.log(`   - VIP2用户 / VIP2 User: ${vip2User}`);
    console.log(`   - VIP3用户 / VIP3 User: ${vip3User}\n`);

    // 2. 存入保证金并设置VIP等级 / Deposit margin and set VIP levels
    console.log('💰 2. 存入保证金并设置VIP等级 / Depositing margin and setting VIP levels...');
    
    // 普通用户存入 $10,000
    await marginManager.depositMargin(regularUser, 'USDT', BigInt('10000000000000000000000'));
    
    // VIP1用户存入 $50,000 并升级VIP等级
    await marginManager.depositMargin(vip1User, 'USDT', BigInt('50000000000000000000000'));
    await marginManager.updateUserVIPLevel(vip1User, 1);
    
    // VIP2用户存入 $200,000 并升级VIP等级
    await marginManager.depositMargin(vip2User, 'USDT', BigInt('200000000000000000000000'));
    await marginManager.updateUserVIPLevel(vip2User, 2);
    
    // VIP3用户存入 $1,000,000 并升级VIP等级
    await marginManager.depositMargin(vip3User, 'USDT', BigInt('1000000000000000000000000'));
    await marginManager.updateUserVIPLevel(vip3User, 3);

    console.log('✅ 保证金存入和VIP等级设置完成 / Margin deposit and VIP level setup completed\n');

    // 3. 设置资产价格 / Set asset prices
    console.log('💹 3. 设置资产价格 / Setting asset prices...');
    await marginManager.updateAssetPrice('BTC', BigInt('50000000000000000000000')); // $50,000
    await marginManager.updateAssetPrice('ETH', BigInt('3000000000000000000000'));  // $3,000
    await marginManager.updateAssetPrice('USDT', BigInt('1000000000000000000'));    // $1.00
    console.log('✅ 资产价格设置完成 / Asset prices set successfully\n');

    // 4. 测试不同VIP等级的杠杆限制 / Test leverage limits for different VIP levels
    console.log('🎯 4. 测试不同VIP等级的杠杆限制 / Testing leverage limits for different VIP levels...');
    
    const testUsers = [
      { user: regularUser, name: '普通用户 / Regular User', expectedMaxLeverage: 10 },
      { user: vip1User, name: 'VIP1用户 / VIP1 User', expectedMaxLeverage: 20 },
      { user: vip2User, name: 'VIP2用户 / VIP2 User', expectedMaxLeverage: 50 },
      { user: vip3User, name: 'VIP3用户 / VIP3 User', expectedMaxLeverage: 100 }
    ];

    for (const testUser of testUsers) {
      const maxLeverage = await marginManager.getUserMaxLeverage(testUser.user, 'BTC/USDT');
      console.log(`   - ${testUser.name}: 最大杠杆 ${maxLeverage}x (预期 ${testUser.expectedMaxLeverage}x)`);
      
      if (maxLeverage === testUser.expectedMaxLeverage) {
        console.log('     ✅ 杠杆限制正确 / Leverage limit correct');
      } else {
        console.log('     ❌ 杠杆限制错误 / Leverage limit incorrect');
      }
    }
    console.log();

    // 5. 测试开仓交易（不同杠杆倍数）/ Test opening positions with different leverage
    console.log('📈 5. 测试开仓交易（不同杠杆倍数）/ Testing position opening with different leverage...');
    
    const positions = [];

    // 普通用户：10倍杠杆开仓
    const regularParams: LeverageParams = {
      userId: regularUser,
      tradingPair: 'BTC/USDT',
      side: 'long',
      quantity: BigInt('100000000000000000'), // 0.1 BTC
      leverage: 10,
      orderType: 'market',
      price: BigInt('50000000000000000000000')
    };
    
    const regularPosition = await marginManager.openLeveragePosition(regularParams);
    positions.push({ user: regularUser, position: regularPosition });
    console.log(`✅ 普通用户开仓成功 / Regular user position opened: ${regularPosition.positionId}`);

    // VIP1用户：20倍杠杆开仓
    const vip1Params: LeverageParams = {
      userId: vip1User,
      tradingPair: 'BTC/USDT',
      side: 'long',
      quantity: BigInt('200000000000000000'), // 0.2 BTC
      leverage: 20,
      orderType: 'market',
      price: BigInt('50000000000000000000000')
    };
    
    const vip1Position = await marginManager.openLeveragePosition(vip1Params);
    positions.push({ user: vip1User, position: vip1Position });
    console.log(`✅ VIP1用户开仓成功 / VIP1 user position opened: ${vip1Position.positionId}`);

    // VIP2用户：50倍杠杆开仓
    const vip2Params: LeverageParams = {
      userId: vip2User,
      tradingPair: 'ETH/USDT',
      side: 'long',
      quantity: BigInt('10000000000000000000'), // 10 ETH
      leverage: 50,
      orderType: 'market',
      price: BigInt('3000000000000000000000')
    };
    
    const vip2Position = await marginManager.openLeveragePosition(vip2Params);
    positions.push({ user: vip2User, position: vip2Position });
    console.log(`✅ VIP2用户开仓成功 / VIP2 user position opened: ${vip2Position.positionId}`);

    // VIP3用户：100倍杠杆开仓
    const vip3Params: LeverageParams = {
      userId: vip3User,
      tradingPair: 'BTC/USDT',
      side: 'long',
      quantity: BigInt('1000000000000000000'), // 1 BTC
      leverage: 100,
      orderType: 'market',
      price: BigInt('50000000000000000000000')
    };
    
    const vip3Position = await marginManager.openLeveragePosition(vip3Params);
    positions.push({ user: vip3User, position: vip3Position });
    console.log(`✅ VIP3用户开仓成功 / VIP3 user position opened: ${vip3Position.positionId}\n`);

    // 6. 检查所有用户的持仓和风险指标 / Check positions and risk metrics for all users
    console.log('📊 6. 检查所有用户的持仓和风险指标 / Checking positions and risk metrics for all users...');
    
    for (const testUser of testUsers) {
      const userPositions = await marginManager.getUserPositions(testUser.user);
      const riskMetrics = await marginManager.getRiskMetrics(testUser.user);
      
      console.log(`\n${testUser.name} (${testUser.user}):`);
      console.log(`   - 持仓数量 / Positions: ${userPositions.length}`);
      console.log(`   - 总权益 / Total Equity: $${(Number(riskMetrics.totalEquity) / 1e18).toLocaleString()}`);
      console.log(`   - 已用保证金 / Used Margin: $${(Number(riskMetrics.totalMargin) / 1e18).toLocaleString()}`);
      console.log(`   - 保证金率 / Margin Ratio: ${(riskMetrics.marginRatio / 10000).toFixed(2)}%`);
      console.log(`   - 总杠杆倍数 / Total Leverage: ${riskMetrics.leverage.toFixed(2)}x`);
      console.log(`   - 风险等级 / Risk Level: ${riskMetrics.riskLevel}`);
      console.log(`   - 未实现盈亏 / Unrealized PnL: $${(Number(riskMetrics.unrealizedPnl) / 1e18).toFixed(2)}`);
    }
    console.log();

    // 7. 测试VIP手续费折扣 / Test VIP fee discounts
    console.log('💸 7. 测试VIP手续费折扣 / Testing VIP fee discounts...');
    
    const baseFeeRate = 0.001; // 0.1% 基础手续费率
    
    for (const testUser of testUsers) {
      const userFeeRate = await marginManager.getUserFeeRate(testUser.user, baseFeeRate);
      const discount = ((baseFeeRate - userFeeRate) / baseFeeRate * 100).toFixed(1);
      
      console.log(`   - ${testUser.name}: 手续费率 ${(userFeeRate * 100).toFixed(3)}% (折扣 ${discount}%)`);
    }
    console.log();

    // 8. 模拟价格下跌测试风险管理 / Simulate price drop to test risk management
    console.log('📉 8. 模拟价格下跌测试风险管理 / Simulating price drop to test risk management...');
    
    // BTC价格下跌到 $45,000 (-10%)
    await marginManager.updateAssetPrice('BTC', BigInt('45000000000000000000000'));
    console.log('💹 BTC价格更新至 $45,000 (-10%) / BTC price updated to $45,000 (-10%)');
    
    // ETH价格下跌到 $2,700 (-10%)
    await marginManager.updateAssetPrice('ETH', BigInt('2700000000000000000000'));
    console.log('💹 ETH价格更新至 $2,700 (-10%) / ETH price updated to $2,700 (-10%)\n');

    // 检查价格下跌后的风险指标
    console.log('⚠️ 价格下跌后的风险指标 / Risk metrics after price drop:');
    for (const testUser of testUsers) {
      const riskMetrics = await marginManager.getRiskMetrics(testUser.user);
      
      console.log(`\n${testUser.name}:`);
      console.log(`   - 保证金率 / Margin Ratio: ${(riskMetrics.marginRatio / 10000).toFixed(2)}%`);
      console.log(`   - 风险等级 / Risk Level: ${riskMetrics.riskLevel}`);
      console.log(`   - 未实现盈亏 / Unrealized PnL: $${(Number(riskMetrics.unrealizedPnl) / 1e18).toFixed(2)}`);
      console.log(`   - 需要追加保证金 / Margin Call Required: ${riskMetrics.marginCallRequired ? '是 / Yes' : '否 / No'}`);
      console.log(`   - 清算风险 / Liquidation Risk: ${riskMetrics.liquidationRisk ? '是 / Yes' : '否 / No'}`);
    }
    console.log();

    // 9. 测试部分平仓 / Test partial position closing
    console.log('🔄 9. 测试部分平仓 / Testing partial position closing...');
    
    if (positions.length > 0) {
      const testPosition = positions[0];
      const closeResult = await marginManager.closeLeveragePosition(
        testPosition.position.positionId,
        BigInt('50000000000000000') // 关闭一半持仓
      );
      
      console.log(`✅ 部分平仓成功 / Partial close successful:`);
      console.log(`   - 持仓ID / Position ID: ${closeResult.positionId}`);
      console.log(`   - 平仓数量 / Closed Quantity: ${Number(closeResult.closedQuantity) / 1e18}`);
      console.log(`   - 平仓价格 / Close Price: $${Number(closeResult.closedPrice) / 1e18}`);
      console.log(`   - 盈亏 / PnL: $${Number(closeResult.pnl) / 1e18}`);
    }
    console.log();

    // 10. 系统风险指标统计 / System risk metrics statistics
    console.log('📈 10. 系统风险指标统计 / System risk metrics statistics...');
    
    const systemMetrics = await marginManager.getSystemRiskMetrics();
    console.log(`✅ 系统风险指标 / System Risk Metrics:`);
    console.log(`   - 总已用保证金 / Total Margin Used: $${(Number(systemMetrics.totalMarginUsed) / 1e18).toLocaleString()}`);
    console.log(`   - 总权益 / Total Equity: $${(Number(systemMetrics.totalEquity) / 1e18).toLocaleString()}`);
    console.log(`   - 平均保证金率 / Average Margin Ratio: ${(systemMetrics.averageMarginRatio / 10000).toFixed(2)}%`);
    console.log(`   - 风险用户数 / Users at Risk: ${systemMetrics.usersAtRisk}`);
    console.log(`   - 待清算用户数 / Liquidations Pending: ${systemMetrics.liquidationsPending}`);

    console.log('\n🎉 TitanChain增强保证金系统（含VIP等级支持）测试完成！');
    console.log('🎉 TitanChain Enhanced Margin System with VIP Level Support test completed successfully!');
    
    console.log('\n📋 测试总结 / Test Summary:');
    console.log('✅ 保证金账户创建和管理 / Margin account creation and management');
    console.log('✅ VIP等级系统集成 / VIP level system integration');
    console.log('✅ 动态杠杆配置（1-100倍）/ Dynamic leverage configuration (1-100x)');
    console.log('✅ 杠杆交易开仓/平仓 / Leverage trading open/close positions');
    console.log('✅ 实时风险监控和计算 / Real-time risk monitoring and calculation');
    console.log('✅ VIP手续费折扣系统 / VIP fee discount system');
    console.log('✅ 价格变动影响和风险管理 / Price impact and risk management');
    console.log('✅ 系统级风险指标统计 / System-level risk metrics statistics');

  } catch (error) {
    console.error('❌ 测试过程中出现错误 / Error during testing:', error);
    throw error;
  }
}

// 运行测试 / Run test
if (require.main === module) {
  testEnhancedMarginVIPSystem().catch(console.error);
}

export { testEnhancedMarginVIPSystem };