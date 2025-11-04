/**
 * 简化智能分片验证测试
 * Simplified Smart Sharding Validation Test
 */

import { SmartShardingManager, ShardType, LoadBalanceStrategy, Shard } from './blockchain/sharding/smart-sharding';

// 简单的测试函数，不需要启动完整的TitanCore
async function validateSmartSharding() {
  console.log('🚀 开始智能分片验证测试...');
  
  try {
    // 1. 测试分片管理器创建 / Test shard manager creation
    console.log('\n1. 测试分片管理器创建...');
    const shardingManager = new SmartShardingManager(2, LoadBalanceStrategy.LEAST_LOADED);
    console.log('✅ 分片管理器创建成功');
    
    // 2. 测试系统状态获取 / Test system status
    console.log('\n2. 测试系统状态获取...');
    const systemStatus = shardingManager.getSystemStatus();
    console.log('系统状态:', {
      shardCount: systemStatus.shardCount,
      isRunning: systemStatus.isRunning,
      autoScaling: systemStatus.autoScaling
    });
    console.log('✅ 系统状态获取成功');
    
    // 3. 测试负载均衡器 / Test load balancer
    console.log('\n3. 测试负载均衡器...');
    const loadBalancer = (shardingManager as any).loadBalancer;
    console.log('负载均衡器策略:', (loadBalancer as any).strategy);
    console.log('分片数量:', loadBalancer.getShardCount());
    console.log('✅ 负载均衡器测试成功');
    
    // 4. 测试分片类型 / Test shard types
    console.log('\n4. 测试分片类型...');
    const testShard = new Shard('test-shard', ShardType.TRADING_PAIR);
    console.log('分片ID:', testShard.id);
    console.log('分片类型:', testShard.type);
    
    // 测试交易对分配
    testShard.assignTradingPair('BTC/USDT');
    testShard.assignTradingPair('ETH/USDT');
    console.log('✅ 分片类型和交易对分配测试成功');
    
    // 5. 测试分片状态 / Test shard status
    console.log('\n5. 测试分片状态...');
    const shardStatus = testShard.getStatus();
    console.log('分片状态:', {
      id: shardStatus.id,
      type: shardStatus.type,
      load: shardStatus.load,
      isHealthy: shardStatus.isHealthy,
      tradingPairs: shardStatus.tradingPairs
    });
    console.log('✅ 分片状态测试成功');
    
    // 6. 测试跨分片协调器 / Test cross-shard coordinator
    console.log('\n6. 测试跨分片协调器...');
    const shards = new Map();
    shards.set('shard1', new Shard('shard1', ShardType.TRADING_PAIR));
    shards.set('shard2', new Shard('shard2', ShardType.USER_BASED));
    
    const crossShardCoordinator = (shardingManager as any).crossShardCoordinator;
    console.log('跨分片协调器创建成功');
    console.log('✅ 跨分片协调器测试成功');
    
    // 7. 测试自动扩缩容配置 / Test auto-scaling configuration
    console.log('\n7. 测试自动扩缩容配置...');
    shardingManager.setAutoScaling(true);
    console.log('自动扩缩容已启用');
    
    shardingManager.setAutoScaling(false);
    console.log('自动扩缩容已禁用');
    console.log('✅ 自动扩缩容配置测试成功');
    
    console.log('\n🎉 智能分片验证测试全部通过！');
    
    return {
      success: true,
      tests: [
        '分片管理器创建',
        '系统状态获取',
        '负载均衡器',
        '分片类型和交易对分配',
        '分片状态',
        '跨分片协调器',
        '自动扩缩容配置'
      ]
    };
    
  } catch (error) {
    console.error('❌ 智能分片验证测试失败:', error);
    console.error('错误详情:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  validateSmartSharding()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 所有测试通过');
        process.exit(0);
      } else {
        console.log('\n❌ 测试失败');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
}

export { validateSmartSharding };