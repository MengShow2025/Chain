import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalletState {
  // 连接状态
  isConnected: boolean;
  address: string | null;
  balance: string;
  chainId: number | null;
  connecting: boolean;
  
  // 钱包信息
  walletType: string | null;
  
  // 方法
  connect: (walletType: string) => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: (chainId: number) => Promise<void>;
  updateBalance: () => Promise<void>;
  sendTransaction: (to: string, value: string, data?: string) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
}

// TitanChain网络配置
const TITANCHAIN_CONFIG = {
  chainId: '0x3e9', // 1001 in hex
  chainName: 'TitanChain',
  nativeCurrency: {
    name: 'TTN',
    symbol: 'TTN',
    decimals: 18
  },
  rpcUrls: ['https://rpc.titanchain.io'],
  blockExplorerUrls: ['https://explorer.titanchain.io']
};

// 优化的MetaMask检测函数
const detectMetaMask = () => {
  if (typeof window === 'undefined') return null;
  
  const { ethereum } = window as any;
  
  if (!ethereum) return null;
  
  // 检查是否是MetaMask
  if (ethereum.isMetaMask) return ethereum;
  
  // 如果有多个钱包，尝试找到MetaMask
  if (ethereum.providers) {
    return ethereum.providers.find((provider: any) => provider.isMetaMask) || null;
  }
  
  return null;
};

// 优化的Coinbase Wallet检测函数
const detectCoinbaseWallet = () => {
  if (typeof window === 'undefined') return null;
  
  const { ethereum } = window as any;
  
  if (!ethereum) return null;
  
  // 检查是否是Coinbase Wallet
  if (ethereum.isCoinbaseWallet) return ethereum;
  
  // 如果有多个钱包，尝试找到Coinbase Wallet
  if (ethereum.providers) {
    return ethereum.providers.find((provider: any) => provider.isCoinbaseWallet) || null;
  }
  
  return null;
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      address: null,
      balance: '0',
      chainId: null,
      connecting: false,
      walletType: null,
      
      connect: async (walletType: string) => {
        set({ connecting: true });
        
        try {
          let provider: any;
          
          switch (walletType) {
            case 'metamask':
              provider = await connectMetaMask();
              break;
            case 'walletconnect':
              provider = await connectWalletConnect();
              break;
            case 'coinbase':
              provider = await connectCoinbaseWallet();
              break;
            default:
              throw new Error('Unsupported wallet type');
          }
          
          if (!provider) {
            throw new Error('Failed to get provider');
          }
          
          // 先获取账户以供余额查询使用，避免变量使用顺序错误
          const accounts: string[] = await provider.request({ method: 'eth_accounts' });
          const [chainId, balance] = await Promise.all([
            provider.request({ method: 'eth_chainId' }),
            provider.request({
              method: 'eth_getBalance',
              params: [accounts?.[0] || '', 'latest']
            }).catch(() => '0x0') // 如果获取余额失败，使用默认值
          ]);
          
          if (!accounts || accounts.length === 0) {
            throw new Error('No accounts found');
          }
          
          const address = accounts[0];
          
          // 转换余额为ETH单位
          const balanceInEth = (parseInt(balance, 16) / Math.pow(10, 18)).toString();
          
          set({
            isConnected: true,
            address,
            balance: balanceInEth,
            chainId: parseInt(chainId, 16),
            walletType,
            connecting: false
          });
          
          // 监听账户和网络变化
          setupEventListeners(provider);
          
        } catch (error) {
          console.error('Failed to connect wallet:', error);
          set({ connecting: false });
          throw error;
        }
      },
      
      disconnect: async () => {
        set({
          isConnected: false,
          address: null,
          balance: '0',
          chainId: null,
          walletType: null
        });
      },
      
      switchNetwork: async (targetChainId: number) => {
        const { walletType } = get();
        
        if (!walletType) {
          throw new Error('No wallet connected');
        }
        
        const provider = getProvider(walletType);
        if (!provider) {
          throw new Error('Provider not found');
        }
        
        try {
          // 尝试切换网络
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }]
          });
        } catch (switchError: any) {
          // 如果网络不存在，尝试添加网络
          if (switchError.code === 4902) {
            try {
              await provider.request({
                method: 'wallet_addEthereumChain',
                params: [TITANCHAIN_CONFIG]
              });
            } catch (addError) {
              console.error('Failed to add network:', addError);
              throw addError;
            }
          } else {
            console.error('Failed to switch network:', switchError);
            throw switchError;
          }
        }
      },
      
      updateBalance: async () => {
        const { address, walletType } = get();
        
        if (!address || !walletType) {
          return;
        }
        
        const provider = getProvider(walletType);
        if (!provider) {
          return;
        }
        
        try {
          const balance = await provider.request({
            method: 'eth_getBalance',
            params: [address, 'latest']
          });
          
          const balanceInEth = (parseInt(balance, 16) / Math.pow(10, 18)).toString();
          set({ balance: balanceInEth });
        } catch (error) {
          console.error('Failed to update balance:', error);
        }
      },
      
      sendTransaction: async (to: string, value: string, data?: string) => {
        const { address, walletType } = get();
        
        if (!address || !walletType) {
          throw new Error('Wallet not connected');
        }
        
        const provider = getProvider(walletType);
        if (!provider) {
          throw new Error('Provider not found');
        }
        
        try {
          // 转换value为wei
          const valueInWei = `0x${(parseFloat(value) * Math.pow(10, 18)).toString(16)}`;
          
          const txParams: any = {
            from: address,
            to,
            value: valueInWei
          };
          
          if (data) {
            txParams.data = data;
          }
          
          const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [txParams]
          });
          
          // 更新余额
          setTimeout(() => get().updateBalance(), 2000);
          
          return txHash;
        } catch (error) {
          console.error('Failed to send transaction:', error);
          throw error;
        }
      },
      
      signMessage: async (message: string) => {
        const { address, walletType } = get();
        
        if (!address || !walletType) {
          throw new Error('Wallet not connected');
        }
        
        const provider = getProvider(walletType);
        if (!provider) {
          throw new Error('Provider not found');
        }
        
        try {
          const signature = await provider.request({
            method: 'personal_sign',
            params: [message, address]
          });
          
          return signature;
        } catch (error) {
          console.error('Failed to sign message:', error);
          throw error;
        }
      }
    }),
    {
      name: 'wallet-storage',
      partialize: (state) => ({
        isConnected: state.isConnected,
        address: state.address,
        walletType: state.walletType
      })
    }
  )
);

