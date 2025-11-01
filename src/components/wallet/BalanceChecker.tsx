import React, { useState, useEffect } from 'react';
import { Search, Wallet, Copy, CheckCircle, AlertCircle, Loader2, Users, RefreshCw, Crown, Zap } from 'lucide-react';

interface BalanceData {
  address: string;
  balance: string;
  balanceInTTN: string;
  success: boolean;
  error?: string;
}

interface AddressInfo {
  address: string;
  balance: string;
  balanceInTTN: string;
  transactionCount: number;
  lastUpdated: number;
}

interface ValidatorNode {
  address: string;
  name: string;
  stake: string;
  isActive: boolean;
  lastBlockTime?: number;
  isCurrentProducer?: boolean;
  isLatestProducer?: boolean;
}

interface BlockProducerInfo {
  current: {
    address: string;
    blockNumber: number;
  };
  latest: string;
  timestamp: number;
}

const BalanceChecker: React.FC = () => {
  const [searchAddress, setSearchAddress] = useState('');
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [addressInfo, setAddressInfo] = useState<AddressInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [batchResults, setBatchResults] = useState<BalanceData[]>([]);
  const [showBatchResults, setShowBatchResults] = useState(false);
  const [validatorAddresses, setValidatorAddresses] = useState<ValidatorNode[]>([]);
  const [loadingValidators, setLoadingValidators] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentProducerInfo, setCurrentProducerInfo] = useState<BlockProducerInfo | null>(null);

  // 验证地址格式
  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // API基础URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

  // 获取当前出块节点信息
  const fetchCurrentProducer = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/blockchain/current-producer`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setCurrentProducerInfo(data.data);
        return data.data;
      }
    } catch (err) {
      console.error('获取当前出块节点失败:', err);
    }
    return null;
  };

  // 获取验证节点列表
  const fetchValidators = async () => {
    setLoadingValidators(true);
    try {
      // 同时获取验证节点列表和当前出块节点信息
      const [validatorsResponse, producerInfo] = await Promise.all([
        fetch(`${API_BASE_URL}/api/validators`),
        fetchCurrentProducer()
      ]);
      
      const validatorsData = await validatorsResponse.json();
      
      if (validatorsData.success && validatorsData.data) {
        // 转换API数据格式为组件需要的格式
        const validators = validatorsData.data.map((validator: any, index: number) => {
          const isCurrentProducer = producerInfo?.current?.address === validator.address;
          const isLatestProducer = producerInfo?.latest === validator.address;
          
          return {
            address: validator.address,
            name: validator.address, // 直接使用实际地址作为名称
            stake: validator.stake || '0',
            isActive: validator.status === 'active',
            lastBlockTime: validator.lastActiveBlock,
            isCurrentProducer,
            isLatestProducer
          };
        });
        
        // 排序：出块节点在前，然后是验证节点
        const sortedValidators = validators.sort((a: ValidatorNode, b: ValidatorNode) => {
          // 当前出块节点排在最前
          if (a.isCurrentProducer && !b.isCurrentProducer) return -1;
          if (!a.isCurrentProducer && b.isCurrentProducer) return 1;
          
          // 最新区块出块者排在第二
          if (a.isLatestProducer && !b.isLatestProducer) return -1;
          if (!a.isLatestProducer && b.isLatestProducer) return 1;
          
          // 其他按活跃状态排序
          if (a.isActive && !b.isActive) return -1;
          if (!a.isActive && b.isActive) return 1;
          
          return 0;
        });
        
        setValidatorAddresses(sortedValidators);
        setLastUpdated(new Date());
        setError(null);
      } else {
        console.warn('获取验证节点失败，使用默认地址');
        // 如果API失败，使用默认的验证节点地址作为备用
        setValidatorAddresses([
          { name: '区块生产者', address: '0x3c55a5681d272E8787C818e2d164c0ABFd90a933', stake: '0', isActive: true },
          { name: '验证节点 #1', address: '0x151bBae42e263EbfBD6740C966420B852d9156dE', stake: '0', isActive: true },
          { name: '验证节点 #2', address: '0x2a3a988B1498524c9D0da26aE8633A1f1461a9eE', stake: '0', isActive: true },
          { name: '验证节点 #3', address: '0x9e3C03081b09330401fC127Cb1877F46481E84B4', stake: '0', isActive: true }
        ]);
      }
    } catch (err) {
      console.error('获取验证节点失败:', err);
      // 使用默认地址作为备用
      setValidatorAddresses([
        { name: '区块生产者', address: '0x3c55a5681d272E8787C818e2d164c0ABFd90a933', stake: '0', isActive: true },
        { name: '验证节点 #1', address: '0x151bBae42e263EbfBD6740C966420B852d9156dE', stake: '0', isActive: true },
        { name: '验证节点 #2', address: '0x2a3a988B1498524c9D0da26aE8633A1f1461a9eE', stake: '0', isActive: true },
        { name: '验证节点 #3', address: '0x9e3C03081b09330401fC127Cb1877F46481E84B4', stake: '0', isActive: true }
      ]);
    } finally {
      setLoadingValidators(false);
    }
  };

  // 组件挂载时获取验证节点
  useEffect(() => {
    fetchValidators();
    
    // 设置定时刷新验证节点（30秒）
    const validatorsInterval = setInterval(fetchValidators, 30000);
    
    return () => {
      clearInterval(validatorsInterval);
    };
  }, []);

  // 单独的useEffect用于定时更新出块节点信息
  useEffect(() => {
    if (validatorAddresses.length === 0) return;

    const producerInterval = setInterval(async () => {
      const producerInfo = await fetchCurrentProducer();
      if (producerInfo) {
        // 更新验证节点列表中的出块节点标记
        setValidatorAddresses(prevValidators => {
          const updatedValidators = prevValidators.map(validator => ({
            ...validator,
            isCurrentProducer: producerInfo.current?.address === validator.address,
            isLatestProducer: producerInfo.latest === validator.address
          }));
          
          // 重新排序
          return updatedValidators.sort((a: ValidatorNode, b: ValidatorNode) => {
            if (a.isCurrentProducer && !b.isCurrentProducer) return -1;
            if (!a.isCurrentProducer && b.isCurrentProducer) return 1;
            if (a.isLatestProducer && !b.isLatestProducer) return -1;
            if (!a.isLatestProducer && b.isLatestProducer) return 1;
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            return 0;
          });
        });
      }
    }, 10000);
    
    return () => {
      clearInterval(producerInterval);
    };
  }, [validatorAddresses.length]);

  // 查询单个地址余额
  const checkBalance = async (address: string) => {
    if (!isValidAddress(address)) {
      setError('无效的地址格式');
      return;
    }

    setLoading(true);
    setError(null);
    setBalanceData(null);
    setAddressInfo(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/wallet/balance/${address}`);
      const data = await response.json();

      if (data.success) {
        setBalanceData(data.data);
        
        // 获取详细信息
        const infoResponse = await fetch(`${API_BASE_URL}/api/wallet/info/${address}`);
        const infoData = await infoResponse.json();
        
        if (infoData.success) {
          setAddressInfo(infoData.data);
        }
      } else {
        setError(data.error || '查询失败');
      }
    } catch (err) {
      setError('网络错误，请检查API服务是否运行');
    } finally {
      setLoading(false);
    }
  };

  // 批量查询验证节点余额
  const checkValidatorBalances = async () => {
    setLoading(true);
    setError(null);
    setBatchResults([]);
    setShowBatchResults(true);

    try {
      const addresses = validatorAddresses.map(v => v.address);
      const response = await fetch(`${API_BASE_URL}/api/wallet/balance/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addresses }),
      });

      const data = await response.json();

      if (data.success) {
        // 合并验证节点名称和余额数据
        const resultsWithNames = data.data.map((result: BalanceData) => ({
          ...result,
          name: validatorAddresses.find(v => v.address === result.address)?.name || '未知节点'
        }));
        setBatchResults(resultsWithNames);
      } else {
        setError(data.error || '批量查询失败');
      }
    } catch (err) {
      setError('网络错误，请检查API服务是否运行');
    } finally {
      setLoading(false);
    }
  };

  // 复制地址到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 格式化地址显示
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchAddress.trim()) {
      checkBalance(searchAddress.trim());
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            钱包余额查询
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              更新时间: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchValidators}
            disabled={loadingValidators}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 
                     dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 
                     rounded-lg transition-colors disabled:opacity-50"
            title="刷新验证节点列表"
          >
            <RefreshCw className={`h-3 w-3 ${loadingValidators ? 'animate-spin' : ''}`} />
            刷新节点
          </button>
        </div>
      </div>

      {/* 搜索表单 */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="输入钱包地址 (0x...)"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !searchAddress.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                     text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            查询
          </button>
        </div>
      </form>

      {/* 快捷查询按钮 */}
      <div className="mb-6">
        <button
          onClick={checkValidatorBalances}
          disabled={loading || validatorAddresses.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 
                   disabled:bg-gray-400 text-white rounded-lg transition-colors"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          查询所有验证节点余额 ({validatorAddresses.length}个节点)
        </button>
        
        {loadingValidators && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            正在获取验证节点列表...
          </div>
        )}
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* 单个地址查询结果 */}
      {balanceData && !showBatchResults && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            查询结果
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">地址:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-gray-900 dark:text-white">
                  {formatAddress(balanceData.address)}
                </span>
                <button
                  onClick={() => copyToClipboard(balanceData.address)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">余额:</span>
              <span className="text-xl font-semibold text-gray-900 dark:text-white">
                {balanceData.balanceInTTN} TTN
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">原始余额:</span>
              <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                {balanceData.balance} wei
              </span>
            </div>

            {addressInfo && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">交易数量:</span>
                <span className="text-gray-900 dark:text-white">
                  {addressInfo.transactionCount}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 批量查询结果 */}
      {showBatchResults && batchResults.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              验证节点余额
            </h3>
            <button
              onClick={() => setShowBatchResults(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-3">
            {batchResults.map((result: any, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {result.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-gray-500">
                      {formatAddress(result.address)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(result.address)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    >
                      <Copy className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {result.balanceInTTN} TTN
                  </div>
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 ml-auto mt-1" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 ml-auto mt-1" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 验证节点快捷选择 */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            区块链节点状态:
          </h4>
          {currentProducerInfo && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              最后更新: {new Date(currentProducerInfo.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
        {validatorAddresses.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            {loadingValidators ? '正在加载验证节点...' : '暂无验证节点数据'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {validatorAddresses.map((validator, index) => {
              // 确定节点类型和样式
              let nodeType = '验证节点';
              let nodeIcon = <CheckCircle className="h-4 w-4" />;
              let nodeStatus = '验证中';
              let cardClass = '';
              let iconColor = 'text-green-500';
              
              if (validator.isCurrentProducer) {
                nodeType = '当前出块节点';
                nodeIcon = <Crown className="h-4 w-4" />;
                nodeStatus = '正在出块';
                cardClass = 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-300 dark:border-yellow-600 shadow-lg';
                iconColor = 'text-yellow-600 dark:text-yellow-400';
              } else if (validator.isLatestProducer) {
                nodeType = '最新出块节点';
                nodeIcon = <Zap className="h-4 w-4" />;
                nodeStatus = '刚完成出块';
                cardClass = 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-300 dark:border-blue-600';
                iconColor = 'text-blue-600 dark:text-blue-400';
              } else if (validator.isActive) {
                cardClass = 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800';
              } else {
                cardClass = 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600';
                iconColor = 'text-gray-400';
              }

              return (
                <button
                  key={`${validator.address}-${index}`}
                  onClick={() => {
                    setSearchAddress(validator.address);
                    setShowBatchResults(false);
                  }}
                  className={`text-left p-4 rounded-lg transition-all duration-200 hover:scale-105 ${cardClass}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={iconColor}>
                        {nodeIcon}
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {nodeType}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      validator.isCurrentProducer 
                        ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                        : validator.isLatestProducer
                        ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                        : validator.isActive 
                        ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}>
                      {nodeStatus}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      {formatAddress(validator.address)}
                    </div>
                    
                    {validator.stake && validator.stake !== '0' && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        质押: {validator.stake} TTN
                      </div>
                    )}
                    
                    {validator.isCurrentProducer && currentProducerInfo && (
                      <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                        当前区块: #{currentProducerInfo.current.blockNumber}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceChecker;