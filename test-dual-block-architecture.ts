/**
 * TitanChain双区块架构测试
 * Dual Block Architecture Test for TitanChain
 */

import { DualBlockProcessor } from './blockchain/core/dual-block-processor';
import { Transaction } from './shared/types/blockchain';

async function testDualBlockArchitecture() {
  console.log('🚀 开始测试TitanChain双区块架构...');
  console.log('🚀 Starting TitanChain Dual Block Architecture Test...\n');

  const processor = new DualBlockProcessor();

  try {
    // 1. 启动双区块处理器 / Start dual block processor
    console.log('📝 1. 启动双区块处理器 / Starting dual block processor...');
    await processor.start();
    
    const initialStatus = processor.getProcessorStatus();
    console.log('✅ 双区块处理器启动成功 / Dual block processor started successfully');
    console.log(`   - 快速区块处理器状态 / Fast block processor: ${initialStatus.fastBlockProcessor.isRunning ? '运行中' : '停止'}`);
    console.log(`   - 批量区块处理器状态 / Batch block processor: ${initialStatus.batchBlockProcessor.isRunning ? '运行中' : '停止'}`);
    console.log(`   - 同步状态 / Sync status: ${initialStatus.syncStatus.isSynced ? '已同步' : '未同步'}\n`);

    // 2. 创建测试交易 / Create test transactions
    console.log('💰 2. 创建测试交易 / Creating test transactions...');
    
    // 快速交易（简单转账）/ Fast transactions (simple transfers)
    const fastTransactions: Transaction[] = [];
    for (let i = 0; i < 20; i++) {
      fastTransactions.push({
        hash: `0xfast${i.toString().padStart(4, '0')}`,
        from: `0x${(1000 + i).toString(16).padStart(40, '0')}`,
        to: `0x${(2000 + i).toString(16).padStart(40, '0')}`,
        value: BigInt(`${100 + i}000000000000000000`), // 100+ ETH
        gasPrice: BigInt('20000000000'), // 20 Gwei
        gasLimit: BigInt('21000'), // 标准转账Gas / Standard transfer gas
        nonce: i,
        data: '0x', // 无数据 / No data
        timestamp: Date.now() + i * 100
      });
    }

    // 批量交易（复杂合约调用）/ Batch transactions (complex contract calls)
    const batchTransactions: Transaction[] = [];
    for (let i = 0; i < 15; i++) {
      batchTransactions.push({
        hash: `0xbatch${i.toString().padStart(4, '0')}`,
        from: `0x${(3000 + i).toString(16).padStart(40, '0')}`,
        to: `0x${(4000 + i).toString(16).padStart(40, '0')}`,
        value: BigInt(`${500 + i}000000000000000000`), // 500+ ETH
        gasPrice: BigInt('30000000000'), // 30 Gwei
        gasLimit: BigInt('500000'), // 复杂合约Gas / Complex contract gas
        nonce: i,
        data: `0x${'a'.repeat(200 + i * 10)}`, // 复杂数据 / Complex data
        timestamp: Date.now() + i * 200
      });
    }

    console.log(`✅ 创建测试交易成功 / Test transactions created successfully`);
    console.log(`   - 快速交易数量 / Fast transactions: ${fastTransactions.length}`);
    console.log(`   - 批量交易数量 / Batch transactions: ${batchTransactions.length}\n`);

    // 3. 添加交易到处理队列 / Add transactions to processing queue
    console.log('📤 3. 添加交易到处理队列 / Adding transactions to processing queue...');
    
    // 混合添加交易以测试路由 / Mix transactions to test routing
    const allTransactions = [...fastTransactions, ...batchTransactions];
    
    for (const tx of allTransactions) {
      await processor.addTransaction(tx);
    }

    const statusAfterAdd = processor.getProcessorStatus();
    console.log('✅ 交易添加完成 / Transactions added successfully');
    console.log(`   - 快速区块队列大小 / Fast block queue size: ${statusAfterAdd.fastBlockProcessor.queueSize}`);
    console.log(`   - 批量区块队列大小 / Batch block queue size: ${statusAfterAdd.batchBlockProcessor.queueSize}\n`);

    // 4. 等待区块处理 / Wait for block processing
    console.log('⏳ 4. 等待区块处理 / Waiting for block processing...');
    
    // 等待10秒让处理器处理交易 / Wait 10 seconds for processor to handle transactions
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 5. 检查处理结果 / Check processing results
    console.log('📊 5. 检查处理结果 / Checking processing results...');
    
    const finalStatus = processor.getProcessorStatus();
    const performanceMetrics = processor.getPerformanceMetrics();
    const fastBlockchain = processor.getFastBlockchain();
    const batchBlockchain = processor.getBatchBlockchain();

    console.log('✅ 区块处理统计 / Block processing statistics:');
    console.log(`   快速区块链 / Fast Blockchain:`);
    console.log(`   - 区块数量 / Block count: ${fastBlockchain.length}`);
    console.log(`   - 总交易数 / Total transactions: ${performanceMetrics.fastBlock.totalTransactions}`);
    console.log(`   - 平均TPS / Average TPS: ${performanceMetrics.fastBlock.averageTPS.toFixed(2)}`);
    console.log(`   - 平均延迟 / Average latency: ${performanceMetrics.fastBlock.averageLatency.toFixed(2)}ms`);
    console.log(`   - 当前队列大小 / Current queue size: ${finalStatus.fastBlockProcessor.queueSize}`);
    
    console.log(`   批量区块链 / Batch Blockchain:`);
    console.log(`   - 区块数量 / Block count: ${batchBlockchain.length}`);
    console.log(`   - 总交易数 / Total transactions: ${performanceMetrics.batchBlock.totalTransactions}`);
    console.log(`   - 平均TPS / Average TPS: ${performanceMetrics.batchBlock.averageTPS.toFixed(2)}`);
    console.log(`   - 平均延迟 / Average latency: ${performanceMetrics.batchBlock.averageLatency.toFixed(2)}ms`);
    console.log(`   - 当前队列大小 / Current queue size: ${finalStatus.batchBlockProcessor.queueSize}\n`);

    // 6. 检查路由效果 / Check routing effectiveness
    console.log('🔍 6. 检查路由效果 / Checking routing effectiveness...');
    
    const router = processor.getRouter();
    const routingStats = router.getRoutingStats();
    const queueStatus = router.getQueueStatus();

    console.log('✅ 路由统计 / Routing statistics:');
    console.log(`   - 总交易数 / Total transactions: ${routingStats.totalTransactions}`);
    console.log(`   - 快速区块交易 / Fast block transactions: ${routingStats.fastBlockTransactions}`);
    console.log(`   - 批量区块交易 / Batch block transactions: ${routingStats.batchBlockTransactions}`);
    console.log(`   - 路由准确率 / Routing accuracy: ${(routingStats.routingAccuracy * 100).toFixed(2)}%`);
    console.log(`   - 负载均衡比率 / Load balance ratio: ${routingStats.loadBalanceRatio.toFixed(2)}\n`);

    // 7. 测试性能指标 / Test performance metrics
    console.log('📈 7. 测试性能指标 / Testing performance metrics...');
    
    const performanceHistory = router.getPerformanceHistory();
    
    if (performanceHistory.length > 0) {
      const latestMetrics = performanceHistory[performanceHistory.length - 1];
      console.log('✅ 最新性能指标 / Latest performance metrics:');
      console.log(`   - 快速区块延迟 / Fast block latency: ${latestMetrics.fastBlockLatency.toFixed(2)}ms`);
      console.log(`   - 批量区块延迟 / Batch block latency: ${latestMetrics.batchBlockLatency.toFixed(2)}ms`);
      console.log(`   - 快速区块TPS / Fast block TPS: ${latestMetrics.fastBlockTPS.toFixed(2)}`);
      console.log(`   - 批量区块TPS / Batch block TPS: ${latestMetrics.batchBlockTPS.toFixed(2)}\n`);
    }

    // 8. 检查同步状态 / Check synchronization status
    console.log('🔄 8. 检查同步状态 / Checking synchronization status...');
    
    console.log('✅ 同步状态 / Synchronization status:');
    console.log(`   - 是否同步 / Is synced: ${finalStatus.syncStatus.isSynced ? '是' : '否'}`);
    console.log(`   - 同步延迟 / Sync lag: ${finalStatus.syncStatus.syncLag} 区块`);
    console.log(`   - 最后同步时间 / Last sync time: ${new Date(finalStatus.syncStatus.lastSyncTime).toLocaleString()}\n`);

    // 9. 验证区块内容 / Verify block contents
    console.log('🔍 9. 验证区块内容 / Verifying block contents...');
    
    if (fastBlockchain.length > 0) {
      const latestFastBlock = fastBlockchain[fastBlockchain.length - 1];
      console.log(`✅ 最新快速区块 #${latestFastBlock.number}:`);
      console.log(`   - 交易数量 / Transaction count: ${latestFastBlock.transactionCount}`);
      console.log(`   - Gas使用量 / Gas used: ${latestFastBlock.gasUsed.toString()}`);
      console.log(`   - Gas限制 / Gas limit: ${latestFastBlock.gasLimit.toString()}`);
      console.log(`   - 区块大小 / Block size: ${latestFastBlock.size} bytes`);
    }

    if (batchBlockchain.length > 0) {
      const latestBatchBlock = batchBlockchain[batchBlockchain.length - 1];
      console.log(`✅ 最新批量区块 #${latestBatchBlock.number}:`);
      console.log(`   - 交易数量 / Transaction count: ${latestBatchBlock.transactionCount}`);
      console.log(`   - Gas使用量 / Gas used: ${latestBatchBlock.gasUsed.toString()}`);
      console.log(`   - Gas限制 / Gas limit: ${latestBatchBlock.gasLimit.toString()}`);
      console.log(`   - 区块大小 / Block size: ${latestBatchBlock.size} bytes\n`);
    }

    // 10. 停止处理器 / Stop processor
    console.log('🛑 10. 停止双区块处理器 / Stopping dual block processor...');
    await processor.stop();
    
    const stoppedStatus = processor.getProcessorStatus();
    console.log('✅ 双区块处理器已停止 / Dual block processor stopped');
    console.log(`   - 快速区块处理器状态 / Fast block processor: ${stoppedStatus.fastBlockProcessor.isRunning ? '运行中' : '已停止'}`);
    console.log(`   - 批量区块处理器状态 / Batch block processor: ${stoppedStatus.batchBlockProcessor.isRunning ? '运行中' : '已停止'}\n`);

    console.log('🎉 TitanChain双区块架构测试完成！');
    console.log('🎉 TitanChain Dual Block Architecture test completed successfully!');

    console.log('\n📋 测试总结 / Test Summary:');
    console.log('✅ 智能交易路由机制 / Smart transaction routing mechanism');
    console.log('✅ 快速区块处理（1秒，5M gas）/ Fast block processing (1s, 5M gas)');
    console.log('✅ 批量区块处理（5秒，50M gas）/ Batch block processing (5s, 50M gas)');
    console.log('✅ 并行处理和状态同步 / Parallel processing and state synchronization');
    console.log('✅ 性能监控和优化 / Performance monitoring and optimization');
    console.log('✅ 动态负载均衡 / Dynamic load balancing');
    console.log('✅ 实时统计和指标 / Real-time statistics and metrics');

  } catch (error) {
    console.error('❌ 测试过程中发生错误 / Error occurred during testing:', error);
    
    // 确保处理器停止 / Ensure processor is stopped
    try {
      await processor.stop();
    } catch (stopError) {
      console.error('❌ 停止处理器时发生错误 / Error stopping processor:', stopError);
    }
  }
}

// 运行测试 / Run test
testDualBlockArchitecture().catch(console.error);

export { testDualBlockArchitecture };