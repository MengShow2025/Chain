#!/usr/bin/env tsx

/**
 * Real Multi-Node P2P Sync Test / 真实多节点P2P同步测试
 * Validates genesis sharing and block sync across multiple nodes
 * 验证创世共享与多节点区块同步 // 英文 /中文
 */

import dotenv from 'dotenv';
import path from 'path';
import { SmartNodeLauncher } from './smart-node-launcher.js';

// Load environment variables / 加载环境变量 // 英文 /中文
dotenv.config();

// Test configuration / 测试配置 // 英文 /中文
interface TestConfig {
  nodeCount: number;            // 节点数量 // 英文 /中文
  basePort: number;             // P2P基础端口 // 英文 /中文
  startIntervalMs: number;      // 启动间隔 // 英文 /中文
  dataDirBase: string;          // 数据目录基路径 // 英文 /中文
  waitAfterStartMs: number;     // 全部启动后等待时间 // 英文 /中文
}

// Parse CLI args / 解析命令行参数 // 英文 /中文
function parseArgs(): Partial<TestConfig> {
  const args = process.argv.slice(2);
  const cfg: Partial<TestConfig> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!value) continue;
    switch (key) {
      case '--nodes': cfg.nodeCount = parseInt(value); break;
      case '--port': cfg.basePort = parseInt(value); break;
      case '--interval': cfg.startIntervalMs = parseInt(value); break;
      case '--data-dir': cfg.dataDirBase = value; break;
      case '--wait': cfg.waitAfterStartMs = parseInt(value); break;
    }
  }
  return cfg;
}

// Simple sleep helper / 简单休眠辅助方法 // 英文 /中文
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main test runner / 主测试运行器 // 英文 /中文
async function main() {
  console.log('🧪 Real Multi-Node P2P Sync Test / 真实多节点P2P同步测试');
  console.log('='.repeat(80));

  const argCfg = parseArgs();
  const config: TestConfig = {
    nodeCount: argCfg.nodeCount ?? 3,
    basePort: argCfg.basePort ?? 7200,
    startIntervalMs: argCfg.startIntervalMs ?? 1500,
    dataDirBase: argCfg.dataDirBase ?? './data/test-real',
    waitAfterStartMs: argCfg.waitAfterStartMs ?? 12000,
  };

  console.log(`📦 Nodes: ${config.nodeCount} | BasePort: ${config.basePort} | Interval: ${config.startIntervalMs}ms`);

  const launchers: SmartNodeLauncher[] = [];
  let passed = true;

  try {
    // Start nodes sequentially / 顺序启动节点 // 英文 /中文
    for (let i = 0; i < config.nodeCount; i++) {
      const nodeId = `real-node-${i}`;
      const p2pPort = config.basePort + i;
      const dataDir = path.join(config.dataDirBase, `node-${i}`);
      const isBootstrap = i === 0;
      const bootstrapNodes = isBootstrap ? [] : [`http://127.0.0.1:${config.basePort}`];

      console.log(`\n🚀 Starting node ${i} (${nodeId}) on ${p2pPort} / 启动节点${i} 在端口${p2pPort}`);

      // Initialize SmartNodeLauncher with per-node overrides
      // 使用每个节点的覆盖配置初始化智能启动器 // 英文 /中文
      const launcher = new SmartNodeLauncher({
        nodeId,
        dataDir,
        p2pPort,
        bootstrapNodes,
        isBootstrapNode: isBootstrap,
        networkTimeout: 30000,
        syncTimeout: 60000,
        maxRetries: 3,
      });

      launchers.push(launcher);
      await launcher.start();

      // Wait between node starts / 启动间隔等待 // 英文 /中文
      if (i < config.nodeCount - 1) {
        await sleep(config.startIntervalMs);
      }
    }

    // Wait for network stabilization / 等待网络稳定 // 英文 /中文
    console.log('\n⏳ Waiting for network stabilization / 等待网络稳定...');
    await sleep(config.waitAfterStartMs);

    // Collect status / 收集状态 // 英文 /中文
    const statuses = launchers.map((l) => l.getStatus());
    const firstHeight = statuses[0].blockHeight;

    console.log('\n📊 Test Status Summary / 测试状态汇总:');
    statuses.forEach((s, i) => {
      console.log(`   #${i} ${s.nodeId} | running=${s.isRunning} | peers=${s.peerCount} | height=${s.blockHeight} | sync=${s.syncStatus}`);
    });

    // Assertions / 断言 // 英文 /中文
    // 1) 第一个节点必须创建创世区块（高度>=1） // 英文 /中文
    if (firstHeight < 1) {
      console.error('❌ Bootstrap node did not create genesis / 引导节点未创建创世');
      passed = false;
    }

    // 2) 后续节点必须与网络高度一致（>= 第一个节点） // 英文 /中文
    for (let i = 1; i < statuses.length; i++) {
      if (statuses[i].blockHeight < firstHeight) {
        console.error(`❌ Node ${i} not synced: ${statuses[i].blockHeight} < ${firstHeight} / 节点${i}未同步`);
        passed = false;
      }
    }

    // Final result / 最终结果 // 英文 /中文
    if (passed) {
      console.log('\n✅ Real Multi-Node P2P Sync Test PASSED / 真实多节点P2P同步测试通过');
      process.exitCode = 0;
    } else {
      console.log('\n❌ Real Multi-Node P2P Sync Test FAILED / 真实多节点P2P同步测试失败');
      process.exitCode = 1;
    }

  } catch (error: any) {
    console.error('\n💥 Test execution error / 测试执行错误:', error?.message || error);
    process.exitCode = 1;
  } finally {
    // Stop all nodes / 停止所有节点 // 英文 /中文
    console.log('\n🛑 Stopping all nodes / 停止所有节点...');
    for (const l of launchers) {
      try { await l.stop(); } catch {}
    }
    console.log('✅ All nodes stopped / 所有节点已停止');
  }
}

// Run if executed directly / 直接执行时运行 // 英文 /中文
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as testRealMultiNode };