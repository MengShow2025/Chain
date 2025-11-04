import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Shield, Activity, Award, Clock, Users, TrendingUp } from 'lucide-react';

interface ValidatorInfo {
  id: string;
  name: string;
  address: string;
  status: 'active' | 'inactive' | 'candidate';
  stake: string;
  delegatedStake: string;
  totalStake: string;
  commission: number;
  uptime: number;
  blocksProduced: number;
  lastBlockTime: string;
  rank: number;
  delegators: number;
  rewards: string;
  performance: {
    efficiency: number;
    reliability: number;
    avgBlockTime: number;
  };
}

export const ValidatorDetail: React.FC = () => {
  const { address } = useParams<{ address: string }>();
  const [validator, setValidator] = useState<ValidatorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchValidatorDetails = async () => {
      if (!address) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/explorer/validator/${address}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch validator details');
        }
        
        const data = await response.json();
        if (data.success) {
          setValidator(data.data);
        } else {
          setError(data.error || 'Failed to load validator details');
        }
      } catch (err) {
        console.error('Error fetching validator details:', err);
        setError('Failed to load validator details');
      } finally {
        setLoading(false);
      }
    };

    fetchValidatorDetails();
  }, [address]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatStake = (stake: string) => {
    const num = parseFloat(stake);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'candidate':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Shield className="w-3 h-3" />;
      case 'inactive':
        return <Clock className="w-3 h-3" />;
      case 'candidate':
        return <Users className="w-3 h-3" />;
      default:
        return <Activity className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !validator) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            to="/explorer"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Explorer
          </Link>
          
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-red-600 mb-4">
              <Shield className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Validator Not Found
            </h2>
            <p className="text-gray-600">
              {error || 'The requested validator could not be found.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/explorer"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Explorer
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-purple-600">#{validator.rank}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{validator.name}</h1>
              <p className="text-gray-600 font-mono">{validator.address}</p>
            </div>
            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(validator.status)}`}>
              {getStatusIcon(validator.status)}
              {validator.status.charAt(0).toUpperCase() + validator.status.slice(1)}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Stake</p>
                <p className="text-xl font-semibold text-gray-900">{formatStake(validator.totalStake)} TITAN</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Uptime</p>
                <p className="text-xl font-semibold text-gray-900">{validator.uptime.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Delegators</p>
                <p className="text-xl font-semibold text-gray-900">{validator.delegators.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Award className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Commission</p>
                <p className="text-xl font-semibold text-gray-900">{validator.commission}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Staking Information */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Staking Information</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Self Stake</span>
                <span className="font-medium">{formatStake(validator.stake)} TITAN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delegated Stake</span>
                <span className="font-medium">{formatStake(validator.delegatedStake)} TITAN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Stake</span>
                <span className="font-medium">{formatStake(validator.totalStake)} TITAN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Rewards</span>
                <span className="font-medium">{formatStake(validator.rewards)} TITAN</span>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Performance Metrics</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Efficiency</span>
                <span className="font-medium">{validator.performance.efficiency.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reliability</span>
                <span className="font-medium">{validator.performance.reliability.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Block Time</span>
                <span className="font-medium">{validator.performance.avgBlockTime.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Blocks Produced</span>
                <span className="font-medium">{validator.blocksProduced.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValidatorDetail;