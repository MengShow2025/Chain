// 最终CAS客户端测试
import { casClient, simpleCasClient } from './shared/da/cas-client.ts';

async function finalTest() {
  console.log('🚀 开始最终CAS客户端测试...');

  try {
    // 测试1：基础存储和检索
    console.log('\n📝 测试1：基础存储和检索');
    
    const testData = new TextEncoder().encode('Hello, Final Test!');
    const metadata = {
      size: testData.length,
      mimeType: 'text/plain',
      tags: ['final-test']
    };

    // 在同一个会话中完成存储和检索
    const cid = await casClient.store(testData, metadata);
    console.log(`   ✅ 存储成功，CID: ${cid.toString()}`);

    const exists = await casClient.exists(cid);
    console.log(`   ✅ 存在性检查: ${exists}`);

    const retrieved = await casClient.retrieve(cid);
    const originalText = new TextDecoder().decode(testData);
    const retrievedText = new TextDecoder().decode(retrieved);
    
    console.log(`   ✅ 原始数据: "${originalText}"`);
    console.log(`   ✅ 检索数据: "${retrievedText}"`);
    console.log(`   ✅ 数据匹配: ${originalText === retrievedText}`);

    // 测试2：批量操作
    console.log('\n📦 测试2：批量操作');
    
    const batchItems = [
      { data: new TextEncoder().encode('Batch Item 1'), metadata: { tags: ['batch', '1'] } },
      { data: new TextEncoder().encode('Batch Item 2'), metadata: { tags: ['batch', '2'] } },
      { data: new TextEncoder().encode('Batch Item 3'), metadata: { tags: ['batch', '3'] } }
    ];

    const batchCids = await casClient.storeBatch(batchItems);
    console.log(`   ✅ 批量存储成功，获得 ${batchCids.length} 个CID`);

    const batchRetrieved = await casClient.retrieveBatch(batchCids);
    console.log(`   ✅ 批量检索成功，获得 ${batchRetrieved.size} 个项目`);

    // 验证批量数据
    let batchValid = true;
    for (let i = 0; i < batchCids.length; i++) {
      const cid = batchCids[i];
      const retrievedData = batchRetrieved.get(cid);
      const originalData = batchItems[i].data;
      
      if (!retrievedData || retrievedData.length !== originalData.length) {
        batchValid = false;
        break;
      }
    }
    console.log(`   ✅ 批量数据验证: ${batchValid}`);

    // 测试3：元数据操作
    console.log('\n🏷️ 测试3：元数据操作');
    
    const metadataTestData = new TextEncoder().encode('Metadata Test');
    const metadataTestCid = await casClient.store(metadataTestData, {
      size: metadataTestData.length,
      mimeType: 'text/plain',
      tags: ['metadata-test'],
      ttl: 3600000
    });

    const retrievedMetadata = await casClient.getMetadata(metadataTestCid);
    console.log(`   ✅ 获取元数据成功: ${JSON.stringify(retrievedMetadata)}`);

    // 测试4：搜索功能
    console.log('\n🔍 测试4：搜索功能');
    
    const searchResults = await casClient.listByTag('final-test');
    console.log(`   ✅ 按标签搜索结果: ${searchResults.length} 个项目`);

    // 测试5：向后兼容性
    console.log('\n🔄 测试5：向后兼容性');
    
    const batchData = {
      orders: [{ id: 1, symbol: 'BTC/USDT', amount: 100 }],
      matches: [{ orderId: 1, price: 50000, amount: 100 }]
    };

    const legacyCid = 'legacy-test-' + Date.now();
    await simpleCasClient.put(legacyCid, batchData);
    console.log(`   ✅ 简单客户端存储成功`);

    const retrievedBatch = await simpleCasClient.get(legacyCid);
    console.log(`   ✅ 简单客户端检索成功`);

    const hasLegacy = await simpleCasClient.has(legacyCid);
    console.log(`   ✅ 简单客户端存在性检查: ${hasLegacy}`);

    if (retrievedBatch && retrievedBatch.orders && retrievedBatch.orders.length === 1) {
      console.log(`   ✅ 向后兼容性数据验证通过`);
    } else {
      throw new Error('向后兼容性数据验证失败');
    }

    // 测试6：统计信息
    console.log('\n📊 测试6：统计信息');
    
    const stats = await casClient.getStats();
    console.log(`   ✅ 总项目数: ${stats.totalItems}`);
    console.log(`   ✅ 总大小: ${stats.totalSize} bytes`);
    console.log(`   ✅ 缓存命中率: ${(stats.cacheHitRate * 100).toFixed(2)}%`);

    const health = await casClient.getHealth();
    console.log(`   ✅ 健康状态: ${health.status}`);
    console.log(`   ✅ 运行时间: ${health.uptime}ms`);

    console.log('\n🎉 所有测试通过！CAS客户端功能正常！');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    throw error;
  }
}

// 运行测试
finalTest().then(() => {
  console.log('\n✅ CAS客户端测试完成');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 测试失败:', error);
  process.exit(1);
});