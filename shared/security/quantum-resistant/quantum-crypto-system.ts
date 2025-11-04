/**
 * 量子抗性密码系统核心类
 */

import { EventEmitter } from 'events';
import { 
  QuantumKey, 
  KyberKeyPair, 
  DilithiumKeyPair, 
  SPHINCSKeyPair,
  QuantumConfig, 
  SecurityEvent, 
  QuantumError 
} from '../types/index.js';
import { IQuantumCryptoSystem } from './index.js';

export class QuantumCryptoSystem extends EventEmitter implements IQuantumCryptoSystem {
  private config: QuantumConfig;
  private keyPairs: Map<string, any> = new Map();
  private encryptionKeys: Map<string, any> = new Map();
  private signingKeys: Map<string, any> = new Map();
  private secureChannels: Map<string, any> = new Map();

  constructor(config: QuantumConfig) {
    super();
    this.config = config;
    this.initializeSystem();
  }

  private async initializeSystem(): Promise<void> {
    try {
      console.log('Initializing Quantum-Resistant Crypto System...');
      console.log('Enabled algorithms:', this.config.enabled_algorithms);
      console.log('Key rotation interval:', this.config.key_rotation_interval_hours, 'hours');
      
      // 验证配置
      this.validateConfiguration();
      
      // 初始化算法
      await this.initializeAlgorithms();
      
      // 设置密钥轮换
      this.setupKeyRotation();
      
      this.emit('system_initialized', {
        enabled_algorithms: this.config.enabled_algorithms,
        key_rotation_interval: this.config.key_rotation_interval_hours
      });
      
      console.log('Quantum-Resistant Crypto System initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Quantum-Resistant Crypto System:', error);
      throw new QuantumError('System initialization failed', error);
    }
  }

  private validateConfiguration(): void {
    if (this.config.enabled_algorithms.length === 0) {
      throw new QuantumError('No quantum-resistant algorithms enabled');
    }
    
    if (this.config.key_rotation_interval_hours <= 0) {
      throw new QuantumError('Invalid key rotation interval');
    }
    
    if (this.config.max_key_age_hours <= 0) {
      throw new QuantumError('Invalid max key age');
    }
    
    const supportedAlgorithms = ['KYBER', 'DILITHIUM', 'SPHINCS_PLUS'];
    for (const algorithm of this.config.enabled_algorithms) {
      if (!supportedAlgorithms.includes(algorithm)) {
        throw new QuantumError(`Unsupported algorithm: ${algorithm}`);
      }
    }
  }

  private async initializeAlgorithms(): Promise<void> {
    for (const algorithm of this.config.enabled_algorithms) {
      try {
        switch (algorithm) {
          case 'KYBER':
            await this.initializeKyber();
            break;
          case 'DILITHIUM':
            await this.initializeDilithium();
            break;
          case 'SPHINCS_PLUS':
            await this.initializeSPHINCS();
            break;
          default:
            console.warn(`Unknown algorithm: ${algorithm}`);
        }
      } catch (error) {
        console.error(`Failed to initialize ${algorithm}:`, error);
        // 继续初始化其他算法
      }
    }
  }

  private async initializeKyber(): Promise<void> {
    console.log('Initializing Kyber KEM...');
    // 实际实现需要Kyber库
  }

  private async initializeDilithium(): Promise<void> {
    console.log('Initializing Dilithium signature...');
    // 实际实现需要Dilithium库
  }

  private async initializeSPHINCS(): Promise<void> {
    console.log('Initializing SPHINCS+ signature...');
    // 实际实现需要SPHINCS+库
  }

  private setupKeyRotation(): void {
    const rotationInterval = this.config.key_rotation_interval_hours * 60 * 60 * 1000;
    
    setInterval(() => {
      this.rotateExpiredKeys();
    }, rotationInterval);
  }

