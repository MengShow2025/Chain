/**
 * 智能分片调试测试
 * Smart Sharding Debug Test
 */

console.log('🔍 开始调试智能分片模块...');

try {
  console.log('1. 尝试导入模块...');
  
  // 动态导入模块
  const shardingModule = await import('./blockchain/sharding/smart-sharding');
  console.log('✅ 模块导入成功');
  console.log('导出的内容:', Object.keys(shardingModule));
  
  const { SmartShardingManager, ShardType, LoadBalanceStrategy } = shardingModule;
  
  console.log('2. 创建分片管理器...');
  const manager = new SmartShardingManager(2, LoadBalanceStrategy.LEAST_LOADED);
  console.log('✅ 分片管理器创建成功');
  
  console.log('3. 获取初始状态...');
  const status = manager.getSystemStatus();
  console.log('初始状态:', status);
  
  console.log('✅ 调试测试完成');
  
} catch (error) {
  console.error('❌ 调试测试失败:', error);
  console.error('错误堆栈:', error.stack);
}