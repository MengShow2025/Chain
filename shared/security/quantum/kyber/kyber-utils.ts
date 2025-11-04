/**
 * Kyber密钥封装机制工具函数
 */

import { randomBytes } from 'crypto';
import { KyberParameters } from './kyber-types.js';

export class KyberUtils {
  /**
   * 生成随机多项式
   */
  static generateRandomPolynomial(n: number, eta: number): Uint8Array {
    const poly = new Uint8Array(n);
    const randomData = randomBytes(n * 2);
    
    for (let i = 0; i < n; i++) {
      // 简化的随机多项式生成
      poly[i] = (randomData[i] + randomData[i + n]) % (2 * eta + 1) - eta;
    }
    
    return poly;
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
   * 多项式乘法（简化版）
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
   * 压缩函数
   */
  static compress(data: Uint8Array, d: number, q: number): Uint8Array {
    const compressed = new Uint8Array(data.length);
    const scale = Math.pow(2, d);
    
    for (let i = 0; i < data.length; i++) {
      compressed[i] = Math.round((data[i] * scale) / q) % scale;
    }
    
    return compressed;
  }
  
  /**
   * 解压缩函数
   */
  static decompress(data: Uint8Array, d: number, q: number): Uint8Array {
    const decompressed = new Uint8Array(data.length);
    const scale = Math.pow(2, d);
    
    for (let i = 0; i < data.length; i++) {
      decompressed[i] = Math.round((data[i] * q) / scale);
    }
    
    return decompressed;
  }
  
  /**
   * 字节数组打包
   */
  static packBytes(data: Uint8Array, bitsPerElement: number): Uint8Array {
    const totalBits = data.length * bitsPerElement;
    const packedSize = Math.ceil(totalBits / 8);
    const packed = new Uint8Array(packedSize);
    
    let bitOffset = 0;
    
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const byteIndex = Math.floor(bitOffset / 8);
      const bitIndex = bitOffset % 8;
      
      // 简化的打包实现
      for (let bit = 0; bit < bitsPerElement; bit++) {
        const currentBit = (value >> bit) & 1;
        const targetByteIndex = Math.floor((bitOffset + bit) / 8);
        const targetBitIndex = (bitOffset + bit) % 8;
        
        if (currentBit) {
          packed[targetByteIndex] |= (1 << targetBitIndex);
        }
      }
      
      bitOffset += bitsPerElement;
    }
    
    return packed;
  }
  
  /**
   * 字节数组解包
   */
  static unpackBytes(packed: Uint8Array, elementCount: number, bitsPerElement: number): Uint8Array {
    const unpacked = new Uint8Array(elementCount);
    let bitOffset = 0;
    
    for (let i = 0; i < elementCount; i++) {
      let value = 0;
      
      for (let bit = 0; bit < bitsPerElement; bit++) {
        const byteIndex = Math.floor((bitOffset + bit) / 8);
        const bitIndex = (bitOffset + bit) % 8;
        
        if (byteIndex < packed.length) {
          const bitValue = (packed[byteIndex] >> bitIndex) & 1;
          value |= (bitValue << bit);
        }
      }
      
      unpacked[i] = value;
      bitOffset += bitsPerElement;
    }
    
    return unpacked;
  }
  
  /**
   * 验证参数有效性
   */
  static validateParameters(params: KyberParameters): boolean {
    return (
      params.n > 0 &&
      params.q > 0 &&
      params.k > 0 &&
      params.eta1 >= 0 &&
      params.eta2 >= 0 &&
      params.du > 0 &&
      params.dv > 0 &&
      params.publicKeySize > 0 &&
      params.privateKeySize > 0 &&
      params.ciphertextSize > 0 &&
      params.sharedSecretSize > 0
    );
  }
}