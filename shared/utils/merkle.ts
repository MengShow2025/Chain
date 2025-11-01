// 简易 Merkle Root 计算工具（使用 SHA-256，占位实现）
// 注意：生产环境可切换为 Keccak-256 或与撮合引擎一致的哈希方案

import crypto from 'crypto';

export function hashLeaf(data: any): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const digest = crypto.createHash('sha256').update(str).digest('hex');
  return '0x' + digest.padStart(64, '0');
}

export function hashPair(left: string, right: string): string {
  const l = left.startsWith('0x') ? left.slice(2) : left;
  const r = right.startsWith('0x') ? right.slice(2) : right;
  const digest = crypto.createHash('sha256').update(l + r, 'hex').digest('hex');
  return '0x' + digest.padStart(64, '0');
}

export function computeMerkleRoot(items: any[]): string {
  if (!items || items.length === 0) {
    return '0x' + '0'.repeat(64);
  }
  let level: string[] = items.map(hashLeaf);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i]; // 奇数时自我配对
      next.push(hashPair(left, right));
    }
    level = next;
  }
  return level[0];
}

export function computeBatchRoots(batchData: { orders?: any[]; matches?: any[]; balanceDiffs?: any[]; auditLog?: any[] }) {
  return {
    ordersRoot: computeMerkleRoot(batchData.orders || []),
    matchesRoot: computeMerkleRoot(batchData.matches || []),
    balanceDiffsRoot: computeMerkleRoot(batchData.balanceDiffs || []),
    auditLogRoot: computeMerkleRoot(batchData.auditLog || []),
  };
}

// 赞助账户根（输入为已序列化快照数组）
export function computeSponsorAccountsRoot(snapshot: Array<any>): string {
  return computeMerkleRoot(snapshot || []);
}

// Gas 成本根（输入可以是字符串、数字或对象）
export function computeGasCostRoot(items: Array<any>): string {
  const normalized = (items || []).map((it) => {
    if (it == null) return '0';
    if (typeof it === 'string') return it;
    if (typeof it === 'number') return String(it);
    if (typeof it === 'bigint') return it.toString();
    // 对象：提取关键字段并字符串化
    const obj: any = it;
    const entry = {
      tx: String(obj.txHash || obj.tx || ''),
      units: String(obj.gasUnits ?? obj.gas ?? 0),
      price: String(obj.gasPrice ?? 0),
    };
    return entry;
  });
  return computeMerkleRoot(normalized);
}