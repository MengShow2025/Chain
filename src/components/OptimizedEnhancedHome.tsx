/**
 * Optimized Enhanced Home Component
 * 优化的增强主页组件 - Performance optimized home page component
 */

import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  ArrowRight, 
  Shield, 
  Zap, 
  TrendingUp, 
  Blocks, 
  Users, 
  Eye,
  Server,
  Settings,
  ChevronRight,
  Cpu,
  Lock,
  Globe,
  BarChart3
} from 'lucide-react';

// Lazy load heavy components / 懒加载重型组件
const LazyChart = lazy(() => import('./Chart').catch(() => ({ 
  default: () => <div className="p-4 text-center text-gray-500">Chart not available</div> 
})));

interface NetworkStats {
  tps: number;
  gasFee: number;
  validators: number;
  blockTime: number;
  titanPrice: number;
}

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface EcosystemCard {
  id: string;
  title: string;
  count: string;
  icon: React.ReactNode;
  color: string;
}

// Memoized counter component / 记忆化计数器组件
const AnimatedCounter = React.memo(({ 
  target, 
  suffix = '', 
  duration = 2000 
}: { 
  target: number; 
  suffix?: string; 
  duration?: number; 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      setCount(Math.floor(target * progress));
      
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
  }, [target, duration]);

  return <span>{count.toLocaleString()}{suffix}</span>;
});

AnimatedCounter.displayName = 'AnimatedCounter';

// Memoized feature card component / 记忆化特性卡片组件
const FeatureCard = React.memo(({ feature }: { feature: FeatureCard }) => (
  <div className="group bg-white rounded-2xl p-8 shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-200 transition-all duration-300 transform hover:-translate-y-1">
    <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
      {feature.icon}
    </div>
    <h3 className="text-xl font-semibold text-gray-900 mb-4">{feature.title}</h3>
    <p className="text-gray-600 leading-relaxed">{feature.description}</p>
  </div>
));

FeatureCard.displayName = 'FeatureCard';

