import React, { useState, useEffect } from 'react';
import { ArrowRight, Clock, Zap, DollarSign, ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasUsed: number;
  gasLimit: number;
  status: 'success' | 'failed' | 'pending';
  timestamp: number;
  blockHeight: number;
  type: 'transfer' | 'contract' | 'exchange_batch' | 'staking';
  isZeroGas: boolean;
  fee: string;
}

interface RecentTransactionsProps {
  showAll?: boolean;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({ showAll = false }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'zero_gas' | 'regular'>('all');
  const transactionsPerPage = showAll ? 20 : 10;
  
  useEffect(() => {
    fetchRecentTransactions();
    
    // 定期更新交易数据
    const interval = setInterval(fetchRecentTransactions, 3000); // 每3秒更新
    
    return () => clearInterval(interval);
  }, [currentPage, filter]);
  
  const fetchRecentTransactions = async () => {
    try {
      const response = await fetch(`/api/transactions/recent?page=${currentPage}&limit=${transactionsPerPage}&filter=${filter}`);
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      } else {
        // 生成模拟交易数据
        const mockTransactions: Transaction[] = [];
        const now = Date.now();
        
        const transactionTypes: Transaction['type'][] = ['transfer', 'contract', 'exchange_batch', 'staking'];
        const statuses: Transaction['status'][] = ['success', 'success', 'success', 'failed', 'pending'];
        
        for (let i = 0; i < transactionsPerPage; i++) {
          const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
          const isZeroGas = type === 'exchange_batch' || Math.random() < 0.3; // 30%概率为0-gas交易
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          
          // 过滤逻辑
          if (filter === 'zero_gas' && !isZeroGas) continue;
          if (filter === 'regular' && isZeroGas) continue;
          
          mockTransactions.push({
            hash: `0x${Math.random().toString(16).substr(2, 64)}`,
            from: `0x${Math.random().toString(16).substr(2, 40)}`,
            to: `0x${Math.random().toString(16).substr(2, 40)}`,
            value: (Math.random() * 1000).toFixed(4),
            gasPrice: isZeroGas ? '0' : (Math.random() * 50 + 10).toFixed(2),
            gasUsed: Math.floor(Math.random() * 100000) + 21000,
            gasLimit: Math.floor(Math.random() * 200000) + 100000,
            status,
            timestamp: now - (i * 1000) - Math.random() * 10000,
            blockHeight: 1234567 - Math.floor(i / 300),
            type,
            isZeroGas,
            fee: isZeroGas ? '0' : (Math.random() * 0.01).toFixed(6)
          });
        }
        
        setTransactions(mockTransactions);
      }
    } catch (error) {
      console.error('Failed to fetch recent transactions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) {
      return `${Math.floor(diff / 1000)}s ago`;
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else {
      return new Date(timestamp).toLocaleString();
    }
  };
  
  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };
  
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatNumber = (num: number | null | undefined) => {
    // 处理空值情况
    if (num === null || num === undefined || isNaN(num)) {
      return '0';
    }
    
    // 确保是数字类型
    const numValue = Number(num);
    return numValue.toLocaleString();
  };
  
  const formatValue = (value: string) => {
    const num = parseFloat(value);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    return num.toFixed(4);
  };
  
  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    }
  };
  
  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
    }
  };
  
  const getTypeLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'transfer':
        return 'Transfer';
      case 'contract':
        return 'Contract';
      case 'exchange_batch':
        return 'Exchange Batch';
      case 'staking':
        return 'Staking';
    }
  };
  
  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'transfer':
        return 'text-blue-600 bg-blue-100';
      case 'contract':
        return 'text-purple-600 bg-purple-100';
      case 'exchange_batch':
        return 'text-green-600 bg-green-100';
      case 'staking':
        return 'text-orange-600 bg-orange-100';
    }
  };
  
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRight className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {showAll ? 'All Transactions' : 'Latest Transactions'}
          </h3>
        </div>
        
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-lg h-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {showAll ? 'All Transactions' : 'Latest Transactions'}
          </h3>
        </div>
        
        <div className="flex items-center gap-3">
          {showAll && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Transactions</option>
              <option value="zero_gas">0-Gas Only</option>
              <option value="regular">Regular Only</option>
            </select>
          )}
          
          {!showAll && (
            <button
              onClick={() => window.location.href = '/transactions'}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              View All
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        {transactions.map((tx) => (
          <div
            key={tx.hash}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => window.location.href = `/tx/${tx.hash}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(tx.status)}
                    <span className="text-sm font-mono text-blue-600">{formatHash(tx.hash)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(tx.type)}`}>
                      {getTypeLabel(tx.type)}
                    </span>
                    
                    {tx.isZeroGas && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-green-600 bg-green-100">
                        <Zap className="w-3 h-3" />
                        0-Gas
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(tx.timestamp)}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">From:</span>
                    <span className="font-mono text-gray-900">{formatAddress(tx.from)}</span>
                  </div>
                  
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">To:</span>
                    <span className="font-mono text-gray-900">{formatAddress(tx.to)}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <div>
                    <span className="text-gray-600">Value:</span>
                    <span className="ml-2 font-semibold text-gray-900">{formatValue(tx.value)} TTN</span>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Block:</span>
                    <span className="ml-2 text-blue-600">#{formatNumber(tx.blockHeight)}</span>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Gas Used:</span>
                    <span className="ml-2 text-gray-900">{formatNumber(tx.gasUsed)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2 ml-4">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                  {getStatusIcon(tx.status)}
                  {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                </div>
                
                <div className="text-right">
                  <div className="text-xs text-gray-600">Fee</div>
                  <div className={`font-semibold ${tx.isZeroGas ? 'text-green-600' : 'text-gray-900'}`}>
                    {tx.isZeroGas ? 'FREE' : `${tx.fee} TTN`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {showAll && (
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <span className="text-sm text-gray-600">
            Page {currentPage}
          </span>
          
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};