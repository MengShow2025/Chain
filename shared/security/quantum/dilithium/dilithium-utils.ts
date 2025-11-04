/**
 * Dilithium数字签名算法工具函数
 */

import { randomBytes, createHash } from 'crypto';
import { DilithiumParameters } from './dilithium-types.js';

export class DilithiumUtils {
  /**
   * 生成随机向量
   */
  static generateRandomVector(length: number, eta: number): Uint8Array[] {
    const vector: Uint8Array[] = [];
    
    for (let i = 0; i < length; i++) {
      const poly = new Uint8Array(256); // n = 256 for Dilithium
      const randomData = randomBytes(256 * 2);
      
      for (let j = 0; j < 256; j++) {
        // 简化的随机多项式生成
        poly[j] = (randomData[j] + randomData[j + 256]) % (2 * eta + 1) - eta;
      }
      
      vector.push(poly);
    }
    
    return vector;
  }
  
  /**
   * 向量加法
   */
  static addVectors(a: Uint8Array[], b: Uint8Array[], q: number): Uint8Array[] {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }
    
    const result: Uint8Array[] = [];
    
    for (let i = 0; i < a.length; i++) {
      const sum = new Uint8Array(a[i].length);
      for (let j = 0; j < a[i].length; j++) {
        sum[j] = (a[i][j] + b[i][j]) % q;
      }
      result.push(sum);
    }
    
    return result;
  }
  
  /**
   * 向量减法
   */
  static subtractVectors(a: Uint8Array[], b: Uint8Array[], q: number): Uint8Array[] {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }
    
    const result: Uint8Array[] = [];
    
    for (let i = 0; i < a.length; i++) {
      const diff = new Uint8Array(a[i].length);
      for (let j = 0; j < a[i].length; j++) {
        diff[j] = (a[i][j] - b[i][j] + q) % q;
      }
      result.push(diff);
    }
    
    return result;
  }
  
  /**
   * 矩阵向量乘法
   */
  static matrixVectorMultiply(matrix: Uint8Array[][], vector: Uint8Array[], q: number): Uint8Array[] {
    const result: Uint8Array[] = [];
    
    for (let i = 0; i < matrix.length; i++) {
      const row = matrix[i];
      let sum = new Uint8Array(256).fill(0);
      
      for (let j = 0; j < row.length; j++) {
        const product = this.multiplyPolynomials(row[j], vector[j], q);
        sum = this.addPolynomials(sum, product, q);
      }
      
      result.push(sum);
    }
    
    return result;
  }
  
  /**
   * 多项式乘法
   */
  static multiplyPolynomials(a: Uint8Array, b: Uint8Array, q: number): Uint8Array {
    const n = a.length;
    const result = new Uint8Array(n);
    
    // 简化的多项式乘法实现
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        const k = (i - j + n) % n;
        sum += a[j] * b[k];
      }
      result[i] = sum % q;
    }
    
    return result;
  }
  
  /**
   * 多项式加法
   */
  static addPolynomials(a: Uint8Array, b: Uint8Array, q: number): Uint8Array {
    const result = new Uint8Array(a.length);
    
    for (let i = 0; i < a.length; i++) {
      result[i] = (a[i] + b[i]) % q;
    }
    
    return result;
  }
  
  /**
   * 高位分解
   */
  static highBits(r: Uint8Array, alpha: number, q: number): Uint8Array {
    const result = new Uint8Array(r.length);
    
    for (let i = 0; i < r.length; i++) {
      result[i] = Math.floor((r[i] + alpha / 2) / alpha) % (q / alpha);
    }
    
    return result;
  }
  
  /**
   * 低位分解
   */
  static lowBits(r: Uint8Array, alpha: number): Uint8Array {
    const result = new Uint8Array(r.length);
    
    for (let i = 0; i < r.length; i++) {
      result[i] = r[i] % alpha;
      if (result[i] > alpha / 2) {
        result[i] -= alpha;
      }
    }
    
    return result;
  }
  
  /**
   * 计算L∞范数
   */
  static infinityNorm(vector: Uint8Array[], q: number): number {
    let maxNorm = 0;
    
    for (const poly of vector) {
      for (let i = 0; i < poly.length; i++) {
        let value = poly[i];
        if (value > q / 2) {
          value = q - value;
        }
        maxNorm = Math.max(maxNorm, Math.abs(value));
      }
    }
    
    return maxNorm;
  }
  
  /**
   * 生成挑战多项式
   */
  static generateChallenge(seed: Uint8Array, tau: number): Uint8Array {
    const challenge = new Uint8Array(256);
    const hash = createHash('sha256');
    hash.update(seed);
    const digest = hash.digest();
    
    // 简化的挑战生成
    let nonZeroCount = 0;
    let index = 0;
    
    while (nonZeroCount < tau && index < digest.length) {
      const pos = digest[index] % 256;
      if (challenge[pos] === 0) {
        challenge[pos] = (digest[index] % 2) * 2 - 1; // -1 or 1
        nonZeroCount++;
      }
      index++;
    }
    
    return challenge;
  }
  
  /**
   * 向量编码
   */
  static encodeVector(vector: Uint8Array[], bitsPerCoeff: number): Uint8Array {
    const totalBits = vector.length * vector[0].length * bitsPerCoeff;
    const encodedSize = Math.ceil(totalBits / 8);
    const encoded = new Uint8Array(encodedSize);
    
    let bitOffset = 0;
    
    for (const poly of vector) {
      for (let i = 0; i < poly.length; i++) {
        const value = poly[i];
        
        for (let bit = 0; bit < bitsPerCoeff; bit++) {
          const currentBit = (value >> bit) & 1;
          const byteIndex = Math.floor(bitOffset / 8);
          const bitIndex = bitOffset % 8;
          
          if (currentBit && byteIndex < encoded.length) {
            encoded[byteIndex] |= (1 << bitIndex);
          }
          
          bitOffset++;
        }
      }
    }
    
    return encoded;
  }
  
  /**
   * 向量解码
   */
  static decodeVector(encoded: Uint8Array, vectorLength: number, polyLength: number, bitsPerCoeff: number): Uint8Array[] {
    const vector: Uint8Array[] = [];
    let bitOffset = 0;
    
    for (let v = 0; v < vectorLength; v++) {
      const poly = new Uint8Array(polyLength);
      
      for (let i = 0; i < polyLength; i++) {
        let value = 0;
        
        for (let bit = 0; bit < bitsPerCoeff; bit++) {
          const byteIndex = Math.floor(bitOffset / 8);
          const bitIndex = bitOffset % 8;
          
          if (byteIndex < encoded.length) {
            const bitValue = (encoded[byteIndex] >> bitIndex) & 1;
            value |= (bitValue << bit);
          }
          
          bitOffset++;
        }
        
        poly[i] = value;
      }
      
      vector.push(poly);
    }
    
    return vector;
  }
  
  /**
   * 验证参数有效性
   */
  static validateParameters(params: DilithiumParameters): boolean {
    return (
      params.n > 0 &&
      params.q > 0 &&
      params.k > 0 &&
      params.l > 0 &&
      params.eta >= 0 &&
      params.tau > 0 &&
      params.beta > 0 &&
      params.gamma1 > 0 &&
      params.gamma2 > 0 &&
      params.omega > 0 &&
      params.publicKeySize > 0 &&
      params.privateKeySize > 0 &&
      params.signatureSize > 0
    );
  }
}