import { BatchCommit, Transaction } from '../../shared/types/blockchain.js';
import { OrderBook } from './order-book.js';
import { CIDDistributor } from './cid-distributor.js';
import { casClient, BatchData } from '../../shared/da/cas-client.js';
import { computeMerkleRoot } from '../../shared/utils/merkle.js';

/**
 * 订单类型定义
 */
export interface Order {
  id: string;
  symbol: string; // 交易对，如 "BTC/USDT"
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  price: string; // 价格（字符串避免精度问题）
  quantity: string; // 数量
  account: string; // 账户地址
  timestamp: number;
  nonce: number;
  signature?: string;
}

/**
 * 撮合结果
 */
export interface MatchResult {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  price: string;
  quantity: string;
  timestamp: number;
  buyAccount: string;
  sellAccount: string;
}

/**
 * 余额变化记录
 */
export interface BalanceDiff {
  account: string;
  asset: string;
  change: string; // 正数为增加，负数为减少
  reason: 'trade' | 'fee' | 'refund';
  relatedOrderId?: string;
  relatedMatchId?: string;
}

/**
 * 审计日志
 */
export interface AuditLog {
  timestamp: number;
  action: string;
  details: any;
  hash: string;
}

/**
 * 验证节点链下撮合引擎
 * 实现高频撮合、订单簿管理、批次生成和CID分发
 */
export class MatchingEngine {
  private orderBooks: Map<string, OrderBook> = new Map();
  private pendingOrders: Map<string, Order> = new Map();
  private matchResults: MatchResult[] = [];
  private balanceDiffs: BalanceDiff[] = [];
  private auditLogs: AuditLog[] = [];
  private cidDistributor: CIDDistributor;
  private isProcessing = false;
  private batchInterval: NodeJS.Timeout | null = null;
  
  // 配置参数
  private readonly BATCH_INTERVAL_MS = 100; // 100ms微批间隔
  private readonly MAX_ORDERS_PER_BATCH = 1000;
  private readonly MAX_MATCHES_PER_BATCH = 500;
  
  constructor() {
    this.cidDistributor = new CIDDistributor();
    this.startBatchProcessing();
    console.log('MatchingEngine initialized with 100ms batch interval');
  }

  /**
   * 启动批次处理
   */
  private startBatchProcessing(): void {
    this.batchInterval = setInterval(() => {
      this.processBatch().catch(error => {
        console.error('Batch processing error:', error);
      });
    }, this.BATCH_INTERVAL_MS);
  }

  /**
   * 停止批次处理
   */
  public stopBatchProcessing(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }

  /**
   * 添加订单到撮合引擎
   */
  public async addOrder(order: Order): Promise<void> {
    try {
      // 验证订单格式
      this.validateOrder(order);
      
      // 添加到待处理订单
      this.pendingOrders.set(order.id, order);
      
      // 记录审计日志
      this.addAuditLog('ORDER_SUBMITTED', {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        price: order.price,
        quantity: order.quantity,
        account: order.account
      });
      
      console.log(`Order added: ${order.id} - ${order.side} ${order.quantity} ${order.symbol} @ ${order.price}`);
    } catch (error) {
      console.error('Failed to add order:', error);
      throw error;
    }
  }

  /**
   * 取消订单
   */
  public async cancelOrder(orderId: string, account: string): Promise<void> {
    const order = this.pendingOrders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    
    if (order.account !== account) {
      throw new Error('Unauthorized to cancel this order');
    }
    
    // 从待处理订单中移除
    this.pendingOrders.delete(orderId);
    
    // 从订单簿中移除
    const orderBook = this.getOrCreateOrderBook(order.symbol);
    orderBook.removeOrder(orderId);
    
    // 记录审计日志
    this.addAuditLog('ORDER_CANCELLED', {
      orderId,
      account,
      reason: 'user_cancellation'
    });
    
    console.log(`Order cancelled: ${orderId}`);
  }

