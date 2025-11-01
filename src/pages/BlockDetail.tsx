import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Blocks, Clock, Users, Zap, Hash } from 'lucide-react';

interface BlockDetail {
  height: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  validator: string;
  transactionCount: number;
  gasUsed: number;
  gasLimit: number;
  size: number;
  reward: string;
  difficulty: string;
  nonce: number;
  merkleRoot: string;
  stateRoot: string;
  receiptsRoot: string;
}

export const BlockDetail: React.FC = () => {
  const { height } = useParams<{ height: string }>();
  const navigate = useNavigate();
  const [block, setBlock] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (height) {
      fetchBlockDetail(height);
    }
  }, [height]);

  const fetchBlockDetail = async (blockHeight: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/explorer/block/${blockHeight}`);
      
      if (response.ok) {
        const data = await response.json();
        setBlock(data);
      } else {
        setError('Block not found');
      }
    } catch (error) {
      console.error('Failed to fetch block details:', error);
      setError('Failed to load block details');
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

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getGasUsagePercentage = (gasUsed: number, gasLimit: number) => {
    return ((gasUsed / gasLimit) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-8 w-64 mb-6"></div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="space-y-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="bg-gray-200 rounded h-4"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !block) {
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
            <Blocks className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Block Not Found</h2>
            <p className="text-gray-600">{error || 'The requested block could not be found.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const gasPercentage = parseFloat(getGasUsagePercentage(block.gasUsed, block.gasLimit));

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
          
          <h1 className="text-2xl font-bold text-gray-900">Block #{formatNumber(block.height)}</h1>
        </div>

        {/* Block Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Blocks className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-sm text-gray-600">Block Height</div>
              <div className="text-xl font-bold text-gray-900">#{formatNumber(block.height)}</div>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-sm text-gray-600">Transactions</div>
              <div className="text-xl font-bold text-gray-900">{formatNumber(block.transactionCount)}</div>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Zap className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="text-sm text-gray-600">Gas Used</div>
              <div className="text-xl font-bold text-gray-900">{gasPercentage}%</div>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-sm text-gray-600">Timestamp</div>
              <div className="text-sm font-medium text-gray-900">{formatTimestamp(block.timestamp)}</div>
            </div>
          </div>
        </div>

        {/* Block Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Block Information</h3>
          
          <div className="space-y-4">
            {/* Block Hash */}
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Block Hash</div>
                <div className="font-mono text-sm text-gray-900 break-all">{block.hash}</div>
              </div>
              <button
                onClick={() => copyToClipboard(block.hash)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Parent Hash */}
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Parent Hash</div>
                <div className="font-mono text-sm text-gray-900 break-all">{block.parentHash}</div>
              </div>
              <button
                onClick={() => copyToClipboard(block.parentHash)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Validator */}
            <div className="py-3 border-b border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Validator</div>
              <div className="text-sm text-gray-900">{block.validator}</div>
            </div>

            {/* Block Reward */}
            <div className="py-3 border-b border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Block Reward</div>
              <div className="text-lg font-semibold text-green-600">{block.reward} TTN</div>
            </div>

            {/* Gas Information */}
            <div className="py-3 border-b border-gray-100">
              <div className="text-sm text-gray-600 mb-2">Gas Usage</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <span className="text-xs text-gray-500">Gas Used:</span>
                  <span className="ml-2 text-sm text-gray-900">{formatNumber(block.gasUsed)}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Gas Limit:</span>
                  <span className="ml-2 text-sm text-gray-900">{formatNumber(block.gasLimit)}</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    gasPercentage >= 90 ? 'bg-red-500' :
                    gasPercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${gasPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Block Size */}
            <div className="py-3 border-b border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Block Size</div>
              <div className="text-sm text-gray-900">{formatSize(block.size)}</div>
            </div>

            {/* Difficulty */}
            <div className="py-3 border-b border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Difficulty</div>
              <div className="text-sm text-gray-900 font-mono">{block.difficulty}</div>
            </div>

            {/* Nonce */}
            <div className="py-3 border-b border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Nonce</div>
              <div className="text-sm text-gray-900">{formatNumber(block.nonce)}</div>
            </div>
          </div>
        </div>

        {/* Merkle Roots */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Merkle Roots</h3>
          
          <div className="space-y-4">
            {/* Merkle Root */}
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Merkle Root</div>
                <div className="font-mono text-sm text-gray-900 break-all">{block.merkleRoot}</div>
              </div>
              <button
                onClick={() => copyToClipboard(block.merkleRoot)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* State Root */}
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">State Root</div>
                <div className="font-mono text-sm text-gray-900 break-all">{block.stateRoot}</div>
              </div>
              <button
                onClick={() => copyToClipboard(block.stateRoot)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Receipts Root */}
            <div className="flex items-start justify-between py-3">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Receipts Root</div>
                <div className="font-mono text-sm text-gray-900 break-all">{block.receiptsRoot}</div>
              </div>
              <button
                onClick={() => copyToClipboard(block.receiptsRoot)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};