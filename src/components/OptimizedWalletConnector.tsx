import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Wallet, ChevronDown, ExternalLink, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { useWalletStore } from '../hooks/useWallet';

interface WalletOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  installed?: boolean;
}

// Check if wallet is installed / 检查钱包是否已安装
const checkWalletInstallation = () => {
  if (typeof window === 'undefined') return { metamask: false, coinbase: false, trust: false };
  
  const ethereum = (window as any).ethereum;
  
  return {
    metamask: !!(ethereum && ethereum.isMetaMask),
    coinbase: !!(ethereum && ethereum.isCoinbaseWallet),
    trust: !!(ethereum && ethereum.isTrust)
  };
};

// Memoized Wallet Option Component / 记忆化钱包选项组件
const WalletOption = React.memo(({ 
  wallet, 
  connecting, 
  onConnect 
}: { 
  wallet: WalletOption; 
  connecting: boolean; 
  onConnect: (walletId: string) => void;
}) => (
  <button
    onClick={() => onConnect(wallet.id)}
    disabled={connecting}
    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
  >
    <span className="text-2xl">{wallet.icon}</span>
    <div className="flex-1 text-left">
      <div className="font-medium text-gray-900">{wallet.name}</div>
      <div className="text-sm text-gray-600">{wallet.description}</div>
      {wallet.installed === false && (
        <div className="text-xs text-red-500 mt-1">Not installed</div>
      )}
    </div>
    {wallet.installed === false && (
      <ExternalLink size={16} className="text-gray-400" />
    )}
  </button>
));

WalletOption.displayName = 'WalletOption';

// Memoized Error Display / 记忆化错误显示
const ErrorDisplay = React.memo(({ error }: { error: string }) => (
  <div className="p-3 border-b border-gray-100">
    <div className="flex items-center gap-2 text-red-600">
      <AlertCircle size={16} />
      <span className="text-sm">{error}</span>
    </div>
  </div>
));

ErrorDisplay.displayName = 'ErrorDisplay';

