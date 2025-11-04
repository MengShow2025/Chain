#!/usr/bin/env tsx

/**
 * Two-Node P2P Sync Quick Test / 双节点P2P同步快速测试
 * Verifies bootstrap node produces blocks and joiner node fully syncs
 * 验证引导节点出块、加入节点完成同步 // 英文 /中文
 */

import dotenv from 'dotenv';
import path from 'path';
import { SmartNodeLauncher } from './smart-node-launcher.js';

dotenv.config(); // Load env / 加载环境 // 英文 /中文

interface TestConfig {
  basePort: number;      // 基础端口 // 英文 /中文
  startIntervalMs: number; // 启动间隔毫秒 // 英文 /中文
  dataDirBase: string;   // 数据目录基路径 // 英文 /中文
  waitAfterStartMs: number; // 全部启动后等待时间 // 英文 /中文
}

function parseArgs(): Partial<TestConfig> {
  const args = process.argv.slice(2);
  const cfg: Partial<TestConfig> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!value) continue;
    switch (key) {
      case '--port': cfg.basePort = parseInt(value); break;
      case '--interval': cfg.startIntervalMs = parseInt(value); break;
      case '--data-dir': cfg.dataDirBase = value; break;
      case '--wait': cfg.waitAfterStartMs = parseInt(value); break;
    }
  }
  return cfg;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🧪 Two-Node P2P Sync Quick Test / 双节点P2P同步快速测试');
  console.log('='.repeat(80));

  const argCfg = parseArgs();
  const config: TestConfig = {
    basePort: argCfg.basePort ?? 7001,
    startIntervalMs: argCfg.startIntervalMs ?? 1200,
    dataDirBase: argCfg.dataDirBase ?? './data/test-two-node-quick',
    waitAfterStartMs: argCfg.waitAfterStartMs ?? 16000,
  };

  console.log(`⚙️ Config: basePort=${config.basePort}, interval=${config.startIntervalMs}ms, wait=${config.waitAfterStartMs}ms`);

  const launchers: SmartNodeLauncher[] = [];
  let passed = true;

  try {
    // Node 1: Bootstrap, enable block production / 节点1：引导，启用出块 // 英文 /中文
    {
      const nodeId = 'two-node-1';
      const p2pPort = config.basePort;
      const dataDir = path.join(config.dataDirBase, 'node-1');
      process.env.NODE_ID = nodeId;
      process.env.DATA_DIR = dataDir;
      process.env.P2P_PORT = String(p2pPort);
      process.env.BOOTSTRAP_NODES = '';
      process.env.IS_BOOTSTRAP_NODE = 'true';
      process.env.JOIN_EXISTING_NETWORK = 'false';
      process.env.ENABLE_BLOCK_PRODUCTION = 'true';

      const launcher = new SmartNodeLauncher({
        nodeId,
        dataDir,
        p2pPort,
        bootstrapNodes: [],
        isBootstrapNode: true,
        networkTimeout: 20000,
        syncTimeout: 30000,
        maxRetries: 2,
      });
      launchers.push(launcher);
      console.log(`🚀 Starting bootstrap node on ${p2pPort} / 引导节点启动`);
      await launcher.start();
    }

    // Wait between starts / 启动间隔等待 // 英文 /中文
    await sleep(config.startIntervalMs);

    // Node 2: Joiner, disable block production / 节点2：加入，禁用出块 // 英文 /中文
    {
      const nodeId = 'two-node-2';
      const p2pPort = config.basePort + 1;
      const dataDir = path.join(config.dataDirBase, 'node-2');
      process.env.NODE_ID = nodeId;
      process.env.DATA_DIR = dataDir;
      process.env.P2P_PORT = String(p2pPort);
      process.env.BOOTSTRAP_NODES = `http://127.0.0.1:${config.basePort}`;
      process.env.IS_BOOTSTRAP_NODE = 'false';
      process.env.JOIN_EXISTING_NETWORK = 'true';
      process.env.ENABLE_BLOCK_PRODUCTION = 'false';

      const launcher = new SmartNodeLauncher({
        nodeId,
        dataDir,
        p2pPort,
        bootstrapNodes: [`http://127.0.0.1:${config.basePort}`],
        isBootstrapNode: false,
        networkTimeout: 20000,
        syncTimeout: 30000,
        maxRetries: 2,
      });
      launchers.push(launcher);
      console.log(`🚀 Starting joiner node on ${p2pPort} / 加入节点启动`);
      await launcher.start();
    }

    // Wait for stabilization / 等待网络稳定 // 英文 /中文
    console.log('\n⏳ Waiting for sync / 等待同步...');
    await sleep(config.waitAfterStartMs);

    // Collect statuses / 收集状态 // 英文 /中文
    const s1 = launchers[0].getStatus();
    const s2 = launchers[1].getStatus();
    const h1 = s1.blockHeight;
    const h2 = s2.blockHeight;
    const hash1 = s1.lastBlockHash ?? 'N/A';
    const hash2 = s2.lastBlockHash ?? 'N/A';

    console.log('\n📊 Status Summary / 状态汇总:');
    console.log(`   #1 ${s1.nodeId} | peers=${s1.peerCount} | height=${h1} | hash=${hash1.slice(0,12)} | sync=${s1.syncStatus}`);
    console.log(`   #2 ${s2.nodeId} | peers=${s2.peerCount} | height=${h2} | hash=${hash2.slice(0,12)} | sync=${s2.syncStatus}`);

    // Assertions / 断言 // 英文 /中文
    if (h1 < 1) {
      console.error('❌ Bootstrap node did not create genesis / 引导节点未创建创世');
      passed = false;
    }
    if (h2 < h1) {
      console.error(`❌ Joiner not fully synced: ${h2} < ${h1} / 加入节点未同步`);
      passed = false;
    }
    if (hash1 !== hash2) {
      console.error('❌ Latest hash mismatch / 最新哈希不一致');
      passed = false;
    }

    if (passed) {
      console.log('\n✅ Two-Node P2P Sync Test PASSED / 双节点P2P同步测试通过');
      process.exitCode = 0;
    } else {
      console.log('\n❌ Two-Node P2P Sync Test FAILED / 双节点P2P同步测试失败');
      process.exitCode = 1;
    }

  } catch (error: any) {
    console.error('\n💥 Test execution error / 测试执行错误:', error?.message || error);
    process.exitCode = 1;
  } finally {
    console.log('\n🛑 Stopping nodes / 停止节点...');
    for (const l of launchers) {
      try { await l.stop(); } catch {}
    }
    console.log('✅ All nodes stopped / 所有节点已停止');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as testTwoNodeSync };