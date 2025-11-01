#!/usr/bin/env node

// TitanChain 见证签名与身份校验 集成测试
// 前置：API 开发服务运行在 3002（npm run server:dev）

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
    // 统一与区块验证器摘要字段：包含赞助账户根与燃气成本根
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
  };
}

async function main() {
  console.log('🚀 见证签名与身份校验 集成测试开始');

  // 存储批次数据与计算根
  const data = sampleBatchData();
  const cid = `bafy-witness-${Date.now()}`;
  const storeResp = await post('/offchain/batch-data', { cid, batchData: data });
  assert(storeResp.status === 200 && storeResp.json && storeResp.json.success, '存储批次数据失败');
  const rootsResp = await post('/offchain/batch-roots', data);
  assert(rootsResp.status === 200 && rootsResp.json && rootsResp.json.success, '计算批次根失败');
  const roots = rootsResp.json.roots;

  // 创建并注册见证者
  const w1 = Wallet.createRandom();
  const w2 = Wallet.createRandom();
  const w3 = Wallet.createRandom();
  for (const w of [w1, w2, w3]) {
    const regResp = await post('/offchain/witness/register', { address: await w.getAddress() });
    assert(regResp.status === 200 && regResp.json && regResp.json.success, '见证注册失败');
  }
  const listResp = await get('/offchain/witness/list');
  assert(listResp.status === 200 && listResp.json && listResp.json.success, '查询见证列表失败');

  // 构造承诺并签名
  const batchId = `batch-witness-${Date.now()}`;
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
    timestamp,
  };
  const digest = digestString(commitBody);
  const sigs = [
    await w1.signMessage(digest),
    await w2.signMessage(digest),
    await w3.signMessage(digest),
  ];

  const okCommit = await post('/offchain/batch-commit', { ...commitBody, witnessSigs: sigs });
  assert(okCommit.status === 200 && okCommit.json && okCommit.json.success, `正确见证签名应成功，但返回: ${okCommit.status}`);
  console.log('✅ 正确见证签名承诺已接收');

  // 负例：未注册见证地址
  const w4 = Wallet.createRandom();
  const badSigs = [await w4.signMessage(digest), await w1.signMessage(digest), await w2.signMessage(digest)];
  const badCommit = await post('/offchain/batch-commit', { ...commitBody, batchId: `${batchId}-unauth`, witnessSigs: badSigs });
  assert(badCommit.status === 400 && badCommit.json && badCommit.json.error === 'unauthorized_witness', '未注册见证未被拦截');
  console.log('✅ 未注册见证负例通过');

  // 负例：重复见证签名（同一地址）
  // 注意：必须使用相同的batchId，否则摘要字符串会不同
  const dupBatchId = `${batchId}-dup`;
  const dupCommitBody = { ...commitBody, batchId: dupBatchId };
  const dupDigest = digestString(dupCommitBody);
  const dupSigs = [await w1.signMessage(dupDigest), await w1.signMessage(dupDigest), await w2.signMessage(dupDigest)];
  
  // 调试：打印重复见证恢复地址
  // eslint-disable-next-line no-undef
  const { verifyMessage } = await import('ethers');
  const rec1 = verifyMessage(dupDigest, dupSigs[0]);
  const rec2 = verifyMessage(dupDigest, dupSigs[1]);
  const rec3 = verifyMessage(dupDigest, dupSigs[2]);
  console.log('调试-重复见证恢复地址:', rec1, rec2, rec3);
  
  const dupCommit = await post('/offchain/batch-commit', { ...dupCommitBody, witnessSigs: dupSigs });
  assert(dupCommit.status === 400 && dupCommit.json && dupCommit.json.error === 'duplicate_witness', '重复见证未被拦截');
  console.log('✅ 重复见证负例通过');

  console.log('\n🎉 见证签名与身份校验 集成测试完成');
}

main().catch((e) => {
  console.error('❌ 测试失败:', e && e.message ? e.message : e);
  process.exit(1);
});