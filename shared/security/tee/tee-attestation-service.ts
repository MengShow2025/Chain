/**
 * TEE远程证明服务
 * 统一管理Intel SGX、AMD SEV和ARM TrustZone的远程证明功能
 */

import { EventEmitter } from 'events';
import {
  ITEEAttestationService,
  TEEPlatform,
  TEEAttestation,
  AttestationRequest,
  AttestationVerificationResult,
  AttestationPolicy,
  AttestationCache
} from './index.js';
import { TEEError } from '../types/index.js';

export class TEEAttestationService extends EventEmitter implements ITEEAttestationService {
  private attestationCache: Map<string, AttestationCache> = new Map();
  private verificationPolicies: Map<TEEPlatform, AttestationPolicy> = new Map();
  private isInitialized: boolean = false;
  private supportedPlatforms: Set<TEEPlatform> = new Set();
  
  // 证明统计信息
  private stats = {
    total_attestations: 0,
    successful_attestations: 0,
    failed_attestations: 0,
    cache_hits: 0,
    cache_misses: 0,
    verification_time_ms: 0,
    platform_stats: new Map<TEEPlatform, number>()
  };
  
  constructor() {
    super();
  }
  
  /**
   * 初始化TEE证明服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      console.log('Initializing TEE Attestation Service...');
      
      // 检测支持的TEE平台
      await this.detectSupportedPlatforms();
      
      // 初始化默认验证策略
      this.initializeDefaultPolicies();
      
      // 启动缓存清理任务
      this.startCacheCleanupTask();
      
      this.isInitialized = true;
      
      this.emit('attestation_service_initialized', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          supported_platforms: Array.from(this.supportedPlatforms),
          initialization_time_ms: Date.now()
        }
      });
      
      console.log('✅ TEE Attestation Service initialized');
      console.log(`   Supported platforms: ${Array.from(this.supportedPlatforms).join(', ')}`);
      
    } catch (error) {
      console.error('❌ TEE Attestation Service initialization failed:', error);
      throw new TEEError(`Failed to initialize attestation service: ${error.message}`, error);
    }
  }
  
  /**
   * 关闭证明服务
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      console.log('Shutting down TEE Attestation Service...');
      
      // 清理缓存
      this.attestationCache.clear();
      
      // 清理策略
      this.verificationPolicies.clear();
      
      this.isInitialized = false;
      
      this.emit('attestation_service_shutdown', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { shutdown_time_ms: Date.now() }
      });
      
      console.log('✅ TEE Attestation Service shutdown completed');
      
    } catch (error) {
      console.error('❌ TEE Attestation Service shutdown failed:', error);
      throw new TEEError(`Failed to shutdown attestation service: ${error.message}`, error);
    }
  }
  
  /**
   * 生成TEE远程证明
   */
  async generateAttestation(request: AttestationRequest): Promise<TEEAttestation> {
    if (!this.isInitialized) {
      throw new TEEError('Attestation service is not initialized');
    }
    
    if (!this.supportedPlatforms.has(request.platform)) {
      throw new TEEError(`Platform ${request.platform} is not supported`);
    }
    
    try {
      const startTime = Date.now();
      
      console.log(`Generating ${request.platform} attestation`);
      console.log(`Challenge: ${Buffer.from(request.challenge).toString('hex').substring(0, 16)}...`);
      
      // 检查缓存
      const cacheKey = this.generateCacheKey(request);
      const cachedAttestation = this.getCachedAttestation(cacheKey);
      
      if (cachedAttestation) {
        this.stats.cache_hits++;
        console.log(`✅ Using cached ${request.platform} attestation`);
        
        this.emit('attestation_generated', {
          event_id: this.generateEventId(),
          timestamp: new Date(),
          data: {
            platform: request.platform,
            cached: true,
            generation_time_ms: Date.now() - startTime
          }
        });
        
        return cachedAttestation.attestation;
      }
      
      this.stats.cache_misses++;
      
      // 根据平台生成证明
      let attestation: TEEAttestation;
      
      switch (request.platform) {
        case 'SGX':
          attestation = await this.generateSGXAttestation(request);
          break;
        case 'SEV':
          attestation = await this.generateSEVAttestation(request);
          break;
        case 'TrustZone':
          attestation = await this.generateTrustZoneAttestation(request);
          break;
        default:
          throw new TEEError(`Unsupported platform: ${request.platform}`);
      }
      
      // 缓存证明
      this.cacheAttestation(cacheKey, attestation);
      
      // 更新统计信息
      this.stats.total_attestations++;
      this.stats.successful_attestations++;
      this.updatePlatformStats(request.platform);
      
      const generationTime = Date.now() - startTime;
      
      this.emit('attestation_generated', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          platform: request.platform,
          cached: false,
          generation_time_ms: generationTime
        }
      });
      
      console.log(`✅ ${request.platform} attestation generated (${generationTime}ms)`);
      
      return attestation;
      
    } catch (error) {
      this.stats.total_attestations++;
      this.stats.failed_attestations++;
      
      this.emit('attestation_generation_failed', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          platform: request.platform,
          error: error.message
        }
      });
      
      throw new TEEError(`Failed to generate ${request.platform} attestation: ${error.message}`, error);
    }
  }
  
  /**
   * 验证TEE远程证明
   */
  async verifyAttestation(attestation: TEEAttestation, policy?: AttestationPolicy): Promise<AttestationVerificationResult> {
    if (!this.isInitialized) {
      throw new TEEError('Attestation service is not initialized');
    }
    
    try {
      const startTime = Date.now();
      
      console.log(`Verifying ${attestation.platform} attestation`);
      
      // 获取验证策略
      const verificationPolicy = policy || this.verificationPolicies.get(attestation.platform);
      if (!verificationPolicy) {
        throw new TEEError(`No verification policy found for platform ${attestation.platform}`);
      }
      
      // 根据平台验证证明
      let result: AttestationVerificationResult;
      
      switch (attestation.platform) {
        case 'SGX':
          result = await this.verifySGXAttestation(attestation, verificationPolicy);
          break;
        case 'SEV':
          result = await this.verifySEVAttestation(attestation, verificationPolicy);
          break;
        case 'TrustZone':
          result = await this.verifyTrustZoneAttestation(attestation, verificationPolicy);
          break;
        default:
          throw new TEEError(`Unsupported platform: ${attestation.platform}`);
      }
      
      const verificationTime = Date.now() - startTime;
      this.stats.verification_time_ms += verificationTime;
      
      this.emit('attestation_verified', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          platform: attestation.platform,
          is_valid: result.is_valid,
          verification_time_ms: verificationTime,
          trust_level: result.trust_level
        }
      });
      
      console.log(`✅ ${attestation.platform} attestation verification completed: ${result.is_valid ? 'Valid' : 'Invalid'} (${verificationTime}ms)`);
      console.log(`   Trust Level: ${result.trust_level}`);
      
      return result;
      
    } catch (error) {
      this.emit('attestation_verification_failed', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          platform: attestation.platform,
          error: error.message
        }
      });
      
      throw new TEEError(`Failed to verify ${attestation.platform} attestation: ${error.message}`, error);
    }
  }
  
  /**
   * 批量验证证明
   */
  async batchVerifyAttestations(attestations: TEEAttestation[], policy?: AttestationPolicy): Promise<AttestationVerificationResult[]> {
    if (!this.isInitialized) {
      throw new TEEError('Attestation service is not initialized');
    }
    
    try {
      console.log(`Batch verifying ${attestations.length} attestations`);
      
      const results: AttestationVerificationResult[] = [];
      
      // 并行验证证明
      const verificationPromises = attestations.map(attestation => 
        this.verifyAttestation(attestation, policy)
      );
      
      const verificationResults = await Promise.allSettled(verificationPromises);
      
      for (let i = 0; i < verificationResults.length; i++) {
        const result = verificationResults[i];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // 验证失败的情况
          results.push({
            is_valid: false,
            trust_level: 'UNTRUSTED',
            platform: attestations[i].platform,
            verification_time: new Date(),
            error_details: result.reason.message,
            policy_violations: ['VERIFICATION_FAILED']
          });
        }
      }
      
      const validCount = results.filter(r => r.is_valid).length;
      
      this.emit('batch_verification_completed', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          total_attestations: attestations.length,
          valid_attestations: validCount,
          invalid_attestations: attestations.length - validCount
        }
      });
      
      console.log(`✅ Batch verification completed: ${validCount}/${attestations.length} valid`);
      
      return results;
      
    } catch (error) {
      throw new TEEError(`Failed to batch verify attestations: ${error.message}`, error);
    }
  }
  
  /**
   * 设置验证策略
   */
  setVerificationPolicy(platform: TEEPlatform, policy: AttestationPolicy): void {
    this.verificationPolicies.set(platform, policy);
    
    console.log(`✅ Verification policy set for platform: ${platform}`);
    console.log(`   Required trust level: ${policy.required_trust_level}`);
    console.log(`   Max age: ${policy.max_attestation_age_ms}ms`);
  }
  
  /**
   * 获取证明统计信息
   */
  getAttestationStats(): any {
    const totalVerificationTime = this.stats.verification_time_ms;
    const totalAttestations = this.stats.total_attestations;
    
    return {
      total_attestations: this.stats.total_attestations,
      successful_attestations: this.stats.successful_attestations,
      failed_attestations: this.stats.failed_attestations,
      success_rate: totalAttestations > 0 ? (this.stats.successful_attestations / totalAttestations) : 0,
      cache_hits: this.stats.cache_hits,
      cache_misses: this.stats.cache_misses,
      cache_hit_rate: (this.stats.cache_hits + this.stats.cache_misses) > 0 ? 
        (this.stats.cache_hits / (this.stats.cache_hits + this.stats.cache_misses)) : 0,
      average_verification_time_ms: totalAttestations > 0 ? (totalVerificationTime / totalAttestations) : 0,
      platform_stats: Object.fromEntries(this.stats.platform_stats),
      supported_platforms: Array.from(this.supportedPlatforms),
      cache_size: this.attestationCache.size
    };
  }
  
  /**
   * 清理证明缓存
   */
  clearAttestationCache(): void {
    const cacheSize = this.attestationCache.size;
    this.attestationCache.clear();
    
    console.log(`✅ Attestation cache cleared (${cacheSize} entries removed)`);
    
    this.emit('cache_cleared', {
      event_id: this.generateEventId(),
      timestamp: new Date(),
      data: { entries_removed: cacheSize }
    });
  }
  
  // 私有方法
  
  private async detectSupportedPlatforms(): Promise<void> {
    console.log('Detecting supported TEE platforms...');
    
    // 模拟平台检测
    // 在实际实现中，这里会检查硬件和软件支持
    
    // 假设所有平台都支持（用于演示）
    this.supportedPlatforms.add('SGX');
    this.supportedPlatforms.add('SEV');
    this.supportedPlatforms.add('TrustZone');
    
    // 初始化平台统计
    for (const platform of this.supportedPlatforms) {
      this.stats.platform_stats.set(platform, 0);
    }
  }
  
  private initializeDefaultPolicies(): void {
    console.log('Initializing default verification policies...');
    
    // SGX默认策略
    this.verificationPolicies.set('SGX', {
      required_trust_level: 'TRUSTED',
      max_attestation_age_ms: 5 * 60 * 1000, // 5分钟
      allowed_debug_mode: false,
      required_security_version: 1,
      allowed_measurements: [],
      required_attributes: ['INITTED', 'MODE64BIT']
    });
    
    // SEV默认策略
    this.verificationPolicies.set('SEV', {
      required_trust_level: 'TRUSTED',
      max_attestation_age_ms: 5 * 60 * 1000,
      allowed_debug_mode: false,
      required_security_version: 1,
      allowed_measurements: [],
      required_attributes: ['SEV_ENABLED']
    });
    
    // TrustZone默认策略
    this.verificationPolicies.set('TrustZone', {
      required_trust_level: 'TRUSTED',
      max_attestation_age_ms: 5 * 60 * 1000,
      allowed_debug_mode: false,
      required_security_version: 1,
      allowed_measurements: [],
      required_attributes: ['SECURE_WORLD']
    });
  }
  
  private startCacheCleanupTask(): void {
    // 每5分钟清理过期的缓存条目
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 5 * 60 * 1000);
  }
  
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, cache] of this.attestationCache.entries()) {
      if (now - cache.cached_at.getTime() > cache.ttl_ms) {
        this.attestationCache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} expired cache entries`);
    }
  }
  
  private generateCacheKey(request: AttestationRequest): string {
    const challengeHash = Buffer.from(request.challenge).toString('hex').substring(0, 16);
    return `${request.platform}_${request.tee_instance_id}_${challengeHash}`;
  }
  
  private getCachedAttestation(cacheKey: string): AttestationCache | undefined {
    const cached = this.attestationCache.get(cacheKey);
    
    if (cached) {
      const now = Date.now();
      if (now - cached.cached_at.getTime() <= cached.ttl_ms) {
        return cached;
      } else {
        // 过期缓存，删除
        this.attestationCache.delete(cacheKey);
      }
    }
    
    return undefined;
  }
  
  private cacheAttestation(cacheKey: string, attestation: TEEAttestation): void {
    const cache: AttestationCache = {
      attestation: attestation,
      cached_at: new Date(),
      ttl_ms: 2 * 60 * 1000 // 2分钟TTL
    };
    
    this.attestationCache.set(cacheKey, cache);
  }
  
  private async generateSGXAttestation(request: AttestationRequest): Promise<TEEAttestation> {
    console.log('Generating SGX attestation...');
    
    // 模拟SGX证明生成
    const attestation: TEEAttestation = {
      platform: 'SGX',
      version: 3,
      timestamp: new Date(),
      challenge: request.challenge,
      tee_instance_id: request.tee_instance_id,
      measurements: {
        mr_enclave: 'sgx_mr_enclave_' + Math.random().toString(36).substring(2, 16),
        mr_signer: 'sgx_mr_signer_' + Math.random().toString(36).substring(2, 16)
      },
      attributes: ['INITTED', 'MODE64BIT'],
      signature: new Uint8Array(64),
      cert_chain: [new Uint8Array(1024), new Uint8Array(1024)]
    };
    
    // 填充随机签名和证书
    crypto.getRandomValues(attestation.signature);
    attestation.cert_chain.forEach(cert => crypto.getRandomValues(cert));
    
    return attestation;
  }
  
  private async generateSEVAttestation(request: AttestationRequest): Promise<TEEAttestation> {
    console.log('Generating SEV attestation...');
    
    // 模拟SEV证明生成
    const attestation: TEEAttestation = {
      platform: 'SEV',
      version: 1,
      timestamp: new Date(),
      challenge: request.challenge,
      tee_instance_id: request.tee_instance_id,
      measurements: {
        launch_measurement: 'sev_launch_' + Math.random().toString(36).substring(2, 16),
        policy: Math.floor(Math.random() * 0xFFFFFFFF)
      },
      attributes: ['SEV_ENABLED', 'ENCRYPTED_STATE'],
      signature: new Uint8Array(72),
      cert_chain: [new Uint8Array(1024), new Uint8Array(1024), new Uint8Array(1024)]
    };
    
    // 填充随机签名和证书
    crypto.getRandomValues(attestation.signature);
    attestation.cert_chain.forEach(cert => crypto.getRandomValues(cert));
    
    return attestation;
  }
  
  private async generateTrustZoneAttestation(request: AttestationRequest): Promise<TEEAttestation> {
    console.log('Generating TrustZone attestation...');
    
    // 模拟TrustZone证明生成
    const attestation: TEEAttestation = {
      platform: 'TrustZone',
      version: 1,
      timestamp: new Date(),
      challenge: request.challenge,
      tee_instance_id: request.tee_instance_id,
      measurements: {
        app_uuid: 'tz_app_uuid_' + Math.random().toString(36).substring(2, 16),
        app_version: '1.0.0',
        secure_world_version: 'OP-TEE v3.20.0'
      },
      attributes: ['SECURE_WORLD', 'TRUSTED_APP'],
      signature: new Uint8Array(64),
      cert_chain: [new Uint8Array(512)]
    };
    
    // 填充随机签名和证书
    crypto.getRandomValues(attestation.signature);
    attestation.cert_chain.forEach(cert => crypto.getRandomValues(cert));
    
    return attestation;
  }
  
  private async verifySGXAttestation(attestation: TEEAttestation, policy: AttestationPolicy): Promise<AttestationVerificationResult> {
    console.log('Verifying SGX attestation...');
    
    const violations: string[] = [];
    
    // 检查时间戳
    const age = Date.now() - attestation.timestamp.getTime();
    if (age > policy.max_attestation_age_ms) {
      violations.push('ATTESTATION_TOO_OLD');
    }
    
    // 检查属性
    const hasRequiredAttrs = policy.required_attributes?.every(attr => 
      attestation.attributes.includes(attr)
    ) ?? true;
    
    if (!hasRequiredAttrs) {
      violations.push('MISSING_REQUIRED_ATTRIBUTES');
    }
    
    // 模拟签名验证
    const signatureValid = attestation.signature.length === 64;
    if (!signatureValid) {
      violations.push('INVALID_SIGNATURE');
    }
    
    const isValid = violations.length === 0;
    
    return {
      is_valid: isValid,
      trust_level: isValid ? 'TRUSTED' : 'UNTRUSTED',
      platform: 'SGX',
      verification_time: new Date(),
      policy_violations: violations,
      measurements: attestation.measurements
    };
  }
  
  private async verifySEVAttestation(attestation: TEEAttestation, policy: AttestationPolicy): Promise<AttestationVerificationResult> {
    console.log('Verifying SEV attestation...');
    
    const violations: string[] = [];
    
    // 检查时间戳
    const age = Date.now() - attestation.timestamp.getTime();
    if (age > policy.max_attestation_age_ms) {
      violations.push('ATTESTATION_TOO_OLD');
    }
    
    // 检查属性
    const hasRequiredAttrs = policy.required_attributes?.every(attr => 
      attestation.attributes.includes(attr)
    ) ?? true;
    
    if (!hasRequiredAttrs) {
      violations.push('MISSING_REQUIRED_ATTRIBUTES');
    }
    
    // 模拟签名验证
    const signatureValid = attestation.signature.length === 72;
    if (!signatureValid) {
      violations.push('INVALID_SIGNATURE');
    }
    
    const isValid = violations.length === 0;
    
    return {
      is_valid: isValid,
      trust_level: isValid ? 'TRUSTED' : 'UNTRUSTED',
      platform: 'SEV',
      verification_time: new Date(),
      policy_violations: violations,
      measurements: attestation.measurements
    };
  }
  
  private async verifyTrustZoneAttestation(attestation: TEEAttestation, policy: AttestationPolicy): Promise<AttestationVerificationResult> {
    console.log('Verifying TrustZone attestation...');
    
    const violations: string[] = [];
    
    // 检查时间戳
    const age = Date.now() - attestation.timestamp.getTime();
    if (age > policy.max_attestation_age_ms) {
      violations.push('ATTESTATION_TOO_OLD');
    }
    
    // 检查属性
    const hasRequiredAttrs = policy.required_attributes?.every(attr => 
      attestation.attributes.includes(attr)
    ) ?? true;
    
    if (!hasRequiredAttrs) {
      violations.push('MISSING_REQUIRED_ATTRIBUTES');
    }
    
    // 模拟签名验证
    const signatureValid = attestation.signature.length === 64;
    if (!signatureValid) {
      violations.push('INVALID_SIGNATURE');
    }
    
    const isValid = violations.length === 0;
    
    return {
      is_valid: isValid,
      trust_level: isValid ? 'TRUSTED' : 'UNTRUSTED',
      platform: 'TrustZone',
      verification_time: new Date(),
      policy_violations: violations,
      measurements: attestation.measurements
    };
  }
  
  private updatePlatformStats(platform: TEEPlatform): void {
    const current = this.stats.platform_stats.get(platform) || 0;
    this.stats.platform_stats.set(platform, current + 1);
  }
  
  private generateEventId(): string {
    return 'attestation_event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }
}