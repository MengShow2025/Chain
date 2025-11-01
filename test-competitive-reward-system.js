import { CompetitiveRewardSystem } from './blockchain/consensus/competitive-reward-system.js';
import { CompetitiveBlockProduction } from './blockchain/consensus/competitive-block-production.js';
import { ValidationWorkloadSystem } from './blockchain/consensus/validation-workload-system.js';

// 创建测试验证节点
const testValidators = [
  {
    address: '0x3c55a5681d272E8787C818e2d164c0ABFd90a933',
    stake: BigInt('1000000000000000000000'), // 1000 TTN
    performance: { score: 95, uptime: 98 },
    status: 'active'
  },
  {
    address: '0x151bBae42e263EbfBD6740C966420B852d9156dE',
    stake: BigInt('1000000000000000000000'), // 1000 TTN
    performance: { score: 92, uptime: 95 },
    status: 'active'
  },
  {
    address: '0x2a3a988B1498524c9D0da26aE8633A1f1461a9eE',
    stake: BigInt('1000000000000000000000'), // 1000 TTN
    performance: { score: 88, uptime: 97 },
    status: 'active'
  }
];

async function testCompetitiveRewardSystem() {
  console.log('🧪 测试竞争奖励系统...\n');

  // 初始化系统
  const blockProduction = new CompetitiveBlockProduction();
  const validationWorkload = new ValidationWorkloadSystem();
  const rewardSystem = new CompetitiveRewardSystem(blockProduction, validationWorkload);

  // 添加验证节点
  for (const validator of testValidators) {
    blockProduction.addBlockProducer(validator);
    validationWorkload.addCandidateValidator(validator);
  }

  console.log('✅ 已添加 3 个测试验证节点\n');

  // 测试多个区块的奖励分配
  for (let blockNumber = 1; blockNumber <= 5; blockNumber++) {
    console.log(`=== 测试区块 #${blockNumber} ===`);
    
    const previousBlockHash = `block-${blockNumber - 1}`;
    const blockReward = BigInt('9512937595129375951'); // ~9.5 TTN

    try {
      const result = await rewardSystem.processBlockRewards(
        blockNumber,
        previousBlockHash,
        blockReward
      );

      if (result) {
        console.log(`✅ 区块 #${blockNumber} 奖励分配成功:`);
        console.log(`   出块者: ${result.blockProducer}`);
        console.log(`   出块奖励: ${result.blockProducerReward} TTN`);
        console.log(`   验证节点数: ${result.validationRewards.size}`);
        
        let totalValidationReward = BigInt(0);
        for (const [address, reward] of result.validationRewards) {
          console.log(`   验证奖励: ${address} -> ${reward} TTN`);
          totalValidationReward += reward;
        }
        console.log(`   验证总奖励: ${totalValidationReward} TTN`);
        console.log(`   总奖励: ${result.totalReward} TTN\n`);
      } else {
        console.error(`❌ 区块 #${blockNumber} 奖励分配失败\n`);
      }
    } catch (error) {
      console.error(`❌ 区块 #${blockNumber} 处理出错:`, error.message, '\n');
    }
  }

  // 获取统计信息
  console.log('=== 系统统计 ===');
  const stats = rewardSystem.getRewardDistributionStats(5);
  console.log('总区块数:', stats.totalBlocks);
  console.log('总奖励:', stats.totalRewards.toString(), 'TTN');
  console.log('出块者奖励占比:', stats.rewardDistribution.blockProducerShare.toFixed(2) + '%');
  console.log('验证奖励占比:', stats.rewardDistribution.validationShare.toFixed(2) + '%');

  const rankings = rewardSystem.getValidatorRewardRanking(5);
  console.log('\n验证节点奖励排名:');
  rankings.forEach((validator, index) => {
    console.log(`${index + 1}. ${validator.address}: ${validator.totalRewards} TTN (${validator.blockCount} 个区块)`);
  });
}

// 运行测试
testCompetitiveRewardSystem().catch(console.error);