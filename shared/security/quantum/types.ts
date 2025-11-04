/**
 * 量子抗性密码学类型定义
 * 
 * 定义Kyber、Dilithium、SPHINCS+等后量子密码学算法的类型
 */

// 基础类型
export type QuantumAlgorithm = 'KYBER' | 'DILITHIUM' | 'SPHINCS_PLUS';

// Kyber变体
export type KyberVariant = 'KYBER_512' | 'KYBER_768' | 'KYBER_1024';

// Dilithium变体
export type DilithiumVariant = 'DILITHIUM_2' | 'DILITHIUM_3' | 'DILITHIUM_5';

// SPHINCS+变体
export type SphincsVariant = 
  | 'SPHINCS_PLUS_128F_ROBUST' | 'SPHINCS_PLUS_128F_SIMPLE'
  | 'SPHINCS_PLUS_128S_ROBUST' | 'SPHINCS_PLUS_128S_SIMPLE'
  | 'SPHINCS_PLUS_192F_ROBUST' | 'SPHINCS_PLUS_192F_SIMPLE'
  | 'SPHINCS_PLUS_192S_ROBUST' | 'SPHINCS_PLUS_192S_SIMPLE'
  | 'SPHINCS_PLUS_256F_ROBUST' | 'SPHINCS_PLUS_256F_SIMPLE'
  | 'SPHINCS_PLUS_256S_ROBUST' | 'SPHINCS_PLUS_256S_SIMPLE';

// 密钥状态
export type KeyStatus = 'active' | 'expired' | 'revoked' | 'pending';

// 安全级别
export type SecurityLevel = 1 | 3 | 5; // NIST安全级别

// Kyber密钥对接口
export interface KyberKeyPair {
  publicKey: KyberPublicKey;
  privateKey: KyberPrivateKey;
  variant: KyberVariant;
  createdAt: Date;
}

export interface KyberPublicKey {
  keyId: string;
  algorithm: 'KYBER';
  variant: KyberVariant;
  publicKeyData: Uint8Array;
  createdAt: Date;
}

export interface KyberPrivateKey {
  keyId: string;
  algorithm: 'KYBER';
  variant: KyberVariant;
  privateKeyData: Uint8Array;
  publicKeyHash: string;
  createdAt: Date;
}

export interface KyberCiphertext {
  ciphertextId: string;
  algorithm: 'KYBER';
  ciphertextData: Uint8Array;
  keyId: string;
  timestamp: Date;
}

export interface KyberSharedSecret {
  secretId: string;
  sharedSecretData: Uint8Array;
  keyId: string;
  timestamp: Date;
}

// Dilithium密钥对接口
export interface DilithiumKeyPair {
  publicKey: DilithiumPublicKey;
  privateKey: DilithiumPrivateKey;
  variant: DilithiumVariant;
  createdAt: Date;
}

export interface DilithiumPublicKey {
  keyId: string;
  algorithm: 'DILITHIUM';
  variant: DilithiumVariant;
  publicKeyData: Uint8Array;
  createdAt: Date;
}

export interface DilithiumPrivateKey {
  keyId: string;
  algorithm: 'DILITHIUM';
  variant: DilithiumVariant;
  privateKeyData: Uint8Array;
  publicKeyHash: string;
  createdAt: Date;
}

export interface DilithiumSignature {
  signatureId: string;
  algorithm: 'DILITHIUM';
  signatureData: Uint8Array;
  messageHash: string;
  keyId: string;
  timestamp: Date;
}

// SPHINCS+密钥对接口
export interface SphincsKeyPair {
  publicKey: SphincsPublicKey;
  privateKey: SphincsPrivateKey;
  variant: SphincsVariant;
  createdAt: Date;
}

export interface SphincsPublicKey {
  keyId: string;
  algorithm: 'SPHINCS_PLUS';
  variant: SphincsVariant;
  publicKeyData: Uint8Array;
  createdAt: Date;
}

export interface SphincsPrivateKey {
  keyId: string;
  algorithm: 'SPHINCS_PLUS';
  variant: SphincsVariant;
  privateKeyData: Uint8Array;
  publicKeyHash: string;
  createdAt: Date;
}

export interface SphincsSignature {
  signatureId: string;
  algorithm: 'SPHINCS_PLUS';
  signatureData: Uint8Array;
  messageHash: string;
  keyId: string;
  timestamp: Date;
}

// 通用密钥管理接口
export interface QuantumKeyMetadata {
  keyId: string;
  algorithm: QuantumAlgorithm;
  variant: string;
  status: KeyStatus;
  securityLevel: SecurityLevel;
  createdAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
  usageCount: number;
  tags?: string[];
}

export interface QuantumKeyRotationPolicy {
  algorithm: QuantumAlgorithm;
  maxAge: number; // 毫秒
  maxUsage: number;
  autoRotate: boolean;
  rotationInterval: number; // 毫秒
}