// Memoized Network Status / 记忆化网络状态
const NetworkStatus = React.memo(({ 
  isCorrectNetwork, 
  onSwitchNetwork 
}: { 
  isCorrectNetwork: boolean; 
  onSwitchNetwork: () => void;
}) => {
  if (isCorrectNetwork) {
    return (
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Network</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-900">TitanChain Mainnet</span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Chain ID: 1001
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-yellow-500" />
        <span className="text-sm font-medium text-yellow-800">Wrong Network</span>
      </div>
      <p className="text-sm text-gray-600 mb-3">
        Please switch to TitanChain network to continue
      </p>
      <button
        onClick={onSwitchNetwork}
        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
      >
        Switch to TitanChain
      </button>
    </div>
  );
});

NetworkStatus.displayName = 'NetworkStatus';

const OptimizedWalletConnector: React.FC = () => {
  const {
    isConnected,
    address,
    balance,
    chainId,
    connecting,
    connect,
    disconnect,
    switchNetwork
  } = useWalletStore();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletInstalled, setWalletInstalled] = useState({ metamask: false, coinbase: false, trust: false });
  
  // Memoized wallet installation check / 记忆化钱包安装检查
  const checkInstallation = useCallback(() => {
    setWalletInstalled(checkWalletInstallation());
  }, []);

  // Check wallet installation status / 检查钱包安装状态
  useEffect(() => {
    checkInstallation();
    
    // Listen for window.ethereum changes / 监听window.ethereum变化
    const handleEthereumChange = () => {
      checkInstallation();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('ethereum#initialized', handleEthereumChange);
      
      // Delayed check as some wallets may need time to initialize / 延迟检查，因为某些钱包可能需要时间初始化
      const timer = setTimeout(checkInstallation, 1000);
      
      return () => {
        window.removeEventListener('ethereum#initialized', handleEthereumChange);
        clearTimeout(timer);
      };
    }
  }, [checkInstallation]);
  
  // Memoized supported wallets / 记忆化支持的钱包
  const SUPPORTED_WALLETS: WalletOption[] = useMemo(() => [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: '🦊',
      description: 'Connect using browser wallet',
      installed: walletInstalled.metamask
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      icon: '🔗',
      description: 'Scan with WalletConnect to connect',
      installed: true // WalletConnect doesn't need installation
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      icon: '🔵',
      description: 'Connect using Coinbase Wallet',
      installed: walletInstalled.coinbase
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      icon: '🛡️',
      description: 'Connect using Trust Wallet',
      installed: walletInstalled.trust
    }
  ], [walletInstalled]);
  
  // Check if on correct network / 检查是否在正确的网络
  const isCorrectNetwork = useMemo(() => chainId === 1001, [chainId]); // TitanChain chain ID

  // Optimized connect handler / 优化的连接处理器
  const handleConnect = useCallback(async (walletId: string) => {
    setError(null);
    
    try {
      // Check if wallet is installed / 检查钱包是否已安装
      const wallet = SUPPORTED_WALLETS.find(w => w.id === walletId);
      if (wallet && wallet.installed === false) {
        setError(`${wallet.name} is not installed. Please install it first.`);
        return;
      }
      
      await connect(walletId);
      setShowDropdown(false);
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      
      // Provide user-friendly error messages / 提供用户友好的错误消息
      let errorMessage = 'Failed to connect wallet';
      
      if (error.message.includes('MetaMask is not installed')) {
        errorMessage = 'MetaMask is not installed. Please install MetaMask extension.';
      } else if (error.message.includes('User rejected')) {
        errorMessage = 'Connection was rejected by user';
      } else if (error.message.includes('No accounts found')) {
        errorMessage = 'No accounts found. Please unlock your wallet.';
      } else if (error.message.includes('WalletConnect integration not implemented')) {
        errorMessage = 'WalletConnect is not yet implemented';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    }
  }, [SUPPORTED_WALLETS, connect]);
  
  // Optimized disconnect handler / 优化的断开连接处理器
  const handleDisconnect = useCallback(async () => {
    setError(null);
    try {
      await disconnect();
      setShowDropdown(false);
    } catch (error: any) {
      console.error('Failed to disconnect wallet:', error);
      setError('Failed to disconnect wallet');
    }
  }, [disconnect]);

  // Optimized network switch handler / 优化的网络切换处理器
  const handleSwitchNetwork = useCallback(async () => {
    setError(null);
    try {
      await switchNetwork(1001); // TitanChain
    } catch (error: any) {
      console.error('Failed to switch network:', error);
      setError('Failed to switch network');
    }
  }, [switchNetwork]);
  
  // Optimized copy address handler / 优化的复制地址处理器
  const copyAddress = useCallback(async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy address:', error);
      }
    }
  }, [address]);

  // Memoized formatters / 记忆化格式化器
  const formatAddress = useCallback((addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, []);
  
  const formatBalance = useCallback((bal: string) => {
    const num = parseFloat(bal);
    if (num === 0) return '0';
    if (num < 0.001) return '< 0.001';
    return num.toFixed(3);
  }, []);

  // Optimized dropdown toggle / 优化的下拉菜单切换
  const toggleDropdown = useCallback(() => {
    setShowDropdown(prev => !prev);
  }, []);
  
  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={toggleDropdown}
          disabled={connecting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
        >
          <Wallet size={20} />
          {connecting ? 'Connecting...' : 'Connect Wallet'}
          <ChevronDown size={16} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>
        
        {showDropdown && (
          <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[280px] z-50">
            <div className="p-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Connect Wallet</h3>
              <p className="text-sm text-gray-600">Choose your preferred wallet to connect</p>
            </div>
            
            {error && <ErrorDisplay error={error} />}
            
            <div className="p-2">
              {SUPPORTED_WALLETS.map((wallet) => (
                <WalletOption
                  key={wallet.id}
                  wallet={wallet}
                  connecting={connecting}
                  onConnect={handleConnect}
                />
              ))}
            </div>
            
            <div className="p-3 border-t border-gray-100 text-xs text-gray-500">
              By connecting, you agree to our Terms of Service
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          isCorrectNetwork
            ? 'bg-green-100 hover:bg-green-200 text-green-800'
            : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
        }`}
      >
        <div className={`w-2 h-2 rounded-full ${isCorrectNetwork ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span className="font-mono text-sm">{formatAddress(address!)}</span>
        <ChevronDown size={16} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>
      
      {showDropdown && (
        <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[320px] z-50">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Connected</span>
              <button
                onClick={copyAddress}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="font-mono text-sm text-gray-900 mb-3">{address}</div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Balance</span>
              <span className="font-semibold text-gray-900">
                {formatBalance(balance)} TTN
              </span>
            </div>
          </div>
          
          {error && <ErrorDisplay error={error} />}
          
          <NetworkStatus 
            isCorrectNetwork={isCorrectNetwork} 
            onSwitchNetwork={handleSwitchNetwork} 
          />
          
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors">
                View in Explorer
              </button>
              <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors">
                Transaction History
              </button>
            </div>
            
            <button
              onClick={handleDisconnect}
              className="w-full px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export { OptimizedWalletConnector };
export default OptimizedWalletConnector;