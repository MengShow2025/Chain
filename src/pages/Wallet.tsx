import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft, Wallet as WalletIcon } from 'lucide-react';
import BalanceChecker from '../components/wallet/BalanceChecker';

export default function Wallet() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">返回首页</span>
              </Link>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">TitanChain</h1>
                <p className="text-xs text-gray-600">钱包管理</p>
              </div>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/explorer" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                区块浏览器
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <WalletIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">钱包管理</h1>
          </div>
          <p className="text-lg text-gray-600">
            查询TitanChain网络上任意地址的余额和交易信息
          </p>
        </div>

        {/* Balance Checker Component */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Balance Checker */}
          <div className="lg:col-span-2">
            <BalanceChecker />
          </div>
          
          {/* Sidebar with Network Info */}
          <div className="space-y-6">
            {/* Network Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                网络状态
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">网络:</span>
                  <span className="text-green-600 font-medium">TitanChain 主网</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">状态:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-green-600 font-medium">正常运行</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">API端点:</span>
                  <span className="text-gray-900 dark:text-white font-mono text-sm">
                    localhost:3001
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                快捷操作
              </h3>
              <div className="space-y-3">
                <Link
                  to="/explorer"
                  className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white 
                           rounded-lg transition-colors text-center font-medium"
                >
                  查看区块浏览器
                </Link>
                <button
                  className="block w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 
                           rounded-lg transition-colors text-center font-medium"
                  disabled
                >
                  连接钱包 (即将推出)
                </button>
                <button
                  className="block w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 
                           rounded-lg transition-colors text-center font-medium"
                  disabled
                >
                  发送交易 (即将推出)
                </button>
              </div>
            </div>

            {/* Network Statistics */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                网络统计
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">总验证节点:</span>
                  <span className="text-gray-900 dark:text-white font-medium">108</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">活跃验证节点:</span>
                  <span className="text-green-600 font-medium">4</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平均出块时间:</span>
                  <span className="text-gray-900 dark:text-white font-medium">2.1s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">网络TPS:</span>
                  <span className="text-blue-600 font-medium">200K+</span>
                </div>
              </div>
            </div>

            {/* Help & Documentation */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                帮助文档
              </h3>
              <div className="space-y-2">
                <a
                  href="#"
                  className="block text-blue-600 hover:text-blue-700 text-sm transition-colors"
                >
                  如何查询余额？
                </a>
                <a
                  href="#"
                  className="block text-blue-600 hover:text-blue-700 text-sm transition-colors"
                >
                  地址格式说明
                </a>
                <a
                  href="#"
                  className="block text-blue-600 hover:text-blue-700 text-sm transition-colors"
                >
                  API文档
                </a>
                <a
                  href="#"
                  className="block text-blue-600 hover:text-blue-700 text-sm transition-colors"
                >
                  常见问题
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}