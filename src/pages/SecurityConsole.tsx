/**
 * TitanChain安全控制台主页面
 * 提供实时监控、威胁检测、安全评分和决策中心的统一界面
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert, AlertDescription } from '../components/ui/Alert';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  Settings,
  Eye,
  Zap,
  Lock,
  Brain,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3
} from 'lucide-react';

// 类型定义
interface SystemOverview {
  securityLevel: number;
  activeThreats: number;
  systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  overallScore: number;
  lastUpdated: Date;
}

interface SecurityLayer {
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  performance: number;
  lastCheck: Date;
}

interface ThreatInfo {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'MITIGATED' | 'INVESTIGATING';
  description: string;
  detectedAt: Date;
}

interface DecisionInfo {
  id: string;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  title: string;
  createdAt: Date;
}

const SecurityConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemOverview, setSystemOverview] = useState<SystemOverview | null>(null);
  const [securityLayers, setSecurityLayers] = useState<SecurityLayer[]>([]);
  const [activeThreats, setActiveThreats] = useState<ThreatInfo[]>([]);
  const [recentDecisions, setRecentDecisions] = useState<DecisionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取系统概览数据
  const fetchSystemOverview = async () => {
    try {
      const response = await fetch('/api/security/overview');
      if (!response.ok) throw new Error('获取系统概览失败');
      const data = await response.json();
      setSystemOverview(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    }
  };

  // 获取安全层状态
  const fetchSecurityLayers = async () => {
    try {
      const response = await fetch('/api/security/layers/status');
      if (!response.ok) throw new Error('获取安全层状态失败');
      const data = await response.json();
      setSecurityLayers(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    }
  };

  // 获取活跃威胁
  const fetchActiveThreats = async () => {
    try {
      const response = await fetch('/api/security/threats');
      if (!response.ok) throw new Error('获取活跃威胁失败');
      const data = await response.json();
      setActiveThreats(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    }
  };

  // 获取最近决策
  const fetchRecentDecisions = async () => {
    try {
      const response = await fetch('/api/security/decisions');
      if (!response.ok) throw new Error('获取最近决策失败');
      const data = await response.json();
      setRecentDecisions(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    }
  };

  // 初始化数据
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchSystemOverview(),
          fetchSecurityLayers(),
          fetchActiveThreats(),
          fetchRecentDecisions()
        ]);
      } catch (err) {
        console.error('初始化数据失败:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();

    // 设置定时刷新
    const interval = setInterval(() => {
      fetchSystemOverview();
      fetchSecurityLayers();
      fetchActiveThreats();
      fetchRecentDecisions();
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, []);

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
      case 'ACTIVE':
      case 'COMPLETED':
        return 'text-green-600 bg-green-100';
      case 'WARNING':
      case 'IN_PROGRESS':
        return 'text-yellow-600 bg-yellow-100';
      case 'CRITICAL':
      case 'ERROR':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // 获取威胁严重性颜色
  const getThreatSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return 'text-blue-600 bg-blue-100';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-100';
      case 'HIGH':
        return 'text-orange-600 bg-orange-100';
      case 'CRITICAL':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载安全控制台...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            TitanChain 安全控制台
          </h1>
          <p className="text-gray-600 mt-1">多层次密码学防护体系监控中心</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(systemOverview?.systemHealth || 'UNKNOWN')}>
            {systemOverview?.systemHealth || 'UNKNOWN'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <Activity className="h-4 w-4 mr-1" />
            刷新
          </Button>
        </div>
      </div>

      {/* 系统概览卡片 */}
      {systemOverview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">安全级别</p>
                  <p className="text-2xl font-bold text-blue-600">{systemOverview.securityLevel}/5</p>
                </div>
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">活跃威胁</p>
                  <p className="text-2xl font-bold text-red-600">{systemOverview.activeThreats}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">安全评分</p>
                  <p className="text-2xl font-bold text-green-600">{systemOverview.overallScore}/100</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">系统状态</p>
                  <p className={`text-sm font-medium ${getStatusColor(systemOverview.systemHealth).replace('bg-', 'text-').replace('-100', '-600')}`}>
                    {systemOverview.systemHealth}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 主要内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            实时监控
          </TabsTrigger>
          <TabsTrigger value="threats" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            威胁检测
          </TabsTrigger>
          <TabsTrigger value="scoring" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            安全评分
          </TabsTrigger>
          <TabsTrigger value="decisions" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            决策中心
          </TabsTrigger>
        </TabsList>

        {/* 实时监控标签页 */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                安全层状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {securityLayers.map((layer, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{layer.name}</h3>
                      <Badge className={getStatusColor(layer.status)}>
                        {layer.status}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>性能:</span>
                        <span className="font-medium">{layer.performance}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${layer.performance}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500">
                        最后检查: {new Date(layer.lastCheck).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 威胁检测标签页 */}
        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                活跃威胁
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeThreats.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                  <p className="text-gray-600">当前没有检测到活跃威胁</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeThreats.map((threat) => (
                    <div key={threat.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{threat.type}</h3>
                          <Badge className={getThreatSeverityColor(threat.severity)}>
                            {threat.severity}
                          </Badge>
                        </div>
                        <Badge className={getStatusColor(threat.status)}>
                          {threat.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{threat.description}</p>
                      <p className="text-xs text-gray-500">
                        检测时间: {new Date(threat.detectedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 安全评分标签页 */}
        <TabsContent value="scoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                安全评分详情
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-blue-600 mx-auto mb-2" />
                <p className="text-gray-600">安全评分详情正在开发中...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 决策中心标签页 */}
        <TabsContent value="decisions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                最近决策
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentDecisions.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">暂无最近决策</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentDecisions.map((decision) => (
                    <div key={decision.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{decision.title}</h3>
                          <Badge className={getThreatSeverityColor(decision.priority)}>
                            {decision.priority}
                          </Badge>
                        </div>
                        <Badge className={getStatusColor(decision.status)}>
                          {decision.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">类型: {decision.type}</p>
                      <p className="text-xs text-gray-500">
                        创建时间: {new Date(decision.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityConsole;