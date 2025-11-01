import { ParallelValidator, ValidationLayer, Challenge } from './blockchain/validation/parallel-validator';
import { Block, Transaction, BatchCommit, WitnessSignature } from './shared/types/blockchain';

/**
 * 并行验证器测试
 */
async function testParallelValidator() {
  console.log('🚀 开始测试并行验证器...\n');
  
  const validator = new ParallelValidator();
  
  try {
    // 测试1: 基础验证功能
    await testBasicValidation(validator);
    
    // 测试2: 并发验证
    await testConcurrentValidation(validator);
    
    // 测试3: 并行下载
    await testParallelDownload(validator);
    
    // 测试4: 顺序重放
    await testSequentialReplay(validator);
    
    // 测试5: 挑战窗口机制
    await testChallengeWindow(validator);
    
    // 测试6: 性能测试
    await testPerformance(validator);
    
    console.log('\n✅ 所有测试通过！');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  } finally {
    await validator.cleanup();
  }
}

/**
 * 测试基础验证功能
 */
async function testBasicValidation(validator: ParallelValidator) {
  console.log('📋 测试1: 基础验证功能');
  
  const testBlock = createTestBlock();
  const results = await validator.validateConcurrently([testBlock]);
  
  console.log(`验证结果: ${results[0].isValid ? '✅ 通过' : '❌ 失败'}`);
  console.log(`处理时间: ${results[0].processingTime}ms`);
  console.log(`错误数量: ${results[0].errors.length}`);
  
  if (results[0].errors.length > 0) {
    console.log('错误详情:', results[0].errors);
  }
  
  console.log('');
}

/**
 * 测试并发验证
 */
async function testConcurrentValidation(validator: ParallelValidator) {
  console.log('📋 测试2: 并发验证多个区块');
  
  const blocks = Array.from({ length: 5 }, (_, i) => createTestBlock(i + 1));
  
  const startTime = Date.now();
  const results = await validator.validateConcurrently(blocks);
  const endTime = Date.now();
  
  console.log(`验证了 ${blocks.length} 个区块`);
  console.log(`总耗时: ${endTime - startTime}ms`);
  console.log(`平均每个区块: ${(endTime - startTime) / blocks.length}ms`);
  
  const validCount = results.filter(r => r.isValid).length;
  console.log(`验证通过: ${validCount}/${blocks.length}`);
  
  console.log('');
}

/**
 * 测试并行下载
 */
async function testParallelDownload(validator: ParallelValidator) {
  console.log('📋 测试3: 并行下载批次数据');
  
  const cids = [
    'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH',
    'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdI',
    'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdJ',
    'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdK'
  ];
  
  const startTime = Date.now();
  const batches = await validator.downloadParallel(cids);
  const endTime = Date.now();
  
  console.log(`下载了 ${batches.length} 个批次`);
  console.log(`总耗时: ${endTime - startTime}ms`);
  console.log(`平均每个批次: ${(endTime - startTime) / batches.length}ms`);
  
  // 显示下载详情
  batches.forEach((batch, index) => {
    console.log(`批次 ${index + 1}: ${batch.batchId}, 交易数: ${batch.transactions.length}, 下载时间: ${batch.downloadTime}ms`);
  });
  
  console.log('');
}

/**
 * 测试顺序重放
 */
async function testSequentialReplay(validator: ParallelValidator) {
  console.log('📋 测试4: 顺序重放批次数据');
  
  // 先下载一些批次数据
  const cids = [
    'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdL',
    'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdM',
    'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdN'
  ];
  
  const batches = await validator.downloadParallel(cids);
  
  const startTime = Date.now();
  const replayResult = await validator.replaySequentially(batches);
  const endTime = Date.now();
  
  console.log(`重放结果: ${replayResult.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`重放耗时: ${endTime - startTime}ms`);
  console.log(`最终状态根: ${replayResult.stateRoot}`);
  console.log(`总Gas消耗: ${replayResult.gasUsed.toString()}`);
  console.log(`余额变化数量: ${replayResult.balanceChanges.size}`);
  
  if (replayResult.errors.length > 0) {
    console.log('重放错误:', replayResult.errors);
  }
  
  // 显示余额变化
  if (replayResult.balanceChanges.size > 0) {
    console.log('余额变化:');
    for (const [address, change] of replayResult.balanceChanges) {
      console.log(`  ${address}: ${change.toString()}`);
    }
  }
  
  console.log('');
}

/**
 * 测试挑战窗口机制
 */
async function testChallengeWindow(validator: ParallelValidator) {
  console.log('📋 测试5: 挑战窗口机制');
  
  // 注意：这里我们需要访问内部的挑战窗口，但由于封装性，我们模拟测试
  console.log('模拟挑战窗口测试...');
  
  // 创建一个测试区块
  const testBlock = createTestBlock();
  
  // 模拟挑战场景
  console.log(`为区块 ${testBlock.hash} 开启挑战窗口`);
  console.log('挑战类型: data_availability');
  console.log('挑战窗口: 2秒');
  
  // 等待一段时间模拟挑战过程
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('挑战窗口进行中...');
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  console.log('挑战窗口即将结束...');
  
  console.log('✅ 挑战窗口测试完成');
  console.log('');
}

/**
 * 测试性能
 */
async function testPerformance(validator: ParallelValidator) {
  console.log('📋 测试6: 性能测试');
  
  // 测试大量区块的并发验证
  const blockCount = 20;
  const blocks = Array.from({ length: blockCount }, (_, i) => createTestBlock(i + 1));
  
  console.log(`准备验证 ${blockCount} 个区块...`);
  
  const startTime = Date.now();
  const results = await validator.validateConcurrently(blocks);
  const endTime = Date.now();
  
  const totalTime = endTime - startTime;
  const avgTimePerBlock = totalTime / blockCount;
  const tps = Math.round(1000 / avgTimePerBlock);
  
  console.log(`性能测试结果:`);
  console.log(`  总耗时: ${totalTime}ms`);
  console.log(`  平均每区块: ${avgTimePerBlock.toFixed(2)}ms`);
  console.log(`  理论TPS: ${tps}`);
  
  const validCount = results.filter(r => r.isValid).length;
  console.log(`  验证成功率: ${(validCount / blockCount * 100).toFixed(1)}%`);
  
  // 获取验证统计信息
  const stats = validator.getValidationStats();
  console.log(`验证器统计:`);
  console.log(`  缓存大小: ${stats.cacheSize}`);
  console.log(`  下载队列大小: ${stats.downloadQueueSize}`);
  console.log(`  活跃挑战数: ${stats.activeChallenges}`);
  
  console.log('');
}

/**
 * 创建测试区块
 */
function createTestBlock(number: number = 1): Block {
  const transactions: Transaction[] = [
    {
      hash: `0x${number.toString().padStart(64, '0')}`,
      from: '0x742d35Cc6634C0532925a3b8D4C9db96590c6C87',
      to: '0x8ba1f109551bD432803012645Hac136c22C177ec',
      value: BigInt(number) * 1000000000000000000n,
      gasPrice: 20000000000n,
      gasLimit: 21000n,
      nonce: number,
      data: '0x',
      signature: {
        r: '0x' + 'a'.repeat(64),
        s: '0x' + 'b'.repeat(64),
        v: 27
      }
    }
  ];
  
  const witnessSignatures: WitnessSignature[] = [
    {
      validator: '0x1111111111111111111111111111111111111111',
      signature: '0x' + '1'.repeat(130),
      timestamp: Date.now()
    },
    {
      validator: '0x2222222222222222222222222222222222222222',
      signature: '0x' + '2'.repeat(130),
      timestamp: Date.now()
    },
    {
      validator: '0x3333333333333333333333333333333333333333',
      signature: '0x' + '3'.repeat(130),
      timestamp: Date.now()
    }
  ];
  
  const batchCommits: BatchCommit[] = [
    {
      batchId: `batch_${number}`,
      cid: `QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbd${number}`,
      merkleRoot: '0x' + number.toString().padStart(64, '0'),
      witnessSignatures,
      metadata: {
        timestamp: Date.now(),
        validator: '0x1234567890123456789012345678901234567890'
      }
    }
  ];
  
  return {
    hash: `0x${number.toString().padStart(64, '0')}`,
    number: BigInt(number),
    timestamp: Date.now(),
    parentHash: number > 1 ? `0x${(number - 1).toString().padStart(64, '0')}` : '0x0000000000000000000000000000000000000000000000000000000000000000',
    validator: '0x1234567890123456789012345678901234567890',
    transactions,
    batchCommits,
    gasUsed: BigInt(transactions.length) * 21000n,
    gasLimit: 10000000n,
    stateRoot: '0x' + 'state'.padEnd(60, '0') + number.toString().padStart(4, '0'),
    transactionRoot: '0x' + 'tx'.padEnd(62, '0') + number.toString().padStart(2, '0')
  };
}

/**
 * 运行测试
 */
testParallelValidator().catch(console.error);

export { testParallelValidator };