/**
 * Mobile Menu Component
 * 移动端菜单组件 - Mobile navigation menu component
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  Home, 
  Search, 
  Wallet, 
  Shield, 
  TrendingUp, 
  Settings,
  ChevronRight,
  Activity
} from 'lucide-react';

interface MobileMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

export function MobileMenu({ isOpen, onToggle, onClose }: MobileMenuProps) {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);

  // Menu items configuration / 菜单项配置
  const menuItems: MenuItem[] = [
    {
      path: '/',
      label: '首页',
      icon: <Home className="w-5 h-5" />,
      description: 'TitanChain主页'
    },
    {
      path: '/explorer',
      label: '区块浏览器',
      icon: <Search className="w-5 h-5" />,
      description: '探索区块链数据'
    },
    {
      path: '/wallet',
      label: '钱包',
      icon: <Wallet className="w-5 h-5" />,
      description: '管理您的资产'
    },
    {
      path: '/trading',
      label: '交易',
      icon: <TrendingUp className="w-5 h-5" />,
      description: 'DeFi交易平台'
    },
    {
      path: '/security-console',
      label: '安全控制台',
      icon: <Shield className="w-5 h-5" />,
      description: '安全监控中心'
    }
  ];

  // Handle menu animation / 处理菜单动画
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setIsAnimating(false), 300);
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close menu on route change / 路由变化时关闭菜单
  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  // Handle backdrop click / 处理背景点击
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Check if menu item is active / 检查菜单项是否激活
  const isActiveItem = (path: string) => {
    return location.pathname === path;
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <>
      {/* Mobile Menu Toggle Button / 移动端菜单切换按钮 */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed top-4 right-4 z-50 p-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 hover:bg-white transition-all duration-200"
        aria-label="Toggle mobile menu"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-gray-700" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* Backdrop / 背景遮罩 */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleBackdropClick}
      />

      {/* Mobile Menu Panel / 移动端菜单面板 */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-40 lg:hidden transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Menu Header / 菜单头部 */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">TitanChain</h2>
              <p className="text-sm text-gray-600">下一代区块链</p>
            </div>
          </div>
        </div>

        {/* Menu Items / 菜单项 */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-2 px-4">
            {menuItems.map((item, index) => (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center gap-4 p-4 rounded-xl transition-all duration-200 ${
                  isActiveItem(item.path)
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 text-blue-700'
                    : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                }`}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                <div className={`p-2 rounded-lg transition-colors ${
                  isActiveItem(item.path)
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                }`}>
                  {item.icon}
                </div>
                
                <div className="flex-1">
                  <div className="font-medium">{item.label}</div>
                  {item.description && (
                    <div className="text-sm text-gray-500 mt-1">
                      {item.description}
                    </div>
                  )}
                </div>
                
                <ChevronRight className={`w-4 h-4 transition-transform ${
                  isActiveItem(item.path) ? 'text-blue-500' : 'text-gray-400'
                }`} />
              </Link>
            ))}
          </div>
        </nav>

        {/* Menu Footer / 菜单底部 */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="space-y-3">
            {/* Network Status / 网络状态 */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">网络状态</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-600 font-medium">在线</span>
              </div>
            </div>
            
            {/* Quick Stats / 快速统计 */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="font-bold text-blue-600">200K+</div>
                <div className="text-gray-500">TPS</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="font-bold text-green-600">0</div>
                <div className="text-gray-500">Gas费用</div>
              </div>
            </div>

            {/* Settings Link / 设置链接 */}
            <Link
              to="/settings"
              className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">设置</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default MobileMenu;