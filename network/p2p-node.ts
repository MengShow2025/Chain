import http from 'http';
import { Server as IOServer, Socket as ServerSocket } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import crypto from 'crypto';
import { TitanChain } from '../blockchain/core/blockchain.js';
import type {
  P2PMessage,
  PeerInfo,
  HelloPayload,
  BlockPayload,
  TransactionPayload,
  RequestBlocksPayload,
  BlocksPayload
} from '../shared/types/p2p.js';

interface P2POptions {
  port?: number; // local P2P port
  host?: string; // local host
  bootnodes?: string[]; // array of ws urls like http://host:port
}

export class P2PNode {
  private chain: TitanChain;
  private server?: IOServer;
  private httpServer?: http.Server;
  private peers: Map<string, { info: PeerInfo; socket: ClientSocket | ServerSocket }>; // id -> peer
  private nodeId: string;
  private options: Required<P2POptions>;
  private lastBroadcastBlockHash: string | null = null;
  private blockBroadcastInterval?: NodeJS.Timeout;
  private rateLimits: Map<string, { windowStart: number; blockCount: number; txCount: number }> = new Map();

  private static readonly RATE_LIMIT_WINDOW_MS = 60_000; // 1分钟窗口
  private static readonly MAX_BLOCKS_PER_WINDOW = 60; // 每分钟最多60块
  private static readonly MAX_TX_PER_WINDOW = 2000; // 每分钟最多2000笔交易

  constructor(chain: TitanChain, options?: P2POptions) {
    this.chain = chain;
    this.peers = new Map();
    this.nodeId = process.env.NODE_ID || crypto.randomUUID();
    this.options = {
      port: options?.port ?? Number(process.env.P2P_PORT || 4001),
      host: options?.host ?? (process.env.P2P_HOST || '0.0.0.0'),
      bootnodes: options?.bootnodes ?? parseBootnodes(process.env.BOOTNODES)
    };
  }

  async start(): Promise<void> {
    await this.startServer();
    await this.connectBootnodes();
    this.startBlockPollingBroadcast();
    console.log(`🕸️ P2P Node started: ${this.getLocalAddress()}`);
  }

