import React, { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, Settings, RefreshCw } from 'lucide-react';
import OrderBook from '../components/trading/OrderBook';
import TradingPanel from '../components/trading/TradingPanel';
import PerformanceDashboard from '../components/trading/PerformanceDashboard';

// 交易对数据类型
interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

// 用户余额类型
interface UserBalance {
  [asset: string]: number;
}

/**
 * 交易页面组件
 * 集成TitanCore完全链上交易功能
 */
export const Trading: React.FC = () => {
  const [selectedPair, setSelectedPair] = useState<string>('SOL/USDT');
  const [tradingPairs, setTradingPairs] = useState<TradingPair[]>([]);
  const [userBalance, setUserBalance] = useState<UserBalance>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showPerformance, setShowPerformance] = useState(false);

  // 初始化交易对数据
  useEffect(() => {
    const initializeTradingData = () => {
      const pairs: TradingPair[] = [
        {
          symbol: 'SOL/USDT',
          baseAsset: 'SOL',
          quoteAsset: 'USDT',
          currentPrice: 125.67,
          priceChange24h: 5.23,
          volume24h: 1250000,
          high24h: 128.45,
          low24h: 119.32
        },
        {
          symbol: 'ETH/USDT',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
          currentPrice: 2456.78,
          priceChange24h: -2.15,
          volume24h: 890000,
          high24h: 2512.34,
          low24h: 2398.56
        },
        {
          symbol: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          currentPrice: 43567.89,
          priceChange24h: 3.45,
          volume24h: 567000,
          high24h: 44123.45,
          low24h: 42890.12
        },
        {
          symbol: 'TTN/USDT',
          baseAsset: 'TTN',
          quoteAsset: 'USDT',
          currentPrice: 1.25,
          priceChange24h: 12.34,
          volume24h: 2100000,
          high24h: 1.35,
          low24h: 1.08
        }
      ];

      const balance: UserBalance = {
        'SOL': 10.5,
        'ETH': 2.3,
        'BTC': 0.15,
        'TTN': 1000,
        'USDT': 5000
      };

      setTradingPairs(pairs);
      setUserBalance(balance);
      setIsLoading(false);
    };

    // 模拟加载延迟
    setTimeout(initializeTradingData, 1000);
  }, []);

  // 获取当前选中交易对的信息
  const currentPair = tradingPairs.find(pair => pair.symbol === selectedPair);

  // 获取当前交易对的余额
  const getCurrentBalance = () => {
    if (!currentPair) return { base: 0, quote: 0 };
    
    return {
      base: userBalance[currentPair.baseAsset] || 0,
      quote: userBalance[currentPair.quoteAsset] || 0
    };
  };

  // 处理订单提交
  const handleSubmitOrder = async (orderData: any) => {
    console.log('提交订单:', orderData);
    
    // 模拟订单处理延迟
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    // 这里可以集成实际的TitanCore订单提交逻辑
    // await titanCore.submitOrder(orderData);
  };

  // 格式化价格
  const formatPrice = (price: number): string => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  // 格式化成交量
  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">加载TitanChain交易界面...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 顶部导航栏 */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold text-white">TitanChain 交易</h1>
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-400">完全链上交易 • 超低延迟</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowPerformance(!showPerformance)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                showPerformance 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>性能监控</span>
            </button>
            
            <button className="flex items-center space-x-2 px-3 py-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
              <span>设置</span>
            </button>
          </div>
        </div>
      </div>

      {/* 交易对选择器 */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3">
        <div className="flex items-center space-x-6 overflow-x-auto">
          {tradingPairs.map(pair => (
            <button
              key={pair.symbol}
              onClick={() => setSelectedPair(pair.symbol)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg transition-colors ${
                selectedPair === pair.symbol
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="text-left">
                <div className="font-medium">{pair.symbol}</div>
                <div className="text-xs flex items-center space-x-2">
                  <span>${formatPrice(pair.currentPrice)}</span>
                  <span className={`flex items-center ${
                    pair.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    <TrendingUp className={`w-3 h-3 ${pair.priceChange24h < 0 ? 'rotate-180' : ''}`} />
                    {Math.abs(pair.priceChange24h).toFixed(2)}%
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 当前交易对详情 */}
      {currentPair && (
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-gray-400">最新价格</div>
              <div className="text-xl font-bold">${formatPrice(currentPair.currentPrice)}</div>
            </div>
            <div>
              <div className="text-gray-400">24h 变化</div>
              <div className={`font-medium ${
                currentPair.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {currentPair.priceChange24h >= 0 ? '+' : ''}{currentPair.priceChange24h.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-gray-400">24h 最高</div>
              <div className="font-medium">${formatPrice(currentPair.high24h)}</div>
            </div>
            <div>
              <div className="text-gray-400">24h 最低</div>
              <div className="font-medium">${formatPrice(currentPair.low24h)}</div>
            </div>
            <div>
              <div className="text-gray-400">24h 成交量</div>
              <div className="font-medium">{formatVolume(currentPair.volume24h)} {currentPair.baseAsset}</div>
            </div>
          </div>
        </div>
      )}

      {/* 主要内容区域 */}
      <div className="flex-1 p-6">
        {showPerformance ? (
          /* 性能监控视图 */
          <PerformanceDashboard className="w-full" />
        ) : (
          /* 交易视图 */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 订单薄 */}
            <div className="lg:col-span-1">
              <OrderBook
                tradingPair={selectedPair}
                precision={currentPair?.symbol.includes('BTC') ? 2 : 4}
                maxDepth={20}
              />
            </div>

            {/* 交易面板 */}
            <div className="lg:col-span-1">
              {currentPair && (
                <TradingPanel
                  tradingPair={selectedPair}
                  currentPrice={currentPair.currentPrice}
                  balance={getCurrentBalance()}
                  onSubmitOrder={handleSubmitOrder}
                />
              )}
            </div>

            {/* 图表和其他信息 */}
            <div className="lg:col-span-1">
              <div className="bg-gray-900 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">价格图表</h3>
                  <button className="text-gray-400 hover:text-white">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                
                {/* 占位符图表 */}
                <div className="h-64 bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500">价格图表</p>
                    <p className="text-xs text-gray-600 mt-1">实时K线图表即将推出</p>
                  </div>
                </div>

                {/* 快速统计 */}
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">我的余额</span>
                    <span className="text-white">
                      {getCurrentBalance().base.toFixed(6)} {currentPair?.baseAsset}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">可用资金</span>
                    <span className="text-white">
                      {getCurrentBalance().quote.toFixed(2)} {currentPair?.quoteAsset}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">预估手续费</span>
                    <span className="text-green-500">0.1%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Trading;