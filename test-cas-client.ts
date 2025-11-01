import { 
  casClient, 
  EnhancedCASClient, 
  HashAlgorithm, 
  CompressionType,
  SimpleCID,
  type CASConfig,
  type ContentMetadata,
  type SearchQuery
} from './shared/da/cas-client.js';

/**
 * CAS客户端测试套件
 */
class CASClientTest {
  private testData = {
    small: new TextEncoder().encode('Hello, World!'),
    medium: new TextEncoder().encode('A'.repeat(2048)), // 2KB
    large: new TextEncoder().encode('B'.repeat(10240))  // 10KB
  };

  async runAllTests(): Promise<void> {
    console.log('🚀 开始CAS客户端测试...\n');

    try {
      await this.testBasicOperations();
      await this.testBatchOperations();
      await this.testMetadataOperations();
      await this.testSearchOperations();
      await this.testCacheOperations();
      await this.testStreamOperations();
      await this.testIntegrityVerification();
      await this.testPerformanceMetrics();
      await this.testGarbageCollection();
      await this.testBackwardCompatibility();

      console.log('✅ 所有测试通过！');
    } catch (error) {
      console.error('❌ 测试失败:', error);
      throw error;
    }
  }

  private async testBasicOperations(): Promise<void> {
    console.log('📝 测试基础存储和检索操作...');

    // 存储数据
    const metadata: ContentMetadata = {
      size: this.testData.small.length,
      mimeType: 'text/plain',
      tags: ['test', 'basic']
    };

    const cid = await casClient.store(this.testData.small, metadata);
    console.log(`   存储成功，CID: ${cid.toString()}`);

    // 检查存在性
    const exists = await casClient.exists(cid);
    console.log(`   存在性检查: ${exists}`);
    if (!exists) throw new Error('存储的内容不存在');

    // 检索数据
    const retrieved = await casClient.retrieve(cid);
    console.log(`   检索成功，大小: ${retrieved.length} bytes`);

    // 验证数据完整性
    if (retrieved.length !== this.testData.small.length) {
      throw new Error('检索的数据大小不匹配');
    }

    for (let i = 0; i < retrieved.length; i++) {
      if (retrieved[i] !== this.testData.small[i]) {
        throw new Error('检索的数据内容不匹配');
      }
    }

    console.log('   ✅ 基础操作测试通过\n');
  }

  private async testBatchOperations(): Promise<void> {
    console.log('📦 测试批量操作...');

    const batchItems = [
      { data: this.testData.small, metadata: { size: this.testData.small.length, tags: ['batch', 'small'] } },
      { data: this.testData.medium, metadata: { size: this.testData.medium.length, tags: ['batch', 'medium'] } },
      { data: this.testData.large, metadata: { size: this.testData.large.length, tags: ['batch', 'large'] } }
    ];

    // 批量存储
    const cids = await casClient.storeBatch(batchItems);
    console.log(`   批量存储成功，获得 ${cids.length} 个CID`);

    // 批量检索
    const retrievedBatch = await casClient.retrieveBatch(cids);
    console.log(`   批量检索成功，获得 ${retrievedBatch.size} 个项目`);

    // 验证批量检索结果
    if (retrievedBatch.size !== cids.length) {
      throw new Error('批量检索的项目数量不匹配');
    }

    console.log('   ✅ 批量操作测试通过\n');
  }

  private async testMetadataOperations(): Promise<void> {
    console.log('🏷️ 测试元数据操作...');

    const metadata: ContentMetadata = {
      size: this.testData.small.length,
      mimeType: 'text/plain',
      tags: ['metadata', 'test'],
      ttl: 3600000 // 1小时
    };

    const cid = await casClient.store(this.testData.small, metadata);

    // 获取元数据
    const retrievedMetadata = await casClient.getMetadata(cid);
    console.log(`   获取元数据: ${JSON.stringify(retrievedMetadata, null, 2)}`);

    // 更新元数据
    const updatedMetadata: ContentMetadata = {
      ...retrievedMetadata,
      tags: [...(retrievedMetadata.tags || []), 'updated']
    };

    await casClient.updateMetadata(cid, updatedMetadata);
    console.log('   元数据更新成功');

    // 验证更新
    const finalMetadata = await casClient.getMetadata(cid);
    if (!finalMetadata.tags?.includes('updated')) {
      throw new Error('元数据更新失败');
    }

    console.log('   ✅ 元数据操作测试通过\n');
  }

  private async testSearchOperations(): Promise<void> {
    console.log('🔍 测试搜索操作...');

    // 存储一些带标签的数据
    await casClient.store(this.testData.small, { 
      size: this.testData.small.length, 
      tags: ['search', 'test', 'small'],
      mimeType: 'text/plain'
    });

    await casClient.store(this.testData.medium, { 
      size: this.testData.medium.length, 
      tags: ['search', 'test', 'medium'],
      mimeType: 'text/plain'
    });

    // 按标签搜索
    const searchResults = await casClient.listByTag('search');
    console.log(`   按标签搜索结果: ${searchResults.length} 个项目`);

    // 复杂搜索
    const query: SearchQuery = {
      tags: ['test'],
      mimeType: 'text/plain',
      sizeRange: [0, 5000],
      limit: 10
    };

    const complexResults = await casClient.search(query);
    console.log(`   复杂搜索结果: ${complexResults.length} 个项目`);

    console.log('   ✅ 搜索操作测试通过\n');
  }

