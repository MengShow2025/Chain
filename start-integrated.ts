#!/usr/bin/env tsx

/**
 * Integrated TitanChain Node and API Server / 集成的TitanChain节点和API服务器
 * This script starts both the blockchain node and API server in the same process
 * 此脚本在同一进程中启动区块链节点和API服务器
 */

import { TitanChainNode } from './blockchain/start-node.js';
import app from './api/app.js';
import dotenv from 'dotenv';

// Load environment variables / 加载环境变量
dotenv.config();

async function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise(async (resolve) => {
    try {
      const net = await import('net');
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      
      server.on('error', () => resolve(false));
    } catch (error) {
      resolve(false);
    }
  });
}

async function startIntegratedSystem() {
  try {
    console.log('🚀 Starting integrated TitanChain system...');
    
    // Check if API port is available / 检查API端口是否可用
    const API_PORT = parseInt(process.env.API_PORT || '3001');
    const isPortAvailable = await checkPortAvailable(API_PORT);
    
    if (!isPortAvailable) {
      console.error(`❌ Port ${API_PORT} is already in use. Please stop other services or use a different port.`);
      process.exit(1);
    }
    
    // Start blockchain node first / 首先启动区块链节点
    console.log('📦 Initializing blockchain node...');
    const node = new TitanChainNode();
    
    // Add error handling for node startup / 为节点启动添加错误处理
    try {
      await node.start();
      console.log('✅ Blockchain node started successfully');
    } catch (nodeError) {
      console.error('❌ Failed to start blockchain node:', nodeError);
      throw nodeError;
    }
    
    // Wait a moment for blockchain to fully initialize / 等待区块链完全初始化
    console.log('⏳ Waiting for blockchain initialization...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Start API server / 启动API服务器
    console.log('🌐 Starting API server...');
    
    const server = app.listen(API_PORT, () => {
      console.log(`\n✅ Integrated TitanChain system started successfully!`);
      console.log(`🌐 API Server: http://localhost:${API_PORT}`);
      console.log(`🔍 Explorer: http://localhost:3000`);
      console.log(`⛓️  RPC URL: http://localhost:8545`);
      console.log(`🕸️  P2P Node: http://0.0.0.0:4001`);
      console.log(`\n🎯 Ready to accept API requests!`);
    });
    
    // Setup graceful shutdown / 设置优雅关闭
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down integrated system...`);
      
      // Close API server / 关闭API服务器
      server.close(() => {
        console.log('🌐 API server closed');
      });
      
      // Stop blockchain node / 停止区块链节点
      try {
        await node.stop();
        console.log('📦 Blockchain node stopped');
      } catch (error) {
        console.error('❌ Error stopping blockchain node:', error);
      }
      
      process.exit(0);
    };
    
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
  } catch (error) {
    console.error('❌ Failed to start integrated system:', error);
    process.exit(1);
  }
}

// Start the integrated system / 启动集成系统
startIntegratedSystem().catch((error) => {
  console.error('❌ Startup error:', error);
  process.exit(1);
});