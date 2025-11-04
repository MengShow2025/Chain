/**
 * TitanChain增强P2P网络层
 * Enhanced P2P Network Layer for TitanChain
 * 
 * 功能特性 / Features:
 * - 区块广播和同步 / Block broadcasting and synchronization
 * - 节点发现和连接管理 / Node discovery and connection management
 * - 网络分区处理和重连 / Network partition handling and reconnection
 * - 智能路由和负载均衡 / Smart routing and load balancing
 * - 区块链状态同步 / Blockchain state synchronization
 */

import http from 'http';
import { Server as IOServer, Socket as ServerSocket } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { TitanChain } from '../blockchain/core/blockchain.js';
import { BlockSyncProtocol, SyncStatus, SyncResponse } from '../blockchain/core/block-sync.js';
import { Block, Transaction } from '../shared/types/blockchain.js';
import type {
  P2PMessage,
  PeerInfo,
  HelloPayload,
  BlockPayload,
  TransactionPayload,
  RequestBlocksPayload,
  BlocksPayload
} from '../shared/types/p2p.js';

// 扩展P2P消息类型 / Extended P2P message types
export type EnhancedP2PMessageType = 
  | 'HELLO'
  | 'WELCOME'
  | 'PEERS'
  | 'BLOCK'
  | 'TRANSACTION'
  | 'REQUEST_BLOCKS'
  | 'BLOCKS'
  | 'PING'
  | 'PONG'
  | 'SYNC_REQUEST'        // 同步请求 / Sync request
  | 'SYNC_RESPONSE'       // 同步响应 / Sync response
  | 'CHAIN_STATUS'        // 链状态 / Chain status
  | 'NODE_STATUS'         // 节点状态 / Node status
  | 'PEER_DISCOVERY'      // 节点发现 / Peer discovery
  | 'NETWORK_INFO';       // 网络信息 / Network info

// 增强的节点信息 / Enhanced peer info
export interface EnhancedPeerInfo extends PeerInfo {
  chainHeight: number;           // 链高度 / Chain height
  nodeVersion: string;           // 节点版本 / Node version
  capabilities: string[];        // 节点能力 / Node capabilities
  latency: number;              // 延迟 / Latency
  reliability: number;          // 可靠性评分 / Reliability score
  lastBlockHash: string;        // 最后区块哈希 / Last block hash
  syncStatus: SyncStatus;       // 同步状态 / Sync status
}

// 网络状态 / Network status
export interface NetworkStatus {
  connectedPeers: number;       // 连接的节点数 / Connected peers count
  totalPeers: number;           // 总节点数 / Total peers count
  networkHeight: number;        // 网络高度 / Network height
  syncProgress: number;         // 同步进度 / Sync progress
  isHealthy: boolean;           // 网络是否健康 / Is network healthy
  partitionDetected: boolean;   // 是否检测到分区 / Partition detected
}

// P2P配置 / P2P configuration
export interface EnhancedP2POptions {
  port?: number;                // 本地P2P端口 / Local P2P port
  host?: string;                // 本地主机 / Local host
  bootnodes?: string[];         // 引导节点 / Boot nodes
  maxPeers?: number;            // 最大节点数 / Max peers
  syncBatchSize?: number;       // 同步批量大小 / Sync batch size
  heartbeatInterval?: number;   // 心跳间隔 / Heartbeat interval
  reconnectInterval?: number;   // 重连间隔 / Reconnect interval
  enableAutoSync?: boolean;     // 启用自动同步 / Enable auto sync
  enablePeerDiscovery?: boolean; // 启用节点发现 / Enable peer discovery
}

// 默认P2P配置 / Default P2P configuration
const DEFAULT_P2P_OPTIONS: Required<EnhancedP2POptions> = {
  port: 4003,
  host: '0.0.0.0',
  bootnodes: [],
  maxPeers: 50,
  syncBatchSize: 100,
  heartbeatInterval: 30000,     // 30秒 / 30 seconds
  reconnectInterval: 5000,      // 5秒 / 5 seconds
  enableAutoSync: true,
  enablePeerDiscovery: true
};

/**
 * 增强P2P网络节点
 * Enhanced P2P Network Node
 */
