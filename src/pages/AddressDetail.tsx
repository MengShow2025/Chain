import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, Wallet, Activity, Clock, Hash } from 'lucide-react';

interface AddressInfo {
  address: string;
  balance: string;
  balanceInTTN: string;
  transactionCount: number;
  firstSeen: string;
  lastActivity: string;
  type: 'EOA' | 'Contract' | 'Validator';
}

interface Transaction {
  hash: string;
  blockHeight: number;
  timestamp: string;
  from: string;
  to: string;
  value: string;
  status: 'success' | 'failed' | 'pending';
  type: 'send' | 'receive';
}

export const AddressDetail: React.FC = () => {
  const { address } = useParams<{ address: string }>();
  const [addressInfo, setAddressInfo] = useState<AddressInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (address) {
      fetchAddressInfo(address);
      fetchAddressTransactions(address);
    }
  }, [address]);

  const fetchAddressInfo = async (addr: string) => {
    try {
      setLoading(true);
      
      // 获取余额信息
      const balanceResponse = await fetch(`http://localhost:3001/api/wallet/balance/${addr}`);
      
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        
        setAddressInfo({
          address: addr,
          balance: balanceData.balance,
          balanceInTTN: balanceData.balanceInTTN,
          transactionCount: Math.floor(Math.random() * 1000) + 1, // 模拟数据
          firstSeen: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          lastActivity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          type: addr.toLowerCase().includes('validator') ? 'Validator' : 'EOA'
        });
      } else {
        throw new Error('Failed to fetch address info');
      }
    } catch (err) {
      console.error('Error fetching address info:', err);
      setError('Failed to load address information');
    } finally {
      setLoading(false);
    }
  };

  const fetchAddressTransactions = async (addr: string) => {
    try {
      // 模拟交易数据
      const mockTransactions: Transaction[] = Array.from({ length: 10 }, (_, i) => ({
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        blockHeight: Math.floor(Math.random() * 1000000) + 1000000,
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
        from: Math.random() > 0.5 ? addr : `0x${Math.random().toString(16).substr(2, 40)}`,
        to: Math.random() > 0.5 ? addr : `0x${Math.random().toString(16).substr(2, 40)}`,
        value: (Math.random() * 1000).toFixed(6),
        status: Math.random() > 0.1 ? 'success' : 'failed',
        type: Math.random() > 0.5 ? 'send' : 'receive'
      }));

      setTransactions(mockTransactions);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !addressInfo) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Address Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'The requested address could not be found.'}
          </p>
          <Link
            to="/explorer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Explorer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/explorer"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Explorer
          </Link>
          
          <div className="flex items-center gap-4 mb-4">
            <Wallet className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Address Details
            </h1>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-4">
            <Hash className="h-5 w-5 text-gray-400" />
            <span className="font-mono text-sm text-gray-900 dark:text-white break-all">
              {addressInfo.address}
            </span>
            <button
              onClick={() => copyToClipboard(addressInfo.address)}
              className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy address"
            >
              <Copy className="h-4 w-4" />
            </button>
            {copied && (
              <span className="text-green-600 text-sm">Copied!</span>
            )}
          </div>
        </div>

        {/* Address Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Balance</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {addressInfo.balanceInTTN} TTN
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {addressInfo.balance} wei
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Transactions</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {addressInfo.transactionCount.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total transactions
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">First Seen</h3>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatTimestamp(addressInfo.firstSeen)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <ExternalLink className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Type</h3>
            </div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              addressInfo.type === 'Validator' 
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }`}>
              {addressInfo.type}
            </span>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Recent Transactions
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Transaction Hash
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Block
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    From/To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((tx) => (
                  <tr key={tx.hash} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/tx/${tx.hash}`}
                        className="text-blue-600 hover:text-blue-800 font-mono text-sm"
                      >
                        {formatAddress(tx.hash)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/block/${tx.blockHeight}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {tx.blockHeight.toLocaleString()}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            tx.type === 'send' 
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {tx.type === 'send' ? 'OUT' : 'IN'}
                          </span>
                          <span className="font-mono text-gray-900 dark:text-white">
                            {tx.type === 'send' ? formatAddress(tx.to) : formatAddress(tx.from)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {tx.value} TTN
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        tx.status === 'success' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : tx.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatTimestamp(tx.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};