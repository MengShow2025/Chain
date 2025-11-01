#!/usr/bin/env node

import { Wallet } from 'ethers';

// 简单的重复见证测试
async function testSimpleDuplicate() {
  const API_PORT = process.env.API_PORT || '3005';
  const API_BASE = `http://localhost:${API_PORT}/api/transactions`;
  
  console.log('=== 简单重复见证测试 ===');
  console.log(`API Base: ${API_BASE}`);
  
  try {
    // 1. 注册一个见证者
    const wallet = Wallet.createRandom();
    const address = wallet.address;
    console.log(`\n1. 注册见证者: ${address}`);
    
    const registerResponse = await fetch(`${API_BASE}/offchain/witness/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
    
    if (!registerResponse.ok) {
      throw new Error(`注册失败: ${registerResponse.status}`);
    }
    
    console.log('✓ 见证者注册成功');
    
    // 验证注册状态
    const listResponse = await fetch(`${API_BASE}/offchain/witness/list`);
    const listResult = await listResponse.json();
    console.log('当前注册的见证者:', listResult.witnesses);
    console.log('我们的地址是否在列表中:', listResult.witnesses.includes(address.toLowerCase()));
    
    // 2. 创建一个简单的批次提交
    const commit = {
      batchId: 'test-duplicate-' + Date.now(),
      nextStateRoot: '0x' + '1'.repeat(64),
      liquidityMetaRoot: '0x' + '2'.repeat(64),
      feeReceiptsRoot: '0x' + '3'.repeat(64),
      distributionPlanRoot: '0x' + '4'.repeat(64),
      timestamp: Date.now()
    };
    
    // 3. 生成摘要字符串（与服务器端一致）
    const digestString = [
        commit.batchId || '',
        commit.cid || '',
        commit.ordersRoot || '',
        commit.matchesRoot || '',
        commit.balanceDiffsRoot || '',
        commit.auditLogRoot || '',
        commit.prevStateRoot || '',
        commit.nextStateRoot || '',
        commit.feeReceiptsRoot || '',
        commit.distributionPlanRoot || '',
        commit.liquidityMetaRoot || '',
        String(commit.timestamp || 0),
    ].join('|');
    console.log('2. 摘要字符串:', digestString);
    
    // 4. 生成签名
    const signature = await wallet.signMessage(digestString);
    console.log(`\n3. 生成签名: ${signature}`);
    
    // 验证地址恢复
    const { verifyMessage } = await import('ethers');
    const recoveredAddress = verifyMessage(digestString, signature);
    console.log(`\n3.1 原始地址: ${address}`);
    console.log(`3.2 恢复地址: ${recoveredAddress}`);
    console.log(`3.3 地址匹配: ${address.toLowerCase() === recoveredAddress.toLowerCase()}`);
    
    // 5. 提交包含重复签名的批次
    const duplicateCommit = {
      ...commit,
      witnessSigs: [signature, signature, signature] // 故意重复同一个签名
    };
    
    console.log('\n4. 提交包含重复签名的批次...');
    
    const commitResponse = await fetch(`${API_BASE}/offchain/batch-commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicateCommit)
    });
    
    const result = await commitResponse.json();
    
    console.log(`\n5. 响应状态: ${commitResponse.status}`);
    console.log(`响应内容:`, JSON.stringify(result, null, 2));
    
    // 6. 验证结果
    if (commitResponse.status === 400 && result.error === 'duplicate_witness') {
      console.log('\n✅ 测试通过：重复见证被正确拦截');
      return true;
    } else {
      console.log('\n❌ 测试失败：重复见证未被拦截');
      console.log(`期望: 状态400, 错误'duplicate_witness'`);
      console.log(`实际: 状态${commitResponse.status}, 错误'${result.error}'`);
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ 测试出错:', error.message);
    return false;
  }
}

// 运行测试
testSimpleDuplicate().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('测试异常:', error);
  process.exit(1);
});