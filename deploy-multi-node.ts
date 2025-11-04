#!/usr/bin/env tsx

/**
 * TitanChain Multi-Node Deployment Script / TitanChain 多节点部署脚本
 * Orchestrates sequential startup of multiple SmartNodeLauncher instances
 * 顺序启动多个智能节点并进行快速健康检查 // 英文 /中文
 */

import dotenv from 'dotenv';
import path from 'path';
import { SmartNodeLauncher } from './smart-node-launcher.js';

// Load environment variables / 加载环境变量 // 英文 /中文
dotenv.config();

// Deploy configuration interface / 部署配置接口 // 英文 /中文
interface DeployConfig {
  nodeCount: number;            // 节点数量 // 英文 /中文
  basePort: number;             // P2P基础端口 // 英文 /中文
  startIntervalMs: number;      // 节点启动间隔毫秒 // 英文 /中文
  dataDirBase: string;          // 数据目录基路径 // 英文 /中文
  waitAfterStartMs: number;     // 全部启动后等待时间 // 英文 /中文
  exitAfterSummary?: boolean;   // 打印汇总后退出 // 英文 /中文
}

// Parse CLI args into config / 解析命令行参数到配置 // 英文 /中文
function parseArgs(): Partial<DeployConfig> {
  const args = process.argv.slice(2);
  const cfg: Partial<DeployConfig> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!value) continue;
    switch (key) {
      case '--nodes':
        cfg.nodeCount = parseInt(value);
        break;
      case '--port':
        cfg.basePort = parseInt(value);
        break;
      case '--interval':
        cfg.startIntervalMs = parseInt(value);
        break;
      case '--data-dir':
        cfg.dataDirBase = value;
        break;
      case '--wait':
        cfg.waitAfterStartMs = parseInt(value);
        break;
      case '--exit':
        // Any truthy value enables exit-after-summary // 英文 /中文
        cfg.exitAfterSummary = value === 'true' || value === '1';
        break;
    }
  }
  return cfg;
}

// Simple sleep helper / 简单休眠辅助方法 // 英文 /中文
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main deployment flow / 主部署流程 // 英文 /中文
async function main() {
  console.log('🚀 TitanChain Multi-Node Deployment / TitanChain 多节点部署');
  console.log('='.repeat(80));

  const argCfg = parseArgs();
  const config: DeployConfig = {
    nodeCount: argCfg.nodeCount ?? 3,
    basePort: argCfg.basePort ?? 6000,
    startIntervalMs: argCfg.startIntervalMs ?? 1500,
    dataDirBase: argCfg.dataDirBase ?? './data',
    waitAfterStartMs: argCfg.waitAfterStartMs ?? 12000,
    exitAfterSummary: argCfg.exitAfterSummary ?? false,
  };

  console.log(`📦 Nodes: ${config.nodeCount} | BasePort: ${config.basePort} | Interval: ${config.startIntervalMs}ms`);

  // Create launchers array / 创建启动器数组 // 英文 /中文
  const launchers: SmartNodeLauncher[] = [];

  try {
    // Sequentially start nodes / 顺序启动节点 // 英文 /中文
    for (let i = 0; i < config.nodeCount; i++) {
      const nodeId = `titan-node-${i}`;
      const p2pPort = config.basePort + i;
      const dataDir = path.join(config.dataDirBase, `node-${i}`);
      const isBootstrap = i === 0;
      const bootstrapNodes = isBootstrap ? [] : [`http://127.0.0.1:${config.basePort}`];

      console.log(`\n🚀 Starting node ${i} (${nodeId}) on ${p2pPort} / 启动节点${i} 在端口${p2pPort}`);

      // Ensure blockchain start behavior aligns with network role // 英文 /中文
      // 为每个节点设置环境变量以匹配其角色 // 英文 /中文
      process.env.NODE_ID = nodeId;
      process.env.DATA_DIR = dataDir;
      process.env.P2P_PORT = String(p2pPort);
      process.env.BOOTSTRAP_NODES = bootstrapNodes.join(',');
      process.env.IS_BOOTSTRAP_NODE = isBootstrap ? 'true' : 'false';
      process.env.JOIN_EXISTING_NETWORK = isBootstrap ? 'false' : 'true';
      process.env.ENABLE_BLOCK_PRODUCTION = isBootstrap ? 'true' : 'false';

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

    // Summarize status / 汇总状态 // 英文 /中文
    console.log('\n📊 Deployment Summary / 部署汇总:');
    for (let i = 0; i < launchers.length; i++) {
      const status = launchers[i].getStatus();
      console.log(
        `   #${i} ${status.nodeId} | running=${status.isRunning} | peers=${status.peerCount} | height=${status.blockHeight} | sync=${status.syncStatus}`
      );
    }

    console.log('\n✅ Multi-node deployment completed. Press Ctrl+C to stop. / 多节点部署完成，按Ctrl+C停止');

    // If exitAfterSummary is enabled, stop all and exit // 英文 /中文
    const stopAll = async () => {
      console.log('\n🛑 Stopping all nodes / 停止所有节点...');
      for (const l of launchers) {
        try {
          await l.stop();
        } catch (e) {
          console.error('⚠️ Error stopping node / 停止节点出错:', e);
        }
      }
      console.log('✅ All nodes stopped / 所有节点已停止');
    };

    if (config.exitAfterSummary) {
      await stopAll();
      return; // 直接退出主流程 // 英文 /中文
    }

    // Otherwise, keep running until signals // 英文 /中文
    const handleSignal = async () => {
      await stopAll();
      process.exit(0);
    };
    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

  } catch (error: any) {
    console.error('\n❌ Deployment failed / 部署失败:', error?.message || error);
    // Attempt cleanup / 尝试清理 // 英文 /中文
    for (const l of launchers) {
      try { await l.stop(); } catch {}
    }
    process.exit(1);
  }
}

// Run if executed directly / 直接执行时运行 // 英文 /中文
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as deployMultiNode };