// 系统配置接口
export interface QuantumSystemConfig {
  kyber: {
    enabled: boolean;
    defaultVariant: KyberVariant;
    supportedVariants: KyberVariant[];
    keyRotationPolicy: QuantumKeyRotationPolicy;
  };
  dilithium: {
    enabled: boolean;
    defaultVariant: DilithiumVariant;
    supportedVariants: DilithiumVariant[];
    keyRotationPolicy: QuantumKeyRotationPolicy;
  };
  sphincs: {
    enabled: boolean;
    defaultVariant: SphincsVariant;
    supportedVariants: SphincsVariant[];
    keyRotationPolicy: QuantumKeyRotationPolicy;
  };
  general: {
    enableKeyCache: boolean;
    cacheSize: number;
    enableMetrics: boolean;
    enableAuditLog: boolean;
  };
}

// 健康检查接口
export interface QuantumHealthStatus {
  algorithm: QuantumAlgorithm;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  metrics: {
    keyGenerationTime: number;
    encryptionTime?: number;
    decryptionTime?: number;
    signatureTime?: number;
    verificationTime?: number;
    errorRate: number;
  };
  errors?: string[];
}

export interface QuantumSystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  algorithms: QuantumHealthStatus[];
  lastCheck: Date;
  uptime: number;
}

// 统计信息接口
export interface QuantumStatistics {
  algorithm: QuantumAlgorithm;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageOperationTime: number;
  keyPairsGenerated: number;
  activeKeys: number;
  expiredKeys: number;
  revokedKeys: number;
  lastReset: Date;
}

export interface QuantumSystemStatistics {
  overall: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    uptime: number;
    startTime: Date;
  };
  algorithms: QuantumStatistics[];
  lastUpdated: Date;
}

// 事件接口
export interface QuantumEvent {
  eventId: string;
  eventType: QuantumEventType;
  algorithm: QuantumAlgorithm;
  keyId?: string;
  timestamp: Date;
  details: Record<string, any>;
}

export type QuantumEventType = 
  | 'key_generated'
  | 'key_rotated'
  | 'key_expired'
  | 'key_revoked'
  | 'encryption_performed'
  | 'decryption_performed'
  | 'signature_created'
  | 'signature_verified'
  | 'error_occurred'
  | 'system_started'
  | 'system_stopped'
  | 'health_check_performed';

// 错误类型
export class QuantumError extends Error {
  public readonly code: string;
  public readonly algorithm?: QuantumAlgorithm;
  public readonly keyId?: string;
  public readonly timestamp: Date;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: string = 'QUANTUM_ERROR',
    originalError?: Error,
    algorithm?: QuantumAlgorithm,
    keyId?: string
  ) {
    super(message);
    this.name = 'QuantumError';
    this.code = code;
    this.algorithm = algorithm;
    this.keyId = keyId;
    this.timestamp = new Date();
    this.originalError = originalError;
  }
}

// 导入/导出接口
export interface QuantumKeyExport {
  keyId: string;
  algorithm: QuantumAlgorithm;
  variant: string;
  keyType: 'public' | 'private' | 'both';
  format: 'pem' | 'der' | 'raw' | 'json';
  data: string | Uint8Array;
  metadata: QuantumKeyMetadata;
  exportedAt: Date;
  signature?: string; // 导出数据的签名
}

export interface QuantumKeyImport {
  algorithm: QuantumAlgorithm;
  variant: string;
  keyType: 'public' | 'private' | 'both';
  format: 'pem' | 'der' | 'raw' | 'json';
  data: string | Uint8Array;
  metadata?: Partial<QuantumKeyMetadata>;
  verifySignature?: boolean;
  signature?: string;
}

// 批量操作接口
export interface QuantumBatchOperation {
  operationId: string;
  operationType: 'key_generation' | 'key_rotation' | 'key_revocation';
  algorithm: QuantumAlgorithm;
  count: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  results?: string[];
  errors?: string[];
}

// 审计日志接口
export interface QuantumAuditLog {
  logId: string;
  timestamp: Date;
  userId?: string;
  operation: string;
  algorithm: QuantumAlgorithm;
  keyId?: string;
  success: boolean;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// 性能监控接口
export interface QuantumPerformanceMetrics {
  algorithm: QuantumAlgorithm;
  operation: string;
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface QuantumPerformanceReport {
  algorithm: QuantumAlgorithm;
  timeRange: {
    start: Date;
    end: Date;
  };
  operations: {
    [operation: string]: {
      count: number;
      averageTime: number;
      minTime: number;
      maxTime: number;
      successRate: number;
    };
  };
  resourceUsage: {
    averageMemory: number;
    peakMemory: number;
    averageCpu: number;
    peakCpu: number;
  };
}

// 缓存接口
export interface QuantumCacheEntry {
  key: string;
  value: any;
  algorithm: QuantumAlgorithm;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

export interface QuantumCacheStatistics {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  memoryUsage: number;
  lastCleanup: Date;
}

// 配置验证接口
export interface QuantumConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedAt: Date;
}

// 系统信息接口
export interface QuantumSystemInfo {
  version: string;
  buildDate: Date;
  supportedAlgorithms: QuantumAlgorithm[];
  supportedVariants: {
    kyber: KyberVariant[];
    dilithium: DilithiumVariant[];
    sphincs: SphincsVariant[];
  };
  systemCapabilities: {
    hardwareAcceleration: boolean;
    parallelProcessing: boolean;
    secureMemory: boolean;
  };
  runtime: {
    nodeVersion: string;
    platform: string;
    architecture: string;
    totalMemory: number;
    freeMemory: number;
  };
}