  async generateKeyPair(algorithm: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      if (!this.config.enabled_algorithms.includes(algorithm)) {
        throw new QuantumError(`Algorithm not enabled: ${algorithm}`);
      }

      const keyId = this.generateKeyId();
      let keyPair: any;

      switch (algorithm) {
        case 'KYBER':
          keyPair = await this.generateKyberKeyPair();
          break;
        case 'DILITHIUM':
          keyPair = await this.generateDilithiumKeyPair();
          break;
        case 'SPHINCS_PLUS':
          keyPair = await this.generateSPHINCSKeyPair();
          break;
        default:
          throw new QuantumError(`Unsupported algorithm: ${algorithm}`);
      }

      // 添加元数据
      const quantumKey: QuantumKey = {
        key_id: keyId,
        algorithm,
        public_key: keyPair.publicKey,
        private_key: keyPair.privateKey,
        created_at: new Date(),
        expires_at: new Date(Date.now() + this.config.max_key_age_hours * 60 * 60 * 1000),
        is_active: true,
        usage_count: 0
      };

      // 存储密钥对
      this.keyPairs.set(keyId, quantumKey);
      
      if (algorithm === 'KYBER') {
        this.encryptionKeys.set(keyId, quantumKey);
      } else {
        this.signingKeys.set(keyId, quantumKey);
      }

      const generationTime = Date.now() - startTime;
      
      // 发出事件
      this.emit('key_pair_generated', {
        event_id: this.generateEventId(),
        event_type: 'KEY_GENERATED',
        layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
        timestamp: new Date(),
        data: { 
          key_id: keyId,
          algorithm,
          generation_time_ms: generationTime
        },
        severity: 'INFO'
      } as SecurityEvent);

      console.log(`${algorithm} key pair generated: ${keyId} in ${generationTime}ms`);
      return quantumKey;
      
    } catch (error) {
      const generationTime = Date.now() - startTime;
      console.error(`Failed to generate ${algorithm} key pair:`, error);
      
      this.emit('key_generation_failed', {
        event_id: this.generateEventId(),
        event_type: 'KEY_GENERATED',
        layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
        timestamp: new Date(),
        data: { 
          algorithm,
          error: error.message,
          generation_time_ms: generationTime
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new QuantumError(`Failed to generate ${algorithm} key pair: ${error.message}`, error);
    }
  }

  private async generateKyberKeyPair(): Promise<KyberKeyPair> {
    // 模拟Kyber密钥对生成
    // 实际实现需要使用Kyber库
    
    const publicKey = new Uint8Array(1568); // Kyber1024公钥大小
    const privateKey = new Uint8Array(3168); // Kyber1024私钥大小
    
    // 填充随机数据（实际应该是Kyber算法生成）
    for (let i = 0; i < publicKey.length; i++) {
      publicKey[i] = Math.floor(Math.random() * 256);
    }
    for (let i = 0; i < privateKey.length; i++) {
      privateKey[i] = Math.floor(Math.random() * 256);
    }
    
    return {
      algorithm: 'KYBER',
      security_level: 1024,
      publicKey,
      privateKey
    };
  }

  private async generateDilithiumKeyPair(): Promise<DilithiumKeyPair> {
    // 模拟Dilithium密钥对生成
    // 实际实现需要使用Dilithium库
    
    const publicKey = new Uint8Array(1952); // Dilithium5公钥大小
    const privateKey = new Uint8Array(4864); // Dilithium5私钥大小
    
    // 填充随机数据（实际应该是Dilithium算法生成）
    for (let i = 0; i < publicKey.length; i++) {
      publicKey[i] = Math.floor(Math.random() * 256);
    }
    for (let i = 0; i < privateKey.length; i++) {
      privateKey[i] = Math.floor(Math.random() * 256);
    }
    
    return {
      algorithm: 'DILITHIUM',
      security_level: 5,
      publicKey,
      privateKey
    };
  }

  private async generateSPHINCSKeyPair(): Promise<SPHINCSKeyPair> {
    // 模拟SPHINCS+密钥对生成
    // 实际实现需要使用SPHINCS+库
    
    const publicKey = new Uint8Array(64); // SPHINCS+-256s公钥大小
    const privateKey = new Uint8Array(128); // SPHINCS+-256s私钥大小
    
    // 填充随机数据（实际应该是SPHINCS+算法生成）
    for (let i = 0; i < publicKey.length; i++) {
      publicKey[i] = Math.floor(Math.random() * 256);
    }
    for (let i = 0; i < privateKey.length; i++) {
      privateKey[i] = Math.floor(Math.random() * 256);
    }
    
    return {
      algorithm: 'SPHINCS_PLUS',
      variant: 'SPHINCS+-256s',
      publicKey,
      privateKey
    };
  }

  async encrypt(data: Uint8Array, publicKey: QuantumKey): Promise<Uint8Array> {
    const startTime = Date.now();
    
    try {
      if (publicKey.algorithm !== 'KYBER') {
        throw new QuantumError(`Invalid algorithm for encryption: ${publicKey.algorithm}`);
      }

      if (!publicKey.is_active) {
        throw new QuantumError(`Key is not active: ${publicKey.key_id}`);
      }

      if (new Date() > publicKey.expires_at) {
        throw new QuantumError(`Key has expired: ${publicKey.key_id}`);
      }

      // 使用Kyber进行加密
      const encryptedData = await this.kyberEncrypt(data, publicKey.public_key);

      // 更新使用计数
      publicKey.usage_count++;

      const encryptionTime = Date.now() - startTime;
      
      // 发出事件
      this.emit('data_encrypted', {
        event_id: this.generateEventId(),
        event_type: 'KEY_GENERATED',
        layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
        timestamp: new Date(),
        data: { 
          key_id: publicKey.key_id,
          algorithm: publicKey.algorithm,
          data_size: data.length,
          encrypted_size: encryptedData.length,
          encryption_time_ms: encryptionTime
        },
        severity: 'INFO'
      } as SecurityEvent);

      console.log(`Data encrypted with ${publicKey.algorithm}: ${data.length} → ${encryptedData.length} bytes in ${encryptionTime}ms`);
      return encryptedData;
      
    } catch (error) {
      const encryptionTime = Date.now() - startTime;
      console.error('Encryption failed:', error);
      
      this.emit('encryption_failed', {
        event_id: this.generateEventId(),
        event_type: 'KEY_GENERATED',
        layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
        timestamp: new Date(),
        data: { 
          key_id: publicKey.key_id,
          error: error.message,
          encryption_time_ms: encryptionTime
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new QuantumError(`Encryption failed: ${error.message}`, error);
    }
  }

  async decrypt(encryptedData: Uint8Array, privateKey: QuantumKey): Promise<Uint8Array> {
    const startTime = Date.now();
    
    try {
      if (privateKey.algorithm !== 'KYBER') {
        throw new QuantumError(`Invalid algorithm for decryption: ${privateKey.algorithm}`);
      }

      if (!privateKey.is_active) {
        throw new QuantumError(`Key is not active: ${privateKey.key_id}`);
      }

      if (new Date() > privateKey.expires_at) {
        throw new QuantumError(`Key has expired: ${privateKey.key_id}`);
      }

      // 使用Kyber进行解密
      const decryptedData = await this.kyberDecrypt(encryptedData, privateKey.private_key);

      // 更新使用计数
      privateKey.usage_count++;

      const decryptionTime = Date.now() - startTime;
      
      // 发出事件
      this.emit('data_decrypted', {
        event_id: this.generateEventId(),
        event_type: 'KEY_GENERATED',
        layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
        timestamp: new Date(),
        data: { 
          key_id: privateKey.key_id,
          algorithm: privateKey.algorithm,
          encrypted_size: encryptedData.length,
          decrypted_size: decryptedData.length,
          decryption_time_ms: decryptionTime
        },
        severity: 'INFO'
      } as SecurityEvent);

      console.log(`Data decrypted with ${privateKey.algorithm}: ${encryptedData.length} → ${decryptedData.length} bytes in ${decryptionTime}ms`);
      return decryptedData;
      
    } catch (error) {
      const decryptionTime = Date.now() - startTime;
      console.error('Decryption failed:', error);
      
      this.emit('decryption_failed', {
        event_id: this.generateEventId(),
        event_type: 'KEY_GENERATED',
        layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
        timestamp: new Date(),
        data: { 
          key_id: privateKey.key_id,
          error: error.message,
          decryption_time_ms: decryptionTime
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new QuantumError(`Decryption failed: ${error.message}`, error);
    }
  }

  async sign(message: Uint8Array, privateKey: QuantumKey): Promise<Uint8Array> {
    const startTime = Date.now();
    
    try {
      if (!['DILITHIUM', 'SPHINCS_PLUS'].includes(privateKey.algorithm)) {
        throw new QuantumError(`Invalid algorithm for signing: ${privateKey.algorithm}`);
      }

      if (!privateKey.is_active) {
        throw new QuantumError(`Key is not active: ${privateKey.key_id}`);
      }

      if (new Date() > privateKey.expires_at) {
        throw new QuantumError(`Key has expired: ${privateKey.key_id}`);
      }

      let signature: Uint8Array;
      
      switch (privateKey.algorithm) {
        case 'DILITHIUM':
          signature = await this.dilithiumSign(message, privateKey.private_key);
          break;
        case 'SPHINCS_PLUS':
          signature = await this.sphincsSign(message, privateKey.private_key);
          break;
        default:
          throw new QuantumError(`Unsupported signing algorithm: ${privateKey.algorithm}`);
      }

      // 更新使用计数
      privateKey.usage_count++;

      const signingTime = Date.now() - startTime;
      
      // 发出事件
      this.emit('message_signed', {
        event_id: this.generateEventId(),
        event_type: 'KEY_GENERATED',
        layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
        timestamp: new Date(),
        data: { 
          key_id: privateKey.key_id,
          algorithm: privateKey.algorithm,
          message_size: message.length,
          signature_size: signature.length,
          signing_time_ms: signingTime
        },
        severity: 'INFO'
      } as SecurityEvent);

      console.log(`Message signed with ${privateKey.algorithm}: ${message.length} bytes → ${signature.length} bytes signature in ${signingTime}ms`);
      return signature;
      
    } catch (error) {
      const signingTime = Date.now() - startTime;
      console.error('Signing failed:', error);
      
      this.emit('signing_failed', {
        event_id: this.generateEventId(),
        event_type: 'KEY_GENERATED',
        layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
        timestamp: new Date(),
        data: { 
          key_id: privateKey.key_id,
          error: error.message,
          signing_time_ms: signingTime
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new QuantumError(`Signing failed: ${error.message}`, error);
    }
  }

  async verify(message: Uint8Array, signature: Uint8Array, publicKey: QuantumKey): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!['DILITHIUM', 'SPHINCS_PLUS'].includes(publicKey.algorithm)) {
        throw new QuantumError(`Invalid algorithm for verification: ${publicKey.algorithm}`);
      }

      if (!publicKey.is_active) {
        throw new QuantumError(`Key is not active: ${publicKey.key_id}`);
      }

      let isValid: boolean;
      
      switch (publicKey.algorithm) {
        case 'DILITHIUM':
          isValid = await this.dilithiumVerify(message, signature, publicKey.public_key);
          break;
        case 'SPHINCS_PLUS':
          isValid = await this.sphincsVerify(message, signature, publicKey.public_key);
          break;
        default:
          throw new QuantumError(`Unsupported verification algorithm: ${publicKey.algorithm}`);
      }

      // 更新使用计数
      publicKey.usage_count++;

      const verificationTime = Date.now() - startTime;
      
      // 发出事件
      this.emit('signature_verified', {
        event_id: this.generateEventId(),
        event_type: 'KEY_GENERATED',
        layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
        timestamp: new Date(),
        data: { 
          key_id: publicKey.key_id,
          algorithm: publicKey.algorithm,
          message_size: message.length,
          signature_size: signature.length,
          is_valid: isValid,
          verification_time_ms: verificationTime
        },
        severity: isValid ? 'INFO' : 'WARNING'
      } as SecurityEvent);

      console.log(`Signature verification with ${publicKey.algorithm}: ${isValid ? 'VALID' : 'INVALID'} in ${verificationTime}ms`);
      return isValid;
      
    } catch (error) {
      const verificationTime = Date.now() - startTime;
      console.error('Verification failed:', error);
      
      this.emit('verification_failed', {
        event_id: this.generateEventId(),
        event_type: 'KEY_GENERATED',
        layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
        timestamp: new Date(),
        data: { 
          key_id: publicKey.key_id,
          error: error.message,
          verification_time_ms: verificationTime
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new QuantumError(`Verification failed: ${error.message}`, error);
    }
  }

  private async kyberEncrypt(data: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array> {
    // 模拟Kyber加密
    // 实际实现需要使用Kyber库
    
    // 简化的加密模拟：数据 XOR 公钥的哈希
    const keyHash = this.hashKey(publicKey);
    const encrypted = new Uint8Array(data.length + 32); // 添加32字节的封装开销
    
    // 复制原始数据并进行XOR
    for (let i = 0; i < data.length; i++) {
      encrypted[i] = data[i] ^ keyHash[i % keyHash.length];
    }
    
    // 添加随机填充
    for (let i = data.length; i < encrypted.length; i++) {
      encrypted[i] = Math.floor(Math.random() * 256);
    }
    
    return encrypted;
  }

  private async kyberDecrypt(encryptedData: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    // 模拟Kyber解密
    // 实际实现需要使用Kyber库
    
    const keyHash = this.hashKey(privateKey);
    const dataLength = encryptedData.length - 32; // 减去封装开销
    const decrypted = new Uint8Array(dataLength);
    
    // 解密数据
    for (let i = 0; i < dataLength; i++) {
      decrypted[i] = encryptedData[i] ^ keyHash[i % keyHash.length];
    }
    
    return decrypted;
  }

  private async dilithiumSign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    // 模拟Dilithium签名
    // 实际实现需要使用Dilithium库
    
    const messageHash = this.hashMessage(message);
    const keyHash = this.hashKey(privateKey);
    
    const signature = new Uint8Array(4595); // Dilithium5签名大小
    
    // 简化的签名生成
    for (let i = 0; i < signature.length; i++) {
      signature[i] = (messageHash[i % messageHash.length] ^ keyHash[i % keyHash.length] ^ i) % 256;
    }
    
    return signature;
  }

  private async dilithiumVerify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    // 模拟Dilithium验证
    // 实际实现需要使用Dilithium库
    
    try {
      const messageHash = this.hashMessage(message);
      const keyHash = this.hashKey(publicKey);
      
      // 简化的验证：重新生成签名并比较
      for (let i = 0; i < Math.min(signature.length, 100); i++) { // 只检查前100字节
        const expected = (messageHash[i % messageHash.length] ^ keyHash[i % keyHash.length] ^ i) % 256;
        if (signature[i] !== expected) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private async sphincsSign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    // 模拟SPHINCS+签名
    // 实际实现需要使用SPHINCS+库
    
    const messageHash = this.hashMessage(message);
    const keyHash = this.hashKey(privateKey);
    
    const signature = new Uint8Array(29792); // SPHINCS+-256s签名大小
    
    // 简化的签名生成
    for (let i = 0; i < signature.length; i++) {
      signature[i] = (messageHash[i % messageHash.length] + keyHash[i % keyHash.length] + i) % 256;
    }
    
    return signature;
  }

  private async sphincsVerify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    // 模拟SPHINCS+验证
    // 实际实现需要使用SPHINCS+库
    
    try {
      const messageHash = this.hashMessage(message);
      const keyHash = this.hashKey(publicKey);
      
      // 简化的验证：重新生成签名并比较
      for (let i = 0; i < Math.min(signature.length, 100); i++) { // 只检查前100字节
        const expected = (messageHash[i % messageHash.length] + keyHash[i % keyHash.length] + i) % 256;
        if (signature[i] !== expected) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private hashMessage(message: Uint8Array): Uint8Array {
    // 简化的哈希函数
    const hash = new Uint8Array(32);
    for (let i = 0; i < hash.length; i++) {
      hash[i] = message[i % message.length] ^ (i * 13) % 256;
    }
    return hash;
  }

  private hashKey(key: Uint8Array): Uint8Array {
    // 简化的密钥哈希函数
    const hash = new Uint8Array(32);
    for (let i = 0; i < hash.length; i++) {
      hash[i] = key[i % key.length] ^ (i * 17) % 256;
    }
    return hash;
  }

  private rotateExpiredKeys(): void {
    const now = new Date();
    let rotatedCount = 0;
    
    for (const [keyId, key] of this.keyPairs.entries()) {
      if (now > key.expires_at && key.is_active) {
        key.is_active = false;
        rotatedCount++;
        
        this.emit('key_rotated', {
          event_id: this.generateEventId(),
          event_type: 'KEY_GENERATED',
          layer: { level: 4, name: 'Quantum-Resistant', description: 'Quantum-Resistant Cryptography Layer' },
          timestamp: new Date(),
          data: { 
            key_id: keyId,
            algorithm: key.algorithm,
            usage_count: key.usage_count
          },
          severity: 'INFO'
        } as SecurityEvent);
      }
    }
    
    if (rotatedCount > 0) {
      console.log(`Rotated ${rotatedCount} expired keys`);
    }
  }

  private generateKeyId(): string {
    return 'qkey_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateEventId(): string {
    return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 获取系统统计信息
  getStatistics() {
    const activeKeys = Array.from(this.keyPairs.values()).filter(k => k.is_active);
    const expiredKeys = Array.from(this.keyPairs.values()).filter(k => !k.is_active);
    
    return {
      total_keys: this.keyPairs.size,
      active_keys: activeKeys.length,
      expired_keys: expiredKeys.length,
      encryption_keys: this.encryptionKeys.size,
      signing_keys: this.signingKeys.size,
      enabled_algorithms: this.config.enabled_algorithms,
      key_rotation_interval_hours: this.config.key_rotation_interval_hours,
      max_key_age_hours: this.config.max_key_age_hours
    };
  }

  // 清理过期密钥
  cleanupExpiredKeys(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [keyId, key] of this.keyPairs.entries()) {
      if (!key.is_active && now - key.expires_at.getTime() > maxAge) {
        this.keyPairs.delete(keyId);
        this.encryptionKeys.delete(keyId);
        this.signingKeys.delete(keyId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired keys`);
    }
  }

  // 获取活跃的加密密钥
  getActiveEncryptionKey(): QuantumKey | null {
    for (const key of this.encryptionKeys.values()) {
      if (key.is_active && new Date() < key.expires_at) {
        return key;
      }
    }
    return null;
  }

  // 获取活跃的签名密钥
  getActiveSigningKey(algorithm: string): QuantumKey | null {
    for (const key of this.signingKeys.values()) {
      if (key.is_active && key.algorithm === algorithm && new Date() < key.expires_at) {
        return key;
      }
    }
    return null;
  }
}