// 优化的MetaMask连接函数
async function connectMetaMask() {
  if (typeof window === 'undefined') {
    throw new Error('Window is not defined');
  }
  
  const ethereum = detectMetaMask();
  
  if (!ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask extension.');
  }
  
  try {
    // 使用单一的请求来连接账户
    const accounts = await ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please make sure your wallet is unlocked.');
    }
    
    return ethereum;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('User rejected the connection request.');
    } else if (error.code === -32002) {
      throw new Error('Connection request is already pending. Please check your wallet.');
    } else if (error.code === -32603) {
      throw new Error('Internal error. Please try again.');
    }
    throw error;
  }
}

// WalletConnect连接
async function connectWalletConnect() {
  // 这里需要实现WalletConnect的连接逻辑
  // 由于WalletConnect需要额外的配置，这里提供一个简化的实现
  throw new Error('WalletConnect integration not implemented yet. Please use MetaMask or Coinbase Wallet.');
}

// 优化的Coinbase Wallet连接函数
async function connectCoinbaseWallet() {
  if (typeof window === 'undefined') {
    throw new Error('Window is not defined');
  }
  
  const ethereum = detectCoinbaseWallet();
  
  if (!ethereum) {
    throw new Error('Coinbase Wallet is not installed. Please install Coinbase Wallet extension.');
  }
  
  try {
    // 使用单一的请求来连接账户
    const accounts = await ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please make sure your wallet is unlocked.');
    }
    
    return ethereum;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('User rejected the connection request.');
    } else if (error.code === -32002) {
      throw new Error('Connection request is already pending. Please check your wallet.');
    } else if (error.code === -32603) {
      throw new Error('Internal error. Please try again.');
    }
    throw error;
  }
}

// 获取provider
function getProvider(walletType: string) {
  if (typeof window === 'undefined') {
    return null;
  }
  
  switch (walletType) {
    case 'metamask':
      return detectMetaMask();
    case 'coinbase':
      return detectCoinbaseWallet();
    case 'walletconnect':
      // WalletConnect provider logic
      return null;
    default:
      return null;
  }
}

// 优化的事件监听器设置
function setupEventListeners(provider: any) {
  // 移除之前的监听器以避免重复
  if (provider._titanChainListenersSetup) {
    return;
  }
  
  // 监听账户变化
  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      useWalletStore.getState().disconnect();
    } else {
      useWalletStore.setState({ address: accounts[0] });
      useWalletStore.getState().updateBalance();
    }
  };
  
  // 监听网络变化
  const handleChainChanged = (chainId: string) => {
    useWalletStore.setState({ chainId: parseInt(chainId, 16) });
    useWalletStore.getState().updateBalance();
  };
  
  // 监听连接状态
  const handleConnect = (connectInfo: { chainId: string }) => {
    useWalletStore.setState({ 
      isConnected: true,
      chainId: parseInt(connectInfo.chainId, 16)
    });
  };
  
  // 监听断开连接
  const handleDisconnect = () => {
    useWalletStore.getState().disconnect();
  };
  
  provider.on('accountsChanged', handleAccountsChanged);
  provider.on('chainChanged', handleChainChanged);
  provider.on('connect', handleConnect);
  provider.on('disconnect', handleDisconnect);
  
  // 标记已设置监听器
  provider._titanChainListenersSetup = true;
}

// 优化的自动重连逻辑
if (typeof window !== 'undefined') {
  // 延迟执行以确保页面完全加载
  setTimeout(async () => {
    const state = useWalletStore.getState();
    
    if (state.isConnected && state.walletType) {
      try {
        const provider = getProvider(state.walletType);
        if (provider) {
          // 检查是否仍然连接
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            // 重新连接成功，更新状态
            state.updateBalance();
            setupEventListeners(provider);
          } else {
            // 没有授权账户，断开连接
            state.disconnect();
          }
        }
      } catch (error) {
        console.error('Auto reconnect failed:', error);
        state.disconnect();
      }
    }
  }, 1000);
}