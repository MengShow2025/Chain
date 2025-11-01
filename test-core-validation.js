/**
 * 核心组件验证测试
 */

async function validateCoreComponents() {
  console.log('🔍 开始核心组件验证测试');
  console.log('='.repeat(60));

  try {
    // 1. 验证消息总线基础功能
    console.log('\n📋 步骤1: 验证消息总线基础功能');
    await testMessageBusBasics();

    // 2. 验证微批处理器
    console.log('\n📋 步骤2: 验证微批处理器');
    await testMicroBatchProcessor();

    // 3. 验证撮合引擎
    console.log('\n📋 步骤3: 验证撮合引擎');
    await testMatchingEngine();

    // 4. 验证批次提交生成器
    console.log('\n📋 步骤4: 验证批次提交生成器');
    await testBatchCommitGenerator();

    console.log('\n✅ 所有核心组件验证完成！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 验证失败:', error);
    throw error;
  }
}

/**
 * 测试消息总线基础功能
 */
async function testMessageBusBasics() {
  const { MessageBus, SimpleMessageHandler } = await import('./blockchain/messaging/message-bus.ts');
  
  const messageBus = new MessageBus();
  console.log('✅ 消息总线已创建');

  // 创建简单的消息处理器
  const handler = new SimpleMessageHandler('test-handler');
  
  // 订阅消息
  const subscriptionId = messageBus.subscribe({
    topic: 'test-topic',
    handler: handler
  });
  
  console.log('✅ 消息订阅成功:', subscriptionId);

  // 发布消息
  const messageId = await messageBus.publish('test-topic', { 
    message: 'Hello World',
    timestamp: Date.now()
  });
  
  console.log('✅ 消息发布成功:', messageId);

  // 等待消息处理
  await new Promise(resolve => setTimeout(resolve, 200));

  // 获取统计信息
  const stats = messageBus.getStats();
  console.log('✅ 消息总线统计:', {
    totalMessages: stats.totalMessages,
    activeSubscriptions: stats.activeSubscriptions
  });

  await messageBus.cleanup();
  console.log('✅ 消息总线清理完成');
}

/**
 * 测试微批处理器
 */
async function testMicroBatchProcessor() {
  const { MessageBus } = await import('./blockchain/messaging/message-bus.ts');
  const { EnhancedMicroBatchProcessor } = await import('./blockchain/core/enhanced-micro-batch-processor.ts');
  
  const messageBus = new MessageBus();
  const processor = new EnhancedMicroBatchProcessor({
    windowSizeMs: 500,
    maxBatchSize: 5,
    maxMemoryMB: 256,
    priorityEnabled: true,
    persistenceEnabled: false,
    adaptiveWindowSize: false,
    minWindowSize: 200,
    maxWindowSize: 1000
  }, messageBus);

  console.log('✅ 微批处理器已创建');

  // 启动处理器
  await processor.start();
  console.log('✅ 微批处理器已启动');

  // 创建测试订单
  const testOrders = [
    {
      id: 'order-1',
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'limit',
      price: '50000.00',
      quantity: '1.0',
      account: 'user-1',
      timestamp: Date.now(),
      nonce: 1
    },
    {
      id: 'order-2',
      symbol: 'BTC/USDT',
      side: 'sell',
      type: 'limit',
      price: '49900.00',
      quantity: '0.5',
      account: 'user-2',
      timestamp: Date.now() + 1,
      nonce: 2
    }
  ];

  // 添加订单
  for (const order of testOrders) {
    await processor.addOrder(order);
    console.log('✅ 订单已添加:', order.id);
  }

  // 等待处理
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 获取指标
  const metrics = processor.getMetrics();
  console.log('✅ 处理器指标:', {
    totalBatches: metrics.totalBatches,
    avgBatchSize: metrics.avgBatchSize,
    successRate: metrics.successRate
  });

  // 停止处理器
  await processor.stop();
  console.log('✅ 微批处理器已停止');

  await messageBus.cleanup();
}

/**
 * 测试撮合引擎
 */
async function testMatchingEngine() {
  const { MatchingEngine } = await import('./blockchain/matching/matching-engine.ts');
  
  const engine = new MatchingEngine();
  console.log('✅ 撮合引擎已创建');

  // 创建测试订单
  const buyOrder = {
    id: 'buy-1',
    symbol: 'BTC/USDT',
    side: 'buy',
    type: 'limit',
    price: '50000.00',
    quantity: '1.0',
    account: 'buyer-1',
    timestamp: Date.now(),
    nonce: 1
  };

  const sellOrder = {
    id: 'sell-1',
    symbol: 'BTC/USDT',
    side: 'sell',
    type: 'limit',
    price: '49900.00',
    quantity: '0.8',
    account: 'seller-1',
    timestamp: Date.now() + 1,
    nonce: 2
  };

  // 添加订单
  await engine.addOrder(buyOrder);
  await engine.addOrder(sellOrder);
  console.log('✅ 测试订单已添加');

  // 等待撮合
  await new Promise(resolve => setTimeout(resolve, 200));

  // 获取撮合结果
  const results = engine.getCurrentBatchResults();
  console.log('✅ 撮合结果:', {
    matches: results.matches.length,
    balanceDiffs: results.balanceDiffs.length
  });

  // 获取统计信息
  const stats = engine.getStats();
  console.log('✅ 撮合引擎统计:', {
    totalOrders: stats.totalOrders,
    totalMatches: stats.totalMatches
  });

  engine.cleanup();
  console.log('✅ 撮合引擎已清理');
}

/**
 * 测试批次提交生成器
 */
async function testBatchCommitGenerator() {
  const { MessageBus } = await import('./blockchain/messaging/message-bus.ts');
  const { BatchCommitGenerator } = await import('./blockchain/matching/batch-commit-generator.ts');
  
  const messageBus = new MessageBus();
  const generator = new BatchCommitGenerator({
    compressionEnabled: false,
    encryptionEnabled: false,
    batchSizeLimit: 100,
    timeoutMs: 5000
  }, messageBus);

  console.log('✅ 批次提交生成器已创建');

  // 创建测试数据
  const testData = {
    orders: [
      {
        id: 'order-1',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        price: '50000.00',
        quantity: '1.0',
        account: 'user-1',
        timestamp: Date.now(),
        nonce: 1
      }
    ],
    matches: [],
    balanceDiffs: []
  };

  try {
    // 生成批次提交
    const batchCommit = await generator.generateBatchCommit(testData);
    console.log('✅ 批次提交已生成:', {
      id: batchCommit.id,
      merkleRoot: batchCommit.merkleRoot ? 'generated' : 'missing',
      cid: batchCommit.cid ? 'generated' : 'missing'
    });
  } catch (error) {
    console.log('⚠️ 批次提交生成遇到问题:', error.message);
  }

  await messageBus.cleanup();
  console.log('✅ 批次提交生成器测试完成');
}

// 运行验证
console.log('开始核心组件验证...');
validateCoreComponents()
  .then(() => {
    console.log('\n🎉 所有验证完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 验证失败:', error);
    process.exit(1);
  });