/**
 * 基础链下撮合引擎测试 (JavaScript版本)
 */

async function runBasicTest() {
  console.log('🚀 开始基础链下撮合引擎测试');
  console.log('='.repeat(50));

  try {
    // 动态导入模块
    const { MessageBus } = await import('./blockchain/messaging/message-bus.ts');
    const { EnhancedMicroBatchProcessor } = await import('./blockchain/core/enhanced-micro-batch-processor.ts');
    
    // 1. 测试消息总线
    console.log('\n📋 步骤1: 测试消息总线');
    const messageBus = new MessageBus();
    
    let messageReceived = false;
    
    // 创建消息处理器
    const testHandler = {
      async handle(message) {
        console.log('✅ 收到消息:', message.payload);
        messageReceived = true;
      }
    };
    
    // 订阅消息
    messageBus.subscribe({
      topic: 'test-topic',
      handler: testHandler
    });

    await messageBus.publish('test-topic', { test: 'data' });
    
    // 等待消息处理
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (messageReceived) {
      console.log('✅ 消息总线测试通过');
    } else {
      throw new Error('消息总线测试失败');
    }

    // 2. 测试微批处理器
    console.log('\n📋 步骤2: 测试微批处理器');
    const processor = new EnhancedMicroBatchProcessor({
      windowSizeMs: 1000,
      maxBatchSize: 10,
      maxMemoryMB: 512,
      priorityEnabled: true,
      persistenceEnabled: true,
      adaptiveWindowSize: true,
      minWindowSize: 500,
      maxWindowSize: 2000
    }, messageBus);

    // 启动处理器
    await processor.start();
    console.log('✅ 微批处理器已启动');

    // 创建测试订单
    const testOrder = {
      id: 'test-order-1',
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'limit',
      price: '50000.00',
      quantity: '1.0',
      account: 'test-account',
      timestamp: Date.now(),
      nonce: 1
    };

    console.log('添加测试订单...');
    await processor.addOrder(testOrder);
    
    // 等待处理
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const metrics = processor.getMetrics();
    console.log('✅ 微批处理器指标:', {
      totalBatches: metrics.totalBatches,
      avgBatchSize: metrics.avgBatchSize,
      avgProcessingTime: metrics.avgProcessingTime,
      successRate: metrics.successRate
    });

    // 3. 测试批量订单处理
    console.log('\n📋 步骤3: 测试批量订单处理');
    
    const orders = generateTestOrders(5);
    console.log(`生成 ${orders.length} 个测试订单`);
    
    for (const order of orders) {
      await processor.addOrder(order);
    }
    
    // 等待批处理完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finalMetrics = processor.getMetrics();
    console.log('✅ 最终处理指标:', {
      totalBatches: finalMetrics.totalBatches,
      avgBatchSize: finalMetrics.avgBatchSize,
      avgProcessingTime: finalMetrics.avgProcessingTime,
      successRate: finalMetrics.successRate,
      memoryUsage: finalMetrics.memoryUsage
    });

    // 停止处理器
    await processor.stop();
    console.log('✅ 微批处理器已停止');

    console.log('\n✅ 基础测试完成！');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    throw error;
  }
}

/**
 * 生成测试订单
 */
function generateTestOrders(count) {
  const orders = [];
  
  for (let i = 0; i < count; i++) {
    orders.push({
      id: `test-order-${i + 2}`,
      symbol: i % 2 === 0 ? 'BTC/USDT' : 'ETH/USDT',
      side: i % 2 === 0 ? 'buy' : 'sell',
      type: 'limit',
      price: (50000 + Math.random() * 1000).toFixed(2),
      quantity: (Math.random() * 5 + 0.1).toFixed(4),
      account: `test-account-${i}`,
      timestamp: Date.now() + i,
      nonce: i + 2
    });
  }
  
  return orders;
}

// 运行测试
console.log('开始执行基础测试脚本...');
runBasicTest()
  .then(() => {
    console.log('\n🎉 所有测试完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 测试失败:', error);
    process.exit(1);
  });