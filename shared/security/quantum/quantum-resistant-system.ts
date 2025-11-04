/**
 * TitanChain量子抗性密码学系统核心实现
 * 
 * 统一管理后量子密码学算法，提供完整的量子安全防护
 */

import { EventEmitter } from 'events';
import { randomBytes, createHash } from 'crypto';
import {
  IQuantumResistantSystem,
  KyberKeyPair,
  KyberPublicKey,
  KyberPrivateKey,
  KyberEncapsulation,
  DilithiumKeyPair,
  DilithiumPublicKey,
  DilithiumPrivateKey,
  DilithiumSignature,
  SphincsKeyPair,
  SphincsPublicKey,
  SphincsPrivateKey,
  SphincsSignature,
  SphincsVariant,
  QuantumHealthStatus,
  QuantumStatistics,
  QuantumKeyExport,
  QuantumKeyImport,
  QuantumError
} from './index.js';
import { KyberKEM } from './kyber/kyber-kem.js';
import { DilithiumDSA } from './dilithium/dilithium-dsa.js';
import { SphincsPlus } from './sphincs/sphincs-plus.js';
import { QuantumKeyManager } from './quantum-key-manager.js';

export class QuantumResistantSystem extends EventEmitter implements IQuantumResistantSystem {
  private isInitialized: boolean = false;
  
  // 算法实现
  private kyberKEM: KyberKEM;
  private dilithiumDSA: DilithiumDSA;
  private sphincsPlus: SphincsPlus;
  private keyManager: QuantumKeyManager;
  
  // 系统状态
  private statistics: QuantumStatistics;
  
  constructor() {
    super();
    
    // 初始化算法实现
    this.kyberKEM = new KyberKEM();
    this.dilithiumDSA = new DilithiumDSA();
    this.sphincsPlus = new SphincsPlus();
    this.keyManager = new QuantumKeyManager();
    
    // 初始化统计信息
    this.statistics = {
      totalKeyPairsGenerated: 0,
      totalEncapsulations: 0,
      totalSignatures: 0,
      totalVerifications: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageKeyGenerationTime: 0,
      averageSigningTime: 0,
      averageVerificationTime: 0,
      algorithmUsage: {
        kyber: 0,
        dilithium: 0,
        sphincs: 0
      },
      lastUpdated: new Date()
    };
    
    this.setupEventListeners();
  }
  
  /**
   * 初始化量子抗性系统
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new QuantumError('Quantum resistant system is already initialized');
    }
    
    try {
      console.log('🚀 Initializing TitanChain Quantum Resistant System...');
      
      // 1. 初始化各个算法模块
      await this.kyberKEM.initialize();
      console.log('✅ Kyber KEM initialized');
      
      await this.dilithiumDSA.initialize();
      console.log('✅ Dilithium DSA initialized');
      
      await this.sphincsPlus.initialize();
      console.log('✅ SPHINCS+ initialized');
      
      // 2. 初始化密钥管理器
      await this.keyManager.initialize();
      console.log('✅ Quantum Key Manager initialized');
      
      // 3. 预生成一些常用密钥对
      await this.preGenerateKeys();
      
      // 4. 启动系统监控
      this.startSystemMonitoring();
      
      this.isInitialized = true;
      
      this.emit('system_initialized', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          algorithms: ['kyber', 'dilithium', 'sphincs'],
          keyManager: 'active'
        }
      });
      
      console.log('🎉 Quantum Resistant System initialization completed');
      
    } catch (error) {
      console.error('❌ Failed to initialize Quantum Resistant System:', error);
      throw new QuantumError(`Failed to initialize quantum resistant system: ${error.message}`, 'INIT_ERROR', error);
    }
  }
  
  /**
   * 关闭量子抗性系统
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      console.log('🔄 Shutting down Quantum Resistant System...');
      
      // 1. 关闭密钥管理器
      await this.keyManager.shutdown();
      console.log('✅ Quantum Key Manager shutdown completed');
      
      // 2. 关闭算法模块
      await this.sphincsPlus.shutdown();
      console.log('✅ SPHINCS+ shutdown completed');
      
      await this.dilithiumDSA.shutdown();
      console.log('✅ Dilithium DSA shutdown completed');
      
      await this.kyberKEM.shutdown();
      console.log('✅ Kyber KEM shutdown completed');
      
      this.isInitialized = false;
      
      this.emit('system_shutdown', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { status: 'shutdown' }
      });
      
      console.log('✅ Quantum Resistant System shutdown completed');
      
    } catch (error) {
      console.error('❌ Error during Quantum Resistant System shutdown:', error);
      throw new QuantumError(`Failed to shutdown quantum resistant system: ${error.message}`, 'SHUTDOWN_ERROR', error);
    }
  }
  
  /**
   * 生成Kyber密钥对
   */
  async generateKyberKeyPair(securityLevel: 512 | 768 | 1024): Promise<KyberKeyPair> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    const startTime = Date.now();
    
