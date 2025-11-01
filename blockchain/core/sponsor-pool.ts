import { ZERO_GAS_LIMITS } from '../../shared/constants/blockchain.js';

type SponsorRecord = {
  budget: bigint;
  creditsUsed: bigint;
  lastRebalance: number;
  dailyGasUsed: bigint;
  dailyTxCount: number;
  resetTime: number;
};

type RebalanceOp = { account: string; setBudget?: bigint; deltaBudget?: bigint };

class SponsorPoolServiceImpl {
  private pools: Map<string, SponsorRecord> = new Map();
  private testingMode: boolean = process.env.TESTING_MODE === 'true';

  private now(): number {
    return Date.now();
  }

  private nextMidnight(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  private ensureRecord(key: string): SponsorRecord {
    const k = key.toLowerCase();
    let rec = this.pools.get(k);
    if (!rec) {
      rec = {
        budget: BigInt(0),
        creditsUsed: BigInt(0),
        lastRebalance: 0,
        dailyGasUsed: BigInt(0),
        dailyTxCount: 0,
        resetTime: this.nextMidnight()
      };
      this.pools.set(k, rec);
    }
    // 日维度重置
    if (this.now() > rec.resetTime) {
      rec.dailyGasUsed = BigInt(0);
      rec.dailyTxCount = 0;
      rec.resetTime = this.nextMidnight();
    }
    return rec;
  }

  getPool(account: string) {
    const rec = this.ensureRecord(account);
    return {
      account: account.toLowerCase(),
      budget: rec.budget,
      creditsUsed: rec.creditsUsed,
      lastRebalance: rec.lastRebalance,
      dailyGasUsed: rec.dailyGasUsed,
      dailyTxCount: rec.dailyTxCount,
      resetTime: rec.resetTime,
    };
  }

  rebalance(operations: RebalanceOp[]) {
    const results: Array<{ account: string; budget: string; creditsUsed: string; lastRebalance: number }> = [];
    for (const op of operations) {
      const key = op.account.toLowerCase();
      const rec = this.ensureRecord(key);
      if (op.setBudget !== undefined) {
        rec.budget = op.setBudget;
      } else if (op.deltaBudget !== undefined) {
        rec.budget = rec.budget + op.deltaBudget;
      }
      if (rec.budget < BigInt(0)) rec.budget = BigInt(0);
      rec.lastRebalance = this.now();
      results.push({
        account: key,
        budget: rec.budget.toString(),
        creditsUsed: rec.creditsUsed.toString(),
        lastRebalance: rec.lastRebalance,
      });
    }
    return results;
  }

  /**
   * 导出快照（序列化为字符串便于 Merkle 哈希）
   */
  snapshot(): Array<{
    account: string;
    budget: string;
    creditsUsed: string;
    dailyGasUsed: string;
    dailyTxCount: number;
    lastRebalance: number;
    resetTime: number;
  }> {
    const out: Array<{
      account: string;
      budget: string;
      creditsUsed: string;
      dailyGasUsed: string;
      dailyTxCount: number;
      lastRebalance: number;
      resetTime: number;
    }> = [];
    for (const [key, recRaw] of this.pools.entries()) {
      const rec = this.ensureRecord(key);
      out.push({
        account: key,
        budget: rec.budget.toString(),
        creditsUsed: rec.creditsUsed.toString(),
        dailyGasUsed: rec.dailyGasUsed.toString(),
        dailyTxCount: rec.dailyTxCount,
        lastRebalance: rec.lastRebalance,
        resetTime: rec.resetTime,
      });
    }
    // 保持稳定顺序（按账号排序）
    out.sort((a, b) => a.account.localeCompare(b.account));
    return out;
  }

  /**
   * 检查是否可赞助本次交易（基于gas单位和每日限制）
   */
  canSponsor(account: string, gasUnits: bigint): { ok: boolean; reason?: string } {
    const rec = this.ensureRecord(account);
    // 测试模式：放宽每日限制，仅保留预算约束
    if (this.testingMode) {
      if (rec.budget < gasUnits) {
        return { ok: false, reason: 'insufficient_budget' };
      }
      return { ok: true };
    }

    // 每笔最大赞助gas限制
    if (gasUnits > ZERO_GAS_LIMITS.MAX_SPONSORED_GAS_PER_TX) {
      return { ok: false, reason: 'exceeds_max_gas_per_tx' };
    }
    // 每日交易数限制
    if (rec.dailyTxCount + 1 > Number(ZERO_GAS_LIMITS.MAX_SPONSORED_TX_PER_DAY)) {
      return { ok: false, reason: 'exceeds_max_tx_per_day' };
    }
    // 每日最大赞助gas限制
    if (rec.dailyGasUsed + gasUnits > ZERO_GAS_LIMITS.MAX_SPONSORED_GAS_PER_DAY) {
      return { ok: false, reason: 'exceeds_max_gas_per_day' };
    }
    // 预算充足检查（预算按gas单位计）
    if (rec.budget < gasUnits) {
      return { ok: false, reason: 'insufficient_budget' };
    }
    return { ok: true };
  }

  /**
   * 扣减赞助预算（按gas单位计）
   */
  deduct(account: string, gasUnits: bigint): { ok: boolean; remainingBudget?: bigint; reason?: string } {
    const rec = this.ensureRecord(account);
    const precheck = this.canSponsor(account, gasUnits);
    if (!precheck.ok) return { ok: false, reason: precheck.reason };
    rec.budget -= gasUnits;
    rec.creditsUsed += gasUnits;
    rec.dailyGasUsed += gasUnits;
    rec.dailyTxCount += 1;
    return { ok: true, remainingBudget: rec.budget };
  }
}

export const SponsorPoolService = new SponsorPoolServiceImpl();