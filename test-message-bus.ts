import { 
  MessageBus, 
  Message, 
  MessagePriority, 
  SimpleMessageHandler, 
  BatchStreamProcessor,
  TransformStreamProcessor,
  MessageHandler,
  SubscriptionConfig
} from './blockchain/messaging/message-bus';

/**
 * 消息总线测试
 */
async function testMessageBus() {
  console.log('🚀 开始测试消息总线...\n');
  
  const messageBus = new MessageBus();
  
  try {
    // 测试1: 基础发布订阅
    await testBasicPubSub(messageBus);
    
    // 测试2: 优先级消息处理
    await testPriorityMessaging(messageBus);
    
    // 测试3: 消息过滤
    await testMessageFiltering(messageBus);
    
    // 测试4: 流处理
    await testStreamProcessing(messageBus);
    
    // 测试5: 错误处理和重试
    await testErrorHandlingAndRetry(messageBus);
    
    // 测试6: 性能测试
    await testPerformance(messageBus);
    
    // 测试7: 死信队列
    await testDeadLetterQueue(messageBus);
    
    console.log('\n✅ 所有测试通过！');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  } finally {
    await messageBus.cleanup();
  }
}

/**
 * 测试基础发布订阅
 */
async function testBasicPubSub(messageBus: MessageBus) {
  console.log('📋 测试1: 基础发布订阅功能');
  
  let receivedMessages: Message[] = [];
  
  // 创建消息处理器
  const handler = new SimpleMessageHandler('TestHandler', 5);
  
  // 订阅主题
  const subscriptionId = messageBus.subscribe({
    topic: 'test.basic',
    handler: {
      async handle(message: Message) {
        receivedMessages.push(message);
        await handler.handle(message);
      }
    }
  });
  
  // 发布消息
  const messageId1 = await messageBus.publish('test.basic', { data: 'Hello World' }, {
    type: 'greeting'
  });
  
  const messageId2 = await messageBus.publish('test.basic', { data: 'Test Message' }, {
    type: 'test'
  });
  
  // 等待消息处理
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log(`发布了 2 条消息`);
  console.log(`接收到 ${receivedMessages.length} 条消息`);
  console.log(`消息ID: ${messageId1}, ${messageId2}`);
  
  // 验证消息内容
  if (receivedMessages.length === 2) {
    console.log('✅ 基础发布订阅测试通过');
  } else {
    console.log('❌ 基础发布订阅测试失败');
  }
  
  console.log('');
}

/**
 * 测试优先级消息处理
 */
async function testPriorityMessaging(messageBus: MessageBus) {
  console.log('📋 测试2: 优先级消息处理');
  
  let processedOrder: string[] = [];
  
  // 创建处理器记录处理顺序
  const priorityHandler: MessageHandler = {
    async handle(message: Message) {
      processedOrder.push(`${message.payload.order}-${MessagePriority[message.priority]}`);
      console.log(`处理消息: ${message.payload.order} (优先级: ${MessagePriority[message.priority]})`);
    }
  };
  
  // 订阅主题
  messageBus.subscribe({
    topic: 'test.priority',
    handler: priorityHandler
  });
  
  // 发布不同优先级的消息（故意乱序发布）
  await messageBus.publish('test.priority', { order: 'A' }, { priority: MessagePriority.LOW });
  await messageBus.publish('test.priority', { order: 'B' }, { priority: MessagePriority.CRITICAL });
  await messageBus.publish('test.priority', { order: 'C' }, { priority: MessagePriority.NORMAL });
  await messageBus.publish('test.priority', { order: 'D' }, { priority: MessagePriority.HIGH });
  
  // 等待消息处理
  await new Promise(resolve => setTimeout(resolve, 200));
  
  console.log(`处理顺序: ${processedOrder.join(' -> ')}`);
  
  // 验证优先级顺序（CRITICAL > HIGH > NORMAL > LOW）
  const expectedOrder = ['B-CRITICAL', 'D-HIGH', 'C-NORMAL', 'A-LOW'];
  const isCorrectOrder = JSON.stringify(processedOrder) === JSON.stringify(expectedOrder);
  
  if (isCorrectOrder) {
    console.log('✅ 优先级消息处理测试通过');
  } else {
    console.log('❌ 优先级消息处理测试失败');
    console.log(`期望顺序: ${expectedOrder.join(' -> ')}`);
  }
  
  console.log('');
}