export class EnhancedP2PNode extends EventEmitter {
  private chain: TitanChain;
  private blockSync: BlockSyncProtocol;
  private server?: IOServer;
  private httpServer?: http.Server;
  private peers: Map<string, { info: EnhancedPeerInfo; socket: ClientSocket | ServerSocket }>;
  private nodeId: string;
  private options: Required<EnhancedP2POptions>;
  private networkStatus: NetworkStatus;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private syncInProgress: boolean = false;
  private rateLimits: Map<string, { windowStart: number; blockCount: number; txCount: number }> = new Map();

  // 速率限制常量 / Rate limiting constants
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000; // 1分钟窗口 / 1 minute window
  private static readonly MAX_BLOCKS_PER_WINDOW = 60;    // 每分钟最多60块 / Max 60 blocks per minute
  private static readonly MAX_TX_PER_WINDOW = 2000;      // 每分钟最多2000笔交易 / Max 2000 transactions per minute

  constructor(chain: TitanChain, blockSync: BlockSyncProtocol, options?: EnhancedP2POptions) {
    super();
    this.chain = chain;
    this.blockSync = blockSync;
    this.peers = new Map();
    this.nodeId = process.env.NODE_ID || crypto.randomUUID();
    this.options = { ...DEFAULT_P2P_OPTIONS, ...options };
    
    // 初始化网络状态 / Initialize network status
    this.networkStatus = {
      connectedPeers: 0,
      totalPeers: 0,
      networkHeight: 0,
      syncProgress: 0,
      isHealthy: true,
      partitionDetected: false
    };

    // 设置区块同步事件监听 / Setup block sync event listeners
    this.setupBlockSyncListeners();
  }

  /**
   * 启动增强P2P节点 / Start enhanced P2P node
   */
  async start(): Promise<void> {
    console.log('🚀 启动增强P2P节点 / Starting enhanced P2P node...');
    
    try {
      // 启动服务器 / Start server
      await this.startServer();
      
      // 连接引导节点 / Connect to boot nodes
      await this.connectBootnodes();
      
      // 启动心跳 / Start heartbeat
      this.startHeartbeat();
      
      // 启动节点发现 / Start peer discovery
      if (this.options.enablePeerDiscovery) {
        this.startPeerDiscovery();
      }
      
      // 启动自动同步 / Start auto sync
      if (this.options.enableAutoSync) {
        this.startAutoSync();
      }
      
      console.log(`✅ 增强P2P节点启动成功 / Enhanced P2P node started: ${this.getLocalAddress()}`);
      
      // 发出启动事件 / Emit start event
      this.emit('started', { nodeId: this.nodeId, address: this.getLocalAddress() });
      
    } catch (error) {
      console.error('❌ 启动增强P2P节点失败 / Failed to start enhanced P2P node:', error);
      throw error;
    }
  }

  /**
   * 停止增强P2P节点 / Stop enhanced P2P node
   */
  async stop(): Promise<void> {
    console.log('🛑 停止增强P2P节点 / Stopping enhanced P2P node...');
    
    // 停止定时器 / Stop timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    // 断开所有连接 / Disconnect all peers
    for (const { socket } of this.peers.values()) {
      try {
        socket.disconnect();
      } catch (error) {
        console.warn('断开节点连接时出错 / Error disconnecting peer:', error);
      }
    }
    this.peers.clear();
    
    // 关闭服务器 / Close server
    if (this.server) {
      await this.server.close();
      this.server = undefined;
    }
    
    if (this.httpServer) {
      await new Promise<void>((resolve) => this.httpServer?.close(() => resolve()));
      this.httpServer = undefined;
    }
    
    console.log('✅ 增强P2P节点已停止 / Enhanced P2P node stopped');
    
    // 发出停止事件 / Emit stop event
    this.emit('stopped');
  }

  /**
   * 启动服务器 / Start server
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.httpServer = http.createServer();
        this.server = new IOServer(this.httpServer, {
          cors: { origin: "*", methods: ["GET", "POST"] },
          transports: ['websocket', 'polling']
        });

        // 处理新连接 / Handle new connections
        this.server.on('connection', (socket: ServerSocket) => {
          console.log(`📡 新节点连接 / New peer connected: ${socket.id}`);
          this.handleNewConnection(socket);
        });

        this.httpServer.listen(this.options.port, this.options.host, () => {
          console.log(`🌐 P2P服务器监听 / P2P server listening on ${this.options.host}:${this.options.port}`);
          resolve();
        });

        this.httpServer.on('error', reject);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 处理新连接 / Handle new connection
   */
  private handleNewConnection(socket: ServerSocket): void {
    // 注册消息处理器 / Register message handlers
    this.registerSocketHandlers(socket);
    
    // 发送欢迎消息 / Send welcome message
    const welcomeMessage: P2PMessage<HelloPayload> = {
      type: 'WELCOME',
      payload: {
        id: this.nodeId,
        address: this.getLocalAddress(),
        version: '2.0.0'
      },
      timestamp: Date.now()
    };
    
    socket.emit('message', welcomeMessage);
  }

