/**
 * TitanChain Shamir Secret Sharing Protocol Implementation / TitanChain Shamir秘密共享协议实现
 * 
 * Based on Shamir secret sharing algorithm, splits secrets into multiple shares,
 * requires threshold number of shares to reconstruct the original secret
 * 基于Shamir秘密共享算法，将秘密分割成多个份额，需要达到门限数量的份额才能重构原始秘密
 */

import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';
import {
  IShamirSecretSharing,
  SecretShare,
  ShamirError
} from './index';

export class ShamirSecretSharing extends EventEmitter implements IShamirSecretSharing {
  private isInitialized: boolean = false;
  private prime: bigint;
  private shares: Map<string, SecretShare> = new Map();

  constructor() {
    super();
    // 使用一个大质数作为有限域的模数 (2^127 - 1, Mersenne prime)
    this.prime = BigInt('170141183460469231731687303715884105727');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new ShamirError('Shamir Secret Sharing is already initialized');
    }

    try {
      console.log('🔐 Initializing Shamir Secret Sharing...');
      
      // 初始化随机数生成器
      this.setupRandomGenerator();
      
      this.isInitialized = true;
      console.log('✅ Shamir Secret Sharing initialized');
      
      this.emit('initialized', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { status: 'initialized' }
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Shamir Secret Sharing:', error);
      throw new ShamirError(`Failed to initialize: ${error.message}`);
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 Shutting down Shamir Secret Sharing...');
      
      // 清理所有份额
      this.shares.clear();
      
      this.isInitialized = false;
      console.log('✅ Shamir Secret Sharing shutdown completed');
      
      this.emit('shutdown', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { status: 'shutdown' }
      });
      
    } catch (error) {
      console.error('❌ Error during Shamir Secret Sharing shutdown:', error);
      throw new ShamirError(`Failed to shutdown: ${error.message}`);
    }
  }

  async shareSecret(secret: string, threshold: number, totalShares: number): Promise<SecretShare[]> {
    if (!this.isInitialized) {
      throw new ShamirError('Shamir Secret Sharing is not initialized');
    }

    if (threshold < 1 || threshold > totalShares) {
      throw new ShamirError('Invalid threshold: must be between 1 and total shares');
    }

    if (totalShares < 1 || totalShares > 255) {
      throw new ShamirError('Invalid total shares: must be between 1 and 255');
    }

    try {
      console.log(`🔐 Sharing secret with threshold ${threshold}/${totalShares}...`);
      
      // 将秘密转换为数字
      const secretValue = this.secretToNumber(secret);
      
      // 生成随机多项式系数
      const coefficients = this.generateCoefficients(secretValue, threshold - 1);
      
      // 计算份额
      const shares: SecretShare[] = [];
      for (let i = 1; i <= totalShares; i++) {
        const shareValue = this.evaluatePolynomial(coefficients, BigInt(i));
        const shareId = this.generateShareId();
        
        const share: SecretShare = {
          share_id: shareId,
          participant_id: `participant_${i}`,
          share_value: shareValue.toString(),
          threshold,
          total_shares: totalShares,
          metadata: {
            x_coordinate: i,
            created_at: new Date(),
            algorithm: 'shamir',
            field_size: this.prime.toString()
          }
        };
        
        shares.push(share);
        this.shares.set(shareId, share);
      }
      
      console.log(`✅ Secret shared into ${totalShares} shares`);
      
      this.emit('secret_shared', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          threshold,
          total_shares: totalShares,
          shares_created: shares.length
        }
      });
      
      return shares;
      
    } catch (error) {
      console.error('❌ Failed to share secret:', error);
      throw new ShamirError(`Failed to share secret: ${error.message}`);
    }
  }

  async reconstructSecret(shares: SecretShare[]): Promise<string> {
    if (!this.isInitialized) {
      throw new ShamirError('Shamir Secret Sharing is not initialized');
    }

    if (shares.length === 0) {
      throw new ShamirError('No shares provided');
    }

    const threshold = shares[0].threshold;
    if (shares.length < threshold) {
      throw new ShamirError(`Insufficient shares: need ${threshold}, got ${shares.length}`);
    }

    try {
      console.log(`🔓 Reconstructing secret from ${shares.length} shares...`);
      
      // 验证份额一致性
      await this.validateSharesConsistency(shares);
      
      // 使用拉格朗日插值重构秘密
      const points: Array<[bigint, bigint]> = shares.slice(0, threshold).map(share => [
        BigInt(share.metadata.x_coordinate),
        BigInt(share.share_value)
      ]);
      
      const secretValue = this.lagrangeInterpolation(points, BigInt(0));
      const secret = this.numberToSecret(secretValue);
      
      console.log('✅ Secret reconstructed successfully');
      
      this.emit('secret_reconstructed', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          shares_used: shares.length,
          threshold: threshold
        }
      });
      
      return secret;
      
    } catch (error) {
      console.error('❌ Failed to reconstruct secret:', error);
      throw new ShamirError(`Failed to reconstruct secret: ${error.message}`);
    }
  }

  async verifyShare(share: SecretShare): Promise<boolean> {
    if (!this.isInitialized) {
      throw new ShamirError('Shamir Secret Sharing is not initialized');
    }

    try {
      // 验证份额格式
      if (!share.share_id || !share.share_value || !share.metadata) {
        return false;
      }

      // 验证x坐标
      const xCoordinate = share.metadata.x_coordinate;
      if (!xCoordinate || xCoordinate < 1 || xCoordinate > share.total_shares) {
        return false;
      }

      // 验证份额值是否在有效范围内
      try {
        const shareValue = BigInt(share.share_value);
        if (shareValue < 0 || shareValue >= this.prime) {
          return false;
        }
      } catch (error) {
        // 如果无法转换为BigInt，则份额值无效
        return false;
      }

      // 验证门限参数
      if (share.threshold < 1 || share.threshold > share.total_shares) {
        return false;
      }

      console.log(`✅ Share verified: ${share.share_id}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to verify share ${share.share_id}:`, error);
      return false;
    }
  }

  async addShare(existingShares: SecretShare[], newShare: SecretShare): Promise<SecretShare[]> {
    if (!this.isInitialized) {
      throw new ShamirError('Shamir Secret Sharing is not initialized');
    }

    // 验证新份额
    const isValid = await this.verifyShare(newShare);
    if (!isValid) {
      throw new ShamirError('Invalid share provided');
    }

    // 验证份额兼容性
    if (existingShares.length > 0) {
      const firstShare = existingShares[0];
      if (newShare.threshold !== firstShare.threshold || 
          newShare.total_shares !== firstShare.total_shares) {
        throw new ShamirError('Share parameters do not match existing shares');
      }
    }

    // 检查是否已存在相同x坐标的份额
    const xCoordinate = newShare.metadata.x_coordinate;
    const existingShare = existingShares.find(share => 
      share.metadata.x_coordinate === xCoordinate
    );

    if (existingShare) {
      throw new ShamirError(`Share with x-coordinate ${xCoordinate} already exists`);
    }

    const updatedShares = [...existingShares, newShare];
    this.shares.set(newShare.share_id, newShare);
    
    console.log(`✅ Share added: ${newShare.share_id}`);
    
    this.emit('share_added', {
      event_id: this.generateEventId(),
      timestamp: new Date(),
      data: {
        share_id: newShare.share_id,
        total_shares: updatedShares.length
      }
    });
    
    return updatedShares;
  }

  async removeShare(shares: SecretShare[], shareId: string): Promise<SecretShare[]> {
    if (!this.isInitialized) {
      throw new ShamirError('Shamir Secret Sharing is not initialized');
    }

    const shareIndex = shares.findIndex(share => share.share_id === shareId);
    if (shareIndex === -1) {
      throw new ShamirError(`Share not found: ${shareId}`);
    }

    const updatedShares = shares.filter(share => share.share_id !== shareId);
    this.shares.delete(shareId);
    
    console.log(`✅ Share removed: ${shareId}`);
    
    this.emit('share_removed', {
      event_id: this.generateEventId(),
      timestamp: new Date(),
      data: {
        share_id: shareId,
        remaining_shares: updatedShares.length
      }
    });
    
    return updatedShares;
  }

  // 私有方法
  private setupRandomGenerator(): void {
    // 初始化加密安全的随机数生成器
    // 在实际实现中，这里会设置更复杂的随机数生成逻辑
  }

  private secretToNumber(secret: string): bigint {
    // 将秘密字符串转换为大整数（可逆转换）
    const buffer = Buffer.from(secret, 'utf8');
    let result = BigInt(0);
    
    for (let i = 0; i < buffer.length; i++) {
      result = (result << BigInt(8)) + BigInt(buffer[i]);
    }
    
    return result % this.prime;
  }

  private numberToSecret(number: bigint): string {
    // 将大整数转换回秘密字符串
    if (number === BigInt(0)) {
      return '';
    }
    
    const bytes: number[] = [];
    let temp = number;
    
    while (temp > BigInt(0)) {
      bytes.unshift(Number(temp & BigInt(255)));
      temp = temp >> BigInt(8);
    }
    
    return Buffer.from(bytes).toString('utf8');
  }

  private generateCoefficients(secret: bigint, degree: number): bigint[] {
    const coefficients = [secret];
    
    for (let i = 0; i < degree; i++) {
      const randomCoeff = this.generateRandomBigInt();
      coefficients.push(randomCoeff);
    }
    
    return coefficients;
  }

  private generateRandomBigInt(): bigint {
    const bytes = randomBytes(32);
    let result = BigInt(0);
    
    for (let i = 0; i < bytes.length; i++) {
      result = (result << BigInt(8)) + BigInt(bytes[i]);
    }
    
    return result % this.prime;
  }

  private evaluatePolynomial(coefficients: bigint[], x: bigint): bigint {
    let result = BigInt(0);
    let xPower = BigInt(1);
    
    for (const coeff of coefficients) {
      result = (result + (coeff * xPower) % this.prime) % this.prime;
      xPower = (xPower * x) % this.prime;
    }
    
    return result;
  }

  private lagrangeInterpolation(points: Array<[bigint, bigint]>, x: bigint): bigint {
    let result = BigInt(0);
    
    for (let i = 0; i < points.length; i++) {
      const [xi, yi] = points[i];
      let numerator = BigInt(1);
      let denominator = BigInt(1);
      
      for (let j = 0; j < points.length; j++) {
        if (i !== j) {
          const [xj] = points[j];
          numerator = (numerator * (x - xj)) % this.prime;
          let diff = (xi - xj) % this.prime;
          if (diff < 0) diff += this.prime;
          denominator = (denominator * diff) % this.prime;
        }
      }
      
      // 确保分母不为0
      if (denominator === BigInt(0)) {
        throw new ShamirError('Division by zero in Lagrange interpolation');
      }
      
      // 计算模逆
      const denominatorInverse = this.modInverse(denominator, this.prime);
      let lagrangeBasis = (numerator * denominatorInverse) % this.prime;
      if (lagrangeBasis < 0) lagrangeBasis += this.prime;
      
      let term = (yi * lagrangeBasis) % this.prime;
      if (term < 0) term += this.prime;
      
      result = (result + term) % this.prime;
    }
    
    if (result < 0) result += this.prime;
    return result;
  }

  private modInverse(a: bigint, m: bigint): bigint {
    // 使用扩展欧几里得算法计算模逆
    const [gcd, x] = this.extendedGCD(a, m);
    
    if (gcd !== BigInt(1)) {
      throw new ShamirError('Modular inverse does not exist');
    }
    
    return (x % m + m) % m;
  }

  private extendedGCD(a: bigint, b: bigint): [bigint, bigint] {
    let oldR = a;
    let r = b;
    let oldS = BigInt(1);
    let s = BigInt(0);
    
    while (r !== BigInt(0)) {
      const quotient = oldR / r;
      [oldR, r] = [r, oldR - quotient * r];
      [oldS, s] = [s, oldS - quotient * s];
    }
    
    return [oldR, oldS];
  }

  private async validateSharesConsistency(shares: SecretShare[]): Promise<void> {
    if (shares.length === 0) {
      throw new ShamirError('No shares to validate');
    }

    const firstShare = shares[0];
    const threshold = firstShare.threshold;
    const totalShares = firstShare.total_shares;

    for (const share of shares) {
      if (share.threshold !== threshold) {
        throw new ShamirError('Inconsistent threshold values in shares');
      }
      
      if (share.total_shares !== totalShares) {
        throw new ShamirError('Inconsistent total shares values');
      }
      
      const isValid = await this.verifyShare(share);
      if (!isValid) {
        throw new ShamirError(`Invalid share: ${share.share_id}`);
      }
    }

    // 检查x坐标唯一性
    const xCoordinates = shares.map(share => share.metadata.x_coordinate);
    const uniqueXCoordinates = new Set(xCoordinates);
    
    if (uniqueXCoordinates.size !== xCoordinates.length) {
      throw new ShamirError('Duplicate x-coordinates found in shares');
    }
  }

  private generateEventId(): string {
    return 'shamir_event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  private generateShareId(): string {
    return 'shamir_share_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }
}