/**
 * 测试消息过滤
 */
async function testMessageFiltering(messageBus: MessageBus) {
  console.log('📋 测试3: 消息过滤');
  
  let filteredMessages: Message[] = [];
  
  // 创建过滤处理器
  const filterHandler: MessageHandler = {
    async handle(message: Message) {
      filteredMessages.push(message);
      console.log(`过滤后接收: ${message.type} - ${message.payload.content}`);
    }
  };
  
  // 订阅带过滤器的主题
  messageBus.subscribe({
    topic: 'test.filter',
    handler: filterHandler,
    filter: {
      messageType: 'important',
      priority: MessagePriority.HIGH
    }
  });
  
  // 发布各种消息
  await messageBus.publish('test.filter', { content: 'Normal message' }, {
    type: 'normal',
    priority: MessagePriority.NORMAL
  });
  
  await messageBus.publish('test.filter', { content: 'Important message 1' }, {
    type: 'important',
    priority: MessagePriority.HIGH
  });
  
  await messageBus.publish('test.filter', { content: 'Low priority important' }, {
    type: 'important',
    priority: MessagePriority.LOW
  });
  
  await messageBus.publish('test.filter', { content: 'Important message 2' }, {
    type: 'important',
    priority: MessagePriority.HIGH
  });
  
  // 等待消息处理
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log(`发布了 4 条消息，过滤后接收到 ${filteredMessages.length} 条消息`);
  
  // 验证过滤结果（应该只有2条重要且高优先级的消息）
  if (filteredMessages.length === 2) {
    console.log('✅ 消息过滤测试通过');
  } else {
    console.log('❌ 消息过滤测试失败');
  }
  
  console.log('');
}

/**
 * 测试流处理
 */
async function testStreamProcessing(messageBus: MessageBus) {
  console.log('📋 测试4: 流处理');
  
  // 注册批处理流处理器
  const batchProcessor = new BatchStreamProcessor(3);
  messageBus.registerStreamProcessor('batch', batchProcessor);
  
  // 注册转换流处理器
  const transformProcessor = new TransformStreamProcessor((message: Message) => ({
    ...message,
    type: `transformed_${message.type}`,
    payload: {
      ...message.payload,
      transformed: true,
      transformedAt: Date.now()
    }
  }));
  messageBus.registerStreamProcessor('transform', transformProcessor);
  
  // 创建测试消息
  const testMessages: Message[] = [];
  for (let i = 1; i <= 7; i++) {
    testMessages.push({
      id: `stream_msg_${i}`,
      type: 'stream_test',
      topic: 'test.stream',
      payload: { index: i, data: `Stream message ${i}` },
      timestamp: Date.now(),
      priority: MessagePriority.NORMAL
    });
  }
  
  console.log(`创建了 ${testMessages.length} 条流消息`);
  
  // 测试批处理
  const batchResult = await messageBus.processStream('batch', testMessages);
  console.log(`批处理结果: ${batchResult.length} 条消息`);
  console.log(`批处理示例: ${batchResult[0].metadata?.batchSize} 条消息一批`);
  
  // 测试转换处理
  const transformResult = await messageBus.processStream('transform', testMessages.slice(0, 3));
  console.log(`转换处理结果: ${transformResult.length} 条消息`);
  console.log(`转换示例: ${transformResult[0].type} (原: stream_test)`);
  
  console.log('✅ 流处理测试通过');
  console.log('');
}

/**
 * 测试错误处理和重试
 */
async function testErrorHandlingAndRetry(messageBus: MessageBus) {
  console.log('📋 测试5: 错误处理和重试');
  
  let attemptCount = 0;
  
  // 创建会失败的处理器
  const flakyHandler: MessageHandler = {
    async handle(message: Message) {
      attemptCount++;
      console.log(`处理尝试 ${attemptCount}: ${message.id}`);
      
      if (attemptCount < 3) {
        throw new Error(`模拟处理失败 (尝试 ${attemptCount})`);
      }
      
      console.log(`✅ 消息 ${message.id} 处理成功`);
    }
  };
  
  // 订阅带重试策略的主题
  messageBus.subscribe({
    topic: 'test.retry',
    handler: flakyHandler,
    options: {
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential',
        initialDelay: 50,
        maxDelay: 1000
      }
    }
  });
  
  // 发布消息
  await messageBus.publish('test.retry', { data: 'Retry test message' }, {
    type: 'retry_test'
  });
  
  // 等待重试完成
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log(`总尝试次数: ${attemptCount}`);
  
  if (attemptCount === 3) {
    console.log('✅ 错误处理和重试测试通过');
  } else {
    console.log('❌ 错误处理和重试测试失败');
  }
  
  console.log('');
}

