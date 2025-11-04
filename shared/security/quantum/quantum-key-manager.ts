/**
 * 量子抗性密钥管理器
 * 
 * 统一管理Kyber、Dilithium、SPHINCS+等后量子密码学算法的密钥
 */

import { EventEmitter } from 'events';
import {
  QuantumAlgorithm,
  KyberKeyPair,
  DilithiumKeyPair,
  SphincsKeyPair,
  QuantumKeyMetadata,
  QuantumKeyRotationPolicy,
  KeyStatus,
  QuantumError,
  QuantumEvent,
  QuantumBatchOperation,
  QuantumKeyExport,
  QuantumKeyImport
} from './types.js';
import { KeyManagementUtils, SecureRandom, EncodingUtils, TimingSafeUtils } from './utils.js';

export class QuantumKeyManager extends EventEmitter {
  private keyStore: Map<string, QuantumKeyMetadata> = new Map();
  private keyData: Map<string, any> = new Map(); // 存储实际密钥数据
  private rotationPolicies: Map<QuantumAlgorithm, QuantumKeyRotationPolicy> = new Map();
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized: boolean = false;
  
  constructor() {
    super();
    this.setupDefaultPolicies();
  }
  
  /**
   * 初始化密钥管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      console.log('🚀 Initializing Quantum Key Manager...');
      
      // 启动密钥轮换调度器
      this.startRotationScheduler();
      
      // 清理过期密钥
      await this.cleanupExpiredKeys();
      
      this.isInitialized = true;
      console.log('✅ Quantum Key Manager initialized successfully');
      
      this.emit('manager_initialized', {
        timestamp: new Date(),
        keyCount: this.keyStore.size
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Quantum Key Manager:', error);
      throw new QuantumError(`Failed to initialize key manager: ${error.message}`, 'KEY_MANAGER_INIT_ERROR', error);
    }
  }
  
  /**
   * 关闭密钥管理器
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      // 停止所有轮换定时器
      for (const timer of this.rotationTimers.values()) {
        clearTimeout(timer);
      }
      this.rotationTimers.clear();
      
      // 清理敏感数据
      this.keyData.clear();
      this.keyStore.clear();
      
      this.isInitialized = false;
      console.log('✅ Quantum Key Manager shutdown completed');
      
      this.emit('manager_shutdown', {
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Error during Quantum Key Manager shutdown:', error);
      throw new QuantumError(`Failed to shutdown key manager: ${error.message}`, 'KEY_MANAGER_SHUTDOWN_ERROR', error);
    }
  }
  
  /**
   * 注册密钥
   */
  async registerKey(keyId: string, keyData: any): Promise<void> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    try {
      // 创建密钥元数据
      const metadata: QuantumKeyMetadata = {
        keyId,
        algorithm: keyData.algorithm as QuantumAlgorithm,
        variant: keyData.securityLevel,
        status: 'active',
        securityLevel: keyData.securityLevel,
        createdAt: keyData.createdAt || new Date(),
        usageCount: 0,
        tags: []
      };
      
      // 设置过期时间
      const policy = this.rotationPolicies.get(metadata.algorithm);
      if (policy && policy.maxAge > 0) {
        metadata.expiresAt = new Date(Date.now() + policy.maxAge);
      }
      
      // 存储元数据和密钥数据
      this.keyStore.set(keyId, metadata);
      this.keyData.set(keyId, keyData);
      
      // 设置自动轮换
      if (policy && policy.autoRotate) {
        this.scheduleKeyRotation(keyId, policy.rotationInterval);
      }
      
      console.log(`✅ Key registered: ${keyId} (${metadata.algorithm})`);
      
      this.emit('key_stored', {
        keyId,
        algorithm: metadata.algorithm,
        variant: metadata.variant,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Failed to register key:', error);
      throw new QuantumError(`Failed to register key: ${error.message}`, 'KEY_REGISTER_ERROR', error);
    }
  }

  /**
   * 存储密钥对
   */
  async storeKeyPair(keyPair: KyberKeyPair | DilithiumKeyPair | SphincsKeyPair): Promise<void> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    try {
      const keyId = keyPair.publicKey.keyId;
      const algorithm = keyPair.publicKey.algorithm as QuantumAlgorithm;
      
      // 创建密钥元数据
      const metadata: QuantumKeyMetadata = {
        keyId,
        algorithm,
        variant: keyPair.variant as string,
        status: 'active',
        securityLevel: this.getSecurityLevel(algorithm, keyPair.variant as string),
        createdAt: keyPair.createdAt,
        usageCount: 0,
        tags: []
      };
      
      // 设置过期时间
      const policy = this.rotationPolicies.get(algorithm);
      if (policy && policy.maxAge > 0) {
        metadata.expiresAt = new Date(Date.now() + policy.maxAge);
      }
      
      // 存储元数据和密钥数据
      this.keyStore.set(keyId, metadata);
      this.keyData.set(keyId, keyPair);
      
      // 设置自动轮换
      if (policy && policy.autoRotate) {
        this.scheduleKeyRotation(keyId, policy.rotationInterval);
      }
      
      console.log(`✅ Key pair stored: ${keyId} (${algorithm})`);
      
      this.emit('key_stored', {
        keyId,
        algorithm,
        variant: keyPair.variant,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Failed to store key pair:', error);
      throw new QuantumError(`Failed to store key pair: ${error.message}`, 'KEY_STORE_ERROR', error);
    }
  }
  
  /**
   * 获取密钥对
   */
  async getKeyPair(keyId: string): Promise<KyberKeyPair | DilithiumKeyPair | SphincsKeyPair | null> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    try {
      const metadata = this.keyStore.get(keyId);
      if (!metadata) {
        return null;
      }
      
      // 检查密钥状态
      if (metadata.status !== 'active') {
        throw new QuantumError(`Key ${keyId} is not active (status: ${metadata.status})`);
      }
      
      // 检查是否过期
      if (KeyManagementUtils.isKeyExpired(metadata)) {
        await this.revokeKey(keyId, 'expired');
        throw new QuantumError(`Key ${keyId} has expired`);
      }
      
      const keyPair = this.keyData.get(keyId);
      if (!keyPair) {
        throw new QuantumError(`Key data not found for ${keyId}`);
      }
      
      // 更新使用统计
      metadata.usageCount++;
      metadata.lastUsed = new Date();
      
      // 检查是否需要轮换
      const policy = this.rotationPolicies.get(metadata.algorithm);
      if (policy && KeyManagementUtils.shouldRotateKey(metadata, policy.maxAge, policy.maxUsage)) {
        this.emit('key_rotation_needed', {
          keyId,
          algorithm: metadata.algorithm,
          reason: 'usage_limit_reached',
          timestamp: new Date()
        });
      }
      
      return keyPair;
      
    } catch (error) {
      console.error(`❌ Failed to get key pair ${keyId}:`, error);
      throw new QuantumError(`Failed to get key pair: ${error.message}`, 'KEY_GET_ERROR', error);
    }
  }
  
  /**
   * 列出密钥
   */
  async listKeys(algorithm?: QuantumAlgorithm, status?: KeyStatus): Promise<QuantumKeyMetadata[]> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    const keys: QuantumKeyMetadata[] = [];
    
    for (const metadata of this.keyStore.values()) {
      if (algorithm && metadata.algorithm !== algorithm) {
        continue;
      }
      
      if (status && metadata.status !== status) {
        continue;
      }
      
      keys.push({ ...metadata }); // 返回副本
    }
    
    return keys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  /**
   * 撤销密钥
   */
  async revokeKey(keyId: string, reason: string = 'manual'): Promise<void> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    try {
      const metadata = this.keyStore.get(keyId);
      if (!metadata) {
        throw new QuantumError(`Key ${keyId} not found`);
      }
      
      // 更新状态
      metadata.status = 'revoked';
      
      // 清理轮换定时器
      const timer = this.rotationTimers.get(keyId);
      if (timer) {
        clearTimeout(timer);
        this.rotationTimers.delete(keyId);
      }
      
      // 清理敏感数据
      this.keyData.delete(keyId);
      
      console.log(`✅ Key revoked: ${keyId} (reason: ${reason})`);
      
      this.emit('key_revoked', {
        keyId,
        algorithm: metadata.algorithm,
        reason,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error(`❌ Failed to revoke key ${keyId}:`, error);
      throw new QuantumError(`Failed to revoke key: ${error.message}`, 'KEY_REVOKE_ERROR', error);
    }
  }
  
  /**
   * 轮换密钥
   */
  async rotateKey(keyId: string): Promise<string> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    try {
      const metadata = this.keyStore.get(keyId);
      if (!metadata) {
        throw new QuantumError(`Key ${keyId} not found`);
      }
      
      const oldKeyPair = this.keyData.get(keyId);
      if (!oldKeyPair) {
        throw new QuantumError(`Key data not found for ${keyId}`);
      }
      
      // 生成新密钥对（这里需要调用相应的密钥生成函数）
      // 为了简化，我们创建一个新的密钥ID
      const newKeyId = KeyManagementUtils.generateKeyId(metadata.algorithm, metadata.variant);
      
      // 创建新的密钥对（简化实现）
      const newKeyPair = {
        ...oldKeyPair,
        publicKey: {
          ...oldKeyPair.publicKey,
          keyId: newKeyId,
          createdAt: new Date()
        },
        privateKey: {
          ...oldKeyPair.privateKey,
          keyId: newKeyId,
          createdAt: new Date()
        },
        createdAt: new Date()
      };
      
      // 存储新密钥
      await this.storeKeyPair(newKeyPair);
      
      // 撤销旧密钥
      await this.revokeKey(keyId, 'rotated');
      
      console.log(`✅ Key rotated: ${keyId} -> ${newKeyId}`);
      
      this.emit('key_rotated', {
        oldKeyId: keyId,
        newKeyId,
        algorithm: metadata.algorithm,
        timestamp: new Date()
      });
      
      return newKeyId;
      
    } catch (error) {
      console.error(`❌ Failed to rotate key ${keyId}:`, error);
      throw new QuantumError(`Failed to rotate key: ${error.message}`, 'KEY_ROTATE_ERROR', error);
    }
  }
  
  /**
   * 导出密钥
   */
  async exportKey(keyId: string, format: 'pem' | 'der' | 'raw' | 'json' = 'json', keyType: 'public' | 'private' | 'both' = 'both'): Promise<QuantumKeyExport> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    try {
      const metadata = this.keyStore.get(keyId);
      if (!metadata) {
        throw new QuantumError(`Key ${keyId} not found`);
      }
      
      const keyPair = this.keyData.get(keyId);
      if (!keyPair) {
        throw new QuantumError(`Key data not found for ${keyId}`);
      }
      
      let exportData: any;
      
      switch (format) {
        case 'json':
          if (keyType === 'public') {
            exportData = JSON.stringify(keyPair.publicKey);
          } else if (keyType === 'private') {
            exportData = JSON.stringify(keyPair.privateKey);
          } else {
            exportData = JSON.stringify(keyPair);
          }
          break;
          
        case 'raw':
          if (keyType === 'public') {
            exportData = keyPair.publicKey.publicKeyData;
          } else if (keyType === 'private') {
            exportData = keyPair.privateKey.privateKeyData;
          } else {
            exportData = {
              public: keyPair.publicKey.publicKeyData,
              private: keyPair.privateKey.privateKeyData
            };
          }
          break;
          
        default:
          throw new QuantumError(`Unsupported export format: ${format}`);
      }
      
      const exportObj: QuantumKeyExport = {
        keyId,
        algorithm: metadata.algorithm,
        variant: metadata.variant,
        keyType,
        format,
        data: exportData,
        metadata: { ...metadata },
        exportedAt: new Date()
      };
      
      this.emit('key_exported', {
        keyId,
        algorithm: metadata.algorithm,
        format,
        keyType,
        timestamp: new Date()
      });
      
      return exportObj;
      
    } catch (error) {
      console.error(`❌ Failed to export key ${keyId}:`, error);
      throw new QuantumError(`Failed to export key: ${error.message}`, 'KEY_EXPORT_ERROR', error);
    }
  }
  
