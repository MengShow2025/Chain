import React, { useState, useEffect } from 'react';
import { Search, Activity, Users, Blocks, TrendingUp, Zap, Clock, DollarSign } from 'lucide-react';
import { NetworkStats } from '../components/NetworkStats';
import { RecentBlocks } from '../components/RecentBlocks';
import { RecentTransactions } from '../components/RecentTransactions';
import { ValidatorsList } from '../components/ValidatorsList';
import { SearchBar } from '../components/SearchBar';

interface ExplorerStats {
  blockHeight: number;
  totalTransactions: number;
  activeValidators: number;
  networkHashRate: string;
  averageBlockTime: number;
  tps: number;
  zeroGasTransactions: number;
  totalStaked: string;
}

export const Explorer: React.FC = () => {
  const [stats, setStats] = useState<ExplorerStats>({
    blockHeight: 0,
    totalTransactions: 0,
    activeValidators: 0,
    networkHashRate: '0 H/s',
    averageBlockTime: 0,
    tps: 0,
    zeroGasTransactions: 0,
    totalStaked: '0'
  });
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'transactions' | 'validators'>('overview');
  
  useEffect(() => {
    fetchNetworkStats();
    
    // 定期更新统计数据
    const interval = setInterval(fetchNetworkStats, 10000); // 每10秒更新
    
    return () => clearInterval(interval);
  }, []);
  
  const fetchNetworkStats = async () => {
    try {
      // 模拟API调用
      const response = await fetch('/api/network/stats');
      if (response.ok) {
        const data = await response.json();
        
        // 确保所有必需的字段都存在，提供默认值
        const safeStats: ExplorerStats = {
          blockHeight: data.blockHeight ?? 0,
          totalTransactions: data.totalTransactions ?? 0,
          activeValidators: data.activeValidators ?? 0,
          networkHashRate: data.networkHashRate ?? '0 H/s',
          averageBlockTime: data.averageBlockTime ?? 0,
          tps: data.tps ?? 0,
          zeroGasTransactions: data.zeroGasTransactions ?? 0,
          totalStaked: data.totalStaked ?? '0'
        };
        
        setStats(safeStats);
      } else {
        // 使用模拟数据
        setStats({
          blockHeight: 1234567,
          totalTransactions: 9876543,
          activeValidators: 108,
          networkHashRate: '1.2 TH/s',
          averageBlockTime: 2.1,
          tps: 185432,
          zeroGasTransactions: 2345678,
          totalStaked: '50000000'
        });
      }
    } catch (error) {
      console.error('Failed to fetch network stats:', error);
      // 使用模拟数据
      setStats({
        blockHeight: 1234567,
        totalTransactions: 9876543,
        activeValidators: 108,
        networkHashRate: '1.2 TH/s',
        averageBlockTime: 2.1,
        tps: 185432,
        zeroGasTransactions: 2345678,
        totalStaked: '50000000'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const formatNumber = (num: number | undefined | null) => {
    // 处理空值情况
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    
    // 确保是数字类型
    const numValue = Number(num);
    
    if (numValue >= 1000000) {
      return (numValue / 1000000).toFixed(1) + 'M';
    }
    if (numValue >= 1000) {
      return (numValue / 1000).toFixed(1) + 'K';
    }
    return numValue.toString();
  };
  
  const formatStaked = (amount: string | undefined | null) => {
    // 处理空值情况
    if (!amount || amount === '') {
      return '0 TTN';
    }
    
    const num = parseFloat(amount);
    return formatNumber(num) + ' TTN';
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading TitanExplorer...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">TitanExplorer</h1>
            </div>
            
            <div className="flex-1 max-w-2xl mx-8">
              <SearchBar />
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Network Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Block Height</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.blockHeight)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Blocks className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalTransactions)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Validators</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeValidators}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current TPS</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.tps)}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-600">Average Block Time</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.averageBlockTime}s</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">0-Gas Transactions</span>
            </div>
            <p className="text-xl font-bold text-green-600">{formatNumber(stats.zeroGasTransactions)}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Total Staked</span>
            </div>
            <p className="text-xl font-bold text-blue-600">{formatStaked(stats.totalStaked)}</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'blocks', label: 'Latest Blocks', icon: Blocks },
                { id: 'transactions', label: 'Latest Transactions', icon: TrendingUp },
                { id: 'validators', label: 'Validators', icon: Users }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentBlocks />
                <RecentTransactions />
              </div>
            )}
            
            {activeTab === 'blocks' && <RecentBlocks showAll />}
            
            {activeTab === 'transactions' && <RecentTransactions showAll />}
            
            {activeTab === 'validators' && <ValidatorsList />}
          </div>
        </div>
        
        {/* Network Health */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Health</h3>
          <NetworkStats />
        </div>
      </main>
    </div>
  );
};