  /**
   * 处理批次撮合
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.pendingOrders.size === 0) {
      return;
    }
    
    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      // 获取当前批次的订单
      const batchOrders = Array.from(this.pendingOrders.values())
        .slice(0, this.MAX_ORDERS_PER_BATCH);
      
      if (batchOrders.length === 0) {
        return;
      }
      
      // 清空当前批次数据
      this.matchResults = [];
      this.balanceDiffs = [];
      
      // 按交易对分组处理订单
      const ordersBySymbol = this.groupOrdersBySymbol(batchOrders);
      
      for (const [symbol, orders] of ordersBySymbol) {
        await this.processOrdersForSymbol(symbol, orders);
      }
      
      // 生成批次承诺
      if (this.matchResults.length > 0) {
        const batchCommit = await this.generateBatchCommit(batchOrders);
        await this.distributeBatchCommit(batchCommit);
      }
      
      // 清理已处理的订单
      for (const order of batchOrders) {
        this.pendingOrders.delete(order.id);
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`Batch processed: ${batchOrders.length} orders, ${this.matchResults.length} matches in ${processingTime}ms`);
      
    } catch (error) {
      console.error('Batch processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 按交易对分组订单
   */
  private groupOrdersBySymbol(orders: Order[]): Map<string, Order[]> {
    const grouped = new Map<string, Order[]>();
    
    for (const order of orders) {
      if (!grouped.has(order.symbol)) {
        grouped.set(order.symbol, []);
      }
      grouped.get(order.symbol)!.push(order);
    }
    
    return grouped;
  }

  /**
   * 处理特定交易对的订单
   */
  private async processOrdersForSymbol(symbol: string, orders: Order[]): Promise<void> {
    const orderBook = this.getOrCreateOrderBook(symbol);
    
    // 将订单添加到订单簿
    for (const order of orders) {
      orderBook.addOrder(order);
    }
    
    // 执行撮合
    const matches = orderBook.matchOrders();
    
    // 处理撮合结果
    for (const match of matches) {
      if (this.matchResults.length >= this.MAX_MATCHES_PER_BATCH) {
        break;
      }
      
      this.matchResults.push(match);
      this.processMatchResult(match);
    }
  }

  /**
   * 处理撮合结果，生成余额变化
   */
  private processMatchResult(match: MatchResult): void {
    const [baseAsset, quoteAsset] = match.buyOrderId.split('/')[0].split('/');
    const tradeValue = parseFloat(match.price) * parseFloat(match.quantity);
    
    // 买方余额变化
    this.balanceDiffs.push({
      account: match.buyAccount,
      asset: baseAsset,
      change: match.quantity,
      reason: 'trade',
      relatedMatchId: match.id
    });
    
    this.balanceDiffs.push({
      account: match.buyAccount,
      asset: quoteAsset,
      change: (-tradeValue).toString(),
      reason: 'trade',
      relatedMatchId: match.id
    });
    
    // 卖方余额变化
    this.balanceDiffs.push({
      account: match.sellAccount,
      asset: baseAsset,
      change: (-parseFloat(match.quantity)).toString(),
      reason: 'trade',
      relatedMatchId: match.id
    });
    
    this.balanceDiffs.push({
      account: match.sellAccount,
      asset: quoteAsset,
      change: tradeValue.toString(),
      reason: 'trade',
      relatedMatchId: match.id
    });
    
    // 记录审计日志
    this.addAuditLog('TRADE_EXECUTED', {
      matchId: match.id,
      buyOrderId: match.buyOrderId,
      sellOrderId: match.sellOrderId,
      price: match.price,
      quantity: match.quantity,
      tradeValue
    });
  }

  /**
   * 生成批次承诺
   */
  private async generateBatchCommit(orders: Order[]): Promise<BatchCommit> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 准备批次数据
    const batchData: BatchData = {
      orders: orders,
      matches: this.matchResults,
      balanceDiffs: this.balanceDiffs,
      auditLog: this.auditLogs
    };
    
    // 计算Merkle根
    const ordersRoot = computeMerkleRoot(orders.map(o => JSON.stringify(o)));
    const matchesRoot = computeMerkleRoot(this.matchResults.map(m => JSON.stringify(m)));
    const balanceDiffsRoot = computeMerkleRoot(this.balanceDiffs.map(d => JSON.stringify(d)));
    const auditLogRoot = computeMerkleRoot(this.auditLogs.map(l => JSON.stringify(l)));
    
    // 生成CID
    const cid = `Qm${Math.random().toString(36).substr(2, 44)}`;
    
