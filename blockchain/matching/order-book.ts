import { Order, MatchResult } from './matching-engine.js';

/**
 * 订单簿条目
 */
interface OrderBookEntry {
  price: string;
  quantity: string;
  orders: Order[];
  totalQuantity: string;
}

/**
 * 订单簿深度数据
 */
export interface OrderBookDepth {
  bids: Array<{ price: string; quantity: string; count: number }>;
  asks: Array<{ price: string; quantity: string; count: number }>;
  lastUpdate: number;
}

/**
 * 高性能订单簿实现
 * 支持快速撮合和深度查询
 */
export class OrderBook {
  private symbol: string;
  private bids: Map<string, OrderBookEntry> = new Map(); // 买单，价格从高到低
  private asks: Map<string, OrderBookEntry> = new Map(); // 卖单，价格从低到高
  private orderIndex: Map<string, Order> = new Map(); // 订单索引
  private lastUpdate: number = Date.now();
  
  constructor(symbol: string) {
    this.symbol = symbol;
    console.log(`OrderBook created for symbol: ${symbol}`);
  }

  /**
   * 添加订单到订单簿
   */
  public addOrder(order: Order): void {
    try {
      // 添加到订单索引
      this.orderIndex.set(order.id, order);
      
      // 根据订单类型处理
      if (order.type === 'market') {
        // 市价单立即执行
        this.executeMarketOrder(order);
      } else {
        // 限价单添加到订单簿
        this.addLimitOrder(order);
      }
      
      this.lastUpdate = Date.now();
    } catch (error) {
      console.error(`Failed to add order ${order.id}:`, error);
      throw error;
    }
  }

  /**
   * 移除订单
   */
  public removeOrder(orderId: string): boolean {
    const order = this.orderIndex.get(orderId);
    if (!order) {
      return false;
    }
    
    const priceLevel = order.side === 'buy' ? this.bids : this.asks;
    const entry = priceLevel.get(order.price);
    
    if (entry) {
      // 从价格层级中移除订单
      entry.orders = entry.orders.filter(o => o.id !== orderId);
      
      // 重新计算总量
      if (entry.orders.length === 0) {
        priceLevel.delete(order.price);
      } else {
        entry.totalQuantity = entry.orders.reduce(
          (sum, o) => (parseFloat(sum) + parseFloat(o.quantity)).toString(),
          '0'
        );
      }
    }
    
    // 从订单索引中移除
    this.orderIndex.delete(orderId);
    this.lastUpdate = Date.now();
    
    return true;
  }

  /**
   * 执行撮合
   */
  public matchOrders(): MatchResult[] {
    const matches: MatchResult[] = [];
    
    try {
      // 获取最优买卖价格
      const bestBid = this.getBestBid();
      const bestAsk = this.getBestAsk();
      
      // 检查是否可以撮合
      while (bestBid && bestAsk && parseFloat(bestBid.price) >= parseFloat(bestAsk.price)) {
        const match = this.executeMatch(bestBid, bestAsk);
        if (match) {
          matches.push(match);
        } else {
          break; // 无法继续撮合
        }
      }
      
      this.lastUpdate = Date.now();
      return matches;
    } catch (error) {
      console.error('Order matching failed:', error);
      return matches;
    }
  }

  /**
   * 添加限价单
   */
  private addLimitOrder(order: Order): void {
    const priceLevel = order.side === 'buy' ? this.bids : this.asks;
    
    if (!priceLevel.has(order.price)) {
      priceLevel.set(order.price, {
        price: order.price,
        quantity: order.quantity,
        orders: [order],
        totalQuantity: order.quantity
      });
    } else {
      const entry = priceLevel.get(order.price)!;
      entry.orders.push(order);
      entry.totalQuantity = (parseFloat(entry.totalQuantity) + parseFloat(order.quantity)).toString();
    }
  }

  /**
   * 执行市价单
   */
  private executeMarketOrder(order: Order): void {
    // 市价单逻辑：立即与最优价格撮合
    // 这里简化处理，实际应该遍历订单簿直到完全成交或无法成交
    const oppositeBook = order.side === 'buy' ? this.asks : this.bids;
    
    if (oppositeBook.size === 0) {
      console.warn(`No liquidity for market order ${order.id}`);
      return;
    }
    
    // 获取最优价格
    const bestPrice = order.side === 'buy' ? this.getBestAsk() : this.getBestBid();
    if (bestPrice) {
      // 将市价单转换为限价单进行处理
      order.price = bestPrice.price;
      order.type = 'limit';
      this.addLimitOrder(order);
    }
  }

