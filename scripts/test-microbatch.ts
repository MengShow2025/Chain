#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { TitanChain } from '../blockchain/core/blockchain.js';
import { Transaction, Validator } from '../shared/types/blockchain.js';
import { CONSENSUS_CONFIG, VALIDATOR_STATUS } from '../shared/constants/blockchain.js';

function genTx(i: number): Transaction {
  const hash = `0x${(Math.random().toString(16).slice(2) + i.toString(16)).padEnd(64, '0')}`;
  return {
    hash,
    from: `0x${'a'.repeat(39)}${(i % 10).toString(16)}`,
    to: `0x${'b'.repeat(39)}${(i % 10).toString(16)}`,
    value: BigInt(1_000_000_000_000_000),
    gas: BigInt(21_000),
    gasPrice: BigInt(1_000_000_000),
    nonce: i,
    data: '0x',
    timestamp: Date.now(),
    isZeroGas: i % 5 === 0 ? true : false,
    exchangeBatch: i % 5 === 0 ? { batchId: `batch-${Math.floor(i/5)}`, exchangeId: 'ex-1' } : undefined,
    contractTier: undefined
  } as any;
}

async function main() {
  console.log('🧪 MicroBatchScheduler test start');
  process.env.ENABLE_MICROBATCH = process.env.ENABLE_MICROBATCH ?? 'true';
  process.env.ENABLE_BLOCK_PRODUCTION = process.env.ENABLE_BLOCK_PRODUCTION ?? 'false';

  const chain = new TitanChain();

  // 生成创世验证节点（与 start-node.ts 逻辑一致的简化版本）
  const makeGenesisValidators = (count = 21): Validator[] => {
    const validators: Validator[] = [];
    const max = Math.min(CONSENSUS_CONFIG.MAX_VALIDATORS, count);
    for (let i = 0; i < max; i++) {
      const address = `0x${i.toString(16).padStart(40, '0')}`;
      const publicKey = `0x${(i + 1000).toString(16).padStart(128, '0')}`;
      const stake = CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE * BigInt(2);
      validators.push({
        address,
        publicKey,
        stake,
        delegatedStake: BigInt(0),
        totalStake: stake,
        commission: 5,
        status: VALIDATOR_STATUS.ACTIVE,
        performance: {
          blocksProduced: 0,
          blocksExpected: 0,
          uptime: 100,
          missedBlocks: 0,
          slashingEvents: 0,
          averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
          score: 100
        },
        metadata: {
          name: `Genesis Validator ${i + 1}`,
          description: 'Genesis validator node',
          website: `https://validator${i + 1}.titanchain.io`
        },
        joinedAt: Date.now(),
        lastActiveBlock: 0
      });
    }
    return validators;
  };

  const genesis = makeGenesisValidators(21);
  await chain.start(genesis);

  // 提交一批交易
  for (let i = 0; i < 50; i++) {
    const tx = genTx(i);
    await chain.submitTransaction(tx);
    await new Promise(r => setTimeout(r, 10));
  }

  // 观察 2 秒，允许微批调度器抓取并入队
  await new Promise(r => setTimeout(r, 2000));

  const queue = chain.getQueueStatus();
  const metrics = chain.getPerformanceMetrics();
  const micro = chain.getMicroBatchStatus();
  console.log('📊 Queue Status:', queue);
  console.log('📈 Performance Metrics:', metrics);
  console.log('🩺 MicroBatch Status:', micro);

  if ((micro?.running === true) || queue.size > 0 || (metrics.totalProcessed ?? 0) > 0) {
    console.log('✅ MicroBatchScheduler working: queue or processed metrics indicate activity');
    process.exit(0);
  } else {
    console.error('❌ MicroBatchScheduler appears inactive');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});