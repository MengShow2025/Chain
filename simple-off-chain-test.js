// 简化的链下撮合引擎测试
console.log('开始简化测试...');

async function simpleTest() {
  try {
    console.log('1. 导入模块...');
    
    // 测试基本导入
    const { MessageBus } = await import('./blockchain/messaging/message-bus.ts');
    console.log('✓ MessageBus 导入成功');
    
    const { MatchingEngine } = await import('./blockchain/matching/matching-engine.ts');
    console.log('✓ MatchingEngine 导入成功');
    
    const { EnhancedMicroBatchProcessor } = await import('./blockchain/core/enhanced-micro-batch-processor.ts');
    console.log('✓ EnhancedMicroBatchProcessor 导入成功');
    
    // 测试新创建的模块
    const { OffChainMatcher } = await import('./blockchain/matching/off-chain-matcher.ts');
    console.log('✓ OffChainMatcher 导入成功');
    
    const { BatchCommitGenerator } = await import('./blockchain/matching/batch-commit-generator.ts');
    console.log('✓ BatchCommitGenerator 导入成功');
    
    console.log('2. 创建基本实例...');
    
    // 创建消息总线
    const messageBus = new MessageBus({
      maxQueueSize: 1000,
      processingIntervalMs: 100,
      enablePersistence: false,
      enableCompression: false,
      retryAttempts: 3,
      retryDelayMs: 1000
    });
    console.log('✓ MessageBus 实例创建成功');
    
    // 创建链下撮合器
    const offChainMatcher = new OffChainMatcher({
      batchWindowMs: 100,
      maxBatchSize: 100,
      maxMemoryMB: 256,
      maxOrdersPerBatch: 50,
      maxMatchesPerBatch: 25,
      enableParallelProcessing: false,
      workerThreads: 1,
      enablePersistence: false,
      enableCaching: false
    }, messageBus);
    console.log('✓ OffChainMatcher 实例创建成功');
    
    // 创建BatchCommit生成器
    const batchCommitGenerator = new BatchCommitGenerator({
      producerId: 'test-producer',
      recipeVersion: 1,
      enableCompression: false,
      enableEncryption: false,
      signatureRequired: false
    });
    console.log('✓ BatchCommitGenerator 实例创建成功');
    
    console.log('3. 测试基本功能...');
    
    // MessageBus在构造函数中自动启动，无需手动启动
    console.log('✓ MessageBus 已自动启动');
    
    // 启动链下撮合器
    await offChainMatcher.start();
    console.log('✓ OffChainMatcher 启动成功');
    
    // 获取初始统计信息
    const initialStats = offChainMatcher.getStats();
    console.log('✓ 获取统计信息成功:', initialStats);
    
    console.log('4. 清理资源...');
    
    // 停止服务
    await offChainMatcher.stop();
    console.log('✓ OffChainMatcher 停止成功');
    
    // MessageBus使用cleanup方法而不是stop方法
    await messageBus.cleanup();
    console.log('✓ MessageBus 清理成功');
    
    batchCommitGenerator.cleanup();
    console.log('✓ BatchCommitGenerator 清理成功');
    
    console.log('\n=== 简化测试完成 ===');
    console.log('✓ 所有基本功能正常工作');
    
  } catch (error) {
    console.error('测试失败:', error);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

// 运行测试
simpleTest();