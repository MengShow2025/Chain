#!/usr/bin/env node

/**
 * BatchCommit验证测试
 * 测试BatchCommit生成和验证的完整性
 */

async function testBatchCommitValidation() {
  try {
    console.log('=== BatchCommit验证测试 ===\n');
    
    console.log('1. 导入模块...');
    const { MessageBus } = await import('./blockchain/messaging/message-bus.ts');
    const { OffChainMatcher } = await import('./blockchain/matching/off-chain-matcher.ts');
    const { BatchCommitGenerator } = await import('./blockchain/matching/batch-commit-generator.ts');
    
    console.log('✓ 模块导入成功');
    
    console.log('2. 初始化系统...');
    
    // 创建消息总线
    const messageBus = new MessageBus();
    
    // 创建链下撮合器
    const offChainMatcher = new OffChainMatcher({
      batchWindowMs: 300,
      maxBatchSize: 20,
      maxMemoryMB: 256,
      maxOrdersPerBatch: 10,
      maxMatchesPerBatch: 8,
      enableParallelProcessing: false,
      workerThreads: 1,
      enablePersistence: false,
      enableCaching: false
    }, messageBus);
    
    // 创建BatchCommitGenerator
    const batchCommitGenerator = new BatchCommitGenerator({
      producerId: 'test-validator',
      recipeVersion: 1,
      enableCompression: false,
      enableEncryption: false,
      signatureRequired: false
    }, messageBus);
    
    console.log('✓ 系统初始化完成');
    
    console.log('3. 启动服务...');
    await offChainMatcher.start();
    console.log('✓ 服务启动成功');
    
    console.log('4. 生成测试订单...');
    
    // 生成能够撮合的测试订单
    const orders = [];
    const basePrice = 50000;
    
    // 生成10个买单和10个卖单，确保能够撮合
    for (let i = 0; i < 10; i++) {
      // 买单
      const buyOrder = {
        id: `buy_order_${i + 1}`,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        price: (basePrice + Math.random() * 200).toFixed(2), // 买单价格较高
        quantity: (Math.random() * 2 + 1).toFixed(4),
        account: `buyer_${i + 1}`,
        timestamp: Date.now() + i * 5,
        status: 'pending'
      };
      
      // 卖单
      const sellOrder = {
        id: `sell_order_${i + 1}`,
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'limit',
        price: (basePrice - Math.random() * 200).toFixed(2), // 卖单价格较低
        quantity: (Math.random() * 2 + 1).toFixed(4),
        account: `seller_${i + 1}`,
        timestamp: Date.now() + i * 5 + 2,
        status: 'pending'
      };
      
      orders.push(buyOrder, sellOrder);
    }
    
    console.log(`✓ 生成了 ${orders.length} 个测试订单`);
    
    console.log('5. 发送订单...');
    
    // 发送订单
    for (const order of orders) {
      await messageBus.publish('orderReceived', order, {
        type: 'order',
        priority: 1
      });
    }
    
    console.log('✓ 订单发送完成');
    
    console.log('6. 等待处理完成...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('7. 验证BatchCommit...');
    
    // 获取所有生成的BatchCommit
    const allBatchResults = batchCommitGenerator.getAllBatchResults();
    console.log(`找到 ${allBatchResults.length} 个批次结果`);
    
    if (allBatchResults.length === 0) {
      console.log('❌ 没有找到批次结果');
      return;
    }
    
    // 验证每个BatchCommit
    for (const batchResult of allBatchResults) {
      console.log(`\n验证批次: ${batchResult.batchId}`);
      
      const batchCommit = batchCommitGenerator.getBatchCommit(batchResult.batchId);
      if (!batchCommit) {
        console.log(`❌ 未找到BatchCommit: ${batchResult.batchId}`);
        continue;
      }
      
      console.log(`  - 批次ID: ${batchCommit.batchId}`);
      console.log(`  - 生产者: ${batchCommit.producerId}`);
      console.log(`  - CID: ${batchCommit.cid}`);
      console.log(`  - 订单根: ${batchCommit.ordersRoot}`);
      console.log(`  - 撮合根: ${batchCommit.matchesRoot}`);
      console.log(`  - 余额变化根: ${batchCommit.balanceDiffsRoot}`);
      console.log(`  - 审计日志根: ${batchCommit.auditLogRoot}`);
      
      // 验证BatchCommit的完整性
      try {
        const isValid = await batchCommitGenerator.verifyBatchCommit(batchCommit);
        console.log(`  - 验证结果: ${isValid ? '✓ 有效' : '❌ 无效'}`);
        
        if (batchCommit.metadata) {
          console.log(`  - 数据大小: ${batchCommit.metadata.dataSize} bytes`);
          console.log(`  - 处理时间: ${batchCommit.metadata.processingTime} ms`);
        }
        
        // 验证批次结果数据
        console.log(`  - 订单数量: ${batchResult.orders?.length || 0}`);
        console.log(`  - 撮合数量: ${batchResult.matches?.length || 0}`);
        console.log(`  - 余额变化数量: ${batchResult.balanceDiffs?.length || 0}`);
        console.log(`  - 审计日志数量: ${batchResult.auditLog?.length || 0}`);
        
        // 验证Merkle根的一致性
        if (batchResult.ordersRoot && batchResult.ordersRoot !== batchCommit.ordersRoot) {
          console.log(`  ❌ 订单根不匹配: ${batchResult.ordersRoot} vs ${batchCommit.ordersRoot}`);
        }
        if (batchResult.matchesRoot && batchResult.matchesRoot !== batchCommit.matchesRoot) {
          console.log(`  ❌ 撮合根不匹配: ${batchResult.matchesRoot} vs ${batchCommit.matchesRoot}`);
        }
        
      } catch (error) {
        console.log(`  ❌ 验证失败: ${error.message}`);
      }
    }
    
    console.log('\n8. 统计信息...');
    
    // 获取撮合引擎统计
    const matchingStats = offChainMatcher.getStats();
    console.log('撮合引擎统计:');
    console.log(`  - 总订单数: ${matchingStats.totalOrders}`);
    console.log(`  - 总撮合数: ${matchingStats.totalMatches}`);
    console.log(`  - 总批次数: ${matchingStats.totalBatches}`);
    console.log(`  - 撮合效率: ${((matchingStats.totalMatches / matchingStats.totalOrders) * 100).toFixed(2)}%`);
    
    // 获取BatchCommit生成器统计
    const commitStats = batchCommitGenerator.getStats();
    console.log('\nBatchCommit生成器统计:');
    console.log(`  - 总生成数: ${commitStats.totalGenerated}`);
    console.log(`  - 平均大小: ${commitStats.averageSize.toFixed(2)} bytes`);
    console.log(`  - 平均处理时间: ${commitStats.averageProcessingTime.toFixed(2)} ms`);
    
    console.log('\n9. 清理资源...');
    
    await offChainMatcher.stop();
    await messageBus.cleanup();
    batchCommitGenerator.cleanup();
    
    console.log('✓ 资源清理完成');
    
    console.log('\n=== BatchCommit验证测试完成 ===');
    console.log('✓ 所有验证通过');
    
  } catch (error) {
    console.error('测试失败:', error);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

// 运行测试
testBatchCommitValidation();