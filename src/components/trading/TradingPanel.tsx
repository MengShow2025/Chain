import React, { useState, useEffect, useMemo } from 'react';
import { Send, Loader2, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';

// 订单类型定义
interface Order {
  id: string;
  tradingPair: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  price?: number;
  quantity: number;
  timestamp: number;
  status: 'pending' | 'filled' | 'cancelled' | 'partial';
  filledQuantity?: number;
}

interface TradingPanelProps {
  tradingPair: string;
  currentPrice: number;
  balance: {
    base: number;
    quote: number;
  };
  onSubmitOrder?: (order: Omit<Order, 'id' | 'timestamp' | 'status'>) => Promise<void>;
}

/**
 * 交易面板组件
 * 支持TitanCore完全链上交易功能
 */
export const TradingPanel: React.FC<TradingPanelProps> = ({
  tradingPair,
  currentPrice,
  balance,
  onSubmitOrder
}) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('limit');
  const [price, setPrice] = useState<string>(currentPrice.toString());
  const [quantity, setQuantity] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [estimatedLatency, setEstimatedLatency] = useState<number>(0.05); // 预估延迟

  // 解析交易对
  const [baseAsset, quoteAsset] = tradingPair.split('/');

  // 更新价格当市场价格变化时
  useEffect(() => {
    if (orderType === 'market') {
      setPrice(currentPrice.toString());
    }
  }, [currentPrice, orderType]);

  // 计算总价值
  const totalValue = useMemo(() => {
    const priceNum = parseFloat(price) || 0;
    const quantityNum = parseFloat(quantity) || 0;
    return priceNum * quantityNum;
  }, [price, quantity]);

  // 计算最大可买/卖数量
  const maxQuantity = useMemo(() => {
    if (activeTab === 'buy') {
      const priceNum = parseFloat(price) || currentPrice;
      return balance.quote / priceNum;
    } else {
      return balance.base;
    }
  }, [activeTab, price, currentPrice, balance]);

  // 处理订单提交
  const handleSubmitOrder = async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      alert('请输入有效的数量');
      return;
    }

    if (orderType !== 'market' && (!price || parseFloat(price) <= 0)) {
      alert('请输入有效的价格');
      return;
    }

    if (parseFloat(quantity) > maxQuantity) {
      alert('数量超过可用余额');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const orderData = {
        tradingPair,
        side: activeTab,
        type: orderType,
        price: orderType === 'market' ? undefined : parseFloat(price),
        quantity: parseFloat(quantity)
      };

      // 模拟超低延迟提交
      const startTime = performance.now();
      
      if (onSubmitOrder) {
        await onSubmitOrder(orderData);
      }
      
      const endTime = performance.now();
      const actualLatency = endTime - startTime;
      setEstimatedLatency(actualLatency);

      // 添加到最近订单列表
      const newOrder: Order = {
        id: `order_${Date.now()}`,
        ...orderData,
        timestamp: Date.now(),
        status: 'pending'
      };
      
      setRecentOrders(prev => [newOrder, ...prev.slice(0, 4)]);
      
      // 清空表单
      setQuantity('');
      if (orderType === 'limit') {
        setPrice(currentPrice.toString());
      }

      // 模拟订单状态更新
      setTimeout(() => {
        setRecentOrders(prev => 
          prev.map(order => 
            order.id === newOrder.id 
              ? { ...order, status: 'filled' as const, filledQuantity: order.quantity }
              : order
          )
        );
      }, 200 + Math.random() * 300);

    } catch (error) {
      console.error('订单提交失败:', error);
      alert('订单提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 设置百分比数量
  const setPercentageQuantity = (percentage: number) => {
    const maxQty = maxQuantity * (percentage / 100);
    setQuantity(maxQty.toFixed(6));
  };

  // 获取订单状态图标
  const getOrderStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'filled':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'partial':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 text-white">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">交易面板</h3>
        <div className="flex items-center space-x-2 text-sm">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="text-gray-400">预估延迟: {estimatedLatency.toFixed(2)}ms</span>
        </div>
      </div>

      {/* 买卖切换 */}
      <div className="flex mb-6">
        <button
          onClick={() => setActiveTab('buy')}
          className={`flex-1 py-3 px-4 rounded-l-lg font-medium transition-colors ${
            activeTab === 'buy'
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          买入 {baseAsset}
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`flex-1 py-3 px-4 rounded-r-lg font-medium transition-colors ${
            activeTab === 'sell'
              ? 'bg-red-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          卖出 {baseAsset}
        </button>
      </div>

      {/* 订单类型选择 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">订单类型</label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as 'market' | 'limit' | 'stop')}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        >
          <option value="limit">限价单</option>
          <option value="market">市价单</option>
          <option value="stop">止损单</option>
        </select>
      </div>

      {/* 价格输入 */}
      {orderType !== 'market' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            价格 ({quoteAsset})
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="输入价格"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            step="0.0001"
          />
        </div>
      )}

      {/* 数量输入 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          数量 ({baseAsset})
        </label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="输入数量"
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          step="0.000001"
        />
        
        {/* 百分比按钮 */}
        <div className="flex space-x-2 mt-2">
          {[25, 50, 75, 100].map(percentage => (
            <button
              key={percentage}
              onClick={() => setPercentageQuantity(percentage)}
              className="flex-1 py-1 px-2 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              {percentage}%
            </button>
          ))}
        </div>
      </div>

      {/* 总价值显示 */}
      <div className="mb-4 p-3 bg-gray-800 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">总价值:</span>
          <span className="font-mono">{totalValue.toFixed(4)} {quoteAsset}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-400">可用余额:</span>
          <span className="font-mono">
            {activeTab === 'buy' 
              ? `${balance.quote.toFixed(4)} ${quoteAsset}`
              : `${balance.base.toFixed(6)} ${baseAsset}`
            }
          </span>
        </div>
      </div>

      {/* 提交按钮 */}
      <button
        onClick={handleSubmitOrder}
        disabled={isSubmitting || !quantity}
        className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
          activeTab === 'buy'
            ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-600'
            : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-600'
        } disabled:cursor-not-allowed`}
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
        <span>
          {isSubmitting 
            ? '提交中...' 
            : `${activeTab === 'buy' ? '买入' : '卖出'} ${baseAsset}`
          }
        </span>
      </button>

      {/* 最近订单 */}
      {recentOrders.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">最近订单</h4>
          <div className="space-y-2">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                <div className="flex items-center space-x-2">
                  {getOrderStatusIcon(order.status)}
                  <span className={`text-sm font-medium ${
                    order.side === 'buy' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {order.side.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-300">
                    {order.quantity} {baseAsset}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {order.status === 'filled' ? '已成交' : 
                   order.status === 'pending' ? '待成交' : 
                   order.status === 'cancelled' ? '已取消' : '部分成交'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingPanel;