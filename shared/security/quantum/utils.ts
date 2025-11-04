/**
 * 量子抗性密码学工具函数
 * 
 * 提供通用的工具函数和辅助方法
 */

import { randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  QuantumAlgorithm,
  KyberVariant,
  DilithiumVariant,
  SphincsVariant,
  SecurityLevel,
  QuantumKeyMetadata,
  QuantumError,
  QuantumConfigValidation,
  QuantumSystemInfo
} from './types.js';

/**
 * 安全随机数生成器
 */
export class SecureRandom {
  /**
   * 生成安全随机字节
   */
  static generateBytes(length: number): Uint8Array {
    if (length <= 0) {
      throw new QuantumError('Invalid random bytes length');
    }
    return randomBytes(length);
  }
  
  /**
   * 生成安全随机整数
   */
  static generateInt(min: number, max: number): number {
    if (min >= max) {
      throw new QuantumError('Invalid range for random integer');
    }
    
    const range = max - min;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValue = Math.pow(256, bytesNeeded);
    const threshold = maxValue - (maxValue % range);
    
    let randomValue: number;
    do {
      const randomBytes = this.generateBytes(bytesNeeded);
      randomValue = 0;
      for (let i = 0; i < bytesNeeded; i++) {
        randomValue = (randomValue << 8) + randomBytes[i];
      }
    } while (randomValue >= threshold);
    
    return min + (randomValue % range);
  }
  
  /**
   * 生成安全随机字符串
   */
  static generateString(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    const bytes = this.generateBytes(length);
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    
    return result;
  }
}

/**
 * 哈希工具类
 */
export class HashUtils {
  /**
   * 计算SHA-256哈希
   */
  static sha256(data: Uint8Array | string): Uint8Array {
    const hash = createHash('sha256');
    hash.update(data);
    return new Uint8Array(hash.digest());
  }
  
  /**
   * 计算SHA-512哈希
   */
  static sha512(data: Uint8Array | string): Uint8Array {
    const hash = createHash('sha512');
    hash.update(data);
    return new Uint8Array(hash.digest());
  }
  
  /**
   * 计算HMAC
   */
  static hmac(key: Uint8Array, data: Uint8Array | string, algorithm: string = 'sha256'): Uint8Array {
    const hmac = createHmac(algorithm, key);
    hmac.update(data);
    return new Uint8Array(hmac.digest());
  }
  
  /**
   * 计算HKDF（基于HMAC的密钥派生函数）
   */
  static hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Uint8Array {
    // 提取阶段
    const prk = this.hmac(salt, ikm);
    
    // 扩展阶段
    const n = Math.ceil(length / 32); // SHA-256输出长度为32字节
    const okm = new Uint8Array(length);
    let t = new Uint8Array(0);
    
    for (let i = 1; i <= n; i++) {
      const input = new Uint8Array(t.length + info.length + 1);
      input.set(t);
      input.set(info, t.length);
      input[input.length - 1] = i;
      
      t = this.hmac(prk, input);
      
      const copyLength = Math.min(32, length - (i - 1) * 32);
      okm.set(t.slice(0, copyLength), (i - 1) * 32);
    }
    
    return okm;
  }
}

/**
 * 编码工具类
 */
export class EncodingUtils {
  /**
   * 字节数组转十六进制字符串
   */
  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * 十六进制字符串转字节数组
   */
  static hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
      throw new QuantumError('Invalid hex string length');
    }
    
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    
    return bytes;
  }
  
  /**
   * 字节数组转Base64字符串
   */
  static bytesToBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
  }
  
  /**
   * Base64字符串转字节数组
   */
  static base64ToBytes(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  
  /**
   * 字符串转字节数组（UTF-8编码）
   */
  static stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }
  
  /**
   * 字节数组转字符串（UTF-8解码）
   */
  static bytesToString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
  }
}

/**
 * 时间安全比较工具
 */
export class TimingSafeUtils {
  /**
   * 时间安全的字节数组比较
   */
  static compareBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    return timingSafeEqual(a, b);
  }
  
  /**
   * 时间安全的字符串比较
   */
  static compareStrings(a: string, b: string): boolean {
    const bytesA = EncodingUtils.stringToBytes(a);
    const bytesB = EncodingUtils.stringToBytes(b);
    
    return this.compareBytes(bytesA, bytesB);
  }
}

/**
 * 算法参数工具类
 */
export class AlgorithmUtils {
  /**
   * 获取算法的安全级别
   */
  static getSecurityLevel(algorithm: QuantumAlgorithm, variant: string): SecurityLevel {
    switch (algorithm) {
      case 'KYBER':
        switch (variant as KyberVariant) {
          case 'KYBER_512': return 1;
          case 'KYBER_768': return 3;
          case 'KYBER_1024': return 5;
          default: throw new QuantumError(`Unknown Kyber variant: ${variant}`);
        }
      
      case 'DILITHIUM':
        switch (variant as DilithiumVariant) {
          case 'DILITHIUM_2': return 1;
          case 'DILITHIUM_3': return 3;
          case 'DILITHIUM_5': return 5;
          default: throw new QuantumError(`Unknown Dilithium variant: ${variant}`);
        }
      
      case 'SPHINCS_PLUS':
        const sphincsVariant = variant as SphincsVariant;
        if (sphincsVariant.includes('128')) return 1;
        if (sphincsVariant.includes('192')) return 3;
        if (sphincsVariant.includes('256')) return 5;
        throw new QuantumError(`Unknown SPHINCS+ variant: ${variant}`);
      
      default:
        throw new QuantumError(`Unknown algorithm: ${algorithm}`);
    }
  }
  
  /**
   * 获取推荐的密钥轮换间隔（毫秒）
   */
  static getRecommendedRotationInterval(algorithm: QuantumAlgorithm, securityLevel: SecurityLevel): number {
    const baseInterval = 24 * 60 * 60 * 1000; // 24小时
    
    switch (algorithm) {
      case 'KYBER':
        return baseInterval * (6 - securityLevel); // 1级：5天，3级：3天，5级：1天
      
      case 'DILITHIUM':
      case 'SPHINCS_PLUS':
        return baseInterval * 7 * (6 - securityLevel); // 1级：35天，3级：21天，5级：7天
      
      default:
        return baseInterval * 7; // 默认7天
    }
  }
  
  /**
   * 获取推荐的最大使用次数
   */
  static getRecommendedMaxUsage(algorithm: QuantumAlgorithm, securityLevel: SecurityLevel): number {
    switch (algorithm) {
      case 'KYBER':
        return Math.pow(10, 3 + securityLevel); // 1级：10^4，3级：10^6，5级：10^8
      
      case 'DILITHIUM':
      case 'SPHINCS_PLUS':
        return Math.pow(10, 2 + securityLevel); // 1级：10^3，3级：10^5，5级：10^7
      
      default:
        return 10000; // 默认10000次
    }
  }
}

/**
 * 密钥管理工具类
 */
export class KeyManagementUtils {
  /**
   * 生成密钥ID
   */
  static generateKeyId(algorithm: QuantumAlgorithm, variant: string): string {
    const timestamp = Date.now();
    const random = SecureRandom.generateString(8);
    return `${algorithm.toLowerCase()}_${variant.toLowerCase()}_${timestamp}_${random}`;
  }
  
  /**
   * 验证密钥ID格式
   */
  static validateKeyId(keyId: string): boolean {
    const pattern = /^(kyber|dilithium|sphincs_plus)_[a-z0-9_]+_\d+_[a-zA-Z0-9]{8}$/;
    return pattern.test(keyId);
  }
  
  /**
   * 从密钥ID提取算法信息
   */
  static parseKeyId(keyId: string): { algorithm: QuantumAlgorithm; variant: string; timestamp: number } {
    if (!this.validateKeyId(keyId)) {
      throw new QuantumError('Invalid key ID format');
    }
    
    const parts = keyId.split('_');
    const algorithm = parts[0].toUpperCase() as QuantumAlgorithm;
    const timestamp = parseInt(parts[parts.length - 2]);
    
    let variant: string;
    if (algorithm === 'SPHINCS_PLUS') {
      variant = parts.slice(1, -2).join('_').toUpperCase();
    } else {
      variant = parts[1].toUpperCase();
    }
    
    return { algorithm, variant, timestamp };
  }
  
  /**
   * 检查密钥是否过期
   */
  static isKeyExpired(metadata: QuantumKeyMetadata): boolean {
    if (!metadata.expiresAt) {
      return false;
    }
    
    return new Date() > metadata.expiresAt;
  }
  
  /**
   * 检查密钥是否需要轮换
   */
  static shouldRotateKey(metadata: QuantumKeyMetadata, maxAge: number, maxUsage: number): boolean {
    // 检查年龄
    const age = Date.now() - metadata.createdAt.getTime();
    if (age > maxAge) {
      return true;
    }
    
    // 检查使用次数
    if (metadata.usageCount >= maxUsage) {
      return true;
    }
    
    // 检查是否过期
    if (this.isKeyExpired(metadata)) {
      return true;
    }
    
    return false;
  }
}

/**
 * 性能监控工具类
 */
export class PerformanceUtils {
  /**
   * 测量函数执行时间
   */
  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // 转换为毫秒
    
    return { result, duration };
  }
  
  /**
   * 获取内存使用情况
   */
  static getMemoryUsage(): { used: number; total: number; free: number } {
    const usage = process.memoryUsage();
    const total = require('os').totalmem();
    const free = require('os').freemem();
    
    return {
      used: usage.heapUsed,
      total,
      free
    };
  }
  
  /**
   * 获取CPU使用情况
   */
  static getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);
        
        const totalTime = endTime[0] * 1000000 + endTime[1] / 1000; // 微秒
        const cpuTime = endUsage.user + endUsage.system; // 微秒
        
        const cpuPercent = (cpuTime / totalTime) * 100;
        resolve(cpuPercent);
      }, 100);
    });
  }
}

/**
 * 配置验证工具类
 */
export class ConfigValidationUtils {
  /**
   * 验证量子系统配置
   */
  static validateQuantumConfig(config: any): QuantumConfigValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 验证基本结构
    if (!config) {
      errors.push('Configuration is required');
      return { isValid: false, errors, warnings, validatedAt: new Date() };
    }
    
    // 验证Kyber配置
    if (config.kyber) {
      if (typeof config.kyber.enabled !== 'boolean') {
        errors.push('kyber.enabled must be a boolean');
      }
      
      if (!config.kyber.defaultVariant) {
        errors.push('kyber.defaultVariant is required');
      }
      
      if (!Array.isArray(config.kyber.supportedVariants)) {
        errors.push('kyber.supportedVariants must be an array');
      }
    }
    
    // 验证Dilithium配置
    if (config.dilithium) {
      if (typeof config.dilithium.enabled !== 'boolean') {
        errors.push('dilithium.enabled must be a boolean');
      }
      
      if (!config.dilithium.defaultVariant) {
        errors.push('dilithium.defaultVariant is required');
      }
      
      if (!Array.isArray(config.dilithium.supportedVariants)) {
        errors.push('dilithium.supportedVariants must be an array');
      }
    }
    
    // 验证SPHINCS+配置
    if (config.sphincs) {
      if (typeof config.sphincs.enabled !== 'boolean') {
        errors.push('sphincs.enabled must be a boolean');
      }
      
      if (!config.sphincs.defaultVariant) {
        errors.push('sphincs.defaultVariant is required');
      }
      
      if (!Array.isArray(config.sphincs.supportedVariants)) {
        errors.push('sphincs.supportedVariants must be an array');
      }
    }
    
    // 验证通用配置
    if (config.general) {
      if (typeof config.general.enableKeyCache !== 'boolean') {
        warnings.push('general.enableKeyCache should be a boolean');
      }
      
      if (typeof config.general.cacheSize !== 'number' || config.general.cacheSize <= 0) {
        warnings.push('general.cacheSize should be a positive number');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date()
    };
  }
}

/**
 * 系统信息工具类
 */
export class SystemInfoUtils {
  /**
   * 获取系统信息
   */
  static getSystemInfo(): QuantumSystemInfo {
    const os = require('os');
    
    return {
      version: '1.0.0',
      buildDate: new Date(),
      supportedAlgorithms: ['KYBER', 'DILITHIUM', 'SPHINCS_PLUS'],
      supportedVariants: {
        kyber: ['KYBER_512', 'KYBER_768', 'KYBER_1024'],
        dilithium: ['DILITHIUM_2', 'DILITHIUM_3', 'DILITHIUM_5'],
        sphincs: [
          'SPHINCS_PLUS_128F_ROBUST', 'SPHINCS_PLUS_128F_SIMPLE',
          'SPHINCS_PLUS_128S_ROBUST', 'SPHINCS_PLUS_128S_SIMPLE',
          'SPHINCS_PLUS_192F_ROBUST', 'SPHINCS_PLUS_192F_SIMPLE',
          'SPHINCS_PLUS_192S_ROBUST', 'SPHINCS_PLUS_192S_SIMPLE',
          'SPHINCS_PLUS_256F_ROBUST', 'SPHINCS_PLUS_256F_SIMPLE',
          'SPHINCS_PLUS_256S_ROBUST', 'SPHINCS_PLUS_256S_SIMPLE'
        ]
      },
      systemCapabilities: {
        hardwareAcceleration: false, // 需要检测硬件支持
        parallelProcessing: os.cpus().length > 1,
        secureMemory: process.platform !== 'win32' // Unix系统通常支持mlock
      },
      runtime: {
        nodeVersion: process.version,
        platform: os.platform(),
        architecture: os.arch(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      }
    };
  }
}

/**
 * 错误处理工具类
 */
export class ErrorUtils {
  /**
   * 包装错误为QuantumError
   */
  static wrapError(error: Error, code: string, algorithm?: QuantumAlgorithm, keyId?: string): QuantumError {
    if (error instanceof QuantumError) {
      return error;
    }
    
    return new QuantumError(error.message, code, error, algorithm, keyId);
  }
  
  /**
   * 创建标准化错误消息
   */
  static createErrorMessage(operation: string, algorithm: QuantumAlgorithm, details?: string): string {
    let message = `Failed to ${operation} with ${algorithm}`;
    if (details) {
      message += `: ${details}`;
    }
    return message;
  }
}

/**
 * 常用常量
 */
export const QuantumConstants = {
  // 默认配置值
  DEFAULT_CACHE_SIZE: 1000,
  DEFAULT_KEY_ROTATION_INTERVAL: 7 * 24 * 60 * 60 * 1000, // 7天
  DEFAULT_MAX_KEY_USAGE: 10000,
  
  // 性能阈值
  PERFORMANCE_WARNING_THRESHOLD: 1000, // 1秒
  PERFORMANCE_ERROR_THRESHOLD: 5000,   // 5秒
  
  // 内存限制
  MAX_CACHE_MEMORY: 100 * 1024 * 1024, // 100MB
  MAX_KEY_SIZE: 10 * 1024,              // 10KB
  
  // 安全参数
  MIN_RANDOM_BYTES: 16,
  RECOMMENDED_SALT_SIZE: 32,
  RECOMMENDED_IV_SIZE: 16,
  
  // 算法标识符
  ALGORITHM_OIDS: {
    KYBER_512: '1.3.6.1.4.1.2.267.7.4.4',
    KYBER_768: '1.3.6.1.4.1.2.267.7.6.5',
    KYBER_1024: '1.3.6.1.4.1.2.267.7.8.7',
    DILITHIUM_2: '1.3.6.1.4.1.2.267.12.4.4',
    DILITHIUM_3: '1.3.6.1.4.1.2.267.12.6.5',
    DILITHIUM_5: '1.3.6.1.4.1.2.267.12.8.7'
  }
} as const;