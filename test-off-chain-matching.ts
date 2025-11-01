import { OffChainMatcher, OffChainMatcherConfig } from './blockchain/matching/off-chain-matcher.js';
import { BatchCommitGenerator, BatchCommitConfig } from './blockchain/matching/batch-commit-generator.js';
import { MessageBus } from './blockchain/messaging/message-bus.js';
import { Order } from './blockchain/matching/matching-engine.js';

/**
 * 链下撮合引擎测试
 */
async function testOffChainMatching() {
  console.log('=== 开始链下撮合引擎测试 ===\n');

  try {
    // 1. 初始化消息总线
    console.log('1. 初始化消息总线...');
    const messageBus = new MessageBus({
      maxQueueSize: 10000,
      processingIntervalMs: 10,
      enablePersistence: false,
      enableCompression: false,
      retryAttempts: 3,
      retryDelayMs: 1000
    });
    await messageBus.start();
    console.log('✓ 消息总线初始化完成\n');

    // 2. 初始化链下撮合引擎
    console.log('2. 初始化链下撮合引擎...');
    const matcherConfig: OffChainMatcherConfig = {
      batchWindowMs: 100,
      maxBatchSize: 1000,
      maxMemoryMB: 512,
      maxOrdersPerBatch: 500,
      maxMatchesPerBatch: 250,
      enableParallelProcessing: true,
      workerThreads: 4,
      enablePersistence: true,
      enableCaching: true
    };

    const offChainMatcher = new OffChainMatcher(matcherConfig, messageBus);
    console.log('✓ 链下撮合引擎初始化完成\n');

    // 3. 初始化BatchCommit生成器
    console.log('3. 初始化BatchCommit生成器...');
    const commitConfig: BatchCommitConfig = {
      producerId: 'test-matcher-1',
      recipeVersion: 1,
      enableCompression: false,
      enableEncryption: false,
      signatureRequired: false
    };

    const batchCommitGenerator = new BatchCommitGenerator(commitConfig);
    console.log('✓ BatchCommit生成器初始化完成\n');

    // 4. 设置事件监听器
    console.log('4. 设置事件监听器...');
    let batchCount = 0;
    let totalMatches = 0;

    offChainMatcher.on('batchCompleted', (result) => {
      batchCount++;
      totalMatches += result.matches.length;
      console.log(`✓ 批次完成: ${result.batchId}, 撮合数: ${result.matches.length}, 处理时间: ${result.processingTime}ms`);
    });

    offChainMatcher.on('batchFailed', (result) => {
      console.error(`✗ 批次失败: ${result.batchId}, 错误: ${result.error}`);
    });

    offChainMatcher.on('statsUpdated', (stats) => {
      console.log(`📊 统计更新: TPS=${stats.throughputTPS.toFixed(2)}, 成功率=${stats.successRate.toFixed(1)}%, 内存=${stats.memoryUsage}MB`);
    });
    console.log('✓ 事件监听器设置完成\n');

    // 5. 启动链下撮合引擎
    console.log('5. 启动链下撮合引擎...');
    await offChainMatcher.start();
    console.log('✓ 链下撮合引擎启动完成\n');

    // 6. 生成测试订单
    console.log('6. 生成测试订单...');
    const testOrders = generateTestOrders(50);
    console.log(`✓ 生成了 ${testOrders.length} 个测试订单\n`);

    // 7. 发送订单到消息总线
    console.log('7. 发送订单到消息总线...');
    for (const order of testOrders) {
      await messageBus.publish('orderReceived', order, 'high');
      await new Promise(resolve => setTimeout(resolve, 5)); // 5ms间隔
    }
    console.log('✓ 所有订单已发送\n');

    // 8. 等待处理完成
    console.log('8. 等待处理完成...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒

    // 9. 获取统计信息
    console.log('9. 获取统计信息...');
    const stats = offChainMatcher.getStats();
    const queueStatus = offChainMatcher.getQueueStatus();
    const recentBatches = offChainMatcher.getRecentBatches(5);

    console.log('\n=== 最终统计信息 ===');
    console.log(`总订单数: ${stats.totalOrders}`);
    console.log(`总撮合数: ${stats.totalMatches}`);
    console.log(`总批次数: ${stats.totalBatches}`);
    console.log(`平均批次大小: ${stats.avgBatchSize.toFixed(2)}`);
    console.log(`平均处理时间: ${stats.avgProcessingTime.toFixed(2)}ms`);
    console.log(`吞吐量: ${stats.throughputTPS.toFixed(2)} TPS`);
    console.log(`成功率: ${stats.successRate.toFixed(1)}%`);
    console.log(`内存使用: ${stats.memoryUsage}MB`);

    console.log('\n=== 队列状态 ===');
    console.log(`待处理: ${queueStatus.pending}`);
    console.log(`处理中: ${queueStatus.processing}`);
    console.log(`已完成: ${queueStatus.completed}`);

    console.log('\n=== 最近批次 ===');
    recentBatches.forEach((batch, index) => {
      console.log(`批次 ${index + 1}: ${batch.batchId}, 撮合数: ${batch.matches.length}, CID: ${batch.cid}`);
    });

    // 10. 测试BatchCommit生成
    console.log('\n10. 测试BatchCommit生成...');
    if (recentBatches.length > 0) {
      const testBatch = recentBatches[0];
      const batchCommit = await batchCommitGenerator.generateBatchCommit(
        testBatch,
        testOrders.slice(0, 10), // 使用前10个订单作为测试
        testBatch.matches,
        testBatch.balanceDiffs
      );

      console.log(`✓ BatchCommit生成成功:`);
      console.log(`  批次ID: ${batchCommit.batchId}`);
      console.log(`  生产者ID: ${batchCommit.producerId}`);
      console.log(`  CID: ${batchCommit.cid}`);
      console.log(`  订单根: ${batchCommit.ordersRoot}`);
      console.log(`  撮合根: ${batchCommit.matchesRoot}`);
      console.log(`  余额变化根: ${batchCommit.balanceDiffsRoot}`);

      // 验证BatchCommit
      const isValid = await batchCommitGenerator.verifyBatchCommit(batchCommit);
      console.log(`  验证结果: ${isValid ? '✓ 有效' : '✗ 无效'}`);
    }

    // 11. 获取BatchCommit生成器统计
    console.log('\n11. BatchCommit生成器统计...');
    const commitStats = batchCommitGenerator.getStats();
    console.log(`总生成数: ${commitStats.totalGenerated}`);
    console.log(`平均大小: ${commitStats.averageSize.toFixed(2)} bytes`);
    console.log(`平均处理时间: ${commitStats.averageProcessingTime.toFixed(2)}ms`);

    // 12. 清理资源
    console.log('\n12. 清理资源...');
    await offChainMatcher.cleanup();
    await messageBus.stop();
    batchCommitGenerator.cleanup();
    console.log('✓ 资源清理完成\n');

    console.log('=== 链下撮合引擎测试完成 ===');
    console.log(`✓ 成功处理 ${stats.totalOrders} 个订单`);
    console.log(`✓ 生成 ${stats.totalMatches} 个撮合结果`);
    console.log(`✓ 处理 ${stats.totalBatches} 个批次`);
    console.log(`✓ 平均吞吐量: ${stats.throughputTPS.toFixed(2)} TPS`);

  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

/**
 * 生成测试订单
 */
function generateTestOrders(count: number): Order[] {
  const orders: Order[] = [];
  const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];
  const accounts = ['account1', 'account2', 'account3', 'account4', 'account5'];

  for (let i = 0; i < count; i++) {
    const symbol = symbols[i % symbols.length];
    const account = accounts[i % accounts.length];
    const side = i % 2 === 0 ? 'buy' : 'sell';
    
    // 生成合理的价格和数量
    let basePrice: number;
    if (symbol === 'BTC/USDT') {
      basePrice = 45000;
    } else if (symbol === 'ETH/USDT') {
      basePrice = 3000;
    } else {
      basePrice = 300;
    }

    const priceVariation = (Math.random() - 0.5) * 0.02; // ±1%的价格变动
    const price = basePrice * (1 + priceVariation);
    const quantity = Math.random() * 10 + 0.1; // 0.1到10.1之间的数量

    const order: Order = {
      id: `order_${i + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      symbol,
      side,
      type: 'limit',
      price: price.toFixed(2),
      quantity: quantity.toFixed(4),
      account,
      timestamp: Date.now() + i, // 确保时间戳递增
      nonce: i + 1
    };

    orders.push(order);
  }

  return orders;
}

/**
 * 运行测试
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  testOffChainMatching().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

export { testOffChainMatching };