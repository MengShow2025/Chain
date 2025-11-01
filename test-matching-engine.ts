import { MatchingEngine, Order } from './blockchain/matching/matching-engine.js';

/**
 * 撮合引擎测试
 */
async function testMatchingEngine() {
  console.log('🚀 开始测试撮合引擎...\n');
  
  const engine = new MatchingEngine();
  
  try {
    // 测试1: 基本订单提交
    console.log('📝 测试1: 基本订单提交');
    
    const buyOrder: Order = {
      id: 'buy_001',
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'limit',
      price: '50000.00',
      quantity: '1.0',
      account: '0x1234567890abcdef',
      timestamp: Date.now(),
      nonce: 1
    };
    
    const sellOrder: Order = {
      id: 'sell_001',
      symbol: 'BTC/USDT',
      side: 'sell',
      type: 'limit',
      price: '49999.00',
      quantity: '0.5',
      account: '0xfedcba0987654321',
      timestamp: Date.now(),
      nonce: 2
    };
    
    await engine.addOrder(buyOrder);
    await engine.addOrder(sellOrder);
    
    console.log('✅ 订单提交成功');
    
    // 等待撮合处理
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 测试2: 查看订单簿深度
    console.log('\n📊 测试2: 订单簿深度查询');
    const depth = engine.getOrderBookDepth('BTC/USDT', 5);
    console.log('订单簿深度:', JSON.stringify(depth, null, 2));
    
    // 测试3: 批量订单提交
    console.log('\n📦 测试3: 批量订单提交');
    
    const batchOrders: Order[] = [];
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? 'buy' : 'sell';
      const basePrice = 50000;
      const price = side === 'buy' 
        ? (basePrice - Math.random() * 100).toFixed(2)
        : (basePrice + Math.random() * 100).toFixed(2);
      
      batchOrders.push({
        id: `batch_${side}_${i}`,
        symbol: 'BTC/USDT',
        side,
        type: 'limit',
        price,
        quantity: (Math.random() * 2 + 0.1).toFixed(4),
        account: `0x${Math.random().toString(16).substr(2, 40)}`,
        timestamp: Date.now() + i,
        nonce: i + 100
      });
    }
    
    for (const order of batchOrders) {
      await engine.addOrder(order);
    }
    
    console.log(`✅ 批量提交 ${batchOrders.length} 个订单成功`);
    
    // 等待批次处理
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 测试4: 查看撮合引擎统计
    console.log('\n📈 测试4: 撮合引擎统计');
    const stats = engine.getStats();
    console.log('引擎统计:', JSON.stringify(stats, null, 2));
    
    // 测试5: 订单取消
    console.log('\n❌ 测试5: 订单取消');
    
    const cancelOrder: Order = {
      id: 'cancel_test_001',
      symbol: 'ETH/USDT',
      side: 'buy',
      type: 'limit',
      price: '3000.00',
      quantity: '5.0',
      account: '0xtest123456789',
      timestamp: Date.now(),
      nonce: 999
    };
    
    await engine.addOrder(cancelOrder);
    console.log('✅ 订单提交成功');
    
    await engine.cancelOrder(cancelOrder.id, cancelOrder.account);
    console.log('✅ 订单取消成功');
    
    // 测试6: 多交易对测试
    console.log('\n🔄 测试6: 多交易对测试');
    
    const symbols = ['ETH/USDT', 'TTN/USDT', 'BTC/ETH'];
    
    for (const symbol of symbols) {
      const buyOrder: Order = {
        id: `multi_buy_${symbol.replace('/', '_')}`,
        symbol,
        side: 'buy',
        type: 'limit',
        price: (Math.random() * 1000 + 100).toFixed(2),
        quantity: (Math.random() * 10 + 1).toFixed(4),
        account: `0x${Math.random().toString(16).substr(2, 40)}`,
        timestamp: Date.now(),
        nonce: Math.floor(Math.random() * 10000)
      };
      
      await engine.addOrder(buyOrder);
    }
    
    console.log(`✅ 多交易对订单提交成功`);
    
    // 等待处理
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 查看各交易对的订单簿
    for (const symbol of symbols) {
      const depth = engine.getOrderBookDepth(symbol, 3);
      console.log(`${symbol} 订单簿:`, JSON.stringify(depth, null, 2));
    }
    
    // 测试7: 性能测试
    console.log('\n⚡ 测试7: 性能测试');
    
    const startTime = Date.now();
    const performanceOrders: Order[] = [];
    
    // 生成1000个订单
    for (let i = 0; i < 1000; i++) {
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const basePrice = 50000;
      const price = side === 'buy' 
        ? (basePrice - Math.random() * 1000).toFixed(2)
        : (basePrice + Math.random() * 1000).toFixed(2);
      
      performanceOrders.push({
        id: `perf_${i}`,
        symbol: 'BTC/USDT',
        side,
        type: 'limit',
        price,
        quantity: (Math.random() * 5 + 0.1).toFixed(4),
        account: `0x${Math.random().toString(16).substr(2, 40)}`,
        timestamp: Date.now() + i,
        nonce: i + 10000
      });
    }
    
    // 批量提交
    for (const order of performanceOrders) {
      await engine.addOrder(order);
    }
    
    const submitTime = Date.now() - startTime;
    console.log(`✅ 提交 ${performanceOrders.length} 个订单耗时: ${submitTime}ms`);
    console.log(`📊 平均每个订单: ${(submitTime / performanceOrders.length).toFixed(2)}ms`);
    
    // 等待所有批次处理完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalStats = engine.getStats();
    console.log('\n📊 最终统计:', JSON.stringify(finalStats, null, 2));
    
    console.log('\n🎉 撮合引擎测试完成!');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    // 清理资源
    engine.cleanup();
  }
}