  /**
   * 连接引导节点 / Connect to boot nodes
   */
  private async connectBootnodes(): Promise<void> {
    console.log(`🔗 连接引导节点 / Connecting to boot nodes: ${this.options.bootnodes.length} nodes`);
    
    const connectionPromises = this.options.bootnodes.map(async (bootnode) => {
      try {
        await this.connectToPeer(bootnode);
        console.log(`✅ 成功连接引导节点 / Successfully connected to boot node: ${bootnode}`);
      } catch (error) {
        console.warn(`⚠️ 连接引导节点失败 / Failed to connect to boot node ${bootnode}:`, error);
      }
    });
    
    await Promise.allSettled(connectionPromises);
    
    // 更新网络状态 / Update network status
    this.updateNetworkStatus();
  }

  /**
   * 连接到节点 / Connect to peer
   */
  private async connectToPeer(address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const socket = ioClient(address, {
          transports: ['websocket', 'polling'],
          timeout: 10000
        });

        socket.on('connect', () => {
          console.log(`🤝 已连接到节点 / Connected to peer: ${address}`);
          
          // 发送Hello消息 / Send hello message
          const helloMessage: P2PMessage<HelloPayload> = {
            type: 'HELLO',
            payload: {
              id: this.nodeId,
              address: this.getLocalAddress(),
              version: '2.0.0'
            },
            timestamp: Date.now()
          };
          
          socket.emit('message', helloMessage);
          
          // 注册消息处理器 / Register message handlers
          this.registerSocketHandlers(socket, address);
          
          resolve();
        });

        socket.on('connect_error', (error) => {
          console.warn(`❌ 连接节点失败 / Failed to connect to peer ${address}:`, error);
          reject(error);
        });

        socket.on('disconnect', (reason) => {
          console.log(`🔌 节点断开连接 / Peer disconnected ${address}: ${reason}`);
          this.handlePeerDisconnect(address);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 注册Socket处理器 / Register socket handlers
   */
  private registerSocketHandlers(socket: ClientSocket | ServerSocket, knownAddress?: string): void {
    socket.on('message', async (msg: P2PMessage<any>) => {
      try {
        await this.handleIncomingMessage(socket, msg, knownAddress);
      } catch (error) {
        console.error('处理消息时出错 / Error handling message:', error);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket错误 / Socket error:', error);
    });
  }

  /**
   * 处理传入消息 / Handle incoming message
   */
  private async handleIncomingMessage(
    socket: ClientSocket | ServerSocket, 
    msg: P2PMessage<any>, 
    knownAddress?: string
  ): Promise<void> {
    const socketId = socket.id;
    
    // 速率限制检查 / Rate limiting check
    if (!this.checkRateLimit(socketId, msg.type)) {
      console.warn(`⚠️ 速率限制触发 / Rate limit triggered for ${socketId}`);
      return;
    }

    console.log(`📨 收到消息 / Received message: ${msg.type} from ${socketId}`);

    try {
      switch (msg.type) {
        case 'HELLO':
          await this.handleHelloMessage(socket, msg.payload as HelloPayload);
          break;
          
        case 'WELCOME':
          await this.handleWelcomeMessage(socket, msg.payload as HelloPayload);
          break;
          
        case 'BLOCK':
          await this.handleBlockMessage(socket, msg.payload as BlockPayload);
          break;
          
        case 'TRANSACTION':
          await this.handleTransactionMessage(socket, msg.payload as TransactionPayload);
          break;
          
        case 'REQUEST_BLOCKS':
          await this.handleRequestBlocksMessage(socket, msg.payload as RequestBlocksPayload);
          break;
          
        case 'BLOCKS':
          await this.handleBlocksMessage(socket, msg.payload as BlocksPayload);
          break;
          
        case 'SYNC_REQUEST':
          await this.handleSyncRequestMessage(socket, msg.payload);
          break;
          
        case 'SYNC_RESPONSE':
          await this.handleSyncResponseMessage(socket, msg.payload);
          break;
          
        case 'CHAIN_STATUS':
          await this.handleChainStatusMessage(socket, msg.payload);
          break;
          
        case 'PING':
          await this.handlePingMessage(socket);
          break;
          
        case 'PONG':
          await this.handlePongMessage(socket);
          break;
          
        default:
          console.warn(`⚠️ 未知消息类型 / Unknown message type: ${msg.type}`);
      }
    } catch (error) {
      console.error(`❌ 处理消息失败 / Failed to handle message ${msg.type}:`, error);
    }
  }

  /**
   * 处理Hello消息 / Handle hello message
   */
  private async handleHelloMessage(socket: ClientSocket | ServerSocket, payload: HelloPayload): Promise<void> {
    const peerInfo: EnhancedPeerInfo = {
      id: payload.id,
      address: payload.address,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      chainHeight: 0,
      nodeVersion: payload.version || '1.0.0',
      capabilities: [],
      latency: 0,
      reliability: 1.0,
      lastBlockHash: '',
      syncStatus: SyncStatus.IDLE
    };

    this.peers.set(payload.id, { info: peerInfo, socket });
    
    console.log(`👋 节点Hello / Peer hello: ${payload.id} (${payload.address})`);
    
    // 请求链状态 / Request chain status
    await this.requestChainStatus(socket);
    
    // 更新网络状态 / Update network status
    this.updateNetworkStatus();
    
    // 发出节点连接事件 / Emit peer connected event
    this.emit('peerConnected', peerInfo);
  }

  /**
   * 处理Welcome消息 / Handle welcome message
   */
  private async handleWelcomeMessage(socket: ClientSocket | ServerSocket, payload: HelloPayload): Promise<void> {
    await this.handleHelloMessage(socket, payload);
  }

  /**
   * 处理区块消息 / Handle block message
   */
  private async handleBlockMessage(socket: ClientSocket | ServerSocket, payload: BlockPayload): Promise<void> {
    try {
      const block = this.parseBlock(payload.block);
      console.log(`📦 收到区块 / Received block: #${block.number} (${block.hash.substring(0, 10)}...)`);
      
      // 通过区块链处理区块 / Process block through blockchain
      const success = await this.chain.receiveBlock(block);
      
      if (success) {
        console.log(`✅ 区块处理成功 / Block processed successfully: #${block.number}`);
        
        // 广播给其他节点（除了发送者） / Broadcast to other peers (except sender)
        this.broadcastToOthers('BLOCK', payload, socket.id);
        
        // 发出区块接收事件 / Emit block received event
        this.emit('blockReceived', { block, peerId: socket.id });
      } else {
        console.warn(`⚠️ 区块处理失败 / Block processing failed: #${block.number}`);
      }
      
    } catch (error) {
      console.error('❌ 处理区块消息失败 / Failed to handle block message:', error);
    }
  }

  /**
   * 处理交易消息 / Handle transaction message
   */
  private async handleTransactionMessage(socket: ClientSocket | ServerSocket, payload: TransactionPayload): Promise<void> {
    try {
      const tx = this.parseTransaction(payload.tx);
      console.log(`💸 收到交易 / Received transaction: ${tx.hash.substring(0, 10)}...`);
      
      // 添加到交易池 / Add to transaction pool
      const success = await this.chain.addTransaction(tx);
      
      if (success) {
        console.log(`✅ 交易添加成功 / Transaction added successfully: ${tx.hash.substring(0, 10)}...`);
        
        // 广播给其他节点（除了发送者） / Broadcast to other peers (except sender)
        this.broadcastToOthers('TRANSACTION', payload, socket.id);
        
        // 发出交易接收事件 / Emit transaction received event
        this.emit('transactionReceived', { transaction: tx, peerId: socket.id });
      } else {
        console.warn(`⚠️ 交易添加失败 / Transaction addition failed: ${tx.hash.substring(0, 10)}...`);
      }
      
    } catch (error) {
      console.error('❌ 处理交易消息失败 / Failed to handle transaction message:', error);
    }
  }

  /**
   * 处理请求区块消息 / Handle request blocks message
   */
  private async handleRequestBlocksMessage(socket: ClientSocket | ServerSocket, payload: RequestBlocksPayload): Promise<void> {
    try {
      console.log(`📋 收到区块请求 / Received blocks request: ${payload.fromHeight} -> ${payload.toHeight || 'latest'}`);
      
      // 获取请求的区块 / Get requested blocks
      const blocks: Block[] = [];
      const startHeight = payload.fromHeight;
      const endHeight = payload.toHeight || this.chain.getBlockHeight();
      
      for (let height = startHeight; height <= endHeight && blocks.length < this.options.syncBatchSize; height++) {
        const block = this.chain.getBlock(height);
        if (block) {
          blocks.push(block);
        }
      }
      
      // 发送区块响应 / Send blocks response
      const response: P2PMessage<BlocksPayload> = {
        type: 'BLOCKS',
        payload: {
          blocks: blocks.map(block => this.stringifyBigInts(this.normalizeBlock(block)))
        },
        timestamp: Date.now()
      };
      
      socket.emit('message', response);
      
      console.log(`📤 发送区块响应 / Sent blocks response: ${blocks.length} blocks`);
      
    } catch (error) {
      console.error('❌ 处理区块请求失败 / Failed to handle blocks request:', error);
    }
  }

  /**
   * 处理区块响应消息 / Handle blocks message
   */
  private async handleBlocksMessage(socket: ClientSocket | ServerSocket, payload: BlocksPayload): Promise<void> {
    try {
      console.log(`📥 收到区块响应 / Received blocks response: ${payload.blocks.length} blocks`);
      
      // 通过区块同步协议处理 / Process through block sync protocol
      const syncResponse: SyncResponse = {
        blocks: payload.blocks.map(block => this.parseBlock(block)),
        fromHeight: payload.blocks.length > 0 ? payload.blocks[0].number : 0,
        toHeight: payload.blocks.length > 0 ? payload.blocks[payload.blocks.length - 1].number : 0,
        hasMore: payload.blocks.length === this.options.syncBatchSize
      };
      
      await this.blockSync.handleSyncResponse(syncResponse, socket.id);
      
    } catch (error) {
      console.error('❌ 处理区块响应失败 / Failed to handle blocks response:', error);
    }
  }

  /**
   * 处理同步请求消息 / Handle sync request message
   */
  private async handleSyncRequestMessage(socket: ClientSocket | ServerSocket, payload: any): Promise<void> {
    try {
      const response = await this.blockSync.requestSync(payload.fromHeight, payload.toHeight, socket.id);
      
      const syncResponseMessage: P2PMessage<any> = {
        type: 'SYNC_RESPONSE',
        payload: response,
        timestamp: Date.now()
      };
      
      socket.emit('message', syncResponseMessage);
      
    } catch (error) {
      console.error('❌ 处理同步请求失败 / Failed to handle sync request:', error);
    }
  }

  /**
   * 处理同步响应消息 / Handle sync response message
   */
  private async handleSyncResponseMessage(socket: ClientSocket | ServerSocket, payload: any): Promise<void> {
    try {
      await this.blockSync.handleSyncResponse(payload, socket.id);
    } catch (error) {
      console.error('❌ 处理同步响应失败 / Failed to handle sync response:', error);
    }
  }

  /**
   * 处理链状态消息 / Handle chain status message
   */
  private async handleChainStatusMessage(socket: ClientSocket | ServerSocket, payload: any): Promise<void> {
    try {
      // 更新节点信息 / Update peer info
      const peer = Array.from(this.peers.values()).find(p => p.socket.id === socket.id);
      if (peer) {
        peer.info.chainHeight = payload.height;
        peer.info.lastBlockHash = payload.lastBlockHash;
        peer.info.syncStatus = payload.syncStatus;
        peer.info.lastSeen = Date.now();
      }
      
      // 检查是否需要同步 / Check if sync is needed
      if (this.options.enableAutoSync && payload.height > this.chain.getBlockHeight()) {
        await this.requestSync(socket, this.chain.getBlockHeight() + 1, payload.height);
      }
      
    } catch (error) {
      console.error('❌ 处理链状态消息失败 / Failed to handle chain status message:', error);
    }
  }

  /**
   * 处理Ping消息 / Handle ping message
   */
  private async handlePingMessage(socket: ClientSocket | ServerSocket): Promise<void> {
    const pongMessage: P2PMessage<{}> = {
      type: 'PONG',
      payload: {},
      timestamp: Date.now()
    };
    
    socket.emit('message', pongMessage);
  }

  /**
   * 处理Pong消息 / Handle pong message
   */
  private async handlePongMessage(socket: ClientSocket | ServerSocket): Promise<void> {
    // 更新节点延迟 / Update peer latency
    const peer = Array.from(this.peers.values()).find(p => p.socket.id === socket.id);
    if (peer) {
      peer.info.lastSeen = Date.now();
      // 这里可以计算延迟 / Could calculate latency here
    }
  }

  /**
   * 广播区块 / Broadcast block
   */
  broadcastBlock(block: Block): void {
    const message: P2PMessage<BlockPayload> = {
      type: 'BLOCK',
      payload: { block: this.stringifyBigInts(this.normalizeBlock(block)) },
      timestamp: Date.now()
    };
    
    this.broadcastToAll('BLOCK', message.payload);
    console.log(`📡 广播区块 / Broadcasted block: #${block.number}`);
  }

  /**
   * 广播交易 / Broadcast transaction
   */
  broadcastTransaction(tx: Transaction): void {
    const message: P2PMessage<TransactionPayload> = {
      type: 'TRANSACTION',
      payload: { tx: this.stringifyBigInts(this.normalizeTransaction(tx)) },
      timestamp: Date.now()
    };
    
    this.broadcastToAll('TRANSACTION', message.payload);
    console.log(`📡 广播交易 / Broadcasted transaction: ${tx.hash.substring(0, 10)}...`);
  }

  /**
   * 请求同步 / Request sync
   */
  private async requestSync(socket: ClientSocket | ServerSocket, fromHeight: number, toHeight?: number): Promise<void> {
    if (this.syncInProgress) {
      console.log('⚠️ 同步正在进行中 / Sync already in progress');
      return;
    }
    
    this.syncInProgress = true;
    
    try {
      const syncRequest: P2PMessage<any> = {
        type: 'SYNC_REQUEST',
        payload: { fromHeight, toHeight },
        timestamp: Date.now()
      };
      
      socket.emit('message', syncRequest);
      console.log(`🔄 请求同步 / Requested sync: ${fromHeight} -> ${toHeight || 'latest'}`);
      
    } catch (error) {
      console.error('❌ 请求同步失败 / Failed to request sync:', error);
    } finally {
      // 设置超时重置同步状态 / Set timeout to reset sync status
      setTimeout(() => {
        this.syncInProgress = false;
      }, 30000); // 30秒超时 / 30 seconds timeout
    }
  }

  /**
   * 请求链状态 / Request chain status
   */
  private async requestChainStatus(socket: ClientSocket | ServerSocket): Promise<void> {
    const chainStatusMessage: P2PMessage<any> = {
      type: 'CHAIN_STATUS',
      payload: {
        height: this.chain.getBlockHeight(),
        lastBlockHash: this.chain.getLatestBlock()?.hash || '',
        syncStatus: this.blockSync.getSyncStats().status
      },
      timestamp: Date.now()
    };
    
    socket.emit('message', chainStatusMessage);
  }

  /**
   * 广播给所有节点 / Broadcast to all peers
   */
  private broadcastToAll(type: string, payload: any): void {
    const message: P2PMessage<any> = {
      type: type as any,
      payload,
      timestamp: Date.now()
    };
    
    for (const { socket } of this.peers.values()) {
      try {
        socket.emit('message', message);
      } catch (error) {
        console.warn('广播消息失败 / Failed to broadcast message:', error);
      }
    }
  }

  /**
   * 广播给其他节点（除了指定的） / Broadcast to others (except specified)
   */
  private broadcastToOthers(type: string, payload: any, excludeSocketId: string): void {
    const message: P2PMessage<any> = {
      type: type as any,
      payload,
      timestamp: Date.now()
    };
    
    for (const { socket } of this.peers.values()) {
      if (socket.id !== excludeSocketId) {
        try {
          socket.emit('message', message);
        } catch (error) {
          console.warn('广播消息失败 / Failed to broadcast message:', error);
        }
      }
    }
  }

  /**
   * 启动心跳 / Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.options.heartbeatInterval);
  }

  /**
   * 发送心跳 / Send heartbeat
   */
  private sendHeartbeat(): void {
    const pingMessage: P2PMessage<{}> = {
      type: 'PING',
      payload: {},
      timestamp: Date.now()
    };
    
    for (const { socket } of this.peers.values()) {
      try {
        socket.emit('message', pingMessage);
      } catch (error) {
        console.warn('发送心跳失败 / Failed to send heartbeat:', error);
      }
    }
  }

  /**
   * 启动节点发现 / Start peer discovery
   */
  private startPeerDiscovery(): void {
    // 定期请求节点列表 / Periodically request peer list
    setInterval(() => {
      this.discoverPeers();
    }, 60000); // 每分钟 / Every minute
  }

  /**
   * 发现节点 / Discover peers
   */
  private discoverPeers(): void {
    // 实现节点发现逻辑 / Implement peer discovery logic
    console.log('🔍 发现节点 / Discovering peers...');
    // 这里可以实现DHT、DNS发现等机制 / Could implement DHT, DNS discovery, etc.
  }

  /**
   * 启动自动同步 / Start auto sync
   */
  private startAutoSync(): void {
    setInterval(() => {
      this.checkAndSync();
    }, 10000); // 每10秒检查一次 / Check every 10 seconds
  }

  /**
   * 检查并同步 / Check and sync
   */
  private async checkAndSync(): Promise<void> {
    if (this.syncInProgress) return;
    
    const currentHeight = this.chain.getBlockHeight();
    let maxPeerHeight = currentHeight;
    let bestPeer: { socket: ClientSocket | ServerSocket; height: number } | null = null;
    
    // 找到最高的节点 / Find the highest peer
    for (const { info, socket } of this.peers.values()) {
      if (info.chainHeight > maxPeerHeight) {
        maxPeerHeight = info.chainHeight;
        bestPeer = { socket, height: info.chainHeight };
      }
    }
    
    // 如果需要同步 / If sync is needed
    if (bestPeer && maxPeerHeight > currentHeight) {
      console.log(`🔄 自动同步 / Auto sync: ${currentHeight} -> ${maxPeerHeight}`);
      await this.requestSync(bestPeer.socket, currentHeight + 1, maxPeerHeight);
    }
  }

  /**
   * 处理节点断开连接 / Handle peer disconnect
   */
  private handlePeerDisconnect(address: string): void {
    // 从节点列表中移除 / Remove from peer list
    for (const [peerId, peer] of this.peers.entries()) {
      if (peer.info.address === address) {
        this.peers.delete(peerId);
        console.log(`🔌 节点已断开 / Peer disconnected: ${peerId}`);
        
        // 发出节点断开事件 / Emit peer disconnected event
        this.emit('peerDisconnected', peer.info);
        break;
      }
    }
    
    // 更新网络状态 / Update network status
    this.updateNetworkStatus();
    
    // 尝试重连 / Attempt reconnection
    this.scheduleReconnect(address);
  }

  /**
   * 安排重连 / Schedule reconnect
   */
  private scheduleReconnect(address: string): void {
    setTimeout(async () => {
      try {
        console.log(`🔄 尝试重连节点 / Attempting to reconnect to peer: ${address}`);
        await this.connectToPeer(address);
      } catch (error) {
        console.warn(`⚠️ 重连失败 / Reconnection failed for ${address}:`, error);
      }
    }, this.options.reconnectInterval);
  }

  /**
   * 更新网络状态 / Update network status
   */
  private updateNetworkStatus(): void {
    this.networkStatus.connectedPeers = this.peers.size;
    this.networkStatus.totalPeers = this.peers.size + this.options.bootnodes.length;
    
    // 计算网络高度 / Calculate network height
    let maxHeight = this.chain.getBlockHeight();
    for (const { info } of this.peers.values()) {
      if (info.chainHeight > maxHeight) {
        maxHeight = info.chainHeight;
      }
    }
    this.networkStatus.networkHeight = maxHeight;
    
    // 计算同步进度 / Calculate sync progress
    const currentHeight = this.chain.getBlockHeight();
    this.networkStatus.syncProgress = maxHeight > 0 ? currentHeight / maxHeight : 1;
    
    // 检查网络健康状态 / Check network health
    this.networkStatus.isHealthy = this.peers.size > 0 && this.networkStatus.syncProgress > 0.9;
    
    // 发出网络状态更新事件 / Emit network status update event
    this.emit('networkStatusUpdated', this.networkStatus);
  }

  /**
   * 设置区块同步事件监听 / Setup block sync event listeners
   */
  private setupBlockSyncListeners(): void {
    this.blockSync.on('statusChanged', (event) => {
      console.log(`🔄 同步状态变化 / Sync status changed: ${event.oldStatus} -> ${event.newStatus}`);
    });
    
    this.blockSync.on('blockSynced', (event) => {
      console.log(`✅ 区块同步完成 / Block synced: #${event.block.number}`);
    });
    
    this.blockSync.on('forkResolved', (event) => {
      console.log(`🔀 分叉已解决 / Fork resolved: ${event.resolution} at height #${event.conflict.height}`);
    });
  }

  /**
   * 速率限制检查 / Rate limit check
   */
  private checkRateLimit(socketId: string, messageType: string): boolean {
    const now = Date.now();
    let bucket = this.rateLimits.get(socketId);
    
    if (!bucket || now - bucket.windowStart > EnhancedP2PNode.RATE_LIMIT_WINDOW_MS) {
      bucket = { windowStart: now, blockCount: 0, txCount: 0 };
      this.rateLimits.set(socketId, bucket);
    }
    
    if (messageType === 'BLOCK') {
      if (bucket.blockCount >= EnhancedP2PNode.MAX_BLOCKS_PER_WINDOW) {
        return false;
      }
      bucket.blockCount++;
    } else if (messageType === 'TRANSACTION') {
      if (bucket.txCount >= EnhancedP2PNode.MAX_TX_PER_WINDOW) {
        return false;
      }
      bucket.txCount++;
    }
    
    return true;
  }

  /**
   * 获取本地地址 / Get local address
   */
  private getLocalAddress(): string {
    return `http://${this.options.host}:${this.options.port}`;
  }

  /**
   * 解析区块 / Parse block
   */
  private parseBlock(block: any): Block {
    return {
      ...block,
      number: Number(block.number),
      timestamp: Number(block.timestamp),
      gasLimit: BigInt(block.gasLimit || 0),
      gasUsed: BigInt(block.gasUsed || 0),
      transactions: block.transactions.map((tx: any) => this.parseTransaction(tx))
    };
  }

  /**
   * 解析交易 / Parse transaction
   */
  private parseTransaction(tx: any): Transaction {
    return {
      ...tx,
      nonce: Number(tx.nonce),
      gasLimit: BigInt(tx.gasLimit || 0),
      gasPrice: BigInt(tx.gasPrice || 0),
      value: BigInt(tx.value || 0)
    };
  }

  /**
   * 标准化区块 / Normalize block
   */
  private normalizeBlock(block: Block): any {
    return {
      ...block,
      gasLimit: block.gasLimit.toString(),
      gasUsed: block.gasUsed.toString(),
      transactions: block.transactions.map(tx => this.normalizeTransaction(tx))
    };
  }

  /**
   * 标准化交易 / Normalize transaction
   */
  private normalizeTransaction(tx: Transaction): any {
    return {
      ...tx,
      gasLimit: tx.gasLimit.toString(),
      gasPrice: tx.gasPrice.toString(),
      value: tx.value.toString()
    };
  }

  /**
   * 字符串化BigInt / Stringify BigInts
   */
  private stringifyBigInts(obj: any): any {
    if (typeof obj === 'bigint') {
      return obj.toString();
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.stringifyBigInts(item));
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.stringifyBigInts(value);
      }
      return result;
    }
    return obj;
  }

  // 公共方法 / Public methods

  /**
   * 获取节点列表 / Get peers
   */
  getPeers(): EnhancedPeerInfo[] {
    return Array.from(this.peers.values()).map(p => p.info);
  }

  /**
   * 获取网络状态 / Get network status
   */
  getNetworkStatus(): NetworkStatus {
    return { ...this.networkStatus };
  }

  /**
   * 获取节点ID / Get node ID
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * 检查是否已连接 / Check if connected
   */
  isConnected(): boolean {
    return this.peers.size > 0;
  }

  /**
   * 手动触发同步 / Manually trigger sync
   */
  async triggerSync(): Promise<void> {
    await this.checkAndSync();
  }
}