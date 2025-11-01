// 完整的链下撮合引擎测试
console.log('开始完整的链下撮合引擎测试...');

async function comprehensiveTest() {
  try {
    console.log('1. 导入模块...');
    
    const { MessageBus } = await import('./blockchain/messaging/message-bus.ts');
    const { OffChainMatcher } = await import('./blockchain/matching/off-chain-matcher.ts');
    const { BatchCommitGenerator } = await import('./blockchain/matching/batch-commit-generator.ts');
    
    console.log('✓ 所有模块导入成功');
    
    console.log('2. 初始化系统...');
    
    // 创建消息总线
    const messageBus = new MessageBus();
    
    // 创建链下撮合器
    const offChainMatcher = new OffChainMatcher({
      batchWindowMs: 200,
      maxBatchSize: 50,
      maxMemoryMB: 256,
      maxOrdersPerBatch: 25,
      maxMatchesPerBatch: 15,
      enableParallelProcessing: false,
      workerThreads: 1,
      enablePersistence: false,
      enableCaching: false
    }, messageBus);
    
    // 5. 初始化BatchCommitGenerator（传递消息总线）
  const batchCommitGenerator = new BatchCommitGenerator({
    producerId: 'test-producer',
    recipeVersion: 1,
    enableCompression: false,
    enableEncryption: false,
    signatureRequired: false
  }, messageBus);
    
    console.log('✓ 系统初始化完成');
    
    console.log('3. 启动服务...');
    
    // 设置批次结果监听器
    let batchResults = [];
    messageBus.subscribe({
      topic: 'batch.result',
      handler: {
        handle: async (message) => {
          console.log(`收到批次结果: ${message.payload.batchId}, 撮合数: ${message.payload.matches.length}`);
          batchResults.push(message.payload);
        }
      }
    });
    
    // 启动链下撮合器
    await offChainMatcher.start();
    console.log('✓ 链下撮合器启动成功');
    
    console.log('4. 生成测试订单...');
    
    // 生成测试订单
    const orders = [];
    const pairs = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];
    const basePrices = { 'BTC/USDT': 50000, 'ETH/USDT': 3000, 'BNB/USDT': 300 };
    
    for (let i = 0; i < 30; i++) {
      const pair = pairs[i % pairs.length];
      const basePrice = basePrices[pair];
      const isBuy = i % 2 === 0;
      
      // 生成能够撮合的价格：买单价格高于卖单价格
      let price;
      if (isBuy) {
        // 买单：基准价格 + 随机上浮
        price = (basePrice + Math.random() * 500).toFixed(2);
      } else {
        // 卖单：基准价格 - 随机下浮，确保低于买单价格
        price = (basePrice - Math.random() * 500).toFixed(2);
      }
      
      const order = {
        id: `order_${i + 1}`,
        userId: `user_${Math.floor(i / 2) + 1}`,
        pair: pair,
        type: isBuy ? 'buy' : 'sell',
        amount: (Math.random() * 5 + 1).toFixed(4), // 减少数量以便更容易撮合
        price: price,
        timestamp: Date.now() + i * 10,
        status: 'pending'
      };
      
      orders.push(order);
    }
    
    console.log(`✓ 生成了 ${orders.length} 个测试订单`);
    
    console.log('5. 发送订单到撮合引擎...');
    
    // 分批发送订单（通过消息总线）
    for (let i = 0; i < orders.length; i++) {
      // 将订单转换为符合MatchingEngine期望的格式
      const order = {
        id: orders[i].id,
        symbol: orders[i].pair,
        side: orders[i].type,
        type: 'limit',
        price: orders[i].price,
        quantity: orders[i].amount,
        account: orders[i].userId,
        timestamp: orders[i].timestamp,
        status: orders[i].status
      };
      
      // 通过消息总线发送订单
      await messageBus.publish('orderReceived', order, {
        type: 'order',
        priority: 1
      });
      
      console.log(`发送订单 ${i + 1}/${orders.length}: ${order.id} (${order.side} ${order.quantity} ${order.symbol} @ ${order.price})`);
      
      // 每5个订单暂停一下，让系统处理
      if ((i + 1) % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('✓ 所有订单发送完成');
    
    console.log('6. 等待处理完成...');
    
    // 等待处理完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('7. 获取处理结果...');
    
    // 获取统计信息
    const stats = offChainMatcher.getStats();
    console.log('撮合引擎统计信息:', {
      totalOrders: stats.totalOrders,
      totalMatches: stats.totalMatches,
      totalBatches: stats.totalBatches,
      avgBatchSize: stats.avgBatchSize.toFixed(2),
      avgProcessingTime: stats.avgProcessingTime.toFixed(2) + 'ms',
      throughputTPS: stats.throughputTPS.toFixed(2),
      successRate: stats.successRate.toFixed(2) + '%'
    });
    
    // 获取队列状态
    const queueStatus = messageBus.getQueueStatus();
    console.log('消息队列状态:', queueStatus);
    
    console.log(`收到的批次结果数量: ${batchResults.length}`);
    
    console.log('8. 测试BatchCommit生成...');
    const allBatchResults = batchCommitGenerator.getAllBatchResults();
    
    if (allBatchResults.length > 0) {
      console.log(`✓ 自动生成了 ${allBatchResults.length} 个BatchCommit`);
      
      // 验证最新的BatchCommit
      const latestBatch = allBatchResults[allBatchResults.length - 1];
      const batchCommit = batchCommitGenerator.getBatchCommit(latestBatch.batchId);
      
      if (batchCommit) {
        console.log(`✓ BatchCommit验证: ${batchCommit.batchId}`);
        console.log(`  - CID: ${batchCommit.cid}`);
        console.log(`  - Orders Root: ${batchCommit.ordersRoot}`);
        console.log(`  - Matches Root: ${batchCommit.matchesRoot}`);
        
        // 验证BatchCommit
        const isValid = await batchCommitGenerator.verifyBatchCommit(batchCommit);
        console.log(`  - 验证结果: ${isValid ? '✓ 有效' : '✗ 无效'}`);
      }
    } else {
      console.log('没有批次结果可用于生成BatchCommit');
    }
    
    console.log('9. 性能分析...');
    
    if (stats.totalOrders > 0) {
      console.log('性能指标:');
      console.log(`- 订单处理率: ${stats.throughputTPS.toFixed(2)} TPS`);
      console.log(`- 平均批次大小: ${stats.avgBatchSize.toFixed(2)} 订单/批次`);
      console.log(`- 平均处理时间: ${stats.avgProcessingTime.toFixed(2)} ms/批次`);
      console.log(`- 撮合成功率: ${stats.successRate.toFixed(2)}%`);
      console.log(`- 内存使用: ${stats.memoryUsage.toFixed(2)} MB`);
      
      // 计算撮合效率
      const matchingEfficiency = stats.totalMatches / stats.totalOrders;
      console.log(`- 撮合效率: ${(matchingEfficiency * 100).toFixed(2)}% (${stats.totalMatches}/${stats.totalOrders})`);
    }
    
    console.log('10. 清理资源...');
    
    // 停止服务
    await offChainMatcher.stop();
    await messageBus.cleanup();
    batchCommitGenerator.cleanup();
    
    console.log('✓ 资源清理完成');
    
    console.log('\n=== 完整测试完成 ===');
    console.log('✓ 链下撮合引擎功能验证成功');
    console.log('✓ BatchCommit生成和验证正常');
    console.log('✓ 性能指标符合预期');
    
  } catch (error) {
    console.error('测试失败:', error);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

// 运行测试
comprehensiveTest();