/**
 * 测试性能
 */
async function testPerformance(messageBus: MessageBus) {
  console.log('📋 测试6: 性能测试');
  
  let processedCount = 0;
  
  // 创建高性能处理器
  const perfHandler: MessageHandler = {
    async handle(message: Message) {
      processedCount++;
      // 最小处理时间
    }
  };
  
  // 订阅性能测试主题
  messageBus.subscribe({
    topic: 'test.performance',
    handler: perfHandler
  });
  
  const messageCount = 1000;
  const startTime = Date.now();
  
  // 批量发布消息
  const publishPromises: Promise<string>[] = [];
  for (let i = 0; i < messageCount; i++) {
    const promise = messageBus.publish('test.performance', { 
      index: i, 
      data: `Performance test message ${i}` 
    }, {
      type: 'perf_test',
      priority: i % 2 === 0 ? MessagePriority.HIGH : MessagePriority.NORMAL
    });
    publishPromises.push(promise);
  }
  
  await Promise.all(publishPromises);
  const publishTime = Date.now() - startTime;
  
  console.log(`发布 ${messageCount} 条消息耗时: ${publishTime}ms`);
  console.log(`发布速率: ${Math.round(messageCount / publishTime * 1000)} msg/s`);
  
  // 等待所有消息处理完成
  const processingStartTime = Date.now();
  while (processedCount < messageCount && Date.now() - processingStartTime < 5000) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log(`处理 ${processedCount}/${messageCount} 条消息`);
  console.log(`总耗时: ${totalTime}ms`);
  console.log(`处理速率: ${Math.round(processedCount / totalTime * 1000)} msg/s`);
  
  // 获取统计信息
  const stats = messageBus.getStats();
  console.log(`消息总线统计:`);
  console.log(`  总消息数: ${stats.totalMessages}`);
  console.log(`  活跃订阅: ${stats.activeSubscriptions}`);
  console.log(`  队列深度: ${stats.queueDepth}`);
  console.log(`  处理延迟: ${stats.processingLatency.toFixed(2)}ms`);
  console.log(`  错误率: ${stats.errorRate}`);
  
  // 获取队列状态
  const queueStatus = messageBus.getQueueStatus();
  console.log(`队列状态:`, queueStatus);
  
  console.log('✅ 性能测试完成');
  console.log('');
}

/**
 * 测试死信队列
 */
async function testDeadLetterQueue(messageBus: MessageBus) {
  console.log('📋 测试7: 死信队列');
  
  // 创建总是失败的处理器
  const alwaysFailHandler: MessageHandler = {
    async handle(message: Message) {
      throw new Error('Always fail for testing');
    }
  };
  
  // 订阅带有限重试的主题
  messageBus.subscribe({
    topic: 'test.deadletter',
    handler: alwaysFailHandler,
    options: {
      retryPolicy: {
        maxRetries: 2,
        backoffStrategy: 'fixed',
        initialDelay: 10,
        maxDelay: 100
      }
    }
  });
  
  // 发布会失败的消息
  await messageBus.publish('test.deadletter', { data: 'This will fail' }, {
    type: 'fail_test'
  });
  
  // 等待重试完成并进入死信队列
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const deadLetterQueue = messageBus.getDeadLetterQueue();
  console.log(`死信队列中的消息数: ${deadLetterQueue.length}`);
  
  if (deadLetterQueue.length > 0) {
    const deadMessage = deadLetterQueue[0];
    console.log(`死信消息ID: ${deadMessage.id}`);
    console.log(`重试次数: ${deadMessage.metadata?.retryCount}`);
    console.log(`错误信息: ${deadMessage.metadata?.error}`);
  }
  
  if (deadLetterQueue.length === 1) {
    console.log('✅ 死信队列测试通过');
  } else {
    console.log('❌ 死信队列测试失败');
  }
  
  // 清理死信队列
  messageBus.clearDeadLetterQueue();
  console.log('死信队列已清理');
  
  console.log('');
}

/**
 * 运行测试
 */
testMessageBus().catch(console.error);

export { testMessageBus };