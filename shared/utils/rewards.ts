import { CONSENSUS_CONFIG } from '../constants/blockchain.js';

// TTN最大小数位（假设18位）
const DECIMALS = 10n ** 18n;

// 基于需求：总共10亿通过出块产生，首个4年周期约4亿，4年一减半
const TOTAL_BLOCK_EMISSION = 1_000_000_000n * DECIMALS;
const FIRST_ERA_EMISSION = 400_000_000n * DECIMALS; // 首个4年约4亿

/**
 * 计算指定区块的出块奖励（bigint，含最大小数位）
 * - 4年一个减半周期（按365天近似，不考虑闰年）
 * - 首个周期总产出约4亿TTN
 * - 全周期总产出上限为10亿TTN（当剩余额度不足时按上限裁剪）
 */
export function calculateBlockReward(blockNumber: number): bigint {
  // 创世块或非法高度不产出
  if (blockNumber <= 0) return 0n;

  const secondsPerEra = 4 * 365 * 24 * 3600; // 近似计算
  const blocksPerEra = Math.floor(secondsPerEra / CONSENSUS_CONFIG.BLOCK_TIME);
  if (blocksPerEra <= 0) return 0n;

  // 当前所在的减半周期（从0开始）
  const eraIndex = Math.floor((blockNumber - 1) / blocksPerEra);

  // 计算之前各周期已产出总量（按几何衰减），并对总额度进行封顶
  let mintedBefore = 0n;
  for (let i = 0; i < eraIndex; i++) {
    mintedBefore += FIRST_ERA_EMISSION / (2n ** BigInt(i));
    if (mintedBefore >= TOTAL_BLOCK_EMISSION) {
      mintedBefore = TOTAL_BLOCK_EMISSION;
      break;
    }
  }

  const remainingTotal = TOTAL_BLOCK_EMISSION - mintedBefore;
  if (remainingTotal <= 0n) return 0n; // 已达总产出上限

  // 本周期的目标总产出（若剩余额度不足，则按剩余上限裁剪）
  const targetEraEmission = FIRST_ERA_EMISSION / (2n ** BigInt(eraIndex));
  const eraEmission = remainingTotal < targetEraEmission ? remainingTotal : targetEraEmission;

  // 每块奖励 = 周期总产出 / 周期区块数（向下取整）
  const perBlock = eraEmission / BigInt(blocksPerEra);
  return perBlock;
}