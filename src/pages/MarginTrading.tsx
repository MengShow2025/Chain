/**
 * TitanChain杠杆交易页面
 * TitanChain Margin Trading Page
 * 
 * 功能：
 * - 杠杆交易面板 / Leverage trading panel
 * - 持仓管理 / Position management
 * - 保证金监控 / Margin monitoring
 * - 风险控制 / Risk control
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Shield, 
  DollarSign, 
  BarChart3,
  Settings,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  MarginAccount, 
  Position, 
  OrderSide, 
  OrderType, 
  TimeInForce,
  RiskLevel,
  AccountStatus,
  MarginTradingParams,
  RiskMetrics,
  VIPConfig
} from '../../shared/types/margin';

interface MarginTradingProps {
  userId: string;
}

const MarginTrading: React.FC<MarginTradingProps> = ({ userId }) => {
  // 状态管理 / State management
  const [account, setAccount] = useState<MarginAccount | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [vipConfigs, setVipConfigs] = useState<VIPConfig[]>([]);
  const [supportedAssets, setSupportedAssets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 交易表单状态 / Trading form state
  const [tradingForm, setTradingForm] = useState({
    tradingPair: 'BTC/USDT',
    side: OrderSide.Buy,
    orderType: OrderType.Market,
    quantity: '',
    price: '',
    leverage: 1,
    timeInForce: TimeInForce.GTC
  });
  
  // 保证金操作状态 / Margin operation state
  const [marginForm, setMarginForm] = useState({
    asset: 'USDT',
    amount: '',
    operation: 'deposit' as 'deposit' | 'withdraw'
  });
  
  // UI状态 / UI state
  const [showBalances, setShowBalances] = useState(false);
  const [activeTab, setActiveTab] = useState('trading');

  /**
   * 初始化数据 / Initialize data
   */
  useEffect(() => {
    initializeData();
  }, [userId]);

  const initializeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAccount(),
        fetchPositions(),
        fetchRiskMetrics(),
        fetchVIPConfigs(),
        fetchSupportedAssets()
      ]);
    } catch (error) {
      console.error('Initialize data error:', error);
      toast.error('初始化数据失败 / Failed to initialize data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取账户信息 / Fetch account info
   */
  const fetchAccount = async () => {
    try {
      const response = await fetch('/api/margin/account', {
        headers: { 'x-user-id': userId }
      });
      const data = await response.json();
      
      if (data.success) {
        setAccount(data.data);
      } else if (response.status === 404) {
        // 账户不存在，需要创建 / Account doesn't exist, need to create
        setAccount(null);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Fetch account error:', error);
    }
  };

  /**
   * 获取持仓列表 / Fetch positions
   */
  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/margin/positions?active=true', {
        headers: { 'x-user-id': userId }
      });
      const data = await response.json();
      
      if (data.success) {
        setPositions(data.data);
      }
    } catch (error) {
      console.error('Fetch positions error:', error);
    }
  };

  /**
   * 获取风险指标 / Fetch risk metrics
   */
  const fetchRiskMetrics = async () => {
    try {
      const response = await fetch('/api/margin/risk', {
        headers: { 'x-user-id': userId }
      });
      const data = await response.json();
      
      if (data.success) {
        setRiskMetrics(data.data);
      }
    } catch (error) {
      console.error('Fetch risk metrics error:', error);
    }
  };

  /**
   * 获取VIP配置 / Fetch VIP configs
   */
  const fetchVIPConfigs = async () => {
    try {
      const response = await fetch('/api/margin/vip/config');
      const data = await response.json();
      
      if (data.success) {
        setVipConfigs(data.data);
      }
    } catch (error) {
      console.error('Fetch VIP configs error:', error);
    }
  };

  /**
   * 获取支持的资产 / Fetch supported assets
   */
  const fetchSupportedAssets = async () => {
    try {
      const response = await fetch('/api/margin/assets');
      const data = await response.json();
      
      if (data.success) {
        setSupportedAssets(data.data);
      }
    } catch (error) {
      console.error('Fetch supported assets error:', error);
    }
  };

  /**
   * 刷新数据 / Refresh data
   */
  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAccount(),
      fetchPositions(),
      fetchRiskMetrics()
    ]);
    setRefreshing(false);
    toast.success('数据已刷新 / Data refreshed');
  };

  /**
   * 创建保证金账户 / Create margin account
   */
  const createMarginAccount = async () => {
    try {
      const response = await fetch('/api/margin/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          stakedAmount: '0' // 初始质押金额为0
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAccount(data.data);
        toast.success('保证金账户创建成功 / Margin account created successfully');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Create account error:', error);
      toast.error('创建账户失败 / Failed to create account');
    }
  };

  /**
   * 保证金操作 / Margin operation
   */
  const handleMarginOperation = async () => {
    if (!marginForm.amount || parseFloat(marginForm.amount) <= 0) {
      toast.error('请输入有效金额 / Please enter valid amount');
      return;
    }

    try {
      const endpoint = marginForm.operation === 'deposit' ? 'deposit' : 'withdraw';
      const response = await fetch(`/api/margin/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          asset: marginForm.asset,
          amount: (parseFloat(marginForm.amount) * 10**18).toString() // 转换为wei
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        setMarginForm({ ...marginForm, amount: '' });
        await fetchAccount();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Margin operation error:', error);
      toast.error('操作失败 / Operation failed');
    }
  };

  /**
   * 开仓 / Open position
   */
  const handleOpenPosition = async () => {
    if (!tradingForm.quantity || parseFloat(tradingForm.quantity) <= 0) {
      toast.error('请输入有效数量 / Please enter valid quantity');
      return;
    }

    if (tradingForm.orderType === OrderType.Limit && (!tradingForm.price || parseFloat(tradingForm.price) <= 0)) {
      toast.error('限价单需要输入价格 / Limit order requires price');
      return;
    }

    try {
      const params: MarginTradingParams = {
        tradingPair: tradingForm.tradingPair,
        side: tradingForm.side,
        orderType: tradingForm.orderType,
        quantity: (parseFloat(tradingForm.quantity) * 10**18).toString(),
        price: tradingForm.price ? (parseFloat(tradingForm.price) * 10**18).toString() : undefined,
        leverage: tradingForm.leverage,
        timeInForce: tradingForm.timeInForce
      };

      const response = await fetch('/api/margin/position/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(params)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('开仓成功 / Position opened successfully');
        setTradingForm({ ...tradingForm, quantity: '', price: '' });
        await Promise.all([fetchAccount(), fetchPositions(), fetchRiskMetrics()]);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Open position error:', error);
      toast.error('开仓失败 / Failed to open position');
    }
  };

  /**
   * 平仓 / Close position
   */
  const handleClosePosition = async (positionId: number) => {
    try {
      const response = await fetch('/api/margin/position/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ positionId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('平仓成功 / Position closed successfully');
        await Promise.all([fetchAccount(), fetchPositions(), fetchRiskMetrics()]);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Close position error:', error);
      toast.error('平仓失败 / Failed to close position');
    }
  };

  /**
   * 获取风险等级颜色 / Get risk level color
   */
  const getRiskLevelColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.Low: return 'text-green-600';
      case RiskLevel.Medium: return 'text-yellow-600';
      case RiskLevel.High: return 'text-orange-600';
      case RiskLevel.Critical: return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  /**
   * 获取账户状态颜色 / Get account status color
   */
  const getAccountStatusColor = (status: AccountStatus) => {
    switch (status) {
      case AccountStatus.Normal: return 'bg-green-100 text-green-800';
      case AccountStatus.MarginCall: return 'bg-yellow-100 text-yellow-800';
      case AccountStatus.Liquidation: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * 格式化数字 / Format number
   */
  const formatNumber = (value: string | number, decimals = 4) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: decimals 
    });
  };

  /**
   * 格式化BigInt / Format BigInt
   */
  const formatBigInt = (value: bigint, decimals = 18, displayDecimals = 4) => {
    const divisor = BigInt(10 ** decimals);
    const quotient = value / divisor;
    const remainder = value % divisor;
    const decimal = Number(remainder) / (10 ** decimals);
    return formatNumber(Number(quotient) + decimal, displayDecimals);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>加载中... / Loading...</p>
        </div>
      </div>
    );
  }

  // 如果没有保证金账户，显示创建界面 / If no margin account, show creation interface
  if (!account) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-center">
              <Shield className="h-8 w-8 mx-auto mb-2" />
              创建保证金账户 / Create Margin Account
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-6">
              您还没有保证金账户，需要先创建一个账户才能进行杠杆交易。
              <br />
              You don't have a margin account yet. Please create one to start margin trading.
            </p>
            <Button onClick={createMarginAccount} className="w-full">
              创建账户 / Create Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题和刷新按钮 / Page title and refresh button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">杠杆交易 / Margin Trading</h1>
        <Button 
          variant="outline" 
          onClick={refreshData} 
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          刷新 / Refresh
        </Button>
      </div>

      {/* 账户状态警告 / Account status warning */}
      {account.status !== AccountStatus.Normal && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {account.status === AccountStatus.MarginCall && 
              '保证金不足，请及时追加保证金 / Insufficient margin, please add margin promptly'}
            {account.status === AccountStatus.Liquidation && 
              '账户正在强制平仓 / Account is being liquidated'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：账户信息和风险监控 / Left: Account info and risk monitoring */}
        <div className="lg:col-span-1 space-y-6">
          {/* 账户概览 / Account overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                账户概览 / Account Overview
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBalances(!showBalances)}
                >
                  {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Badge className={getAccountStatusColor(account.status)}>
                  VIP {account.vipLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">总权益 / Total Equity</Label>
                  <p className="text-lg font-semibold">
                    {showBalances ? `$${formatBigInt(account.totalEquity)}` : '****'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">可用保证金 / Available</Label>
                  <p className="text-lg font-semibold">
                    {showBalances ? `$${formatBigInt(account.availableMargin)}` : '****'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">已用保证金 / Used</Label>
                  <p className="text-lg font-semibold">
                    {showBalances ? `$${formatBigInt(account.usedMargin)}` : '****'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">保证金率 / Margin Ratio</Label>
                  <p className="text-lg font-semibold">
                    {formatNumber(account.marginRatio / 100, 2)}%
                  </p>
                </div>
              </div>
              
              {/* 保证金率进度条 / Margin ratio progress bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>保证金率 / Margin Ratio</span>
                  <span>{formatNumber(account.marginRatio / 100, 2)}%</span>
                </div>
                <Progress 
                  value={Math.min(100, account.marginRatio / 100)} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* 风险监控 / Risk monitoring */}
          {riskMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  风险监控 / Risk Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>风险等级 / Risk Level</Label>
                  <Badge className={getRiskLevelColor(riskMetrics.riskLevel)}>
                    {riskMetrics.riskLevel}
                  </Badge>
                </div>
                
                <div className="flex justify-between">
                  <Label>总杠杆倍数 / Total Leverage</Label>
                  <span>{formatNumber(riskMetrics.leverage, 2)}x</span>
                </div>
                
                <div className="flex justify-between">
                  <Label>未实现盈亏 / Unrealized PnL</Label>
                  <span className={Number(riskMetrics.unrealizedPnl) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ${formatBigInt(riskMetrics.unrealizedPnl)}
                  </span>
                </div>
                
                {riskMetrics.marginCallRequired && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      需要追加保证金 / Margin call required
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：交易面板和持仓管理 / Right: Trading panel and position management */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trading">交易 / Trading</TabsTrigger>
              <TabsTrigger value="positions">持仓 / Positions</TabsTrigger>
              <TabsTrigger value="margin">保证金 / Margin</TabsTrigger>
            </TabsList>

            {/* 交易面板 / Trading panel */}
            <TabsContent value="trading">
              <Card>
                <CardHeader>
                  <CardTitle>杠杆交易 / Leverage Trading</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>交易对 / Trading Pair</Label>
                      <Select 
                        value={tradingForm.tradingPair} 
                        onValueChange={(value) => setTradingForm({...tradingForm, tradingPair: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BTC/USDT">BTC/USDT</SelectItem>
                          <SelectItem value="ETH/USDT">ETH/USDT</SelectItem>
                          <SelectItem value="BNB/USDT">BNB/USDT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>方向 / Side</Label>
                      <Select 
                        value={tradingForm.side} 
                        onValueChange={(value) => setTradingForm({...tradingForm, side: value as OrderSide})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={OrderSide.Buy}>
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              做多 / Long
                            </div>
                          </SelectItem>
                          <SelectItem value={OrderSide.Sell}>
                            <div className="flex items-center gap-2">
                              <TrendingDown className="h-4 w-4 text-red-600" />
                              做空 / Short
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>订单类型 / Order Type</Label>
                      <Select 
                        value={tradingForm.orderType} 
                        onValueChange={(value) => setTradingForm({...tradingForm, orderType: value as OrderType})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={OrderType.Market}>市价单 / Market</SelectItem>
                          <SelectItem value={OrderType.Limit}>限价单 / Limit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>杠杆倍数 / Leverage</Label>
                      <Select 
                        value={tradingForm.leverage.toString()} 
                        onValueChange={(value) => setTradingForm({...tradingForm, leverage: parseInt(value)})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 5, 10, 20, 50, 100].map(leverage => {
                            const vipConfig = vipConfigs.find(c => c.level === account.vipLevel);
                            const maxLeverage = vipConfig?.maxLeverage || 5;
                            return leverage <= maxLeverage ? (
                              <SelectItem key={leverage} value={leverage.toString()}>
                                {leverage}x
                              </SelectItem>
                            ) : null;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>数量 / Quantity</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={tradingForm.quantity}
                        onChange={(e) => setTradingForm({...tradingForm, quantity: e.target.value})}
                      />
                    </div>
                    
                    {tradingForm.orderType === OrderType.Limit && (
                      <div>
                        <Label>价格 / Price</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={tradingForm.price}
                          onChange={(e) => setTradingForm({...tradingForm, price: e.target.value})}
                        />
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={handleOpenPosition} 
                    className="w-full"
                    disabled={account.status !== AccountStatus.Normal}
                  >
                    {tradingForm.side === OrderSide.Buy ? '开多仓 / Open Long' : '开空仓 / Open Short'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 持仓管理 / Position management */}
            <TabsContent value="positions">
              <Card>
                <CardHeader>
                  <CardTitle>当前持仓 / Current Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  {positions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      暂无持仓 / No positions
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {positions.map((position) => (
                        <div key={position.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold">{position.tradingPair}</h3>
                              <div className="flex items-center gap-2">
                                {position.isLong ? (
                                  <Badge className="bg-green-100 text-green-800">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    做多 / Long
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800">
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    做空 / Short
                                  </Badge>
                                )}
                                <Badge variant="outline">{position.leverage}x</Badge>
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleClosePosition(position.id)}
                            >
                              平仓 / Close
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <Label className="text-gray-600">数量 / Quantity</Label>
                              <p>{formatBigInt(position.quantity)}</p>
                            </div>
                            <div>
                              <Label className="text-gray-600">开仓价 / Entry Price</Label>
                              <p>${formatBigInt(position.avgPrice)}</p>
                            </div>
                            <div>
                              <Label className="text-gray-600">保证金 / Margin</Label>
                              <p>${formatBigInt(position.margin)}</p>
                            </div>
                            <div>
                              <Label className="text-gray-600">未实现盈亏 / Unrealized PnL</Label>
                              <p className={Number(position.unrealizedPnl) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                ${formatBigInt(position.unrealizedPnl)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-2 text-xs text-gray-500">
                            强制平仓价 / Liquidation Price: ${formatBigInt(position.liquidationPrice)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 保证金管理 / Margin management */}
            <TabsContent value="margin">
              <Card>
                <CardHeader>
                  <CardTitle>保证金管理 / Margin Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>操作类型 / Operation</Label>
                      <Select 
                        value={marginForm.operation} 
                        onValueChange={(value) => setMarginForm({...marginForm, operation: value as 'deposit' | 'withdraw'})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deposit">存入 / Deposit</SelectItem>
                          <SelectItem value="withdraw">提取 / Withdraw</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>资产 / Asset</Label>
                      <Select 
                        value={marginForm.asset} 
                        onValueChange={(value) => setMarginForm({...marginForm, asset: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {supportedAssets.map(asset => (
                            <SelectItem key={asset} value={asset}>{asset}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>金额 / Amount</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={marginForm.amount}
                      onChange={(e) => setMarginForm({...marginForm, amount: e.target.value})}
                    />
                  </div>

                  <Button onClick={handleMarginOperation} className="w-full">
                    {marginForm.operation === 'deposit' ? '存入保证金 / Deposit' : '提取保证金 / Withdraw'}
                  </Button>

                  {/* 余额显示 / Balance display */}
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">资产余额 / Asset Balances</h3>
                    <div className="space-y-2">
                      {Object.entries(account.balances).map(([asset, balance]) => (
                        <div key={asset} className="flex justify-between">
                          <span>{asset}</span>
                          <span>{showBalances ? formatBigInt(BigInt(balance)) : '****'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default MarginTrading;