// Memoized ecosystem card component / 记忆化生态系统卡片组件
const EcosystemCard = React.memo(({ ecosystem }: { ecosystem: EcosystemCard }) => (
  <div className="group bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-200 hover:shadow-lg hover:border-purple-200 transition-all duration-300 transform hover:-translate-y-1">
    <div className={`w-12 h-12 ${ecosystem.color} rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
      {ecosystem.icon}
    </div>
    <h3 className="font-semibold text-gray-900 mb-2">{ecosystem.title}</h3>
    <p className="text-2xl font-bold text-blue-600">{ecosystem.count}</p>
  </div>
));

EcosystemCard.displayName = 'EcosystemCard';

export function OptimizedEnhancedHome() {
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    tps: 200000,
    gasFee: 0,
    validators: 108,
    blockTime: 2.1,
    titanPrice: 45.67
  });

  // Memoized feature data / 记忆化特性数据
  const features = useMemo<FeatureCard[]>(() => [
    {
      id: 'zero-gas',
      title: '零Gas费用',
      description: '革命性的零gas技术，为用户消除交易成本，让区块链使用更加便民',
      icon: <Zap className="w-6 h-6 text-green-600" />,
      color: 'bg-green-100'
    },
    {
      id: 'high-performance',
      title: '高性能处理',
      description: '超快处理速度，支持200K+ TPS和2.1秒出块时间，满足企业级应用需求',
      icon: <TrendingUp className="w-6 h-6 text-blue-600" />,
      color: 'bg-blue-100'
    },
    {
      id: 'advanced-consensus',
      title: '先进共识机制',
      description: '创新的PoS共识机制，具备动态验证者选择和智能分片技术',
      icon: <Shield className="w-6 h-6 text-purple-600" />,
      color: 'bg-purple-100'
    },
    {
      id: 'evm-compatible',
      title: 'EVM兼容',
      description: '完全兼容以太坊虚拟机，支持现有DApp无缝迁移和部署',
      icon: <Blocks className="w-6 h-6 text-yellow-600" />,
      color: 'bg-yellow-100'
    },
    {
      id: 'deep-liquidity',
      title: '深度流动性',
      description: '内置流动性池和跨链桥接解决方案，提供充足的市场流动性',
      icon: <Users className="w-6 h-6 text-indigo-600" />,
      color: 'bg-indigo-100'
    },
    {
      id: 'real-time-monitoring',
      title: '实时监控',
      description: '先进的网络监控和性能分析系统，确保网络稳定运行',
      icon: <Eye className="w-6 h-6 text-red-600" />,
      color: 'bg-red-100'
    }
  ], []);

  // Memoized ecosystem data / 记忆化生态系统数据
  const ecosystem = useMemo<EcosystemCard[]>(() => [
    {
      id: 'dapps',
      title: 'DApps',
      count: '50+',
      icon: <Activity className="w-6 h-6 text-blue-600" />,
      color: 'bg-blue-100'
    },
    {
      id: 'defi',
      title: 'DeFi协议',
      count: '25+',
      icon: <TrendingUp className="w-6 h-6 text-green-600" />,
      color: 'bg-green-100'
    },
    {
      id: 'nft',
      title: 'NFT市场',
      count: '10+',
      icon: <Blocks className="w-6 h-6 text-purple-600" />,
      color: 'bg-purple-100'
    },
    {
      id: 'games',
      title: '游戏',
      count: '15+',
      icon: <Zap className="w-6 h-6 text-yellow-600" />,
      color: 'bg-yellow-100'
    },
    {
      id: 'infrastructure',
      title: '基础设施',
      count: '20+',
      icon: <Server className="w-6 h-6 text-indigo-600" />,
      color: 'bg-indigo-100'
    },
    {
      id: 'dev-tools',
      title: '开发工具',
      count: '30+',
      icon: <Settings className="w-6 h-6 text-red-600" />,
      color: 'bg-red-100'
    }
  ], []);

  // Memoized security features / 记忆化安全特性
  const securityFeatures = useMemo(() => [
    {
      id: 'zk-proofs',
      title: '零知识证明',
      description: 'SNARK/STARK协议保护隐私',
      icon: <Lock className="w-5 h-5 text-blue-600" />
    },
    {
      id: 'tee',
      title: 'TEE可信执行',
      description: 'SGX/SEV硬件级安全保护',
      icon: <Shield className="w-5 h-5 text-green-600" />
    },
    {
      id: 'mpc',
      title: 'MPC多方计算',
      description: '分布式密钥管理和计算',
      icon: <Users className="w-5 h-5 text-purple-600" />
    },
    {
      id: 'quantum-resistant',
      title: '量子抗性加密',
      description: 'KYBER/DILITHIUM后量子算法',
      icon: <Cpu className="w-5 h-5 text-red-600" />
    }
  ], []);

  // Optimized network stats update / 优化的网络统计更新
  const updateNetworkStats = useCallback(() => {
    setNetworkStats(prev => ({
      ...prev,
      tps: prev.tps + Math.floor(Math.random() * 1000 - 500),
      titanPrice: prev.titanPrice + (Math.random() - 0.5) * 2
    }));
  }, []);

  // Update network stats periodically / 定期更新网络统计
  useEffect(() => {
    const interval = setInterval(updateNetworkStats, 5000);
    return () => clearInterval(interval);
  }, [updateNetworkStats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section / 英雄区域 */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5"></div>
        <div className="relative max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              欢迎来到
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> TitanChain</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">体验超快交易、无与伦比的安全性和创新的DeFi解决方案，构建下一代去中心化应用</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              to="/explorer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              <Activity className="w-5 h-5" />
              探索网络
              <ArrowRight className="w-4 h-4" />
            </Link>
            
            <button className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 font-semibold rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
              <Shield className="w-5 h-5" />
              成为验证者
            </button>
          </div>
          
          {/* Real-time Network Stats / 实时网络统计 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 max-w-5xl mx-auto">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                <AnimatedCounter target={networkStats.tps} suffix="+" />
              </div>
              <div className="text-sm text-gray-600">TPS</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
              <div className="text-3xl font-bold text-green-600 mb-2">
                <AnimatedCounter target={networkStats.gasFee} />
              </div>
              <div className="text-sm text-gray-600">Gas费用</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                <AnimatedCounter target={networkStats.validators} />
              </div>
              <div className="text-sm text-gray-600">验证者</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
              <div className="text-3xl font-bold text-yellow-600 mb-2">
                {networkStats.blockTime}s
              </div>
              <div className="text-sm text-gray-600">出块时间</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
              <div className="text-3xl font-bold text-indigo-600 mb-2">
                ${networkStats.titanPrice.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">TITAN价格</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section / 特性区域 */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">为什么选择TitanChain？</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              发现我们尖端区块链技术的优势
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Ecosystem Section / 生态系统区域 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">TitanChain生态系统</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              探索不断增长的应用和服务生态系统
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {ecosystem.map((item) => (
              <EcosystemCard key={item.id} ecosystem={item} />
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Security Section / 企业级安全区域 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-gray-900 to-blue-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">企业级安全保障</h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              多层次安全防护，保障您的数字资产和隐私安全
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {securityFeatures.map((feature) => (
              <div key={feature.id} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  {feature.icon}
                  <h3 className="font-semibold">{feature.title}</h3>
                </div>
                <p className="text-sm opacity-80">{feature.description}</p>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link
              to="/security-console"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              <Shield className="w-5 h-5" />
              访问安全控制台
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Performance Chart Section / 性能图表区域 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">实时性能监控</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              监控网络性能和交易吞吐量
            </p>
          </div>
          
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-8 h-8 text-blue-600 animate-pulse" />
                  <span className="text-gray-600">加载性能图表中...</span>
                </div>
              </div>
            }>
              <LazyChart />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Community Section / 社区区域 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">加入我们的社区</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12">
            与全球开发者、验证者和爱好者建立联系
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
              <Globe className="w-5 h-5" />
              加入Discord
            </a>
            <a href="#" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors">
              加入Telegram
            </a>
            <a href="#" className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors">
              关注Twitter
            </a>
            <a href="#" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors">
              查看GitHub
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section / 行动号召区域 */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-4">与TitanChain共建未来</h2>
          <p className="text-xl mb-8 opacity-90">
            为开发者、企业和用户打造的完美区块链平台
          </p>
          <Link
            to="/explorer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            立即开始
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default OptimizedEnhancedHome;