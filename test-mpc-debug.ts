/**
 * MPC系统调试测试
 * MPC System Debug Test
 */

console.log('🔍 开始调试MPC系统...');

try {
  console.log('1. 尝试导入MPC模块...');
  
  // 动态导入MPC模块
  const mpcModule = await import('./shared/security/mpc/index');
  console.log('✅ MPC模块导入成功');
  console.log('导出的内容:', Object.keys(mpcModule));
  
  const { MPCSystem } = mpcModule;
  
  console.log('2. 创建MPC系统实例...');
  const mpcSystem = new MPCSystem();
  console.log('✅ MPC系统实例创建成功');
  
  console.log('3. 初始化MPC系统...');
  await mpcSystem.initializeSystem();
  console.log('✅ MPC系统初始化成功');
  
  console.log('4. 获取系统健康状态...');
  const healthStatus = await mpcSystem.healthCheck();
  console.log('健康状态:', healthStatus);
  
  console.log('5. 获取系统统计信息...');
  const statistics = await mpcSystem.getStatistics();
  console.log('统计信息:', statistics);
  
  console.log('6. 关闭MPC系统...');
  await mpcSystem.shutdownSystem();
  console.log('✅ MPC系统关闭成功');
  
  console.log('✅ MPC系统调试测试完成');
  
} catch (error) {
  console.error('❌ MPC系统调试测试失败:', error);
  console.error('错误堆栈:', error.stack);
}