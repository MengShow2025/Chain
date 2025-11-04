import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer, useToast } from "@/components/Toast";
import { OptimizedNavigation } from "@/components/OptimizedNavigation";

// Lazy load pages for code splitting / 懒加载页面以实现代码分割
const Home = lazy(() => import("@/pages/Home"));
const Explorer = lazy(() => import("@/pages/Explorer"));
const Wallet = lazy(() => import("@/pages/Wallet"));
const SecurityConsole = lazy(() => import("@/pages/SecurityConsole"));
const Trading = lazy(() => import("@/pages/Trading"));
const MarginTrading = lazy(() => import("@/pages/MarginTrading"));
const TransactionDetail = lazy(() => import("@/pages/TransactionDetail"));
const BlockDetail = lazy(() => import("@/pages/BlockDetail"));
const AddressDetail = lazy(() => import("@/pages/AddressDetail"));
const ValidatorDetail = lazy(() => import("@/pages/ValidatorDetail"));

// Loading component / 加载组件
const LoadingSpinner = React.memo(() => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Loading TitanChain...</p>
    </div>
  </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

// Coming Soon component / 即将推出组件
const ComingSoon = React.memo(() => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Coming Soon</h1>
      <p className="text-gray-600">This page is under development</p>
    </div>
  </div>
));

ComingSoon.displayName = 'ComingSoon';

// Optimized App Component / 优化的App组件
const OptimizedApp = React.memo(() => {
  const { toasts, removeToast } = useToast();

  return (
    <ErrorBoundary>
      <Router>
        {/* Global Navigation Bar / 全局导航栏 */}
        <OptimizedNavigation />
        
        {/* Main Content with top padding for fixed navigation / 主要内容区域，为固定导航栏添加顶部间距 */}
        <div className="pt-16">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/explorer" element={<Explorer />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/trading" element={<Trading />} />
              <Route path="/margin-trading" element={<MarginTrading />} />
              <Route path="/security" element={<SecurityConsole />} />
              <Route path="/security-console" element={<SecurityConsole />} />
              <Route path="/tx/:hash" element={<TransactionDetail />} />
              <Route path="/block/:height" element={<BlockDetail />} />
              <Route path="/address/:address" element={<AddressDetail />} />
              <Route path="/validator/:address" element={<ValidatorDetail />} />
              <Route path="/other" element={<ComingSoon />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ErrorBoundary>
  );
});

OptimizedApp.displayName = 'OptimizedApp';

export default OptimizedApp;