import { Wallet } from 'ethers';
import fs from 'fs';
import path from 'path';

/**
 * 生成多个 TTN(EVM)钱包地址，并输出到项目根目录的 genesis-wallets.json
 * 用法：tsx scripts/generate-wallets.ts [count]
 */
async function main() {
  const arg = process.argv[2];
  const count = Math.max(1, Number(arg) || 10);

  const wallets = [] as Array<{
    address: string;
    publicKey: string;
    privateKey: string;
  }>;

  for (let i = 0; i < count; i++) {
    const wallet = Wallet.createRandom();
    wallets.push({
      address: wallet.address,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
    });
  }

  const outPath = path.resolve(process.cwd(), 'genesis-wallets.json');
  fs.writeFileSync(outPath, JSON.stringify(wallets, null, 2), 'utf8');

  console.log(`✅ 已生成 ${wallets.length} 个钱包到 ${outPath}`);
  console.log('示例（前3个）：');
  console.log(wallets.slice(0, 3));
}

main().catch((err) => {
  console.error('生成钱包失败:', err);
  process.exit(1);
});