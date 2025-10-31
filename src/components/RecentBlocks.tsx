import React, { useState, useEffect } from 'react';
import { Blocks, Clock, Users, Zap, ExternalLink } from 'lucide-react';

interface Block {
  height: number;
  hash: string;
  timestamp: number;
  validator: string;
  transactionCount: number;
  gasUsed: number;
  gasLimit: number;
  size: number;
  reward: string;
  difficulty: string;
}

interface RecentBlocksProps {
  showAll?: boolean;
}

export const RecentBlocks: React.FC<RecentBlocksProps> = ({ showAll = false }) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const blocksPerPage = showAll ? 20 : 10;
  
  useEffect(() => {
    fetchRecentBlocks();
    
    // 定期更新区块数据
    const interval = setInterval(fetchRecentBlocks, 5000); // 每5秒更新
    
    return () => clearInterval(interval);
  }, [currentPage]);
  
  const fetchRecentBlocks = async () => {
    try {
      const response = await fetch(`/api/blocks/recent?page=${currentPage}&limit=${blocksPerPage}`);
      
      if (response.ok) {
        const data = await response.json();
        setBlocks(data.blocks || []);
      } else {
        // 生成模拟区块数据
        const mockBlocks: Block[] = [];
        const now = Date.now();
        
        for (let i = 0; i < blocksPerPage; i++) {
          const height = 1234567 - i;
          mockBlocks.push({
            height,
            hash: `0x${Math.random().toString(16).substr(2, 64)}`,
            timestamp: now - (i * 2100), // 每2.1秒一个区块
            validator: `Validator-${Math.floor(Math.random() * 108) + 1}`,
            transactionCount: Math.floor(Math.random() * 500) + 100,
            gasUsed: Math.floor(Math.random() * 8000000) + 2000000,
            gasLimit: 10000000,
            size: Math.floor(Math.random() * 50000) + 20000,
            reward: (Math.random() * 2 + 1).toFixed(4),
            difficulty: (Math.random() * 1000000000000).toExponential(2)
          });
        }
        
        setBlocks(mockBlocks);
      }
    } catch (error) {
      console.error('Failed to fetch recent blocks:', error);
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
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
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
  
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${bytes} B`;
  };
  
  const getGasUsagePercentage = (gasUsed: number, gasLimit: number) => {
    return ((gasUsed / gasLimit) * 100).toFixed(1);
  };
  
  const getGasUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };
  
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Blocks className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {showAll ? 'All Blocks' : 'Latest Blocks'}
          </h3>
        </div>
        
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-lg h-20"></div>
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
          <Blocks className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {showAll ? 'All Blocks' : 'Latest Blocks'}
          </h3>
        </div>
        
        {!showAll && (
          <button
            onClick={() => window.location.href = '/blocks'}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            View All
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        {blocks.map((block, index) => {
          const gasPercentage = parseFloat(getGasUsagePercentage(block.gasUsed, block.gasLimit));
          
          return (
            <div
              key={`block-${block.height}-${block.hash}-${index}`}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => window.location.href = `/block/${block.height}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600">Block</span>
                      <span className="text-lg font-bold text-blue-600">#{formatNumber(block.height)}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(block.timestamp)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Hash:</span>
                      <span className="ml-2 font-mono text-gray-900">{formatHash(block.hash)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-600">Validator:</span>
                      <span className="text-gray-900">{block.validator}</span>
                    </div>
                    
                    <div>
                      <span className="text-gray-600">Transactions:</span>
                      <span className="ml-2 font-semibold text-gray-900">{formatNumber(block.transactionCount)}</span>
                    </div>
                    
                    <div>
                      <span className="text-gray-600">Size:</span>
                      <span className="ml-2 text-gray-900">{formatSize(block.size)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2 ml-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Reward</div>
                    <div className="font-semibold text-green-600">{block.reward} TTN</div>
                  </div>
                  
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getGasUsageColor(gasPercentage)}`}>
                    <Zap className="w-3 h-3" />
                    {gasPercentage}% Gas
                  </div>
                </div>
              </div>
              
              {/* Gas Usage Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Gas Usage</span>
                  <span>{formatNumber(block.gasUsed)} / {formatNumber(block.gasLimit)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      gasPercentage >= 90 ? 'bg-red-500' :
                      gasPercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${gasPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
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