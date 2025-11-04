import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Zap, TrendingUp, Server, Cpu, HardDrive, Gauge } from 'lucide-react';

// 性能指标数据类型
interface PerformanceMetrics {
  timestamp: number;
  tps: number;
  latency: number;
  throughput: number;
  cpuUsage: number;
  memoryUsage: number;
  networkIO: number;
  activeShards: number;
  consensusLatency: number;
  blockTime: number;
}

interface PerformanceDashboardProps {
  className?: string;
}

/**
 * 性能监控仪表板组件
 * 实时显示TitanChain的性能指标
 */
export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ className }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  // 生成模拟性能数据
  const generateMetrics = (): PerformanceMetrics => {
    const now = Date.now();
    const baseTime = Math.floor(now / 1000) * 1000;
    
    return {
      timestamp: baseTime,
      tps: 450000 + Math.random() * 100000, // 450K-550K TPS
      latency: 0.05 + Math.random() * 0.05, // 0.05-0.1ms
      throughput: 800 + Math.random() * 200, // 800-1000 MB/s
      cpuUsage: 60 + Math.random() * 30, // 60-90%
      memoryUsage: 70 + Math.random() * 20, // 70-90%
      networkIO: 500 + Math.random() * 300, // 500-800 MB/s
      activeShards: 8 + Math.floor(Math.random() * 4), // 8-12 shards
      consensusLatency: 10 + Math.random() * 20, // 10-30ms
      blockTime: 1000 + Math.random() * 500 // 1-1.5s
    };
  };

  // 实时数据更新
  useEffect(() => {
    setIsConnected(true);
    
    const interval = setInterval(() => {
      const newMetrics = generateMetrics();
      
      setCurrentMetrics(newMetrics);
      setMetrics(prev => {
        const updated = [...prev, newMetrics];
        return updated.slice(-60); // 保留最近60个数据点
      });

      // 检查性能告警
      if (newMetrics.tps < 400000 || newMetrics.latency > 0.15) {
        setAlertCount(prev => prev + 1);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, []);

  // 格式化数值
  const formatNumber = (value: number, decimals: number = 0): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(decimals);
  };

  // 获取状态颜色
  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-500';
    if (value >= thresholds.warning) return 'text-yellow-500';
    return 'text-red-500';
  };

  // 性能指标卡片组件
  const MetricCard: React.FC<{
    title: string;
    value: string;
    unit: string;
    icon: React.ReactNode;
    color: string;
    trend?: number;
  }> = ({ title, value, unit, icon, color, trend }) => (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {icon}
          <span className="text-sm text-gray-400">{title}</span>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center text-xs ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            <span className="ml-1">{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline space-x-1">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
    </div>
  );

  if (!currentMetrics) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-400">加载性能数据...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-lg p-6 text-white ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Gauge className="w-6 h-6 text-blue-500" />
          <h3 className="text-xl font-semibold">性能监控仪表板</h3>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-gray-400">实时监控</span>
          </div>
          {alertCount > 0 && (
            <div className="flex items-center space-x-1 bg-red-600 px-2 py-1 rounded">
              <span className="text-xs">告警: {alertCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* 核心性能指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="TPS"
          value={formatNumber(currentMetrics.tps)}
          unit="tx/s"
          icon={<Zap className="w-5 h-5 text-yellow-500" />}
          color={getStatusColor(currentMetrics.tps, { good: 450000, warning: 300000 })}
          trend={5.2}
        />
        
        <MetricCard
          title="延迟"
          value={currentMetrics.latency.toFixed(3)}
          unit="ms"
          icon={<Activity className="w-5 h-5 text-green-500" />}
          color={getStatusColor(1 / currentMetrics.latency, { good: 10, warning: 6.67 })}
          trend={-2.1}
        />
        
        <MetricCard
          title="吞吐量"
          value={formatNumber(currentMetrics.throughput)}
          unit="MB/s"
          icon={<Server className="w-5 h-5 text-blue-500" />}
          color={getStatusColor(currentMetrics.throughput, { good: 800, warning: 500 })}
          trend={3.8}
        />
        
        <MetricCard
          title="活跃分片"
          value={currentMetrics.activeShards.toString()}
          unit="shards"
          icon={<HardDrive className="w-5 h-5 text-purple-500" />}
          color="text-white"
          trend={0}
        />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* TPS 趋势图 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-lg font-medium mb-4 flex items-center">
            <Zap className="w-5 h-5 text-yellow-500 mr-2" />
            TPS 趋势
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                stroke="#9CA3AF"
              />
              <YAxis 
                tickFormatter={(value) => formatNumber(value)}
                stroke="#9CA3AF"
              />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                formatter={(value: number) => [formatNumber(value), 'TPS']}
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
              />
              <Area 
                type="monotone" 
                dataKey="tps" 
                stroke="#EAB308" 
                fill="#EAB308" 
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 延迟趋势图 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-lg font-medium mb-4 flex items-center">
            <Activity className="w-5 h-5 text-green-500 mr-2" />
            延迟趋势
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                stroke="#9CA3AF"
              />
              <YAxis 
                tickFormatter={(value) => `${value.toFixed(2)}ms`}
                stroke="#9CA3AF"
              />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                formatter={(value: number) => [`${value.toFixed(3)}ms`, '延迟']}
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
              />
              <Line 
                type="monotone" 
                dataKey="latency" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 系统资源使用情况 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-lg font-medium mb-4 flex items-center">
          <Cpu className="w-5 h-5 text-red-500 mr-2" />
          系统资源
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CPU 使用率 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">CPU 使用率</span>
              <span className="text-white">{currentMetrics.cpuUsage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-red-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentMetrics.cpuUsage}%` }}
              ></div>
            </div>
          </div>

          {/* 内存使用率 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">内存使用率</span>
              <span className="text-white">{currentMetrics.memoryUsage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentMetrics.memoryUsage}%` }}
              ></div>
            </div>
          </div>

          {/* 网络 I/O */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">网络 I/O</span>
              <span className="text-white">{formatNumber(currentMetrics.networkIO)} MB/s</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((currentMetrics.networkIO / 1000) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部状态信息 */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400">共识延迟</div>
            <div className="text-white font-mono">{currentMetrics.consensusLatency.toFixed(1)}ms</div>
          </div>
          <div>
            <div className="text-gray-400">出块时间</div>
            <div className="text-white font-mono">{(currentMetrics.blockTime / 1000).toFixed(1)}s</div>
          </div>
          <div>
            <div className="text-gray-400">网络状态</div>
            <div className="text-green-500 font-medium">健康</div>
          </div>
          <div>
            <div className="text-gray-400">最后更新</div>
            <div className="text-white font-mono">{new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;