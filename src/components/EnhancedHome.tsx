import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  Blocks, 
  Users, 
  Zap, 
  ArrowRight, 
  Shield, 
  TrendingUp, 
  Server, 
  Eye, 
  Cpu, 
  BarChart3, 
  Settings,
  Globe,
  Lock,
  Layers,
  Rocket,
  Star,
  CheckCircle,
  ArrowUpRight,
  Play,
  Pause
} from 'lucide-react';
import Navigation from './Navigation';

// 实时数据接口
interface NetworkStats {
  tps: number;
  blockTime: number;
  validators: number;
  totalTransactions: number;
  marketCap: string;
  price: number;
  change24h: number;
}

// 动画计数器组件
function AnimatedCounter({ 
  value, 
  suffix = '', 
  prefix = '', 
  duration = 2000 
}: { 
  value: number; 
  suffix?: string; 
  prefix?: string; 
  duration?: number; 
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setCount(Math.floor(progress * value));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  return (
    <span>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

// 特性卡片组件
function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  color, 
  delay = 0 
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div 
      className={`
        bg-white rounded-2xl p-8 shadow-sm border border-gray-200 
        hover:shadow-lg hover:scale-105 transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-6`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-4">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

// 生态系统卡片组件
function EcosystemCard({ 
  icon: Icon, 
  title, 
  count, 
  color,
  delay = 0 
}: {
  icon: React.ElementType;
  title: string;
  count: string;
  color: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div 
      className={`
        bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-200 
        hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mx-auto mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{count}</p>
    </div>
  );
}

export function EnhancedHome() {
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    tps: 0,
    blockTime: 2.1,
    validators: 108,
    totalTransactions: 0,
    marketCap: '$2.5B',
    price: 45.67,
    change24h: 12.5
  });

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // 模拟实时数据更新
  useEffect(() => {
    const updateStats = () => {
      setNetworkStats(prev => ({
        ...prev,
        tps: Math.floor(Math.random() * 50000) + 150000,
        totalTransactions: Math.floor(Math.random() * 1000000) + 50000000,
        price: 45.67 + (Math.random() - 0.5) * 2,
        change24h: 12.5 + (Math.random() - 0.5) * 5
      }));
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: Zap,
      title: '零Gas费用',
      description: '革命性的零Gas技术，为用户消除交易成本',
      color: 'bg-gradient-to-r from-green-500 to-emerald-600'
    },
    {
      icon: TrendingUp,
      title: '高性能处理',
      description: '超快处理速度，支持200K+ TPS和2.1秒出块时间',
      color: 'bg-gradient-to-r from-blue-500 to-cyan-600'
    },
    {
      icon: Shield,
      title: '先进共识',
      description: '创新的PoS共识机制，具有动态验证者选择',
      color: 'bg-gradient-to-r from-purple-500 to-violet-600'
    },
    {
      icon: Blocks,
      title: 'EVM兼容',
      description: '完全兼容以太坊，支持无缝dApp迁移',
      color: 'bg-gradient-to-r from-yellow-500 to-orange-600'
    },
    {
      icon: Users,
      title: '深度流动性',
      description: '内置流动性池和跨链桥接解决方案',
      color: 'bg-gradient-to-r from-indigo-500 to-blue-600'
    },
    {
      icon: Eye,
      title: '实时监控',
      description: '先进的网络监控和性能分析',
      color: 'bg-gradient-to-r from-red-500 to-pink-600'
    }
  ];

  const ecosystemItems = [
    { icon: Activity, title: 'DApps', count: '50+', color: 'bg-gradient-to-r from-blue-500 to-cyan-600' },
    { icon: TrendingUp, title: 'DeFi协议', count: '25+', color: 'bg-gradient-to-r from-green-500 to-emerald-600' },
    { icon: Blocks, title: 'NFT市场', count: '10+', color: 'bg-gradient-to-r from-purple-500 to-violet-600' },
    { icon: Zap, title: '游戏', count: '15+', color: 'bg-gradient-to-r from-yellow-500 to-orange-600' },
    { icon: Server, title: '基础设施', count: '20+', color: 'bg-gradient-to-r from-indigo-500 to-blue-600' },
    { icon: Settings, title: '开发工具', count: '30+', color: 'bg-gradient-to-r from-red-500 to-pink-600' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 导航栏 */}
      <Navigation />

      {/* 英雄区域 */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-purple-400 to-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-6">
              <Star className="w-4 h-4" />
              现已上线主网
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              欢迎来到
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                TitanChain
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto mb-8 leading-relaxed">
              体验超快交易、无与伦比的安全性和创新的DeFi解决方案
              <br />
              <span className="text-blue-600 font-semibold">下一代区块链平台</span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              to="/explorer"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-2xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            >
              <Activity className="w-5 h-5" />
              探索网络
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <button 
              onClick={() => setIsVideoPlaying(!isVideoPlaying)}
              className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 font-semibold rounded-2xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300"
            >
              {isVideoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              观看演示
            </button>
          </div>
          
          {/* 实时统计 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                <AnimatedCounter value={networkStats.tps} suffix="+" />
              </div>
              <div className="text-sm text-gray-600">TPS</div>
              <div className="text-xs text-green-600 mt-1">实时更新</div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300">
              <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">0</div>
              <div className="text-sm text-gray-600">Gas费用</div>
              <div className="text-xs text-green-600 mt-1">永久免费</div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300">
              <div className="text-3xl md:text-4xl font-bold text-purple-600 mb-2">
                <AnimatedCounter value={networkStats.validators} />
              </div>
              <div className="text-sm text-gray-600">验证者</div>
              <div className="text-xs text-blue-600 mt-1">去中心化</div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300">
              <div className="text-3xl md:text-4xl font-bold text-yellow-600 mb-2">
                {networkStats.blockTime}s
              </div>
              <div className="text-sm text-gray-600">出块时间</div>
              <div className="text-xs text-yellow-600 mt-1">超快确认</div>
            </div>
          </div>

          {/* 价格信息 */}
          <div className="mt-8 inline-flex items-center gap-4 px-6 py-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200">
            <div className="text-sm text-gray-600">TITAN价格:</div>
            <div className="text-lg font-bold text-gray-900">
              ${networkStats.price.toFixed(2)}
            </div>
            <div className={`text-sm font-medium ${networkStats.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {networkStats.change24h >= 0 ? '+' : ''}{networkStats.change24h.toFixed(2)}%
            </div>
          </div>
        </div>
      </section>

      {/* 特性区域 */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              为什么选择TitanChain？
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              发现我们尖端区块链技术的优势
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                color={feature.color}
                delay={index * 100}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 生态系统区域 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              TitanChain生态系统
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              探索不断增长的应用程序和服务生态系统
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {ecosystemItems.map((item, index) => (
              <EcosystemCard
                key={item.title}
                icon={item.icon}
                title={item.title}
                count={item.count}
                color={item.color}
                delay={index * 100}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 安全性区域 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-gray-900 to-blue-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                企业级安全
              </h2>
              <p className="text-xl text-gray-300 mb-8">
                多层安全防护，包括零知识证明、可信执行环境和量子抗性加密
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <span className="text-lg">零知识证明技术</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <span className="text-lg">可信执行环境(TEE)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <span className="text-lg">多方安全计算(MPC)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <span className="text-lg">量子抗性加密</span>
                </div>
              </div>
              
              <Link
                to="/security"
                className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-white text-gray-900 font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
              >
                查看安全控制台
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-400">99.9%</div>
                    <div className="text-sm text-gray-300">安全评分</div>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-8 h-8 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-blue-400">5层</div>
                    <div className="text-sm text-gray-300">安全防护</div>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Layers className="w-8 h-8 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-400">24/7</div>
                    <div className="text-sm text-gray-300">实时监控</div>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-yellow-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Cpu className="w-8 h-8 text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold text-yellow-400">0</div>
                    <div className="text-sm text-gray-300">安全事件</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 社区区域 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            加入我们的社区
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
            与全球的开发者、验证者和爱好者建立联系
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="#" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 hover:scale-105 transition-all duration-300"
            >
              <Globe className="w-5 h-5" />
              加入Discord
            </a>
            <a 
              href="#" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 hover:scale-105 transition-all duration-300"
            >
              <Globe className="w-5 h-5" />
              加入Telegram
            </a>
            <a 
              href="#" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 hover:scale-105 transition-all duration-300"
            >
              <Globe className="w-5 h-5" />
              关注Twitter
            </a>
            <a 
              href="#" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-700 hover:scale-105 transition-all duration-300"
            >
              <Globe className="w-5 h-5" />
              查看GitHub
            </a>
          </div>
        </div>
      </section>

      {/* CTA区域 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            与TitanChain共建未来
          </h2>
          <p className="text-xl mb-8 opacity-90">
            为开发者、企业和用户打造的完美区块链平台
          </p>
          <Link
            to="/explorer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 font-semibold rounded-2xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
          >
            <Rocket className="w-5 h-5" />
            立即开始
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="bg-gray-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Activity className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">TitanChain</h3>
                  <p className="text-sm text-gray-400">下一代区块链</p>
                </div>
              </div>
              <p className="text-gray-400 max-w-md mb-6">
                TitanChain是为下一代去中心化应用程序打造的高性能区块链平台。
              </p>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    <AnimatedCounter value={networkStats.totalTransactions} suffix="+" />
                  </div>
                  <div className="text-xs text-gray-500">总交易数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{networkStats.marketCap}</div>
                  <div className="text-xs text-gray-500">市值</div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-lg">平台</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">文档</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API参考</a></li>
                <li><a href="#" className="hover:text-white transition-colors">SDK</a></li>
                <li><a href="#" className="hover:text-white transition-colors">白皮书</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-lg">社区</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-white transition-colors">博客</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 TitanChain. 保留所有权利。
            </p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">隐私政策</a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">服务条款</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default EnhancedHome;