    try {
      const keyPair = await this.kyberKEM.generateKeyPair(securityLevel);
      
      // 注册到密钥管理器
      await this.keyManager.registerKey(keyPair.publicKey.keyId, {
        algorithm: 'KYBER',
        keyType: 'public',
        securityLevel: securityLevel.toString(),
        keyData: keyPair.publicKey.publicKeyData,
        createdAt: keyPair.createdAt
      });
      
      await this.keyManager.registerKey(keyPair.privateKey.keyId, {
        algorithm: 'KYBER',
        keyType: 'private',
        securityLevel: securityLevel.toString(),
        keyData: keyPair.privateKey.privateKeyData,
        createdAt: keyPair.createdAt
      });
      
      // 更新统计信息
      this.statistics.totalKeyPairsGenerated++;
      this.statistics.algorithmUsage.kyber++;
      this.updateAverageKeyGenerationTime(Date.now() - startTime);
      this.statistics.successfulOperations++;
      this.statistics.lastUpdated = new Date();
      
      this.emit('kyber_keypair_generated', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          keyId: keyPair.publicKey.keyId,
          securityLevel,
          generationTime: Date.now() - startTime
        }
      });
      
      console.log(`🔑 Kyber-${securityLevel} key pair generated: ${keyPair.publicKey.keyId}`);
      return keyPair;
      
    } catch (error) {
      this.statistics.failedOperations++;
      this.statistics.lastUpdated = new Date();
      
      console.error(`❌ Failed to generate Kyber-${securityLevel} key pair:`, error);
      throw new QuantumError(`Failed to generate Kyber key pair: ${error.message}`, 'KYBER_KEYGEN_ERROR', error);
    }
  }
  
  /**
   * Kyber密钥封装
   */
  async kyberEncapsulate(publicKey: KyberPublicKey): Promise<KyberEncapsulation> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    try {
      const encapsulation = await this.kyberKEM.encapsulate(publicKey);
      
      // 更新统计信息
      this.statistics.totalEncapsulations++;
      this.statistics.algorithmUsage.kyber++;
      this.statistics.successfulOperations++;
      this.statistics.lastUpdated = new Date();
      
      this.emit('kyber_encapsulation', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          encapsulationId: encapsulation.encapsulationId,
          keyId: publicKey.keyId,
          securityLevel: publicKey.securityLevel
        }
      });
      
      console.log(`🔒 Kyber encapsulation completed: ${encapsulation.encapsulationId}`);
      return encapsulation;
      
    } catch (error) {
      this.statistics.failedOperations++;
      this.statistics.lastUpdated = new Date();
      
      console.error('❌ Failed to perform Kyber encapsulation:', error);
      throw new QuantumError(`Failed to encapsulate: ${error.message}`, 'KYBER_ENCAP_ERROR', error);
    }
  }
  
  /**
   * Kyber密钥解封装
   */
  async kyberDecapsulate(privateKey: KyberPrivateKey, ciphertext: Uint8Array): Promise<Uint8Array> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    try {
      const sharedSecret = await this.kyberKEM.decapsulate(privateKey, ciphertext);
      
      // 更新统计信息
      this.statistics.algorithmUsage.kyber++;
      this.statistics.successfulOperations++;
      this.statistics.lastUpdated = new Date();
      
      this.emit('kyber_decapsulation', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          keyId: privateKey.keyId,
          securityLevel: privateKey.securityLevel
        }
      });
      
      console.log(`🔓 Kyber decapsulation completed for key: ${privateKey.keyId}`);
      return sharedSecret;
      
    } catch (error) {
      this.statistics.failedOperations++;
      this.statistics.lastUpdated = new Date();
      
      console.error('❌ Failed to perform Kyber decapsulation:', error);
      throw new QuantumError(`Failed to decapsulate: ${error.message}`, 'KYBER_DECAP_ERROR', error);
    }
  }
  
  /**
   * 生成Dilithium密钥对
   */
  async generateDilithiumKeyPair(securityLevel: 2 | 3 | 5): Promise<DilithiumKeyPair> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    const startTime = Date.now();
    
    try {
      const keyPair = await this.dilithiumDSA.generateKeyPair(securityLevel);
      
      // 注册到密钥管理器
      await this.keyManager.registerKey(keyPair.publicKey.keyId, {
        algorithm: 'DILITHIUM',
        keyType: 'public',
        securityLevel: securityLevel.toString(),
        keyData: keyPair.publicKey.publicKeyData,
        createdAt: keyPair.createdAt
      });
      
      await this.keyManager.registerKey(keyPair.privateKey.keyId, {
        algorithm: 'DILITHIUM',
        keyType: 'private',
        securityLevel: securityLevel.toString(),
        keyData: keyPair.privateKey.privateKeyData,
        createdAt: keyPair.createdAt
      });
      
      // 更新统计信息
      this.statistics.totalKeyPairsGenerated++;
      this.statistics.algorithmUsage.dilithium++;
      this.updateAverageKeyGenerationTime(Date.now() - startTime);
      this.statistics.successfulOperations++;
      this.statistics.lastUpdated = new Date();
      
      this.emit('dilithium_keypair_generated', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          keyId: keyPair.publicKey.keyId,
          securityLevel,
          generationTime: Date.now() - startTime
        }
      });
      
      console.log(`🔑 Dilithium-${securityLevel} key pair generated: ${keyPair.publicKey.keyId}`);
      return keyPair;
      
    } catch (error) {
      this.statistics.failedOperations++;
      this.statistics.lastUpdated = new Date();
      
      console.error(`❌ Failed to generate Dilithium-${securityLevel} key pair:`, error);
      throw new QuantumError(`Failed to generate Dilithium key pair: ${error.message}`, 'DILITHIUM_KEYGEN_ERROR', error);
    }
  }
  
  /**
   * Dilithium数字签名
   */
  async dilithiumSign(privateKey: DilithiumPrivateKey, message: Uint8Array): Promise<DilithiumSignature> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    const startTime = Date.now();
    
    try {
      const signature = await this.dilithiumDSA.sign(privateKey, message);
      
      // 更新统计信息
      this.statistics.totalSignatures++;
      this.statistics.algorithmUsage.dilithium++;
      this.updateAverageSigningTime(Date.now() - startTime);
      this.statistics.successfulOperations++;
      this.statistics.lastUpdated = new Date();
      
      this.emit('dilithium_signature_created', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          signatureId: signature.signatureId,
          keyId: privateKey.keyId,
          securityLevel: privateKey.securityLevel,
          signingTime: Date.now() - startTime
        }
      });
      
      console.log(`✍️ Dilithium signature created: ${signature.signatureId}`);
      return signature;
      
    } catch (error) {
      this.statistics.failedOperations++;
      this.statistics.lastUpdated = new Date();
      
      console.error('❌ Failed to create Dilithium signature:', error);
      throw new QuantumError(`Failed to sign with Dilithium: ${error.message}`, 'DILITHIUM_SIGN_ERROR', error);
    }
  }
  
  /**
   * 验证Dilithium数字签名
   */
  async dilithiumVerify(publicKey: DilithiumPublicKey, message: Uint8Array, signature: DilithiumSignature): Promise<boolean> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    const startTime = Date.now();
    
    try {
      const isValid = await this.dilithiumDSA.verify(publicKey, message, signature);
      
      // 更新统计信息
      this.statistics.totalVerifications++;
      this.statistics.algorithmUsage.dilithium++;
      this.updateAverageVerificationTime(Date.now() - startTime);
      
      if (isValid) {
        this.statistics.successfulOperations++;
      } else {
        this.statistics.failedOperations++;
      }
      
      this.statistics.lastUpdated = new Date();
      
      this.emit('dilithium_signature_verified', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          signatureId: signature.signatureId,
          keyId: publicKey.keyId,
          isValid,
          verificationTime: Date.now() - startTime
        }
      });
      
      console.log(`🔍 Dilithium signature verification: ${isValid ? '✅ Valid' : '❌ Invalid'} (${signature.signatureId})`);
      return isValid;
      
    } catch (error) {
      this.statistics.failedOperations++;
      this.statistics.lastUpdated = new Date();
      
      console.error('❌ Failed to verify Dilithium signature:', error);
      throw new QuantumError(`Failed to verify Dilithium signature: ${error.message}`, 'DILITHIUM_VERIFY_ERROR', error);
    }
  }
  
  /**
   * 生成SPHINCS+密钥对
   */
  async generateSphincsKeyPair(variant: SphincsVariant): Promise<SphincsKeyPair> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    const startTime = Date.now();
    
    try {
      const keyPair = await this.sphincsPlus.generateKeyPair(variant);
      
      // 注册到密钥管理器
      await this.keyManager.registerKey(keyPair.publicKey.keyId, {
        algorithm: 'SPHINCS_PLUS',
        keyType: 'public',
        securityLevel: variant,
        keyData: keyPair.publicKey.publicKeyData,
        createdAt: keyPair.createdAt
      });
      
      await this.keyManager.registerKey(keyPair.privateKey.keyId, {
        algorithm: 'SPHINCS_PLUS',
        keyType: 'private',
        securityLevel: variant,
        keyData: keyPair.privateKey.privateKeyData,
        createdAt: keyPair.createdAt
      });
      
      // 更新统计信息
      this.statistics.totalKeyPairsGenerated++;
      this.statistics.algorithmUsage.sphincs++;
      this.updateAverageKeyGenerationTime(Date.now() - startTime);
      this.statistics.successfulOperations++;
      this.statistics.lastUpdated = new Date();
      
      this.emit('sphincs_keypair_generated', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          keyId: keyPair.publicKey.keyId,
          variant,
          generationTime: Date.now() - startTime
        }
      });
      
      console.log(`🔑 SPHINCS+ ${variant} key pair generated: ${keyPair.publicKey.keyId}`);
      return keyPair;
      
    } catch (error) {
      this.statistics.failedOperations++;
      this.statistics.lastUpdated = new Date();
      
      console.error(`❌ Failed to generate SPHINCS+ ${variant} key pair:`, error);
      throw new QuantumError(`Failed to generate SPHINCS+ key pair: ${error.message}`, 'SPHINCS_KEYGEN_ERROR', error);
    }
  }
  
  /**
   * SPHINCS+数字签名
   */
  async sphincsSign(privateKey: SphincsPrivateKey, message: Uint8Array): Promise<SphincsSignature> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    const startTime = Date.now();
    
    try {
      const signature = await this.sphincsPlus.sign(privateKey, message);
      
      // 更新统计信息
      this.statistics.totalSignatures++;
      this.statistics.algorithmUsage.sphincs++;
      this.updateAverageSigningTime(Date.now() - startTime);
      this.statistics.successfulOperations++;
      this.statistics.lastUpdated = new Date();
      
      this.emit('sphincs_signature_created', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          signatureId: signature.signatureId,
          keyId: privateKey.keyId,
          variant: privateKey.variant,
          signingTime: Date.now() - startTime
        }
      });
      
      console.log(`✍️ SPHINCS+ signature created: ${signature.signatureId}`);
      return signature;
      
    } catch (error) {
      this.statistics.failedOperations++;
      this.statistics.lastUpdated = new Date();
      
      console.error('❌ Failed to create SPHINCS+ signature:', error);
      throw new QuantumError(`Failed to sign with SPHINCS+: ${error.message}`, 'SPHINCS_SIGN_ERROR', error);
    }
  }
  
  /**
   * 验证SPHINCS+数字签名
   */
  async sphincsVerify(publicKey: SphincsPublicKey, message: Uint8Array, signature: SphincsSignature): Promise<boolean> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    const startTime = Date.now();
    
    try {
      const isValid = await this.sphincsPlus.verify(publicKey, message, signature);
      
      // 更新统计信息
      this.statistics.totalVerifications++;
      this.statistics.algorithmUsage.sphincs++;
      this.updateAverageVerificationTime(Date.now() - startTime);
      
      if (isValid) {
        this.statistics.successfulOperations++;
      } else {
        this.statistics.failedOperations++;
      }
      
      this.statistics.lastUpdated = new Date();
      
      this.emit('sphincs_signature_verified', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          signatureId: signature.signatureId,
          keyId: publicKey.keyId,
          isValid,
          verificationTime: Date.now() - startTime
        }
      });
      
      console.log(`🔍 SPHINCS+ signature verification: ${isValid ? '✅ Valid' : '❌ Invalid'} (${signature.signatureId})`);
      return isValid;
      
    } catch (error) {
      this.statistics.failedOperations++;
      this.statistics.lastUpdated = new Date();
      
      console.error('❌ Failed to verify SPHINCS+ signature:', error);
      throw new QuantumError(`Failed to verify SPHINCS+ signature: ${error.message}`, 'SPHINCS_VERIFY_ERROR', error);
    }
  }
  
  /**
   * 密钥轮换
   */
  async rotateKeys(keyType: 'kyber' | 'dilithium' | 'sphincs'): Promise<void> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    try {
      console.log(`🔄 Starting key rotation for ${keyType}...`);
      
      await this.keyManager.rotateKeys(keyType);
      
      this.emit('key_rotation_completed', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { keyType }
      });
      
      console.log(`✅ Key rotation completed for ${keyType}`);
      
    } catch (error) {
      console.error(`❌ Failed to rotate ${keyType} keys:`, error);
      throw new QuantumError(`Failed to rotate keys: ${error.message}`, 'KEY_ROTATION_ERROR', error);
    }
  }
  
  /**
   * 导出密钥
   */
  async exportKeys(format: 'pem' | 'der' | 'raw'): Promise<QuantumKeyExport> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    try {
      const exportData = await this.keyManager.exportKeys(format);
      
      this.emit('keys_exported', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { format, keyCount: Object.keys(exportData.keys).length }
      });
      
      console.log(`📤 Keys exported in ${format} format`);
      return exportData;
      
    } catch (error) {
      console.error('❌ Failed to export keys:', error);
      throw new QuantumError(`Failed to export keys: ${error.message}`, 'KEY_EXPORT_ERROR', error);
    }
  }
  
  /**
   * 导入密钥
   */
  async importKeys(keyData: QuantumKeyImport): Promise<void> {
    if (!this.isInitialized) {
      throw new QuantumError('System not initialized');
    }
    
    try {
      await this.keyManager.importKeys(keyData);
      
      this.emit('keys_imported', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { format: keyData.format }
      });
      
      console.log(`📥 Keys imported from ${keyData.format} format`);
      
    } catch (error) {
      console.error('❌ Failed to import keys:', error);
      throw new QuantumError(`Failed to import keys: ${error.message}`, 'KEY_IMPORT_ERROR', error);
    }
  }
  
  /**
   * 系统健康检查
   */
  async getHealthCheck(): Promise<QuantumHealthStatus> {
    const healthStatus: QuantumHealthStatus = {
      status: 'HEALTHY',
      algorithms: {
        kyber: await this.checkAlgorithmHealth('kyber'),
        dilithium: await this.checkAlgorithmHealth('dilithium'),
        sphincs: await this.checkAlgorithmHealth('sphincs')
      },
      keyManager: await this.keyManager.getHealthStatus(),
      overallScore: 0,
      lastCheck: new Date()
    };
    
    // 计算总体健康分数
    const algorithmScores = Object.values(healthStatus.algorithms).map(alg => 
      alg.status === 'ACTIVE' ? (1 - alg.errorRate) : 0
    );
    
    const keyManagerScore = healthStatus.keyManager.status === 'ACTIVE' ? 1 : 0;
    
    healthStatus.overallScore = (
      algorithmScores.reduce((sum, score) => sum + score, 0) + keyManagerScore
    ) / (algorithmScores.length + 1);
    
    // 确定总体状态
    if (healthStatus.overallScore >= 0.8) {
      healthStatus.status = 'HEALTHY';
    } else if (healthStatus.overallScore >= 0.5) {
      healthStatus.status = 'DEGRADED';
    } else {
      healthStatus.status = 'CRITICAL';
    }
    
    return healthStatus;
  }
  
  /**
   * 获取系统统计信息
   */
  async getStatistics(): Promise<QuantumStatistics> {
    return { ...this.statistics };
  }
  
  // 私有方法
  
  private async preGenerateKeys(): Promise<void> {
    console.log('🔑 Pre-generating quantum-resistant keys...');
    
    try {
      // 预生成Kyber密钥对
      await this.generateKyberKeyPair(768);
      
      // 预生成Dilithium密钥对
      await this.generateDilithiumKeyPair(3);
      
      // 预生成SPHINCS+密钥对
      await this.generateSphincsKeyPair('SPHINCS_PLUS_128F_ROBUST');
      
      console.log('✅ Pre-generation of quantum-resistant keys completed');
      
    } catch (error) {
      console.warn('⚠️ Failed to pre-generate some keys:', error);
    }
  }
  
  private startSystemMonitoring(): void {
    // 每5分钟更新一次统计信息
    setInterval(() => {
      this.statistics.lastUpdated = new Date();
      
      this.emit('statistics_updated', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: this.statistics
      });
    }, 5 * 60 * 1000);
  }
  
  private async checkAlgorithmHealth(algorithm: 'kyber' | 'dilithium' | 'sphincs'): Promise<any> {
    const usage = this.statistics.algorithmUsage[algorithm];
    const totalOps = this.statistics.successfulOperations + this.statistics.failedOperations;
    const errorRate = totalOps > 0 ? this.statistics.failedOperations / totalOps : 0;
    
    return {
      status: usage > 0 ? 'ACTIVE' : 'INACTIVE',
      keyPairsGenerated: Math.floor(usage * 0.3), // 估算
      operationsPerformed: usage,
      averageOperationTime: this.getAverageOperationTime(algorithm),
      errorRate
    };
  }
  
  private getAverageOperationTime(algorithm: 'kyber' | 'dilithium' | 'sphincs'): number {
    // 返回该算法的平均操作时间（毫秒）
    switch (algorithm) {
      case 'kyber':
        return this.statistics.averageKeyGenerationTime * 0.5;
      case 'dilithium':
        return this.statistics.averageSigningTime;
      case 'sphincs':
        return this.statistics.averageSigningTime * 1.5;
      default:
        return 0;
    }
  }
  
  private updateAverageKeyGenerationTime(newTime: number): void {
    const totalTime = this.statistics.averageKeyGenerationTime * (this.statistics.totalKeyPairsGenerated - 1) + newTime;
    this.statistics.averageKeyGenerationTime = totalTime / this.statistics.totalKeyPairsGenerated;
  }
  
  private updateAverageSigningTime(newTime: number): void {
    const totalTime = this.statistics.averageSigningTime * (this.statistics.totalSignatures - 1) + newTime;
    this.statistics.averageSigningTime = totalTime / this.statistics.totalSignatures;
  }
  
  private updateAverageVerificationTime(newTime: number): void {
    const totalTime = this.statistics.averageVerificationTime * (this.statistics.totalVerifications - 1) + newTime;
    this.statistics.averageVerificationTime = totalTime / this.statistics.totalVerifications;
  }
  
  private setupEventListeners(): void {
    // 监听各个算法模块的事件
    this.kyberKEM.on('error', (error) => {
      this.emit('algorithm_error', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { algorithm: 'kyber', error: error.message }
      });
    });
    
    this.dilithiumDSA.on('error', (error) => {
      this.emit('algorithm_error', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { algorithm: 'dilithium', error: error.message }
      });
    });
    
    this.sphincsPlus.on('error', (error) => {
      this.emit('algorithm_error', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { algorithm: 'sphincs', error: error.message }
      });
    });
    
    this.keyManager.on('key_expired', (event) => {
      this.emit('key_expired', event);
    });
    
    this.keyManager.on('key_rotation_needed', (event) => {
      this.emit('key_rotation_needed', event);
    });
  }
  
  private generateEventId(): string {
    return `quantum_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }
}