import { MessageBus } from './blockchain/messaging/message-bus.js';
import { EnhancedMicroBatchProcessor } from './blockchain/core/enhanced-micro-batch-processor.js';
import { Order } from './blockchain/matching/matching-engine.js';

/**
 * 简化的链下撮合引擎测试
 */
async function runSimpleTest() {
  console.log('🚀 开始简化的链下撮合引擎测试');
  console.log('='.repeat(50));

  try {
    // 1. 测试消息总线
    console.log('\n📋 步骤1: 测试消息总线');
    const messageBus = new MessageBus();
    
    let messageReceived = false;
    messageBus.subscribe('test-topic', (message) => {
      console.log('✅ 收到消息:', message.data);
      messageReceived = true;
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
      maxBatchSize: 10,
      timeWindowMs: 1000,
      maxConcurrentBatches: 5,
      enableDynamicSizing: true,
      enableTimeWindows: true,
      enablePriorityQueuing: true,
      performanceThresholds: {
        maxLatency: 100,
        minThroughput: 1000,
        maxMemoryUsage: 512 * 1024 * 1024
      }
    }, messageBus);

    // 创建测试订单
    const testOrder: Order = {
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
      batchesProcessed: metrics.batchesProcessed,
      ordersProcessed: metrics.ordersProcessed,
      averageLatency: metrics.averageLatency
    });

    // 3. 测试订单生成和处理
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
      avgProcessingTime: finalMetrics.avgProcessingTime
    });

    console.log('\n✅ 简化测试完成！');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    throw error;
  }
}

/**
 * 生成测试订单
 */
function generateTestOrders(count: number): Order[] {
  const orders: Order[] = [];
  
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
console.log('开始执行测试脚本...');
runSimpleTest()
  .then(() => {
    console.log('\n🎉 所有测试完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 测试失败:', error);
    process.exit(1);
  });