/**
 * API测试
 */
async function testMatchingAPI() {
  console.log('\n🌐 开始测试撮合引擎API...\n');
  
  const baseURL = 'http://localhost:8080/api/matching';
  
  try {
    // 测试健康检查
    console.log('🏥 测试健康检查');
    const healthResponse = await fetch(`${baseURL}/health`);
    const healthData = await healthResponse.json();
    console.log('健康检查结果:', JSON.stringify(healthData, null, 2));
    
    // 测试订单提交
    console.log('\n📝 测试订单提交API');
    const orderData = {
      order: {
        id: `api_test_${Date.now()}`,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        price: '50000.00',
        quantity: '1.0',
        account: '0xapi_test_account'
      }
    };
    
    const orderResponse = await fetch(`${baseURL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    
    const orderResult = await orderResponse.json();
    console.log('订单提交结果:', JSON.stringify(orderResult, null, 2));
    
    // 测试订单簿查询
    console.log('\n📊 测试订单簿查询API');
    const orderbookResponse = await fetch(`${baseURL}/orderbook/BTC/USDT?depth=5`);
    const orderbookData = await orderbookResponse.json();
    console.log('订单簿数据:', JSON.stringify(orderbookData, null, 2));
    
    // 测试统计信息
    console.log('\n📈 测试统计信息API');
    const statsResponse = await fetch(`${baseURL}/stats`);
    const statsData = await statsResponse.json();
    console.log('统计信息:', JSON.stringify(statsData, null, 2));
    
    console.log('\n🎉 API测试完成!');
    
  } catch (error) {
    console.error('❌ API测试失败:', error);
  }
}

// 运行测试
async function runTests() {
  await testMatchingEngine();
  
  // 如果网关正在运行，测试API
  try {
    const response = await fetch('http://localhost:8080/health');
    if (response.ok) {
      await testMatchingAPI();
    } else {
      console.log('\n⚠️ 网关未运行，跳过API测试');
    }
  } catch (error) {
    console.log('\n⚠️ 网关未运行，跳过API测试');
  }
}

// 如果直接运行此文件
if (process.argv[1] && process.argv[1].endsWith('test-matching-engine.ts')) {
  runTests().catch(console.error);
}

export { testMatchingEngine, testMatchingAPI };