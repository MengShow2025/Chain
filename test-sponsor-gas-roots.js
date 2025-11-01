#!/usr/bin/env node

// TitanChain 赞助与燃气成本根 严格模式集成测试
// 要求：严格模式服务运行（未设置 SKIP_WITNESS_VALIDATION），例如 PORT=3002 npm run server:dev

import { Wallet } from 'ethers';

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

function digestString(commit) {
  const parts = [
    commit.batchId || '',
    commit.cid || '',
    commit.ordersRoot || '',
    commit.matchesRoot || '',
    commit.balanceDiffsRoot || '',
    commit.auditLogRoot || '',
    commit.sponsorAccountsRoot || '',
    commit.gasCostRoot || '',
    commit.prevStateRoot || '',
    commit.nextStateRoot || '',
    commit.feeReceiptsRoot || '',
    commit.distributionPlanRoot || '',
    commit.liquidityMetaRoot || '',
    String(commit.timestamp || 0),
  ];
  return parts.join('|');
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
    // 提供交易数组以计算 gasCostRoot
    transactions: [
      { hash: '0xaaa', gas: 21000, gasPrice: 1_000_000_000 },
      { hash: '0xbbb', gas: 35000, gasPrice: 1_000_000_000 },
      { hash: '0xccc', gas: 50000, gasPrice: 2_000_000_000 },
    ],
  };
}

async function main() {
  console.log('🚀 赞助与燃气根 严格模式集成测试开始');

  // 预设赞助池预算，生成非空赞助快照
  const sponsorOps = [
    { account: '0xabc', setBudget: '100000' },
    { account: '0xdef', setBudget: '200000' },
    { account: '0x123', setBudget: '150000' },
  ];
  const rebalanceResp = await post('/gas/sponsor', { operations: sponsorOps });
  assert(rebalanceResp.status === 200 && rebalanceResp.json && rebalanceResp.json.success, '赞助池再平衡失败');

  // 存储批次数据并计算所有根（含 sponsorAccountsRoot 与 gasCostRoot）
  const data = sampleBatchData();
  const cid = `bafy-sponsor-gas-${Date.now()}`;
  const storeResp = await post('/offchain/batch-data', { cid, batchData: data });
  assert(storeResp.status === 200 && storeResp.json && storeResp.json.success, '存储批次数据失败');

  const rootsResp = await post('/offchain/batch-roots', data);
  assert(rootsResp.status === 200 && rootsResp.json && rootsResp.json.success, '计算批次根失败');
  const roots = rootsResp.json.roots;
  assert(roots.sponsorAccountsRoot && roots.gasCostRoot, '赞助或燃气根缺失');

  // 注册见证者并签名（严格模式需要注册与有效签名）
  const w1 = Wallet.createRandom();
  const w2 = Wallet.createRandom();
  const w3 = Wallet.createRandom();
  for (const w of [w1, w2, w3]) {
    const regResp = await post('/offchain/witness/register', { address: await w.getAddress() });
    assert(regResp.status === 200 && regResp.json && regResp.json.success, '见证注册失败');
  }
  const list = await get('/offchain/witness/list');
  assert(list.status === 200 && list.json && list.json.success, '查询见证列表失败');
  console.log('调试-见证列表:', list.json.witnesses);

  // 构造承诺（包含 sponsor/gas 根）并签名
  const batchId = `batch-sponsor-gas-${Date.now()}`;
  const timestamp = Date.now();
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
    sponsorAccountsRoot: roots.sponsorAccountsRoot,
    gasCostRoot: roots.gasCostRoot,
    timestamp,
  };
  const digest = digestString(commitBody);
  console.log('调试-摘要:', digest);
  console.log('调试-见证地址:', await w1.getAddress(), await w2.getAddress(), await w3.getAddress());
  const sigs = [
    await w1.signMessage(digest),
    await w2.signMessage(digest),
    await w3.signMessage(digest),
  ];

  const okCommit = await post('/offchain/batch-commit', { ...commitBody, witnessSigs: sigs });
  if (!(okCommit.status === 200 && okCommit.json && okCommit.json.success)) {
    console.error('提交失败详情:', okCommit.json);
    assert(false, `正确包含赞助与燃气根的承诺应成功，但返回: ${okCommit.status}`);
  }
  console.log('✅ 包含 sponsor/gas 根的承诺已接收');

  // 负例：仅提交 sponsorAccountsRoot，缺失 gasCostRoot，应被拦截
  const badSponsorOnly = await post('/offchain/batch-commit', {
    ...commitBody,
    batchId: `${batchId}-sponsor-only`,
    gasCostRoot: undefined,
    witnessSigs: sigs,
  });
  assert(badSponsorOnly.status === 400 && badSponsorOnly.json && badSponsorOnly.json.error === 'inconsistent_sponsor_gas_roots', '仅 sponsor 根未被拦截');
  console.log('✅ 仅 sponsor 根负例通过');

  // 负例：仅提交 gasCostRoot，缺失 sponsorAccountsRoot，应被拦截
  const badGasOnly = await post('/offchain/batch-commit', {
    ...commitBody,
    batchId: `${batchId}-gas-only`,
    sponsorAccountsRoot: undefined,
    witnessSigs: sigs,
  });
  assert(badGasOnly.status === 400 && badGasOnly.json && badGasOnly.json.error === 'inconsistent_sponsor_gas_roots', '仅 gas 根未被拦截');
  console.log('✅ 仅 gas 根负例通过');

  console.log('\n🎉 赞助与燃气根 严格模式集成测试完成');
}

main().catch((e) => {
  console.error('❌ 测试失败:', e && e.message ? e.message : e);
  process.exit(1);
});