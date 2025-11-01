#!/usr/bin/env node
// 摘要字段顺序一致性回归测试
import { Wallet } from 'ethers';

const API_BASE = `http://localhost:${process.env.API_PORT || 3001}/api/transactions`;

async function post(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sampleBatchData() {
  return {
    orders: [
      { id: 'o1', user: 'u1', asset: 'ETH', side: 'buy', amount: 1, price: 2000 },
      { id: 'o2', user: 'u2', asset: 'ETH', side: 'sell', amount: 1, price: 2000 },
    ],
    matches: [
      { buyOrderId: 'o1', sellOrderId: 'o2', amount: 1, price: 2000 },
    ],
    balanceDiffs: [
      { user: 'u1', asset: 'ETH', delta: +1 },
      { user: 'u2', asset: 'USD', delta: +2000 },
    ],
    auditLog: [
      { type: 'ORDER', message: 'u1 buy 1 ETH @2000' },
      { type: 'ORDER', message: 'u2 sell 1 ETH @2000' },
      { type: 'MATCH', message: 'o1<->o2 matched' },
    ],
  };
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

async function main() {
  console.log('🧪 摘要字段顺序一致性回归测试 开始');

  // 注册满足阈值的见证者（默认阈值为3）
  const w1 = Wallet.createRandom();
  const w2 = Wallet.createRandom();
  const w3 = Wallet.createRandom();
  for (const w of [w1, w2, w3]) {
    const addr = await w.getAddress();
    const reg = await post('/offchain/witness/register', { address: addr });
    assert(reg.status === 200 && reg.json && reg.json.success, '见证注册失败');
  }

  // 存储批次数据与计算根
  const data = sampleBatchData();
  const cid = `bafy-digest-${Date.now()}`;
  const storeResp = await post('/offchain/batch-data', { cid, batchData: data });
  assert(storeResp.status === 200 && storeResp.json && storeResp.json.success, '存储批次数据失败');
  const rootsResp = await post('/offchain/batch-roots', data);
  assert(rootsResp.status === 200 && rootsResp.json && rootsResp.json.success, '计算批次根失败');
  const roots = rootsResp.json.roots;

  const commit = {
    batchId: `digest-consistency-${Date.now()}`,
    cid,
    ordersRoot: roots.ordersRoot,
    matchesRoot: roots.matchesRoot,
    balanceDiffsRoot: roots.balanceDiffsRoot,
    auditLogRoot: roots.auditLogRoot,
    sponsorAccountsRoot: roots.sponsorAccountsRoot,
    gasCostRoot: roots.gasCostRoot,
    prevStateRoot: '0x' + '00'.repeat(32),
    nextStateRoot: '0x' + '00'.repeat(32),
    feeReceiptsRoot: '0x' + '00'.repeat(32),
    distributionPlanRoot: '0x' + '00'.repeat(32),
    liquidityMetaRoot: '0x' + '00'.repeat(32),
    timestamp: Date.now(),
  };

  const goodDigest = digestString(commit);
  const goodSigs = [
    await w1.signMessage(goodDigest),
    await w2.signMessage(goodDigest),
    await w3.signMessage(goodDigest),
  ];
  const ok = await post('/offchain/batch-commit', { ...commit, witnessSigs: goodSigs });
  assert(ok.status === 200 && ok.json && ok.json.success, `正确摘要应通过，但返回: ${ok.status}`);
  console.log('✅ 正确摘要签名提交通过');

  // 构造错误摘要（移除 cid 字段参与签名）
  const wrongCommit = { ...commit };
  const wrongParts = [
    wrongCommit.batchId || '',
    // wrongCommit.cid 被故意省略
    wrongCommit.ordersRoot || '',
    wrongCommit.matchesRoot || '',
    wrongCommit.balanceDiffsRoot || '',
    wrongCommit.auditLogRoot || '',
    wrongCommit.sponsorAccountsRoot || '',
    wrongCommit.gasCostRoot || '',
    wrongCommit.prevStateRoot || '',
    wrongCommit.nextStateRoot || '',
    wrongCommit.feeReceiptsRoot || '',
    wrongCommit.distributionPlanRoot || '',
    wrongCommit.liquidityMetaRoot || '',
    String(wrongCommit.timestamp || 0),
  ];
  const badDigest = wrongParts.join('|');
  const badSigs = [
    await w1.signMessage(badDigest),
    await w2.signMessage(badDigest),
    await w3.signMessage(badDigest),
  ];
  const bad = await post('/offchain/batch-commit', { ...commit, batchId: `${commit.batchId}-bad`, witnessSigs: badSigs });
  assert(bad.status === 400 && bad.json && bad.json.error === 'unauthorized_witness', '错误摘要未被拦截为未授权见证');
  console.log('✅ 错误摘要被拦截为未授权见证');

  console.log('\n🎉 摘要字段顺序一致性回归测试完成');
}

main().catch((e) => {
  console.error('❌ 测试失败:', e && e.message ? e.message : e);
  process.exit(1);
});