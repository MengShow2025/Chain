// 简化的CAS客户端测试
import { casClient, simpleCasClient } from './shared/da/cas-client.ts';

async function testCAS() {
  console.log('🚀 开始CAS客户端测试...');

  try {
    // 测试基础存储和检索
    console.log('📝 测试基础操作...');
    
    const testData = new TextEncoder().encode('Hello, CAS World!');
    const metadata = {
      size: testData.length,
      mimeType: 'text/plain',
      tags: ['test']
    };

    // 存储数据
    const cid = await casClient.store(testData, metadata);
    console.log(`   存储成功，CID: ${cid.toString()}`);

    // 检查存在性
    const exists = await casClient.exists(cid);
    console.log(`   存在性检查: ${exists}`);

    // 检索数据（在同一个会话中）
    const retrieved = await casClient.retrieve(cid);
    console.log(`   检索成功，大小: ${retrieved.length} bytes`);

    // 验证数据
    const originalText = new TextDecoder().decode(testData);
    const retrievedText = new TextDecoder().decode(retrieved);
    console.log(`   原始数据: ${originalText}`);
    console.log(`   检索数据: ${retrievedText}`);

    if (originalText === retrievedText) {
      console.log('   ✅ 数据完整性验证通过');
    } else {
      throw new Error('数据完整性验证失败');
    }

    // 测试向后兼容性
    console.log('🔄 测试向后兼容性...');
    
    const batchData = {
      orders: [{ id: 1, symbol: 'BTC/USDT', amount: 100 }],
      matches: [{ orderId: 1, price: 50000, amount: 100 }]
    };

    const batchCid = 'test-batch-' + Date.now();
    await simpleCasClient.put(batchCid, batchData);
    console.log('   简单客户端存储成功');

    const retrievedBatch = await simpleCasClient.get(batchCid);
    console.log('   简单客户端检索成功');

    if (retrievedBatch && retrievedBatch.orders.length === 1) {
      console.log('   ✅ 向后兼容性测试通过');
    } else {
      throw new Error('向后兼容性测试失败');
    }

    // 获取统计信息
    console.log('📊 获取统计信息...');
    const stats = await casClient.getStats();
    console.log(`   总项目数: ${stats.totalItems}`);
    console.log(`   总大小: ${stats.totalSize} bytes`);
    console.log(`   缓存命中率: ${(stats.cacheHitRate * 100).toFixed(2)}%`);

    console.log('🎉 所有测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  }
}

// 运行测试
testCAS().then(() => {
  console.log('✅ CAS客户端测试完成');
  process.exit(0);
}).catch((error) => {
  console.error('💥 测试失败:', error);
  process.exit(1);
});