    // 存储到CAS
    casClient.put(cid, batchData);
    
    const batchCommit: BatchCommit = {
      batchId,
      producerId: 'matching-engine-1',
      timestamp: Date.now(),
      ordersRoot,
      matchesRoot,
      balanceDiffsRoot,
      auditLogRoot,
      cid,
      recipeVersion: 1
    };
    
    console.log(`BatchCommit generated: ${batchId} with CID: ${cid}`);
    return batchCommit;
  }

  /**
   * 分发批次承诺
   */
  private async distributeBatchCommit(batchCommit: BatchCommit): Promise<void> {
    try {
      await this.cidDistributor.distribute(batchCommit.cid!, batchCommit);
      console.log(`BatchCommit distributed: ${batchCommit.batchId}`);
    } catch (error) {
      console.error('Failed to distribute batch commit:', error);
      throw error;
    }
  }

  /**
   * 获取或创建订单簿
   */
  private getOrCreateOrderBook(symbol: string): OrderBook {
    if (!this.orderBooks.has(symbol)) {
      this.orderBooks.set(symbol, new OrderBook(symbol));
    }
    return this.orderBooks.get(symbol)!;
  }

  /**
   * 验证订单格式
   */
  private validateOrder(order: Order): void {
    if (!order.id || !order.symbol || !order.side || !order.type || !order.price || !order.quantity || !order.account) {
      throw new Error('Invalid order format: missing required fields');
    }
    
    if (order.side !== 'buy' && order.side !== 'sell') {
      throw new Error('Invalid order side: must be buy or sell');
    }
    
    if (order.type !== 'market' && order.type !== 'limit') {
      throw new Error('Invalid order type: must be market or limit');
    }
    
    if (parseFloat(order.price) <= 0 || parseFloat(order.quantity) <= 0) {
      throw new Error('Invalid order: price and quantity must be positive');
    }
  }

  /**
   * 添加审计日志
   */
  private addAuditLog(action: string, details: any): void {
    const log: AuditLog = {
      timestamp: Date.now(),
      action,
      details,
      hash: this.calculateLogHash(action, details)
    };
    
    this.auditLogs.push(log);
  }

  /**
   * 计算日志哈希
   */
  private calculateLogHash(action: string, details: any): string {
    const data = JSON.stringify({ action, details, timestamp: Date.now() });
    // 简化的哈希计算，生产环境应使用加密哈希
    return computeMerkleRoot([data]);
  }

  /**
   * 获取订单簿深度
   */
  public getOrderBookDepth(symbol: string, depth: number = 10): any {
    const orderBook = this.orderBooks.get(symbol);
    if (!orderBook) {
      return { bids: [], asks: [] };
    }
    
    return orderBook.getDepth(depth);
  }

  /**
   * 获取撮合引擎统计信息
   */
  public getStats(): any {
    return {
      pendingOrders: this.pendingOrders.size,
      activeOrderBooks: this.orderBooks.size,
      totalMatches: this.matchResults.length,
      totalBalanceDiffs: this.balanceDiffs.length,
      auditLogEntries: this.auditLogs.length,
      batchInterval: this.BATCH_INTERVAL_MS,
      isProcessing: this.isProcessing
    };
  }

  /**
   * 获取当前批次的撮合结果
   */
  getCurrentBatchResults(): {
    matches: MatchResult[];
    balanceDiffs: BalanceDiff[];
    auditLogs: AuditLog[];
  } {
    return {
      matches: [...this.matchResults],
      balanceDiffs: [...this.balanceDiffs],
      auditLogs: [...this.auditLogs]
    };
  }

  /**
   * 清空当前批次结果（在批次完成后调用）
   */
  clearCurrentBatchResults(): void {
    this.matchResults = [];
    this.balanceDiffs = [];
    this.auditLogs = [];
  }

  /**
   * 手动触发批次处理
   */
  async processPendingOrders(): Promise<void> {
    if (this.isProcessing || this.pendingOrders.size === 0) {
      return;
    }

    await this.processBatch();
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stopBatchProcessing();
    this.orderBooks.clear();
    this.pendingOrders.clear();
    this.matchResults = [];
    this.balanceDiffs = [];
    this.auditLogs = [];
    console.log('MatchingEngine cleaned up');
  }
}