import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Zap, Users, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface NetworkMetrics {
  timestamp: number;
  tps: number;
  blockTime: number;
  gasUsage: number;
  activeValidators: number;
  networkLoad: number;
}

interface NetworkHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  consensusHealth: number;
  networkLatency: number;
  syncStatus: number;
}

export const NetworkStats: React.FC = () => {
  const [metrics, setMetrics] = useState<NetworkMetrics[]>([]);
  const [health, setHealth] = useState<NetworkHealth>({
    status: 'healthy',
    uptime: 99.98,
    consensusHealth: 100,
    networkLatency: 45,
    syncStatus: 100
  });
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchNetworkMetrics();
    fetchNetworkHealth();
    
    // 定期更新数据
    const interval = setInterval(() => {
      fetchNetworkMetrics();
      fetchNetworkHealth();
    }, 30000); // 每30秒更新
    
    return () => clearInterval(interval);
  }, [timeRange]);
  
  const fetchNetworkMetrics = async () => {
    try {
      const response = await fetch(`/api/network/metrics?range=${timeRange}`);
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics || []);
      } else {
        // 生成模拟数据
        const now = Date.now();
        const dataPoints = timeRange === '1h' ? 60 : timeRange === '24h' ? 144 : timeRange === '7d' ? 168 : 720;
        const interval = timeRange === '1h' ? 60000 : timeRange === '24h' ? 600000 : timeRange === '7d' ? 3600000 : 3600000;
        
        const mockMetrics: NetworkMetrics[] = [];
        
        for (let i = dataPoints; i >= 0; i--) {
          const timestamp = now - (i * interval);
          mockMetrics.push({
            timestamp,
            tps: Math.floor(Math.random() * 50000) + 150000, // 150K-200K TPS
            blockTime: Math.random() * 0.5 + 1.8, // 1.8-2.3s
            gasUsage: Math.random() * 30 + 70, // 70-100% gas usage
            activeValidators: Math.floor(Math.random() * 3) + 106, // 106-108 validators
            networkLoad: Math.random() * 40 + 60 // 60-100% network load
          });
        }
        
        setMetrics(mockMetrics);
      }
    } catch (error) {
      console.error('Failed to fetch network metrics:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchNetworkHealth = async () => {
    try {
      const response = await fetch('/api/network/health');
      
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      } else {
        // 使用模拟健康数据
        setHealth({
          status: 'healthy',
          uptime: 99.98,
          consensusHealth: 100,
          networkLatency: Math.floor(Math.random() * 20) + 35, // 35-55ms
          syncStatus: 100
        });
      }
    } catch (error) {
      console.error('Failed to fetch network health:', error);
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeRange === '1h') {
      return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === '24h') {
      return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };
  
  const formatNumber = (num: number | null | undefined) => {
    // 处理空值情况
    if (num === null || num === undefined || isNaN(num)) {
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
    return numValue.toFixed(0);
  };
  
  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };
  
  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <TrendingUp className="w-4 h-4" />;
      case 'warning':
        return <Activity className="w-4 h-4" />;
      case 'critical':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };
  
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  const currentMetrics = metrics[metrics.length - 1] || {
    tps: 0,
    blockTime: 0,
    gasUsage: 0,
    activeValidators: 0,
    networkLoad: 0
  };
  
  return (
    <div className="space-y-6">
      {/* Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Network Status</span>
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(health.status)}`}>
              {getHealthIcon(health.status)}
              {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
            </div>
          </div>
          <p className="text-lg font-semibold text-gray-900">{health.uptime}% Uptime</p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-600">Consensus Health</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{health.consensusHealth}%</p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">Network Latency</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{health.networkLatency}ms</p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-600">Sync Status</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{health.syncStatus}%</p>
        </div>
      </div>
      
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">Network Performance</h4>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['1h', '24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      
      {/* TPS Chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            <h5 className="font-medium text-gray-900">Transactions Per Second</h5>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{formatNumber(currentMetrics.tps)}</p>
            <p className="text-sm text-gray-600">Current TPS</p>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTimestamp}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis 
              tickFormatter={formatNumber}
              stroke="#6b7280"
              fontSize={12}
            />
            <Tooltip 
              labelFormatter={(value) => formatTimestamp(value as number)}
              formatter={(value: number) => [formatNumber(value), 'TPS']}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="tps" 
              stroke="#eab308" 
              fill="#fef3c7" 
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Block Time and Network Load */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h5 className="font-medium text-gray-900">Block Time</h5>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900">{currentMetrics.blockTime.toFixed(2)}s</p>
              <p className="text-sm text-gray-600">Average</p>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTimestamp}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis 
                domain={[1.5, 2.5]}
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip 
                labelFormatter={(value) => formatTimestamp(value as number)}
                formatter={(value: number) => [`${value.toFixed(2)}s`, 'Block Time']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="blockTime" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              <h5 className="font-medium text-gray-900">Network Load</h5>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900">{currentMetrics.networkLoad.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Current</p>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTimestamp}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis 
                domain={[0, 100]}
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip 
                labelFormatter={(value) => formatTimestamp(value as number)}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Network Load']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="networkLoad" 
                stroke="#10b981" 
                fill="#d1fae5" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};