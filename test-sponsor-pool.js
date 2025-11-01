const fs = require('fs');

console.log('\n📋 测试: 赞助池服务与路由存在性检查');
try {
  const serviceContent = fs.readFileSync('./blockchain/core/sponsor-pool.ts', 'utf8');
  const routesContent = fs.readFileSync('./api/transactions/routes.ts', 'utf8');

  const checks = [
    { name: 'SponsorPoolService 导出', ok: serviceContent.includes('export const SponsorPoolService') },
    { name: 'rebalance 方法', ok: serviceContent.includes('rebalance(operations') },
    { name: 'canSponsor 方法', ok: serviceContent.includes('canSponsor(account') },
    { name: 'deduct 方法', ok: serviceContent.includes('deduct(account') },
    { name: 'POST /gas/sponsor 路由', ok: routesContent.includes("router.post('/gas/sponsor'") },
    { name: 'POST /gas-sponsor-rebalance 路由', ok: routesContent.includes("router.post('/gas-sponsor-rebalance'") },
  ];

  let passed = 0;
  for (const c of checks) {
    if (c.ok) { console.log(`✅ ${c.name}`); passed++; } else { console.log(`❌ ${c.name}`); }
  }

  console.log(`\n📊 赞助池服务与路由检查: ${passed}/${checks.length} (${Math.round(passed/checks.length*100)}%)`);
} catch (error) {
  console.log(`❌ 赞助池检查失败: ${error.message}`);
}