  async stop(): Promise<void> {
    if (this.blockBroadcastInterval) {
      clearInterval(this.blockBroadcastInterval);
      this.blockBroadcastInterval = undefined;
    }
    for (const { socket } of this.peers.values()) {
      try { socket.disconnect(); } catch {}
    }
    this.peers.clear();
    if (this.server) {
      await this.server.close();
      this.server = undefined;
    }
    if (this.httpServer) {
      await new Promise<void>((resolve) => this.httpServer?.close(() => resolve()));
      this.httpServer = undefined;
    }
  }

  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values()).map(p => p.info);
  }

  broadcastBlock(block: any): void {
    const message: P2PMessage<BlockPayload> = {
      type: 'BLOCK',
      payload: { block: stringifyBigInts(normalizeBlock(block)) },
      timestamp: Date.now()
    };
    for (const { socket } of this.peers.values()) {
      socket.emit('message', message);
    }
  }

  broadcastTransaction(tx: any): void {
    const message: P2PMessage<TransactionPayload> = {
      type: 'TRANSACTION',
      payload: { tx: stringifyBigInts(normalizeTransaction(tx)) },
      timestamp: Date.now()
    };
    for (const { socket } of this.peers.values()) {
      socket.emit('message', message);
    }
  }

  private async startServer(): Promise<void> {
    this.httpServer = http.createServer();
    this.server = new IOServer(this.httpServer, {
      cors: { origin: '*', methods: ['GET','POST'] }
    });

    this.server.on('connection', (socket: ServerSocket) => {
      // Expect HELLO message
      socket.on('message', async (msg: P2PMessage<any>) => {
        try {
          await this.handleIncomingMessage(socket, msg);
        } catch (e) {
          console.error('P2P message handling error:', e);
        }
      });

      // heartbeat
      socket.on('disconnect', () => {
        for (const [id, peer] of this.peers) {
          if (peer.socket.id === socket.id) {
            this.peers.delete(id);
            break;
          }
        }
      });
    });

    await new Promise<void>((resolve) => this.httpServer!.listen(this.options.port, this.options.host, () => resolve()));
  }

  private async connectBootnodes(): Promise<void> {
    for (const address of this.options.bootnodes) {
      try {
        const socket = ioClient(address, { transports: ['websocket'], reconnection: true, reconnectionDelay: 2000 });
        this.registerClientHandlers(socket, address);
        const hello: P2PMessage<HelloPayload> = {
          type: 'HELLO',
          payload: { id: this.nodeId, address: this.getLocalAddress(), version: '0.1.0' },
          timestamp: Date.now()
        };
        socket.emit('message', hello);
        console.log(`🔗 Connecting bootnode ${address}`);
      } catch (e) {
        console.warn(`Failed to connect bootnode ${address}:`, e);
      }
    }
  }

  private registerClientHandlers(socket: ClientSocket, address: string): void {
    socket.on('message', async (msg: P2PMessage<any>) => {
      try {
        await this.handleIncomingMessage(socket, msg, address);
      } catch (e) {
        console.error('P2P client message handling error:', e);
      }
    });

    socket.on('connect', () => {
      console.log(`✅ Connected to peer ${address}`);
      // 初始同步：请求从当前高度+1开始的区块到对方最新高度
      try {
        const req: P2PMessage<RequestBlocksPayload> = {
          type: 'REQUEST_BLOCKS',
          payload: { fromHeight: this.chain.getBlockHeight() + 1 },
          timestamp: Date.now()
        };
        socket.emit('message', req);
      } catch (e) {
        console.warn('Failed to request initial blocks:', e);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Disconnected from peer ${address}`);
      for (const [id, peer] of this.peers) {
        if (peer.socket.id === socket.id) {
          this.peers.delete(id);
          break;
        }
      }
    });
  }

  private async handleIncomingMessage(socket: ClientSocket | ServerSocket, msg: P2PMessage<any>, knownAddress?: string): Promise<void> {
    // 简单速率限制：按socket维度统计
    const sid = (socket as any).id || 'unknown';
    const now = Date.now();
    const bucket = this.ensureRateBucket(sid, now);

    switch (msg.type) {
      case 'HELLO': {
        const payload = msg.payload as HelloPayload;
        const address = payload.address || knownAddress || `peer:${socket.id}`;

        this.peers.set(payload.id, {
          info: { id: payload.id, address, connectedAt: Date.now(), lastSeen: Date.now() },
          socket
        });

        // respond with WELCOME and current peers
        const welcome: P2PMessage<HelloPayload> = {
          type: 'WELCOME',
          payload: { id: this.nodeId, address: this.getLocalAddress(), version: '0.1.0' },
          timestamp: Date.now()
        };
        socket.emit('message', welcome);

        const peersMsg: P2PMessage<PeerInfo[]> = {
          type: 'PEERS',
          payload: this.getPeers(),
          timestamp: Date.now()
        };
        socket.emit('message', peersMsg);
        break;
      }

      case 'PEERS': {
        // Optionally connect to new peers from list
        const peers = msg.payload as PeerInfo[];
        for (const p of peers) {
          if (!this.peers.has(p.id) && !this.isSelf(p)) {
            try {
              const s = ioClient(p.address, { transports: ['websocket'], reconnection: true });
              this.registerClientHandlers(s, p.address);
              const hello: P2PMessage<HelloPayload> = {
                type: 'HELLO',
                payload: { id: this.nodeId, address: this.getLocalAddress(), version: '0.1.0' },
                timestamp: Date.now()
              };
              s.emit('message', hello);
            } catch (e) {
              console.warn('Failed to auto-connect peer', p.address, e);
            }
          }
        }
        break;
      }

      case 'BLOCK': {
        // 速率限制：区块消息
        if (now - bucket.windowStart > P2PNode.RATE_LIMIT_WINDOW_MS) {
          bucket.windowStart = now;
          bucket.blockCount = 0;
        }
        bucket.blockCount++;
        if (bucket.blockCount > P2PNode.MAX_BLOCKS_PER_WINDOW) {
          console.warn(`Rate limit exceeded for BLOCK from ${sid}. Dropping message.`);
          return;
        }
        const payload = msg.payload as BlockPayload;
        // Delegate to chain to validate and append
        try {
          const incoming = parseBlock(payload.block);
          const ok = await (this.chain as any).receiveBlock?.(incoming);
          if (!ok) {
            console.warn('Received block rejected');
          }
        } catch (e) {
          console.error('Error applying received block:', e);
        }
        break;
      }

      case 'TRANSACTION': {
        // 速率限制：交易消息
        if (now - bucket.windowStart > P2PNode.RATE_LIMIT_WINDOW_MS) {
          bucket.windowStart = now;
          bucket.txCount = 0;
        }
        bucket.txCount++;
        if (bucket.txCount > P2PNode.MAX_TX_PER_WINDOW) {
          console.warn(`Rate limit exceeded for TRANSACTION from ${sid}. Dropping message.`);
          return;
        }
        const payload = msg.payload as TransactionPayload;
        try {
          const incomingTx = parseTransaction(payload.tx);
          await this.chain.submitTransaction(incomingTx);
        } catch (e) {
          console.error('Error applying received transaction:', e);
        }
        break;
      }

      case 'REQUEST_BLOCKS': {
        const payload = msg.payload as RequestBlocksPayload;
        const blocks: any[] = [];
        const from = Math.max(0, payload.fromHeight);
        const to = typeof payload.toHeight === 'number' ? payload.toHeight : this.chain.getBlockHeight();
        for (let h = from; h <= to; h++) {
          const b = this.chain.getBlock(h);
          if (b) blocks.push(stringifyBigInts(normalizeBlock(b)));
        }
        const resp: P2PMessage<BlocksPayload> = { type: 'BLOCKS', payload: { blocks }, timestamp: Date.now() };
        socket.emit('message', resp);
        break;
      }

      case 'BLOCKS': {
        const payload = msg.payload as BlocksPayload;
        const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
        for (const b of blocks) {
          try {
            const ok = await (this.chain as any).receiveBlock?.(parseBlock(b));
            if (!ok) {
              console.warn('Initial sync block rejected');
            }
          } catch (e) {
            console.error('Error applying sync block:', e);
          }
        }
        break;
      }

      case 'PING': {
        const pong: P2PMessage<null> = { type: 'PONG', payload: null, timestamp: Date.now() };
        socket.emit('message', pong);
        break;
      }

      default:
        break;
    }
  }

  private ensureRateBucket(sid: string, now: number) {
    let bucket = this.rateLimits.get(sid);
    if (!bucket) {
      bucket = { windowStart: now, blockCount: 0, txCount: 0 };
      this.rateLimits.set(sid, bucket);
    }
    // 若窗口过期，重置计数
    if (now - bucket.windowStart > P2PNode.RATE_LIMIT_WINDOW_MS * 2) {
      bucket.windowStart = now;
      bucket.blockCount = 0;
      bucket.txCount = 0;
    }
    return bucket;
  }

  private startBlockPollingBroadcast(): void {
    this.blockBroadcastInterval = setInterval(() => {
      try {
        const latest = this.chain.getLatestBlock();
        if (!latest) return;
        if (latest.hash !== this.lastBroadcastBlockHash) {
          this.broadcastBlock(latest);
          this.lastBroadcastBlockHash = latest.hash;
        }
      } catch (e) {
        console.warn('Block polling broadcast error:', e);
      }
    }, 1000);
  }

  private getLocalAddress(): string {
    const host = process.env.P2P_PUBLIC_HOST || this.options.host;
    const port = this.options.port;
    const protocol = (process.env.P2P_PROTOCOL || 'http').toLowerCase();
    return `${protocol}://${host}:${port}`;
  }

  private isSelf(p: PeerInfo): boolean {
    return p.id === this.nodeId || p.address === this.getLocalAddress();
  }
}

function parseBootnodes(env?: string): string[] {
  if (!env) return [];
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

// --- 序列化与反序列化辅助函数，解决BigInt无法JSON序列化问题 ---
function stringifyBigInts(obj: any): any {
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map((v) => stringifyBigInts(v));
  if (obj && typeof obj === 'object') {
    const res: any = {};
    for (const k of Object.keys(obj)) {
      res[k] = stringifyBigInts(obj[k]);
    }
    return res;
  }
  return obj;
}

function normalizeBlock(block: any): any {
  if (!block) return block;
  const b = { ...block };
  // 顶层BigInt字段转字符串
  if (typeof b.gasUsed === 'bigint') b.gasUsed = b.gasUsed.toString();
  if (typeof b.gasLimit === 'bigint') b.gasLimit = b.gasLimit.toString();
  if (typeof b.difficulty === 'bigint') b.difficulty = b.difficulty.toString();
  if (typeof b.reward === 'bigint') b.reward = b.reward.toString();
  // 交易列表处理
  if (Array.isArray(b.transactions)) {
    b.transactions = b.transactions.map((tx: any) => normalizeTransaction(tx));
  }
  return b;
}

function normalizeTransaction(tx: any): any {
  if (!tx) return tx;
  const t = { ...tx };
  if (typeof t.value === 'bigint') t.value = t.value.toString();
  if (typeof t.gas === 'bigint') t.gas = t.gas.toString();
  if (typeof t.gasPrice === 'bigint') t.gasPrice = t.gasPrice.toString();
  if (t.exchangeBatch && typeof t.exchangeBatch.totalVolume === 'bigint') {
    t.exchangeBatch = { ...t.exchangeBatch, totalVolume: t.exchangeBatch.totalVolume.toString() };
  }
  return t;
}

function parseBlock(block: any): any {
  if (!block) return block;
  const b = { ...block };
  const toBigInt = (v: any) => (typeof v === 'string' ? BigInt(v) : v);
  b.gasUsed = toBigInt(b.gasUsed);
  b.gasLimit = toBigInt(b.gasLimit);
  b.difficulty = toBigInt(b.difficulty);
  b.reward = toBigInt(b.reward);
  if (Array.isArray(b.transactions)) {
    b.transactions = b.transactions.map((tx: any) => parseTransaction(tx));
  }
  return b;
}

function parseTransaction(tx: any): any {
  if (!tx) return tx;
  const t = { ...tx };
  const toBigInt = (v: any) => (typeof v === 'string' ? BigInt(v) : v);
  t.value = toBigInt(t.value);
  t.gas = toBigInt(t.gas);
  t.gasPrice = toBigInt(t.gasPrice);
  if (t.exchangeBatch && typeof t.exchangeBatch.totalVolume === 'string') {
    t.exchangeBatch = { ...t.exchangeBatch, totalVolume: BigInt(t.exchangeBatch.totalVolume) };
  }
  return t;
}