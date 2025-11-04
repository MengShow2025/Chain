/**
 * TitanChain量子抗性密码学模块
 * 
 * 提供后量子密码学算法支持，包括：
 * - Kyber: 基于格的密钥封装机制
 * - Dilithium: 基于格的数字签名
 * - SPHINCS+: 基于哈希的数字签名
 */

export * from './types.js';
export * from './kyber/index.js';
export * from './dilithium/index.js';
export * from './sphincs/index.js';
export * from './utils.js';
export * from './quantum-key-manager.js';
export * from './quantum-resistant-system.js';

// 量子抗性系统接口
export interface IQuantumResistantSystem {
  initializeSystem(): Promise<void>;
  shutdownSystem(): Promise<void>;
  
  // Kyber密钥封装
  generateKyberKeyPair(securityLevel: 512 | 768 | 1024): Promise<KyberKeyPair>;
  encapsulate(publicKey: KyberPublicKey): Promise<KyberEncapsulation>;
  decapsulate(privateKey: KyberPrivateKey, ciphertext: Uint8Array): Promise<Uint8Array>;
  
  // Dilithium数字签名
  generateDilithiumKeyPair(securityLevel: 2 | 3 | 5): Promise<DilithiumKeyPair>;
  signWithDilithium(privateKey: DilithiumPrivateKey, message: Uint8Array): Promise<DilithiumSignature>;
  verifyDilithiumSignature(publicKey: DilithiumPublicKey, message: Uint8Array, signature: DilithiumSignature): Promise<boolean>;
  
  // SPHINCS+哈希签名
  generateSphincsKeyPair(variant: SphincsVariant): Promise<SphincsKeyPair>;
  signWithSphincs(privateKey: SphincsPrivateKey, message: Uint8Array): Promise<SphincsSignature>;
  verifySphincsSignature(publicKey: SphincsPublicKey, message: Uint8Array, signature: SphincsSignature): Promise<boolean>;
  
  // 密钥管理
  rotateKeys(keyType: 'kyber' | 'dilithium' | 'sphincs'): Promise<void>;
  exportKeys(format: 'pem' | 'der' | 'raw'): Promise<QuantumKeyExport>;
  importKeys(keyData: QuantumKeyImport): Promise<void>;
  
  // 系统状态
  healthCheck(): Promise<QuantumHealthStatus>;
  getStatistics(): Promise<QuantumStatistics>;
}

// Kyber相关类型
export interface KyberKeyPair {
  publicKey: KyberPublicKey;
  privateKey: KyberPrivateKey;
  securityLevel: 512 | 768 | 1024;
  createdAt: Date;
}

export interface KyberPublicKey {
  keyId: string;
  algorithm: 'KYBER';
  securityLevel: 512 | 768 | 1024;
  publicKeyData: Uint8Array;
  createdAt: Date;
}

export interface KyberPrivateKey {
  keyId: string;
  algorithm: 'KYBER';
  securityLevel: 512 | 768 | 1024;
  privateKeyData: Uint8Array;
  publicKeyHash: string;
  createdAt: Date;
}

export interface KyberEncapsulation {
  ciphertext: Uint8Array;
  sharedSecret: Uint8Array;
  encapsulationId: string;
  timestamp: Date;
}

// Dilithium相关类型
export interface DilithiumKeyPair {
  publicKey: DilithiumPublicKey;
  privateKey: DilithiumPrivateKey;
  securityLevel: 2 | 3 | 5;
  createdAt: Date;
}

export interface DilithiumPublicKey {
  keyId: string;
  algorithm: 'DILITHIUM';
  securityLevel: 2 | 3 | 5;
  publicKeyData: Uint8Array;
  createdAt: Date;
}

export interface DilithiumPrivateKey {
  keyId: string;
  algorithm: 'DILITHIUM';
  securityLevel: 2 | 3 | 5;
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

// SPHINCS+相关类型
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

export type SphincsVariant = 
  | 'SPHINCS_PLUS_128F_ROBUST'
  | 'SPHINCS_PLUS_128F_SIMPLE'
  | 'SPHINCS_PLUS_128S_ROBUST'
  | 'SPHINCS_PLUS_128S_SIMPLE'
  | 'SPHINCS_PLUS_192F_ROBUST'
  | 'SPHINCS_PLUS_192F_SIMPLE'
  | 'SPHINCS_PLUS_192S_ROBUST'
  | 'SPHINCS_PLUS_192S_SIMPLE'
  | 'SPHINCS_PLUS_256F_ROBUST'
  | 'SPHINCS_PLUS_256F_SIMPLE'
  | 'SPHINCS_PLUS_256S_ROBUST'
  | 'SPHINCS_PLUS_256S_SIMPLE';

// 系统状态类型
export interface QuantumHealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  algorithms: {
    kyber: AlgorithmHealth;
    dilithium: AlgorithmHealth;
    sphincs: AlgorithmHealth;
  };
  keyManager: {
    status: 'ACTIVE' | 'INACTIVE';
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
  };
  overallScore: number;
  lastCheck: Date;
}

export interface AlgorithmHealth {
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  keyPairsGenerated: number;
  operationsPerformed: number;
  averageOperationTime: number;
  errorRate: number;
}

export interface QuantumStatistics {
  totalKeyPairsGenerated: number;
  totalEncapsulations: number;
  totalSignatures: number;
  totalVerifications: number;
  successfulOperations: number;
  failedOperations: number;
  averageKeyGenerationTime: number;
  averageSigningTime: number;
  averageVerificationTime: number;
  algorithmUsage: {
    kyber: number;
    dilithium: number;
    sphincs: number;
  };
  lastUpdated: Date;
}

// 密钥导入导出类型
export interface QuantumKeyExport {
  format: 'pem' | 'der' | 'raw';
  keys: {
    kyber?: KyberKeyPair[];
    dilithium?: DilithiumKeyPair[];
    sphincs?: SphincsKeyPair[];
  };
  metadata: {
    exportedAt: Date;
    version: string;
    checksum: string;
  };
}

export interface QuantumKeyImport {
  format: 'pem' | 'der' | 'raw';
  keyData: Uint8Array;
  metadata?: {
    version?: string;
    checksum?: string;
  };
}

// 错误类型
export class QuantumError extends Error {
  constructor(
    message: string,
    public code: string = 'QUANTUM_ERROR',
    public cause?: Error
  ) {
    super(message);
    this.name = 'QuantumError';
  }
}