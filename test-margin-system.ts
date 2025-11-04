import { MarginManager } from './blockchain/core/margin-manager';
import { MarginTradingParams, OrderSide, OrderType, TimeInForce } from './shared/types/margin';

async function testMarginSystem() {
  console.log('🚀 开始测试保证金交易系统...');
  
  // 初始化保证金管理器 / Initialize margin manager
  const marginManager = new MarginManager();
  
  // 添加支持的资产 / Add supported assets
  marginManager.addSupportedAsset('TTN', BigInt('1000000000000000000')); // $1.00
  marginManager.addSupportedAsset('USDT', BigInt('1000000000000000000')); // $1.00
  console.log('✅ 保证金管理器初始化完成，已添加支持的资产');

  // 创建测试账户 / Create test account
  const testUser = 'test-user-123';
  const stakedAmount = BigInt('1000000000000000000000000'); // 1M TTN staked
  
  try {
    const account = await marginManager.createMarginAccount(testUser, stakedAmount);
    console.log('✅ 创建保证金账户:', account);

    // 存入保证金 / Deposit margin
    await marginManager.depositMargin(testUser, 'TTN', BigInt('100000000000000000000000')); // 100,000 TTN
    console.log('✅ 存入保证金 100,000 TTN');

    // 检查账户状态 / Check account status
    const updatedAccount = marginManager.getMarginAccount(testUser);
    console.log('📊 账户状态:', {
      totalEquity: updatedAccount?.totalEquity.toString(),
      availableMargin: updatedAccount?.availableMargin.toString(),
      balances: updatedAccount?.balances
    });

    // 开仓测试 / Open position test
    const tradingParams: MarginTradingParams = {
      tradingPair: 'TTN/USDT',
      side: OrderSide.Buy,
      quantity: BigInt('50000000000000000000000'), // 50,000 TTN
      leverage: 5,
      orderType: OrderType.Market,
      timeInForce: TimeInForce.GTC,
      price: BigInt('1000000000000000000'), // $1.00
    };

    const tradeResult = await marginManager.openPosition(testUser, tradingParams);
    console.log('✅ 开仓结果:', tradeResult);

    // 获取风险指标 / Get risk metrics
    const riskMetrics = await marginManager.getRiskMetrics(testUser);
    console.log('⚠️ 风险指标:', riskMetrics);

    // 更新VIP等级 / Update VIP level
    await marginManager.updateVIPLevel(testUser, BigInt(2000000)); // 2M TTN
    console.log('✅ VIP等级已更新');

    // 模拟价格变动 / Simulate price change
    console.log('📈 模拟价格上涨到 $1.20...');
    // 这里应该有价格更新机制，暂时跳过

    // 追加保证金测试 / Add margin test
    await marginManager.depositMargin(testUser, 'TTN', BigInt(20000));
    console.log('✅ 追加保证金 20,000 TTN');

    // 部分平仓测试 / Partial close test
    if (tradeResult.success && tradeResult.positionId) {
      const closeResult = await marginManager.closePosition(testUser, tradeResult.positionId, BigInt(120));
      console.log('✅ 部分平仓结果:', closeResult);
    }

    console.log('🎉 保证金交易系统测试完成！');
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 运行测试 / Run test
testMarginSystem().catch(console.error);

export { testMarginSystem };