#!/usr/bin/env node

// TitanChain L1 数据可用性与 Merkle 根校验 集成测试
// 依赖：本地 API 服务已运行（npm run server:dev），端口 3002

const API_BASE = `http://localhost:${process.env.API_PORT || 3001}/api/transactions`;

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sampleBatchData() {
  return {
    orders: [
      { id: 'o1', pairId: 'TTN/ttUSD', side: 'buy', price: '1.00', amount: '100', account: '0xabc', ts: 1 },
      { id: 'o2', pairId: 'TTN/ttUSD', side: 'sell', price: '1.01', amount: '100', account: '0xdef', ts: 2 },
    ],
    matches: [
      { orderA: 'o1', orderB: 'o2', price: '1.005', amount: '100' },
    ],
    balanceDiffs: [
      { account: '0xabc', delta: '+100' },
      { account: '0xdef', delta: '-100' },
    ],
    auditLog: [
      { event: 'match', id: 'm1', at: 3 },
    ],
  };
}

async function main() {
  console.log('🚀 L1 数据可用性与 Merkle 根校验 集成测试开始');

  // 1) 存储批次数据到 CAS
  const data = sampleBatchData();
  const cid = `bafy-test-${Date.now()}`;
  const storeResp = await post('/offchain/batch-data', { cid, batchData: data });
  assert(storeResp.status === 200 && storeResp.json && storeResp.json.success, '存储批次数据失败');
  console.log('✅ 批次数据已存储', cid);

  // 2) 计算批次 Merkle 根
  const rootsResp = await post('/offchain/batch-roots', data);
  assert(rootsResp.status === 200 && rootsResp.json && rootsResp.json.success, '计算批次根失败');
  const roots = rootsResp.json.roots;
  assert(roots.ordersRoot && roots.matchesRoot && roots.balanceDiffsRoot && roots.auditLogRoot, '批次根返回不完整');
  console.log('✅ 批次 Merkle 根已计算');

  // 3) 提交正确的批次承诺，期望成功
  const batchId = `batch-da-${Date.now()}`;
  const commitBody = {
    batchId,
    cid,
    prevStateRoot: '0x'.padEnd(66, '0'),
    nextStateRoot: '0x'.padEnd(66, '0'),
    ordersRoot: roots.ordersRoot,
    matchesRoot: roots.matchesRoot,
    balanceDiffsRoot: roots.balanceDiffsRoot,
    auditLogRoot: roots.auditLogRoot,
    liquidityMetaRoot: '0x'.padEnd(66, '0'),
    feeReceiptsRoot: '0x'.padEnd(66, '0'),
    distributionPlanRoot: '0x'.padEnd(66, '0'),
    witnessSigs: ['sig1', 'sig2', 'sig3'],
    timestamp: Date.now(),
  };
  const okCommit = await post('/offchain/batch-commit', commitBody);
  assert(okCommit.status === 200 && okCommit.json && okCommit.json.success, `正确批次承诺应成功，但返回: ${okCommit.status}`);
  console.log('✅ 正确批次承诺已接收');

  // 状态查询
  const statusResp = await get(`/offchain/batch/${batchId}`);
  assert(statusResp.status === 200 && statusResp.json && statusResp.json.success, '查询批次状态失败');
  assert(statusResp.json.batch && statusResp.json.batch.status === 'received', '批次状态不是 received');
  assert(statusResp.json.batch.witnessesCollected === 3, '见证数量不匹配');
  console.log('✅ 批次状态校验通过');

  // 4) 负例：错误的 ordersRoot，应返回 400 + orders_root_mismatch
  const badCommit = await post('/offchain/batch-commit', {
    ...commitBody,
    batchId: `${batchId}-bad-orders`,
    ordersRoot: '0x' + '1'.repeat(64),
  });
  assert(badCommit.status === 400 && badCommit.json && badCommit.json.error === 'orders_root_mismatch', '错误的 ordersRoot 未被拦截');
  console.log('✅ 错误的 ordersRoot 负例通过');

  // 5) 负例：缺失 cid，应返回 400 + missing_cid_for_da_check
  const noCidCommit = await post('/offchain/batch-commit', {
    ...commitBody,
    batchId: `${batchId}-no-cid`,
    cid: undefined,
  });
  assert(noCidCommit.status === 400 && noCidCommit.json && noCidCommit.json.error === 'missing_cid_for_da_check', '缺失 cid 未被拦截');
  console.log('✅ 缺失 cid 负例通过');

  console.log('\n🎉 L1 数据可用性与 Merkle 根校验 集成测试完成');
}

main().catch((e) => {
  console.error('❌ 测试失败:', e && e.message ? e.message : e);
  process.exit(1);
});