  /**
   * 执行撮合
   */
  private executeMatch(bidEntry: OrderBookEntry, askEntry: OrderBookEntry): MatchResult | null {
    const buyOrder = bidEntry.orders[0];
    const sellOrder = askEntry.orders[0];
    
    if (!buyOrder || !sellOrder) {
      return null;
    }
    
    // 确定成交价格（取卖单价格，符合价格优先原则）
    const matchPrice = askEntry.price;
    
    // 确定成交数量（取较小值）
    const buyQuantity = parseFloat(buyOrder.quantity);
    const sellQuantity = parseFloat(sellOrder.quantity);
    const matchQuantity = Math.min(buyQuantity, sellQuantity);
    
    // 生成撮合结果
    const match: MatchResult = {
      id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      price: matchPrice,
      quantity: matchQuantity.toString(),
      timestamp: Date.now(),
      buyAccount: buyOrder.account,
      sellAccount: sellOrder.account
    };
    
    // 更新订单数量
    buyOrder.quantity = (buyQuantity - matchQuantity).toString();
    sellOrder.quantity = (sellQuantity - matchQuantity).toString();
    
    // 移除完全成交的订单
    if (parseFloat(buyOrder.quantity) === 0) {
      this.removeOrderFromEntry(bidEntry, buyOrder.id);
      this.orderIndex.delete(buyOrder.id);
    }
    
    if (parseFloat(sellOrder.quantity) === 0) {
      this.removeOrderFromEntry(askEntry, sellOrder.id);
      this.orderIndex.delete(sellOrder.id);
    }
    
    // 更新价格层级总量
    this.updateEntryTotalQuantity(bidEntry);
    this.updateEntryTotalQuantity(askEntry);
    
    console.log(`Match executed: ${matchQuantity} ${this.symbol} @ ${matchPrice}`);
    return match;
  }

  /**
   * 从价格层级中移除订单
   */
  private removeOrderFromEntry(entry: OrderBookEntry, orderId: string): void {
    entry.orders = entry.orders.filter(o => o.id !== orderId);
    
    if (entry.orders.length === 0) {
      // 移除空的价格层级
      const priceLevel = entry === this.bids.get(entry.price) ? this.bids : this.asks;
      priceLevel.delete(entry.price);
    }
  }

  /**
   * 更新价格层级总量
   */
  private updateEntryTotalQuantity(entry: OrderBookEntry): void {
    entry.totalQuantity = entry.orders.reduce(
      (sum, order) => (parseFloat(sum) + parseFloat(order.quantity)).toString(),
      '0'
    );
  }

  /**
   * 获取最优买价
   */
  private getBestBid(): OrderBookEntry | null {
    if (this.bids.size === 0) return null;
    
    // 买单按价格从高到低排序，取最高价
    const sortedPrices = Array.from(this.bids.keys()).sort((a, b) => parseFloat(b) - parseFloat(a));
    return this.bids.get(sortedPrices[0]) || null;
  }

  /**
   * 获取最优卖价
   */
  private getBestAsk(): OrderBookEntry | null {
    if (this.asks.size === 0) return null;
    
    // 卖单按价格从低到高排序，取最低价
    const sortedPrices = Array.from(this.asks.keys()).sort((a, b) => parseFloat(a) - parseFloat(b));
    return this.asks.get(sortedPrices[0]) || null;
  }

  /**
   * 获取订单簿深度
   */
  public getDepth(levels: number = 10): OrderBookDepth {
    const bids = this.getTopLevels(this.bids, levels, false); // 买单价格从高到低
    const asks = this.getTopLevels(this.asks, levels, true);  // 卖单价格从低到高
    
    return {
      bids: bids.map(entry => ({
        price: entry.price,
        quantity: entry.totalQuantity,
        count: entry.orders.length
      })),
      asks: asks.map(entry => ({
        price: entry.price,
        quantity: entry.totalQuantity,
        count: entry.orders.length
      })),
      lastUpdate: this.lastUpdate
    };
  }

  /**
   * 获取顶层价格层级
   */
  private getTopLevels(priceMap: Map<string, OrderBookEntry>, levels: number, ascending: boolean): OrderBookEntry[] {
    const sortedPrices = Array.from(priceMap.keys()).sort((a, b) => {
      return ascending ? parseFloat(a) - parseFloat(b) : parseFloat(b) - parseFloat(a);
    });
    
    return sortedPrices.slice(0, levels).map(price => priceMap.get(price)!);
  }

  /**
   * 获取订单簿统计信息
   */
  public getStats(): any {
    const bidLevels = this.bids.size;
    const askLevels = this.asks.size;
    const totalBidQuantity = Array.from(this.bids.values()).reduce(
      (sum, entry) => sum + parseFloat(entry.totalQuantity), 0
    );
    const totalAskQuantity = Array.from(this.asks.values()).reduce(
      (sum, entry) => sum + parseFloat(entry.totalQuantity), 0
    );
    
    return {
      symbol: this.symbol,
      bidLevels,
      askLevels,
      totalBidQuantity: totalBidQuantity.toString(),
      totalAskQuantity: totalAskQuantity.toString(),
      totalOrders: this.orderIndex.size,
      bestBid: this.getBestBid()?.price || null,
      bestAsk: this.getBestAsk()?.price || null,
      spread: this.calculateSpread(),
      lastUpdate: this.lastUpdate
    };
  }

  /**
   * 计算买卖价差
   */
  private calculateSpread(): string | null {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();
    
    if (!bestBid || !bestAsk) {
      return null;
    }
    
    const spread = parseFloat(bestAsk.price) - parseFloat(bestBid.price);
    return spread.toString();
  }

  /**
   * 清理订单簿
   */
  public clear(): void {
    this.bids.clear();
    this.asks.clear();
    this.orderIndex.clear();
    this.lastUpdate = Date.now();
    console.log(`OrderBook cleared for symbol: ${this.symbol}`);
  }

  /**
   * 获取订单详情
   */
  public getOrder(orderId: string): Order | null {
    return this.orderIndex.get(orderId) || null;
  }

  /**
   * 检查订单是否存在
   */
  public hasOrder(orderId: string): boolean {
    return this.orderIndex.has(orderId);
  }
}