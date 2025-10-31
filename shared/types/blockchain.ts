// TitanChain 区块链核心类型定义

export interface Block {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  validator: string;
  transactions: Transaction[];
  gasUsed: bigint;
  gasLimit: bigint;
  stateRoot: string;
  transactionsRoot: string;
  receiptsRoot: string;
  difficulty: bigint;
  nonce: string;
  size: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  gas: bigint;
  gasPrice: bigint;
  data: string;
  nonce: number;
  timestamp: number; // 交易时间戳
  blockNumber?: number;
  blockHash?: string;
  transactionIndex?: number;
  status: 'pending' | 'confirmed' | 'failed';
  isZeroGas: boolean; // TitanChain 0-gas费标识
  exchangeBatch?: ExchangeBatch; // 交易所批量交易信息
  contractTier?: number; // 智能合约分层收费等级
}

export interface ExchangeBatch {
  batchId: string;
  exchangeId: string;
  totalTransactions: number;
  totalVolume: bigint;
  timestamp: number;
  transactions: string[]; // 交易哈希列表
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
}

export interface Validator {
  address: string;
  publicKey: string;
  stake: bigint;
  delegatedStake: bigint;
  totalStake: bigint;
  commission: number; // 佣金比例 (0-100)
  status: 'active' | 'inactive' | 'jailed' | 'candidate';
  performance: ValidatorPerformance;
  metadata: ValidatorMetadata;
  joinedAt: number;
  lastActiveBlock: number;
}

export interface ValidatorPerformance {
  blocksProduced: number;
  blocksExpected: number;
  uptime: number; // 在线时间百分比
  missedBlocks: number;
  slashingEvents: number;
  averageBlockTime: number;
  score: number; // 综合评分 (0-100)
}

export interface ValidatorMetadata {
  name: string;
  description: string;
  website?: string;
  identity?: string;
  details?: string;
}

export interface CandidateNode {
  address: string;
  publicKey: string;
  stake: bigint;
  delegatedStake: bigint;
  totalStake: bigint;
  commission: number;
  ranking: number; // 候补节点排名 (1-2000)
  metadata: ValidatorMetadata;
  applicationTime: number;
  readinessScore: number; // 准备度评分
}

export interface StakingInfo {
  validator: string;
  delegator: string;
  amount: bigint;
  rewards: bigint;
  lockPeriod: number;
  unlockTime: number;
  status: 'active' | 'unbonding' | 'withdrawn';
}

export interface NetworkStats {
  currentTPS: number;
  averageTPS: number;
  peakTPS: number;
  blockHeight: number;
  totalTransactions: number;
  activeValidators: number;
  candidateNodes: number;
  totalStaked: bigint;
  networkHealth: 'excellent' | 'good' | 'warning' | 'critical';
  averageBlockTime: number;
  zeroGasTransactions: number;
  exchangeBatchTransactions: number;
}

export interface ConsensusState {
  currentEpoch: number;
  epochStartBlock: number;
  epochEndBlock: number;
  activeValidators: Validator[];
  nextValidators: Validator[];
  proposer: string;
  round: number;
  step: 'propose' | 'prevote' | 'precommit' | 'commit';
}

export interface EVMState {
  accounts: Map<string, Account>;
  contracts: Map<string, Contract>;
  storage: Map<string, Map<string, string>>;
  logs: Log[];
}

export interface Account {
  address: string;
  balance: bigint;
  nonce: number;
  codeHash?: string;
  storageRoot?: string;
}

export interface Contract {
  address: string;
  code: string;
  storage: Map<string, string>;
  creator: string;
  createdAt: number;
  tier: number; // 合约收费等级
}

export interface Log {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
}

// 流动性共享相关类型
export interface UnifiedOrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdate: number;
  aggregatedDepth: number;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  exchange: string;
  timestamp: number;
}

export interface LiquidityPool {
  id: string;
  exchanges: string[];
  totalLiquidity: bigint;
  volume24h: bigint;
  fees24h: bigint;
  participants: number;
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}


export interface ValidatorCandidate {
  address: string;
  publicKey: string;
  stake: bigint;
  delegatedStake: bigint;
  totalStake: bigint;
  commission: number;
  registeredAt: number;
  lastElectionAttempt: number;
  electionAttempts: number;
  isEligible: boolean;
  status: 'pending' | 'active' | 'probation' | 'suspended' | 'blacklisted';
  metadata: ValidatorMetadata;
  votes?: bigint;
  readinessScore: number;
  violationHistory: ViolationRecord[];
  hardwareMetrics?: HardwareMetrics;
  networkMetrics?: NetworkMetrics;
}

export interface StakingRecord {
  address: string;
  amount: bigint;
  timestamp: number;
  type: 'stake' | 'unstake' | 'reward' | 'slash';
  blockNumber: number;
  epoch?: number;
  transactionHash?: string;
}

// 违规检测相关类型
export interface ViolationRecord {
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  blockNumber: number;
  description: string;
  evidence?: any;
  penalty: bigint;
  resolved: boolean;
}

export enum ViolationType {
  HARDWARE_INSUFFICIENT = 'hardware_insufficient',
  LONG_OFFLINE = 'long_offline',
  BLOCK_PRODUCTION_FAILURE = 'block_production_failure',
  RESPONSE_TIMEOUT = 'response_timeout',
  DOUBLE_SIGNING = 'double_signing',
  MALICIOUS_FORK = 'malicious_fork',
  COLLUSION = 'collusion',
  ASSOCIATED_NODES = 'associated_nodes',
  NETWORK_ATTACK = 'network_attack'
}

export interface HardwareMetrics {
  cpuUsage: number; // 百分比
  memoryUsage: number; // 百分比
  diskUsage: number; // 百分比
  networkBandwidth: number; // Mbps
  lastUpdated: number;
  isAdequate: boolean;
}

export interface NetworkMetrics {
  latency: number; // ms
  uptime: number; // 百分比
  blocksMissed: number;
  blocksProduced: number;
  responseTime: number; // ms
  ipAddress: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
    coordinates: [number, number];
  };
}

// 随机选择相关类型
export interface VRFProof {
  proof: string;
  publicKey: string;
  seed: string;
  output: string;
  verified: boolean;
}

export interface RandomSelectionResult {
  selectedCandidates: string[];
  vrfProof: VRFProof;
  randomSeed: string;
  timestamp: number;
  blockHash: string;
  selectionRound: number;
}

// 关联节点检测
export interface AssociatedNodesAnalysis {
  suspiciousGroups: AssociatedNodeGroup[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalNodes: number;
  analysisTimestamp: number;
}

export interface AssociatedNodeGroup {
  nodes: string[];
  associationType: 'same_ip' | 'similar_behavior' | 'timing_correlation' | 'stake_pattern';
  confidence: number; // 0-100
  riskScore: number; // 0-100
  evidence: any[];
}

// 奖励和权益转移
export interface RewardTransfer {
  fromValidator: string;
  toValidator: string;
  amount: bigint;
  type: 'block_reward' | 'staking_reward' | 'commission';
  timestamp: number;
  blockNumber: number;
  epoch: number;
}

export interface ValidatorTransition {
  address: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  timestamp: number;
  blockNumber: number;
  stakeLocked: bigint;
  stakeReleased: bigint;
  penaltyApplied: bigint;
}