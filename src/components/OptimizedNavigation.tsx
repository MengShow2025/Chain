import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Activity, 
  Sun, 
  Moon, 
  Bell, 
  ChevronDown
} from 'lucide-react';
import { WalletConnector } from './WalletConnector';
import { MobileMenu } from './MobileMenu';

interface NavigationProps {
  className?: string;
}

// Memoized Logo Component / 记忆化Logo组件
const Logo = React.memo(() => (
  <Link to="/" className="flex items-center gap-3 group">
    <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
      <Activity className="w-6 h-6 text-white" />
    </div>
    <div className="hidden sm:block">
      <h1 className="text-xl font-bold text-gray-900">TitanChain</h1>
      <p className="text-xs text-gray-500 -mt-1">Next-Gen Blockchain</p>
    </div>
  </Link>
));

Logo.displayName = 'Logo';

// Memoized Navigation Item / 记忆化导航项
const NavigationItem = React.memo(({ path, label, active }: { path: string; label: string; active: boolean }) => (
  <Link
    to={path}
    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
      active
        ? 'bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 shadow-sm'
        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
    }`}
  >
    {label}
  </Link>
));

NavigationItem.displayName = 'NavigationItem';

// Memoized Theme Toggle / 记忆化主题切换
const ThemeToggle = React.memo(({ isDarkMode, onToggle }: { isDarkMode: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
    aria-label="Toggle theme"
  >
    {isDarkMode ? (
      <Sun className="w-5 h-5 text-gray-700" />
    ) : (
      <Moon className="w-5 h-5 text-gray-700" />
    )}
  </button>
));

ThemeToggle.displayName = 'ThemeToggle';

// Memoized Notification Button / 记忆化通知按钮
const NotificationButton = React.memo(({ notifications }: { notifications: number }) => (
  <button className="relative p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
    <Bell className="w-5 h-5 text-gray-700" />
    {notifications > 0 && (
      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
        {notifications}
      </span>
    )}
  </button>
));

NotificationButton.displayName = 'NotificationButton';

export const OptimizedNavigation = React.memo(({ className = '' }: NavigationProps) => {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(3);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Memoized navigation items / 记忆化导航项
  const navItems = useMemo(() => [
    { path: '/', label: 'Home', active: location.pathname === '/' },
    { path: '/explorer', label: 'Explorer', active: location.pathname === '/explorer' },
    { path: '/trading', label: 'Trading', active: location.pathname === '/trading' },
    { path: '/wallet', label: 'Wallet', active: location.pathname === '/wallet' },
    { path: '/security-console', label: 'Security', active: location.pathname === '/security-console' }
  ], [location.pathname]);

  // Optimized scroll handler / 优化的滚动处理器
  const handleScroll = useCallback(() => {
    const scrolled = window.scrollY > 20;
    if (scrolled !== isScrolled) {
      setIsScrolled(scrolled);
    }
  }, [isScrolled]);

  // Handle scroll effect / 处理滚动效果
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Optimized theme toggle / 优化的主题切换
  const handleThemeToggle = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Optimized mobile menu handlers / 优化的移动端菜单处理器
  const handleMobileMenuToggle = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  const handleMobileMenuClose = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // Memoized navigation class / 记忆化导航类名
  const navigationClass = useMemo(() => 
    `fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200' 
        : 'bg-transparent'
    } ${className}`,
    [isScrolled, className]
  );

  return (
    <>
      <nav className={navigationClass}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo />
            <div className="hidden lg:flex items-center space-x-8">
              {navItems.map((item) => (
                <NavigationItem
                  key={item.path}
                  path={item.path}
                  label={item.label}
                  active={item.active}
                />
              ))}
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle isDarkMode={isDarkMode} onToggle={handleThemeToggle} />
              <NotificationButton notifications={notifications} />
              <WalletConnector />
            </div>
          </div>
        </div>
      </nav>
      <MobileMenu 
        isOpen={isMobileMenuOpen}
        onToggle={handleMobileMenuToggle}
        onClose={handleMobileMenuClose}
      />
    </>
  );
});

OptimizedNavigation.displayName = 'OptimizedNavigation';

export default OptimizedNavigation;