  /**
   * 导入密钥
   */
  async importKey(importData: QuantumKeyImport): Promise<string> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    try {
      let keyPair: any;
      
      switch (importData.format) {
        case 'json':
          keyPair = JSON.parse(importData.data as string);
          break;
          
        case 'raw':
          // 需要根据算法和变体重构密钥对
          throw new QuantumError('Raw format import not yet implemented');
          
        default:
          throw new QuantumError(`Unsupported import format: ${importData.format}`);
      }
      
      // 验证密钥对结构
      if (!keyPair.publicKey || !keyPair.privateKey) {
        throw new QuantumError('Invalid key pair structure');
      }
      
      // 生成新的密钥ID
      const keyId = KeyManagementUtils.generateKeyId(importData.algorithm, importData.variant);
      
      // 更新密钥ID
      keyPair.publicKey.keyId = keyId;
      keyPair.privateKey.keyId = keyId;
      keyPair.createdAt = new Date();
      
      // 存储密钥对
      await this.storeKeyPair(keyPair);
      
      console.log(`✅ Key imported: ${keyId} (${importData.algorithm})`);
      
      this.emit('key_imported', {
        keyId,
        algorithm: importData.algorithm,
        variant: importData.variant,
        timestamp: new Date()
      });
      
      return keyId;
      
    } catch (error) {
      console.error('❌ Failed to import key:', error);
      throw new QuantumError(`Failed to import key: ${error.message}`, 'KEY_IMPORT_ERROR', error);
    }
  }
  
  /**
   * 获取健康状态
   */
  async getHealthStatus(): Promise<any> {
    if (!this.isInitialized) {
      return { status: 'INACTIVE' };
    }
    
    const stats = await this.getKeyStatistics();
    const activeKeys = stats.byStatus['active'] || 0;
    
    return {
      status: activeKeys > 0 ? 'ACTIVE' : 'INACTIVE',
      totalKeys: stats.total,
      activeKeys,
      lastCheck: new Date()
    };
  }

  /**
   * 轮换密钥
   */
  async rotateKeys(keyType: 'kyber' | 'dilithium' | 'sphincs'): Promise<void> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    try {
      const algorithmMap = {
        'kyber': 'KYBER' as QuantumAlgorithm,
        'dilithium': 'DILITHIUM' as QuantumAlgorithm,
        'sphincs': 'SPHINCS_PLUS' as QuantumAlgorithm
      };
      
      const algorithm = algorithmMap[keyType];
      if (!algorithm) {
        throw new QuantumError(`Unknown key type: ${keyType}`);
      }
      
      // 获取该算法的所有活跃密钥
      const keys = await this.listKeys(algorithm, 'active');
      
      // 轮换所有密钥
      for (const keyMetadata of keys) {
        try {
          await this.rotateKey(keyMetadata.keyId);
        } catch (error) {
          console.error(`❌ Failed to rotate key ${keyMetadata.keyId}:`, error);
        }
      }
      
      console.log(`✅ Rotated ${keys.length} ${keyType} keys`);
      
    } catch (error) {
      console.error(`❌ Failed to rotate ${keyType} keys:`, error);
      throw new QuantumError(`Failed to rotate keys: ${error.message}`, 'KEY_ROTATION_ERROR', error);
    }
  }

  /**
   * 导出密钥
   */
  async exportKeys(format: 'pem' | 'der' | 'raw'): Promise<any> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    try {
      const exportData: any = {
        format,
        exportedAt: new Date(),
        keys: {}
      };
      
      for (const [keyId, metadata] of this.keyStore) {
        if (metadata.status === 'active') {
          const keyData = this.keyData.get(keyId);
          if (keyData) {
            exportData.keys[keyId] = {
              metadata,
              keyData: format === 'raw' ? keyData : JSON.stringify(keyData)
            };
          }
        }
      }
      
      return exportData;
      
    } catch (error) {
      console.error('❌ Failed to export keys:', error);
      throw new QuantumError(`Failed to export keys: ${error.message}`, 'KEY_EXPORT_ERROR', error);
    }
  }

  /**
   * 导入密钥
   */
  async importKeys(keyData: any): Promise<void> {
    if (!this.isInitialized) {
      throw new QuantumError('Key manager not initialized');
    }
    
    try {
      if (!keyData.keys) {
        throw new QuantumError('Invalid import data structure');
      }
      
      let importedCount = 0;
      
      for (const [keyId, data] of Object.entries(keyData.keys as any)) {
        try {
          const parsedData = typeof data.keyData === 'string' ? JSON.parse(data.keyData) : data.keyData;
          await this.storeKeyPair(parsedData);
          importedCount++;
        } catch (error) {
          console.error(`❌ Failed to import key ${keyId}:`, error);
        }
      }
      
      console.log(`✅ Imported ${importedCount} keys`);
      
    } catch (error) {
      console.error('❌ Failed to import keys:', error);
      throw new QuantumError(`Failed to import keys: ${error.message}`, 'KEY_IMPORT_ERROR', error);
    }
  }

  /**
   * 获取密钥统计信息
   */
  async getKeyStatistics(): Promise<{
    total: number;
    byAlgorithm: Record<QuantumAlgorithm, number>;
    byStatus: Record<KeyStatus, number>;
    oldestKey: Date | null;
    newestKey: Date | null;
  }> {
    const stats = {
      total: this.keyStore.size,
      byAlgorithm: {} as Record<QuantumAlgorithm, number>,
      byStatus: {} as Record<KeyStatus, number>,
      oldestKey: null as Date | null,
      newestKey: null as Date | null
    };
    
    for (const metadata of this.keyStore.values()) {
      // 按算法统计
      stats.byAlgorithm[metadata.algorithm] = (stats.byAlgorithm[metadata.algorithm] || 0) + 1;
      
      // 按状态统计
      stats.byStatus[metadata.status] = (stats.byStatus[metadata.status] || 0) + 1;
      
      // 最老和最新密钥
      if (!stats.oldestKey || metadata.createdAt < stats.oldestKey) {
        stats.oldestKey = metadata.createdAt;
      }
      
      if (!stats.newestKey || metadata.createdAt > stats.newestKey) {
        stats.newestKey = metadata.createdAt;
      }
    }
    
    return stats;
  }
  
  // 私有方法
  
  private setupDefaultPolicies(): void {
    // Kyber密钥轮换策略
    this.rotationPolicies.set('KYBER', {
      algorithm: 'KYBER',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
      maxUsage: 10000,
      autoRotate: true,
      rotationInterval: 6 * 60 * 60 * 1000 // 6小时检查一次
    });
    
    // Dilithium密钥轮换策略
    this.rotationPolicies.set('DILITHIUM', {
      algorithm: 'DILITHIUM',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30天
      maxUsage: 50000,
      autoRotate: true,
      rotationInterval: 24 * 60 * 60 * 1000 // 24小时检查一次
    });
    
    // SPHINCS+密钥轮换策略
    this.rotationPolicies.set('SPHINCS_PLUS', {
      algorithm: 'SPHINCS_PLUS',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30天
      maxUsage: 50000,
      autoRotate: true,
      rotationInterval: 24 * 60 * 60 * 1000 // 24小时检查一次
    });
  }
  
  private getSecurityLevel(algorithm: QuantumAlgorithm, variant: string): 1 | 3 | 5 {
    // 简化的安全级别映射
    if (variant.includes('512') || variant.includes('2') || variant.includes('128')) {
      return 1;
    } else if (variant.includes('768') || variant.includes('3') || variant.includes('192')) {
      return 3;
    } else {
      return 5;
    }
  }
  
  private startRotationScheduler(): void {
    // 每小时检查一次密钥轮换
    const checkInterval = 60 * 60 * 1000; // 1小时
    
    const scheduler = setInterval(async () => {
      try {
        await this.checkAndRotateKeys();
      } catch (error) {
        console.error('❌ Error in rotation scheduler:', error);
      }
    }, checkInterval);
    
    // 保存定时器引用以便清理
    this.rotationTimers.set('scheduler', scheduler);
  }
  
  private async checkAndRotateKeys(): Promise<void> {
    for (const [keyId, metadata] of this.keyStore) {
      if (metadata.status !== 'active') {
        continue;
      }
      
      const policy = this.rotationPolicies.get(metadata.algorithm);
      if (!policy || !policy.autoRotate) {
        continue;
      }
      
      if (KeyManagementUtils.shouldRotateKey(metadata, policy.maxAge, policy.maxUsage)) {
        try {
          await this.rotateKey(keyId);
        } catch (error) {
          console.error(`❌ Failed to auto-rotate key ${keyId}:`, error);
        }
      }
    }
  }
  
  private scheduleKeyRotation(keyId: string, interval: number): void {
    const timer = setTimeout(async () => {
      try {
        await this.rotateKey(keyId);
      } catch (error) {
        console.error(`❌ Failed to scheduled rotate key ${keyId}:`, error);
      }
    }, interval);
    
    this.rotationTimers.set(keyId, timer);
  }
  
  private async cleanupExpiredKeys(): Promise<void> {
    const expiredKeys: string[] = [];
    
    for (const [keyId, metadata] of this.keyStore) {
      if (KeyManagementUtils.isKeyExpired(metadata)) {
        expiredKeys.push(keyId);
      }
    }
    
    for (const keyId of expiredKeys) {
      try {
        await this.revokeKey(keyId, 'expired');
      } catch (error) {
        console.error(`❌ Failed to cleanup expired key ${keyId}:`, error);
      }
    }
    
    if (expiredKeys.length > 0) {
      console.log(`✅ Cleaned up ${expiredKeys.length} expired keys`);
    }
  }
}