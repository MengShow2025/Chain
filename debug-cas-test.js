// 调试CAS客户端
import { casClient, EnhancedCASClient } from './shared/da/cas-client.ts';

async function debugCAS() {
  console.log('🔍 调试CAS客户端...');

  try {
    const testData = new TextEncoder().encode('Hello, Debug!');
    console.log('原始数据:', testData);
    console.log('原始数据长度:', testData.length);

    // 存储数据
    console.log('📝 存储数据...');
    const cid = await casClient.store(testData, {
      size: testData.length,
      mimeType: 'text/plain',
      tags: ['debug']
    });
    console.log('存储成功，CID:', cid.toString());

    // 检查存在性
    console.log('🔍 检查存在性...');
    const exists = await casClient.exists(cid);
    console.log('存在性检查结果:', exists);

    // 检查内部存储
    console.log('🗄️ 检查内部存储...');
    const internalStorage = casClient.storage;
    console.log('内部存储大小:', internalStorage.size);
    console.log('内部存储键:', Array.from(internalStorage.keys()));

    if (exists) {
      console.log('✅ 内容存在，尝试检索...');
      
      // 直接从内部存储获取
      const storedContent = internalStorage.get(cid.toString());
      if (storedContent) {
        console.log('从内部存储获取成功');
        console.log('存储内容:', {
          cid: storedContent.cid.toString(),
          dataLength: storedContent.data.length,
          metadata: storedContent.metadata,
          timestamp: storedContent.timestamp
        });
        
        // 手动处理数据
        let processedData = storedContent.data;
        
        // 检查是否需要解压缩
        if (storedContent.metadata.compression) {
          console.log('需要解压缩，压缩类型:', storedContent.metadata.compression);
        } else {
          console.log('无需解压缩');
        }
        
        const retrievedText = new TextDecoder().decode(processedData);
        console.log('检索到的文本:', retrievedText);
        
      } else {
        console.log('❌ 内部存储中未找到内容');
      }
      
      // 使用正常的检索方法
      console.log('🔄 使用正常检索方法...');
      try {
        const retrieved = await casClient.retrieve(cid);
        const retrievedText = new TextDecoder().decode(retrieved);
        console.log('正常检索成功:', retrievedText);
      } catch (error) {
        console.error('正常检索失败:', error.message);
      }
    } else {
      console.log('❌ 内容不存在');
    }

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

// 运行调试
debugCAS().then(() => {
  console.log('✅ 调试完成');
  process.exit(0);
}).catch((error) => {
  console.error('💥 调试失败:', error);
  process.exit(1);
});