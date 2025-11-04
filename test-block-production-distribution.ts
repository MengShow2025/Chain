import { CompetitiveBlockProduction } from './blockchain/consensus/competitive-block-production.js';

// 快速分布测试：验证质押主导的竞争出块是否有效 // 英文 /中文

type TestValidator = {
  address: string;
  stake: bigint;
  performance: { score: number; uptime: number };
  status: 'active';
};

// 构造不同质押规模的验证节点，保持较高性能与在线率 // 英文 /中文
const validators: TestValidator[] = [
  {
    address: '0xAAA0000000000000000000000000000000000001',
    stake: BigInt('1000000000000000000000'), // 1,000 TTN // 英文 /中文
    performance: { score: 95, uptime: 99 },
    status: 'active'
  },
  {
    address: '0xBBB0000000000000000000000000000000000002',
    stake: BigInt('5000000000000000000000'), // 5,000 TTN // 英文 /中文
    performance: { score: 92, uptime: 97 },
    status: 'active'
  },
  {
    address: '0xCCC0000000000000000000000000000000000003',
    stake: BigInt('20000000000000000000000'), // 20,000 TTN // 英文 /中文
    performance: { score: 90, uptime: 96 },
    status: 'active'
  },
  {
    address: '0xDDD0000000000000000000000000000000000004',
    stake: BigInt('800000000000000000000'), // 800 TTN (新节点) // 英文 /中文
    performance: { score: 85, uptime: 94 },
    status: 'active'
  }
];

async function main() {
  console.log('🧪 运行快速分布测试 (基于质押主导的权重) ...'); // 英文 /中文

  const bp = new CompetitiveBlockProduction();
  for (const v of validators) {
    bp.addBlockProducer(v as any); // 仅用于测试 // 英文 /中文
  }

  const blocks = 50; // 测试区块数量，控制日志体量 // 英文 /中文
  const counts = new Map<string, number>();

  for (let i = 1; i <= blocks; i++) {
    const prevHash = `block-${i - 1}`;
    const result = await bp.selectBlockProducer(i, prevHash);
    if (result?.selectedProducer) {
      counts.set(result.selectedProducer, (counts.get(result.selectedProducer) || 0) + 1);
    }
  }

  // 输出统计 // 英文 /中文
  console.log('\n=== 出块分布统计 ==='); // 英文 /中文
  for (const v of validators) {
    const c = counts.get(v.address) || 0;
    const percent = ((c / blocks) * 100).toFixed(2);
    console.log(`Validator ${v.address} -> ${c}/${blocks} blocks (${percent}%)`); // 英文 /中文
  }

  // 给出期望与结论 // 英文 /中文
  console.log('\n期望：质押20k > 5k > 1k ≈ 0.8k，但低权重仍有一定机会。'); // 英文 /中文
  console.log('若分布接近上述顺序，说明质押主导权重生效，随机影响被适度控制。'); // 英文 /中文
}

main().catch((e) => {
  console.error('测试运行异常:', e); // 英文 /中文
  process.exit(1); // 英文 /中文
});