  private async testCacheOperations(): Promise<void> {
    console.log('💾 测试缓存操作...');

    const cid = await casClient.store(this.testData.small, { 
      size: this.testData.small.length, 
      tags: ['cache', 'test'] 
    });

    // Pin操作
    await casClient.pin(cid);
    console.log('   Pin操作成功');

    // 第一次检索（应该从存储获取）
    const start1 = Date.now();
    await casClient.retrieve(cid);
    const time1 = Date.now() - start1;

    // 第二次检索（应该从缓存获取）
    const start2 = Date.now();
    await casClient.retrieve(cid);
    const time2 = Date.now() - start2;

    console.log(`   第一次检索耗时: ${time1}ms`);
    console.log(`   第二次检索耗时: ${time2}ms`);

    // Unpin操作
    await casClient.unpin(cid);
    console.log('   Unpin操作成功');

    console.log('   ✅ 缓存操作测试通过\n');
  }

  private async testStreamOperations(): Promise<void> {
    console.log('🌊 测试流式操作...');

    // 创建可读流
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(this.testData.medium);
        controller.close();
      }
    });

    // 流式存储
    const cid = await casClient.storeStream(stream, {
      size: this.testData.medium.length,
      tags: ['stream', 'test']
    });
    console.log(`   流式存储成功，CID: ${cid.toString()}`);

    // 流式检索
    const retrievedStream = await casClient.retrieveStream(cid);
    const reader = retrievedStream.getReader();
    const chunks: Uint8Array[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const retrievedData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      retrievedData.set(chunk, offset);
      offset += chunk.length;
    }

    console.log(`   流式检索成功，大小: ${retrievedData.length} bytes`);

    // 验证数据
    if (retrievedData.length !== this.testData.medium.length) {
      throw new Error('流式操作数据大小不匹配');
    }

    console.log('   ✅ 流式操作测试通过\n');
  }

  private async testIntegrityVerification(): Promise<void> {
    console.log('🔒 测试完整性验证...');

    const cid = await casClient.store(this.testData.small, { 
      size: this.testData.small.length, 
      tags: ['integrity', 'test'] 
    });

    // 正常检索应该成功
    const retrieved = await casClient.retrieve(cid);
    console.log(`   正常检索成功，大小: ${retrieved.length} bytes`);

    // 测试CID解析
    const cidStr = cid.toString();
    const parsedCID = SimpleCID.parse(cidStr);
    console.log(`   CID解析成功: ${parsedCID.toString()}`);

    if (cidStr !== parsedCID.toString()) {
      throw new Error('CID解析不一致');
    }

    console.log('   ✅ 完整性验证测试通过\n');
  }

  private async testPerformanceMetrics(): Promise<void> {
    console.log('📊 测试性能指标...');

    // 获取统计信息
    const stats = await casClient.getStats();
    console.log('   CAS统计信息:');
    console.log(`     总项目数: ${stats.totalItems}`);
    console.log(`     总大小: ${stats.totalSize} bytes`);
    console.log(`     缓存命中率: ${(stats.cacheHitRate * 100).toFixed(2)}%`);
    console.log(`     平均延迟: ${stats.averageLatency.toFixed(2)}ms`);
    console.log(`     错误率: ${(stats.errorRate * 100).toFixed(2)}%`);

    // 获取健康状态
    const health = await casClient.getHealth();
    console.log('   健康状态:');
    console.log(`     状态: ${health.status}`);
    console.log(`     运行时间: ${health.uptime}ms`);
    console.log(`     内存使用: ${(health.memoryUsage / 1024 / 1024).toFixed(2)}MB`);

    console.log('   ✅ 性能指标测试通过\n');
  }

  private async testGarbageCollection(): Promise<void> {
    console.log('🗑️ 测试垃圾回收...');

    // 存储一个带TTL的项目
    const shortTTL = 100; // 100ms
    const cid = await casClient.store(this.testData.small, {
      size: this.testData.small.length,
      tags: ['gc', 'test'],
      ttl: shortTTL
    });

    console.log('   存储了带TTL的项目');

    // 等待TTL过期
    await new Promise(resolve => setTimeout(resolve, shortTTL + 50));

    // 运行垃圾回收
    await casClient.gc();
    console.log('   垃圾回收完成');

    console.log('   ✅ 垃圾回收测试通过\n');
  }

  private async testBackwardCompatibility(): Promise<void> {
    console.log('🔄 测试向后兼容性...');

    const { simpleCasClient } = await import('./shared/da/cas-client.js');

    const testData = {
      orders: [{ id: 1, symbol: 'BTC/USDT', amount: 100 }],
      matches: [{ orderId: 1, price: 50000, amount: 100 }],
      balanceDiffs: [{ address: '0x123', token: 'BTC', delta: -100 }],
      auditLog: [{ action: 'match', timestamp: Date.now() }]
    };

    // 使用简单客户端存储
    const cid = '1-raw-sha2-256-' + Buffer.from('test-cid').toString('hex');
    await simpleCasClient.put(cid, testData);
    console.log('   简单客户端存储成功');

    // 使用简单客户端检索
    const retrieved = await simpleCasClient.get(cid);
    console.log('   简单客户端检索成功');

    if (!retrieved) {
      throw new Error('简单客户端检索失败');
    }

    // 验证数据
    if (retrieved.orders?.length !== testData.orders.length) {
      throw new Error('向后兼容性数据不匹配');
    }

    // 检查存在性
    const exists = await simpleCasClient.has(cid);
    console.log(`   存在性检查: ${exists}`);

    console.log('   ✅ 向后兼容性测试通过\n');
  }
}

// 运行测试
async function runTests() {
  const tester = new CASClientTest();
  
  try {
    await tester.runAllTests();
    console.log('🎉 CAS客户端测试全部通过！');
    process.exit(0);
  } catch (error) {
    console.error('💥 测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { CASClientTest };