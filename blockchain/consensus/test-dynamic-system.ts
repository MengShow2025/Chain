/**
 * 动态验证节点管理系统测试
 */

import { ValidatorManager } from './validator-manager.js';
import { VALIDATOR_STATUS } from '../../shared/constants/blockchain.js';
import { Validator, ValidatorCandidate } from '../../shared/types/blockchain.js';

/**
 * 测试动态验证节点管理系统
 */
async function testDynamicValidatorSystem() {
  console.log('🚀 开始测试动态验证节点管理系统...\n');

  try {
    // 初始化验证节点管理器
    const validatorManager = new ValidatorManager();
    const genesisValidators: Validator[] = [
      {
        address: '0x0000000000000000000000000000000000000001',
        publicKey: 'genesis-pk-1',
        stake: 1000n,
        delegatedStake: 0n,
        totalStake: 1000n,
        commission: 5,
        status: VALIDATOR_STATUS.ACTIVE,
        performance: {
          blocksProduced: 0,
          blocksExpected: 0,
          uptime: 100,
          missedBlocks: 0,
          slashingEvents: 0,
          averageBlockTime: 3000,
          score: 100,
        },
        metadata: {
          name: 'Genesis Validator 1',
          description: 'Bootstrap genesis validator',
        },
        joinedAt: Date.now(),
        lastActiveBlock: 0,
      },
    ];

    await validatorManager.initialize(genesisValidators);

    console.log('✅ 验证节点管理器初始化完成\n');

    // 测试1: 注册候选节点
    console.log('📝 测试1: 注册候选节点');
    const candidates: ValidatorCandidate[] = [
      {
        address: '0x00000000000000000000000000000000000000c1',
        publicKey: 'p'.repeat(64),
        stake: 1000n,
        delegatedStake: 0n,
        totalStake: 1000n,
        commission: 10,
        registeredAt: Date.now(),
        lastElectionAttempt: 0,
        electionAttempts: 0,
        isEligible: true,
        status: 'pending' as 'pending',
        metadata: { name: '候选节点1', description: '测试候选节点1' },
        readinessScore: 80,
        violationHistory: [],
      },
      {
        address: '0x00000000000000000000000000000000000000c2', 
        publicKey: 'q'.repeat(64),
        stake: 1500n,
        delegatedStake: 0n,
        totalStake: 1500n,
        commission: 8,
        registeredAt: Date.now(),
        lastElectionAttempt: 0,
        electionAttempts: 0,
        isEligible: true,
        status: 'pending' as 'pending',
        metadata: { name: '候选节点2', description: '测试候选节点2' },
        readinessScore: 85,
        violationHistory: [],
      },
      {
        address: '0x00000000000000000000000000000000000000c3',
        publicKey: 'r'.repeat(64), 
        stake: 2000n,
        delegatedStake: 0n,
        totalStake: 2000n,
        commission: 12,
        registeredAt: Date.now(),
        lastElectionAttempt: 0,
        electionAttempts: 0,
        isEligible: true,
        status: 'pending' as 'pending',
        metadata: { name: '候选节点3', description: '测试候选节点3' },
        readinessScore: 82,
        violationHistory: [],
      }
    ];

    for (const candidate of candidates) {
      await validatorManager.registerCandidate(candidate);
      console.log(`  ✓ 注册候选节点: ${candidate.address}`);
    }

    // 测试2: 查看奖励分配统计
    console.log('\n💰 测试2: 奖励分配统计');
    const rewardStats = validatorManager.getRewardDistributionStats();
    console.log('  奖励分配统计:', {
      活跃节点数量: rewardStats.activeValidatorsCount,
      候补节点数量: rewardStats.candidateNodesCount,
      活跃节点分配比例: `${rewardStats.activeValidatorsShare * 100}%`,
      候补节点分配比例: `${rewardStats.candidateNodesShare * 100}%`,
      单个活跃节点奖励比例: `${(rewardStats.rewardPerActiveValidator * 100).toFixed(4)}%`,
      单个候补节点奖励比例: `${(rewardStats.rewardPerCandidate * 100).toFixed(4)}%`
    });

    // 测试3: 模拟区块奖励分配
    console.log('\n🎁 测试3: 模拟区块奖励分配');
    const totalReward = 1000; // 假设总奖励为1000个代币
    const blockNumber = 12345;
    
    await validatorManager.distributeBlockRewards(totalReward, blockNumber);
    console.log(`  ✓ 区块 #${blockNumber} 奖励分配完成`);

    // 测试4: 获取系统状态
    console.log('\n📊 测试4: 系统状态');
    const systemStatus = validatorManager.getDynamicManagerStatus();
    console.log('  系统统计:', systemStatus);

    // 测试5: 模拟违规检测和节点踢出
    console.log('\n⚠️  测试5: 模拟违规检测');
    
    // 假设candidate1出现违规
    const violationResult = await validatorManager.manualKickValidator(
      'candidate1', 
      '测试违规：模拟硬件条件不足'
    );
    
    if (violationResult) {
      console.log('  ✓ 违规节点已被踢出');
    } else {
      console.log('  ⚠️  节点踢出失败或节点不存在');
    }

    // 再次查看奖励分配统计
    console.log('\n💰 违规处理后的奖励分配统计');
    const newRewardStats = validatorManager.getRewardDistributionStats();
    console.log('  更新后的奖励分配统计:', {
      活跃节点数量: newRewardStats.activeValidatorsCount,
      候补节点数量: newRewardStats.candidateNodesCount,
      单个候补节点奖励比例: `${(newRewardStats.rewardPerCandidate * 100).toFixed(4)}%`
    });

    console.log('\n🎉 动态验证节点管理系统测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

/**
 * 运行测试
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  testDynamicValidatorSystem().catch(console.error);
}

export { testDynamicValidatorSystem };