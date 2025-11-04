import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';

interface TransactionDetail {
  hash: string;
  blockHash: string;
  blockHeight: number;
  transactionIndex: number;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasUsed: number;
  gasLimit: number;
  status: 'success' | 'failed';
  timestamp: number;
  nonce: number;
  input: string;
  logs: any[];
  isZeroGas: boolean;
  fee: string;
}

export const TransactionDetail: React.FC = () => {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hash) {
      fetchTransactionDetail(hash);
    }
  }, [hash]);

  const fetchTransactionDetail = async (txHash: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/explorer/transaction/${txHash}`);
      
      if (response.ok) {
        const data = await response.json();
        setTransaction(data);
      } else {
        setError('Transaction not found');
      }
    } catch (error) {
      console.error('Failed to fetch transaction details:', error);
      setError('Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatHash = (hash: string, length: number = 10) => {
    return `${hash.slice(0, length)}...${hash.slice(-8)}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-8 w-64 mb-6"></div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-gray-200 rounded h-4"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Transaction Not Found</h2>
            <p className="text-gray-600">{error || 'The requested transaction could not be found.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900">Transaction Details</h1>
        </div>

        {/* Transaction Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            {transaction.status === 'success' ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
            <span className={`text-lg font-semibold ${
              transaction.status === 'success' ? 'text-green-600' : 'text-red-600'
            }`}>
              {transaction.status === 'success' ? 'Success' : 'Failed'}
            </span>
            
            {transaction.isZeroGas && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <Zap className="w-3 h-3" />
                0-Gas
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Block Height:</span>
              <button
                onClick={() => navigate(`/block/${transaction.blockHeight}`)}
                className="ml-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                #{formatNumber(transaction.blockHeight)}
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-gray-600">Timestamp:</span>
              <span className="text-gray-900">{formatTimestamp(transaction.timestamp)}</span>
            </div>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Information</h3>
          
          <div className="space-y-4">
            {/* Hash */}
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Transaction Hash</div>
                <div className="font-mono text-sm text-gray-900 break-all">{transaction.hash}</div>
              </div>
              <button
                onClick={() => copyToClipboard(transaction.hash)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Block Hash */}
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Block Hash</div>
                <div className="font-mono text-sm text-gray-900 break-all">{transaction.blockHash}</div>
              </div>
              <button
                onClick={() => copyToClipboard(transaction.blockHash)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* From */}
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">From</div>
                <div className="font-mono text-sm text-gray-900 break-all">{transaction.from}</div>
              </div>
              <button
                onClick={() => copyToClipboard(transaction.from)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* To */}
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">To</div>
                <div className="font-mono text-sm text-gray-900 break-all">{transaction.to}</div>
              </div>
              <button
                onClick={() => copyToClipboard(transaction.to)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Value */}
            <div className="py-3 border-b border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Value</div>
              <div className="text-lg font-semibold text-gray-900">{transaction.value} TTN</div>
            </div>

            {/* Gas Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-3 border-b border-gray-100">
              <div>
                <div className="text-sm text-gray-600 mb-1">Gas Used</div>
                <div className="text-sm text-gray-900">{formatNumber(transaction.gasUsed)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Gas Limit</div>
                <div className="text-sm text-gray-900">{formatNumber(transaction.gasLimit)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Gas Price</div>
                <div className="text-sm text-gray-900">
                  {transaction.isZeroGas ? '0 TTN' : `${transaction.gasPrice} TTN`}
                </div>
              </div>
            </div>

            {/* Fee */}
            <div className="py-3 border-b border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Transaction Fee</div>
              <div className="text-sm text-gray-900">
                {transaction.isZeroGas ? '0 TTN (0-Gas Transaction)' : `${transaction.fee} TTN`}
              </div>
            </div>

            {/* Nonce */}
            <div className="py-3 border-b border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Nonce</div>
              <div className="text-sm text-gray-900">{transaction.nonce}</div>
            </div>

            {/* Transaction Index */}
            <div className="py-3">
              <div className="text-sm text-gray-600 mb-1">Transaction Index</div>
              <div className="text-sm text-gray-900">{transaction.transactionIndex}</div>
            </div>
          </div>
        </div>

        {/* Input Data */}
        {transaction.input && transaction.input !== '0x' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Input Data</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm font-mono text-gray-900 whitespace-pre-wrap break-all">
                {transaction.input}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionDetail;