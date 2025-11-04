import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';

// 订单类型定义
interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
  count: number;
}

interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  lastPrice: number;
  priceChange24h: number;
}

interface OrderBookProps {
  tradingPair: string;
  data?: OrderBookData;
  precision?: number;
  maxDepth?: number;
}

/**
 * 实时订单薄组件
 * 支持TitanCore完全链上订单薄(CLOB)显示
 */
export const OrderBook: React.FC<OrderBookProps> = ({
  tradingPair,
  data,
  precision = 4,
  maxDepth = 15
}) => {
  const [orderBookData, setOrderBookData] = useState<OrderBookData | null>(data || null);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState<number>(0);

  // 模拟实时数据更新
  useEffect(() => {
    const generateMockData = (): OrderBookData => {
      const basePrice = 100 + Math.random() * 50;
      const spread = 0.01 + Math.random() * 0.05;
      
      const bids: OrderBookEntry[] = [];
      const asks: OrderBookEntry[] = [];
      
      // 生成买单数据
      for (let i = 0; i < maxDepth; i++) {
        const price = basePrice - (i + 1) * spread;
        const quantity = Math.random() * 1000 + 100;
        bids.push({
          price,
          quantity,
          total: quantity * price,
          count: Math.floor(Math.random() * 10) + 1
        });
      }
      
      // 生成卖单数据
      for (let i = 0; i < maxDepth; i++) {
        const price = basePrice + (i + 1) * spread;
        const quantity = Math.random() * 1000 + 100;
        asks.push({
          price,
          quantity,
          total: quantity * price,
          count: Math.floor(Math.random() * 10) + 1
        });
      }
      
      return {
        bids: bids.sort((a, b) => b.price - a.price),
        asks: asks.sort((a, b) => a.price - b.price),
        spread: asks[0]?.price - bids[0]?.price || 0,
        lastPrice: basePrice,
        priceChange24h: (Math.random() - 0.5) * 10
      };
    };

    // 模拟WebSocket连接
    setIsConnected(true);
    const interval = setInterval(() => {
      const startTime = performance.now();
      setOrderBookData(generateMockData());
      const endTime = performance.now();
      setLatency(endTime - startTime);
    }, 100); // 100ms更新频率

    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [maxDepth]);

  // 计算最大数量用于进度条
  const maxQuantity = useMemo(() => {
    if (!orderBookData) return 0;
    const allQuantities = [
      ...orderBookData.bids.map(b => b.quantity),
      ...orderBookData.asks.map(a => a.quantity)
    ];
    return Math.max(...allQuantities);
  }, [orderBookData]);

  // 格式化价格
  const formatPrice = (price: number): string => {
    return price.toFixed(precision);
  };

  // 格式化数量
  const formatQuantity = (quantity: number): string => {
    return quantity.toFixed(2);
  };

  if (!orderBookData) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-400">加载订单薄数据...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 text-white">
      {/* 头部信息 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold">{tradingPair} 订单薄</h3>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-gray-400">延迟: {latency.toFixed(2)}ms</span>
          </div>
          <div className="flex items-center space-x-1">
            {orderBookData.priceChange24h >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={orderBookData.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}>
              {orderBookData.priceChange24h >= 0 ? '+' : ''}{orderBookData.priceChange24h.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* 表头 */}
      <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 mb-2 px-2">
        <div>价格</div>
        <div className="text-right">数量</div>
        <div className="text-right">总额</div>
        <div className="text-right">订单数</div>
      </div>

      {/* 卖单区域 */}
      <div className="space-y-1 mb-4">
        {orderBookData.asks.slice(0, Math.floor(maxDepth / 2)).reverse().map((ask, index) => (
          <div key={`ask-${index}`} className="relative">
            {/* 背景进度条 */}
            <div 
              className="absolute inset-0 bg-red-500 bg-opacity-10 rounded"
              style={{ width: `${(ask.quantity / maxQuantity) * 100}%` }}
            ></div>
            
            <div className="relative grid grid-cols-4 gap-2 text-sm py-1 px-2 hover:bg-gray-800 rounded">
              <div className="text-red-400 font-mono">{formatPrice(ask.price)}</div>
              <div className="text-right text-gray-300">{formatQuantity(ask.quantity)}</div>
              <div className="text-right text-gray-400">{formatQuantity(ask.total)}</div>
              <div className="text-right text-gray-500">{ask.count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 价差信息 */}
      <div className="bg-gray-800 rounded p-3 mb-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-400">价差</div>
          <div className="text-sm font-mono text-yellow-500">
            {formatPrice(orderBookData.spread)} ({((orderBookData.spread / orderBookData.lastPrice) * 100).toFixed(3)}%)
          </div>
        </div>
        <div className="flex justify-between items-center mt-1">
          <div className="text-sm text-gray-400">最新价格</div>
          <div className="text-lg font-mono font-bold text-white">
            {formatPrice(orderBookData.lastPrice)}
          </div>
        </div>
      </div>

      {/* 买单区域 */}
      <div className="space-y-1">
        {orderBookData.bids.slice(0, Math.floor(maxDepth / 2)).map((bid, index) => (
          <div key={`bid-${index}`} className="relative">
            {/* 背景进度条 */}
            <div 
              className="absolute inset-0 bg-green-500 bg-opacity-10 rounded"
              style={{ width: `${(bid.quantity / maxQuantity) * 100}%` }}
            ></div>
            
            <div className="relative grid grid-cols-4 gap-2 text-sm py-1 px-2 hover:bg-gray-800 rounded">
              <div className="text-green-400 font-mono">{formatPrice(bid.price)}</div>
              <div className="text-right text-gray-300">{formatQuantity(bid.quantity)}</div>
              <div className="text-right text-gray-400">{formatQuantity(bid.total)}</div>
              <div className="text-right text-gray-500">{bid.count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 底部统计 */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-gray-400">买单总量</div>
            <div className="text-green-400 font-mono">
              {formatQuantity(orderBookData.bids.reduce((sum, bid) => sum + bid.quantity, 0))}
            </div>
          </div>
          <div>
            <div className="text-gray-400">卖单总量</div>
            <div className="text-red-400 font-mono">
              {formatQuantity(orderBookData.asks.reduce((sum, ask) => sum + ask.quantity, 0))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderBook;