import React, { useState, useEffect } from 'react';
import { Users, Shield, TrendingUp, TrendingDown, Clock, DollarSign, Activity, AlertTriangle } from 'lucide-react';

interface Validator {
  id: string;
  address: string;
  name: string;
  status: 'active' | 'inactive' | 'jailed' | 'candidate';
  stake: string;
  delegatedStake: string;
  commission: number;
  uptime: number;
  blocksProduced: number;
  lastBlockTime: number;
  performance: {
    score: number;
    trend: 'up' | 'down' | 'stable';
  };
  rewards: {
    total: string;
    lastEpoch: string;
  };
  rank: number;
  votingPower: number;
}

export const ValidatorsList: React.FC = () => {
  const [validators, setValidators] = useState<Validator[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'rank' | 'stake' | 'performance' | 'uptime'>('rank');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'candidate'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const validatorsPerPage = 20;
  
  useEffect(() => {
    fetchValidators();
    
    // 定期更新验证节点数据
    const interval = setInterval(fetchValidators, 15000); // 每15秒更新
    
    return () => clearInterval(interval);
  }, [sortBy, filterStatus, currentPage]);
  
  const fetchValidators = async () => {
    try {
      const response = await fetch(`/api/validators?sort=${sortBy}&status=${filterStatus}&page=${currentPage}&limit=${validatorsPerPage}`);
      
      if (response.ok) {
        const data = await response.json();
        setValidators(data.validators || []);
      } else {
        // 生成模拟验证节点数据
        const mockValidators: Validator[] = [];
        const statuses: Validator['status'][] = ['active', 'active', 'active', 'active', 'inactive', 'candidate'];
        const trends: ('up' | 'down' | 'stable')[] = ['up', 'down', 'stable'];
        
        for (let i = 0; i < validatorsPerPage; i++) {
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          
          // 过滤逻辑
          if (filterStatus !== 'all' && status !== filterStatus) continue;
          
          const validator: Validator = {
            id: `validator-${i + 1}`,
            address: `0x${Math.random().toString(16).substr(2, 40)}`,
            name: `Validator Node ${i + 1}`,
            status,
            stake: (Math.random() * 500000 + 100000).toFixed(0),
            delegatedStake: (Math.random() * 1000000 + 200000).toFixed(0),
            commission: Math.random() * 10 + 2, // 2-12%
            uptime: Math.random() * 5 + 95, // 95-100%
            blocksProduced: Math.floor(Math.random() * 10000) + 1000,
            lastBlockTime: Date.now() - Math.random() * 3600000, // 最近1小时内
            performance: {
              score: Math.random() * 20 + 80, // 80-100分
              trend: trends[Math.floor(Math.random() * trends.length)]
            },
            rewards: {
              total: (Math.random() * 50000 + 10000).toFixed(2),
              lastEpoch: (Math.random() * 1000 + 100).toFixed(2)
            },
            rank: i + 1,
            votingPower: Math.random() * 2 + 0.5 // 0.5-2.5%
          };
          
          mockValidators.push(validator);
        }
        
        // 根据排序方式排序
        mockValidators.sort((a, b) => {
          switch (sortBy) {
            case 'stake':
              return parseFloat(b.stake) - parseFloat(a.stake);
            case 'performance':
              return b.performance.score - a.performance.score;
            case 'uptime':
              return b.uptime - a.uptime;
            default:
              return a.rank - b.rank;
          }
        });
        
        setValidators(mockValidators);
      }
    } catch (error) {
      console.error('Failed to fetch validators:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatStake = (stake: string) => {
    const num = parseFloat(stake);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M TTN`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K TTN`;
    }
    return `${num.toFixed(0)} TTN`;
  };
  
  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
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
  
  const getStatusColor = (status: Validator['status']) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'inactive':
        return 'text-gray-600 bg-gray-100';
      case 'jailed':
        return 'text-red-600 bg-red-100';
      case 'candidate':
        return 'text-blue-600 bg-blue-100';
    }
  };
  
  const getStatusIcon = (status: Validator['status']) => {
    switch (status) {
      case 'active':
        return <Shield className="w-4 h-4" />;
      case 'inactive':
        return <Clock className="w-4 h-4" />;
      case 'jailed':
        return <AlertTriangle className="w-4 h-4" />;
      case 'candidate':
        return <Users className="w-4 h-4" />;
    }
  };
  
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'stable':
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };
  
  const getPerformanceColor = (score: number) => {
    if (score >= 95) return 'text-green-600';
    if (score >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-600';
    if (uptime >= 95) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Validators</h3>
        </div>
        
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-lg h-24"></div>
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
          <Users className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Validators</h3>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="candidate">Candidates</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="rank">Sort by Rank</option>
            <option value="stake">Sort by Stake</option>
            <option value="performance">Sort by Performance</option>
            <option value="uptime">Sort by Uptime</option>
          </select>
        </div>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validator
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stake
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uptime
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rewards
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Block
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {validators.map((validator) => (
                <tr
                  key={validator.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => window.location.href = `/validator/${validator.address}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-purple-600">#{validator.rank}</span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{validator.name}</div>
                        <div className="text-sm text-gray-500 font-mono">{formatAddress(validator.address)}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(validator.status)}`}>
                      {getStatusIcon(validator.status)}
                      {validator.status.charAt(0).toUpperCase() + validator.status.slice(1)}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="font-semibold">{formatStake(validator.stake)}</div>
                      <div className="text-gray-500">+ {formatStake(validator.delegatedStake)} delegated</div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${getPerformanceColor(validator.performance.score)}`}>
                        {validator.performance.score.toFixed(1)}
                      </span>
                      {getTrendIcon(validator.performance.trend)}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${getUptimeColor(validator.uptime)}`}>
                      {validator.uptime.toFixed(2)}%
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="font-semibold">{validator.rewards.total} TTN</div>
                      <div className="text-gray-500">+{validator.rewards.lastEpoch} last epoch</div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTimestamp(validator.lastBlockTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
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
    </div>
  );
};