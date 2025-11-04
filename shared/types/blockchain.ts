// TitanChain blockchain core type definitions / TitanChain 区块链核心类型定义

export interface BlockHeader {
  number: number;
  height: number; // Block height / 区块高度
  hash: string;
  parentHash: string;
  timestamp: number;
  validator: string;
  proposer?: string; // Block proposer / 区块提议者
  stateRoot: string;
  transactionsRoot: string;
  receiptsRoot: string;
  difficulty: bigint;
  nonce: string;
}

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
  reward: bigint;
  header?: BlockHeader; // Optional block header / 可选的区块头
}

export interface Transaction {
  id: string; // Transaction unique identifier / 交易唯一标识符
  hash: string;
  from: string;
  to: string;
  value: bigint;
  gas: bigint;
  gasPrice: bigint;
  gasLimit: bigint; // Gas limit for transaction / 交易Gas限制
  data: string;
  nonce: number;
  timestamp: number; // Transaction timestamp / 交易时间戳
  blockNumber?: number;
  blockHash?: string;
  transactionIndex?: number;
  status: 'pending' | 'confirmed' | 'failed';
  signature: string; // Transaction signature / 交易签名
  isZeroGas: boolean; // TitanChain zero-gas fee identifier / TitanChain 0-gas费标识
  contractTier?: number; // Smart contract tiered charging level / 智能合约分层收费等级
}



export interface Validator {
  address: string;
  publicKey: string;
  stake: bigint;
  delegatedStake: bigint;
  totalStake: bigint;
  commission: number; // Commission rate (0-100) / 佣金比例 (0-100)
  status: 'active' | 'inactive' | 'jailed' | 'candidate';
  performance: ValidatorPerformance;
  metadata: ValidatorMetadata;
  joinedAt: number;
  lastActiveBlock: number;
}

export interface ValidatorPerformance {
  blocksProduced: number;
  blocksExpected: number;
  uptime: number; // Online time percentage / 在线时间百分比
  missedBlocks: number;
  slashingEvents: number;
  averageBlockTime: number;
  score: number; // Comprehensive score (0-100) / 综合评分 (0-100)
}

export interface ValidatorMetadata {
  name: string;
  description: string;
  website?: string;
  identity?: string;
  details?: string;
  // Candidate/validator locally computed ranking (optional) / 候选/验证节点在本地计算的排名（可选）
  ranking?: number;
  // Maintenance information (optional): removal reason and time / 维护信息（可选）：移除原因与时间
  removalReason?: string;
  removedAt?: number;
}

export interface CandidateNode {
  address: string;
  publicKey: string;
  stake: bigint;
  delegatedStake: bigint;
  totalStake: bigint;
  commission: number;
  ranking: number; // Candidate node ranking (1-2000) / 候补节点排名 (1-2000)
  metadata: ValidatorMetadata;
  applicationTime: number;
  readinessScore: number; // Readiness score / 准备度评分
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
  totalStaked: bigint;
  lastBlockTime: number;
  networkHashRate: bigint;
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

export interface BatchCommit {
  batchId: string;
  producerId: string;
  timestamp: number;
  ordersRoot: string;
  matchesRoot: string;
  balanceDiffsRoot: string;
  auditLogRoot: string;
  nextStateRoot?: string; // Next state root / 下一个状态根
  liquidityMetaRoot?: string; // Liquidity metadata root / 流动性元数据根
  feeReceiptsRoot?: string; // Fee receipts root / 费用收据根
  distributionPlanRoot?: string; // Distribution plan root / 分配计划根
  cancellationsRoot?: string; // Cancellations root / 取消根
  gasCostRoot?: string; // Gas cost root / Gas成本根
  sponsorAccountsRoot?: string; // Sponsor accounts root / 赞助账户根
  prevStateRoot?: string; // Previous state root / 前一个状态根
  cid?: string;
  recipeVersion: number;
}

export interface Event {
  type: string;
  data: any; // Event data payload / 事件数据载荷
}