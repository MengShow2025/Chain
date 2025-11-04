/**
 * SPHINCS+哈希签名算法工具函数
 */

import { randomBytes, createHash, createHmac } from 'crypto';
import { SphincsParameters, SphincsTreeNode, SphincsAuthPath } from './sphincs-types.js';

export class SphincsUtils {
  /**
   * 生成哈希链
   */
  static generateHashChain(seed: Uint8Array, length: number, hashFunction: string = 'sha256'): Uint8Array[] {
    const chain: Uint8Array[] = [];
    let current = seed;
    
    for (let i = 0; i < length; i++) {
      chain.push(new Uint8Array(current));
      
      const hash = createHash(hashFunction);
      hash.update(current);
      current = new Uint8Array(hash.digest());
    }
    
    return chain;
  }
  
  /**
   * 计算Merkle树根
   */
  static computeMerkleRoot(leaves: Uint8Array[], hashFunction: string = 'sha256'): Uint8Array {
    if (leaves.length === 0) {
      throw new Error('Cannot compute root of empty tree');
    }
    
    if (leaves.length === 1) {
      return leaves[0];
    }
    
    let currentLevel = leaves.slice();
    
    while (currentLevel.length > 1) {
      const nextLevel: Uint8Array[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        
        const hash = createHash(hashFunction);
        hash.update(left);
        hash.update(right);
        nextLevel.push(new Uint8Array(hash.digest()));
      }
      
      currentLevel = nextLevel;
    }
    
    return currentLevel[0];
  }
  
  /**
   * 生成Merkle树认证路径
   */
  static generateAuthPath(leaves: Uint8Array[], leafIndex: number, hashFunction: string = 'sha256'): SphincsAuthPath {
    if (leafIndex >= leaves.length) {
      throw new Error('Leaf index out of bounds');
    }
    
    const nodes: Uint8Array[] = [];
    const indices: number[] = [];
    let currentLevel = leaves.slice();
    let currentIndex = leafIndex;
    
    while (currentLevel.length > 1) {
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      
      if (siblingIndex < currentLevel.length) {
        nodes.push(currentLevel[siblingIndex]);
        indices.push(siblingIndex);
      }
      
      // 构建下一层
      const nextLevel: Uint8Array[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        
        const hash = createHash(hashFunction);
        hash.update(left);
        hash.update(right);
        nextLevel.push(new Uint8Array(hash.digest()));
      }
      
      currentLevel = nextLevel;
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    return { nodes, indices };
  }
  
  /**
   * 验证Merkle树认证路径
   */
  static verifyAuthPath(
    leaf: Uint8Array,
    leafIndex: number,
    authPath: SphincsAuthPath,
    root: Uint8Array,
    hashFunction: string = 'sha256'
  ): boolean {
    let current = leaf;
    let index = leafIndex;
    
    for (let i = 0; i < authPath.nodes.length; i++) {
      const sibling = authPath.nodes[i];
      const hash = createHash(hashFunction);
      
      if (index % 2 === 0) {
        // 当前节点是左子节点
        hash.update(current);
        hash.update(sibling);
      } else {
        // 当前节点是右子节点
        hash.update(sibling);
        hash.update(current);
      }
      
      current = new Uint8Array(hash.digest());
      index = Math.floor(index / 2);
    }
    
    return this.compareBytes(current, root);
  }
  
  /**
   * WOTS+密钥生成
   */
  static generateWOTSKeys(seed: Uint8Array, w: number, n: number, hashFunction: string = 'sha256'): Uint8Array[] {
    const chainLength = Math.ceil(Math.log2(w));
    const keys: Uint8Array[] = [];
    
    for (let i = 0; i < n; i++) {
      const keySeed = new Uint8Array(seed.length + 4);
      keySeed.set(seed);
      keySeed.set(this.intToBytes(i, 4), seed.length);
      
      const hash = createHash(hashFunction);
      hash.update(keySeed);
      const keyStart = new Uint8Array(hash.digest().slice(0, n));
      
      const chain = this.generateHashChain(keyStart, chainLength, hashFunction);
      keys.push(chain[chain.length - 1]);
    }
    
    return keys;
  }
  
  /**
   * WOTS+签名
   */
  static wotsSign(
    message: Uint8Array,
    privateKeys: Uint8Array[],
    w: number,
    hashFunction: string = 'sha256'
  ): Uint8Array[] {
    const signature: Uint8Array[] = [];
    const messageDigits = this.baseWEncode(message, w);
    
    for (let i = 0; i < messageDigits.length && i < privateKeys.length; i++) {
      const chainLength = messageDigits[i];
      const chain = this.generateHashChain(privateKeys[i], chainLength, hashFunction);
      signature.push(chain[chain.length - 1]);
    }
    
    return signature;
  }
  
  /**
   * WOTS+验证
   */
  static wotsVerify(
    message: Uint8Array,
    signature: Uint8Array[],
    publicKeys: Uint8Array[],
    w: number,
    hashFunction: string = 'sha256'
  ): boolean {
    const messageDigits = this.baseWEncode(message, w);
    
    for (let i = 0; i < messageDigits.length && i < signature.length; i++) {
      const remainingChainLength = w - 1 - messageDigits[i];
      const chain = this.generateHashChain(signature[i], remainingChainLength, hashFunction);
      const computedPublicKey = chain[chain.length - 1];
      
      if (!this.compareBytes(computedPublicKey, publicKeys[i])) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * FORS密钥生成
   */
  static generateFORSKeys(seed: Uint8Array, k: number, t: number, n: number, hashFunction: string = 'sha256'): Uint8Array[][] {
    const keys: Uint8Array[][] = [];
    
    for (let i = 0; i < k; i++) {
      const treeKeys: Uint8Array[] = [];
      
      for (let j = 0; j < t; j++) {
        const keySeed = new Uint8Array(seed.length + 8);
        keySeed.set(seed);
        keySeed.set(this.intToBytes(i, 4), seed.length);
        keySeed.set(this.intToBytes(j, 4), seed.length + 4);
        
        const hash = createHash(hashFunction);
        hash.update(keySeed);
        treeKeys.push(new Uint8Array(hash.digest().slice(0, n)));
      }
      
      keys.push(treeKeys);
    }
    
    return keys;
  }
  
  /**
   * FORS签名
   */
  static forsSign(
    message: Uint8Array,
    privateKeys: Uint8Array[][],
    k: number,
    t: number,
    hashFunction: string = 'sha256'
  ): { signatures: Uint8Array[]; authPaths: SphincsAuthPath[] } {
    const signatures: Uint8Array[] = [];
    const authPaths: SphincsAuthPath[] = [];
    
    // 将消息分割为k个部分
    const messageChunks = this.splitMessage(message, k);
    
    for (let i = 0; i < k && i < messageChunks.length; i++) {
      const chunkValue = this.bytesToInt(messageChunks[i]) % t;
      signatures.push(privateKeys[i][chunkValue]);
      
      // 生成认证路径
      const authPath = this.generateAuthPath(privateKeys[i], chunkValue, hashFunction);
      authPaths.push(authPath);
    }
    
    return { signatures, authPaths };
  }
  
  /**
   * Base-w编码
   */
  static baseWEncode(data: Uint8Array, w: number): number[] {
    const digits: number[] = [];
    const bitsPerDigit = Math.ceil(Math.log2(w));
    
    let bitBuffer = 0;
    let bitsInBuffer = 0;
    
    for (const byte of data) {
      bitBuffer = (bitBuffer << 8) | byte;
      bitsInBuffer += 8;
      
      while (bitsInBuffer >= bitsPerDigit) {
        const digit = (bitBuffer >> (bitsInBuffer - bitsPerDigit)) & ((1 << bitsPerDigit) - 1);
        digits.push(digit);
        bitsInBuffer -= bitsPerDigit;
      }
    }
    
    // 处理剩余位
    if (bitsInBuffer > 0) {
      const digit = (bitBuffer << (bitsPerDigit - bitsInBuffer)) & ((1 << bitsPerDigit) - 1);
      digits.push(digit);
    }
    
    return digits;
  }
  
  /**
   * 分割消息
   */
  static splitMessage(message: Uint8Array, parts: number): Uint8Array[] {
    const chunks: Uint8Array[] = [];
    const chunkSize = Math.ceil(message.length / parts);
    
    for (let i = 0; i < parts; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, message.length);
      chunks.push(message.slice(start, end));
    }
    
    return chunks;
  }
  
  /**
   * 整数转字节数组
   */
  static intToBytes(value: number, length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    
    for (let i = length - 1; i >= 0; i--) {
      bytes[i] = value & 0xFF;
      value >>= 8;
    }
    
    return bytes;
  }
  
  /**
   * 字节数组转整数
   */
  static bytesToInt(bytes: Uint8Array): number {
    let value = 0;
    
    for (const byte of bytes) {
      value = (value << 8) | byte;
    }
    
    return value;
  }
  
  /**
   * 字节数组比较
   */
  static compareBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 生成随机地址
   */
  static generateAddress(layer: number, tree: number, type: number, keyPair: number): Uint8Array {
    const address = new Uint8Array(32);
    
    address.set(this.intToBytes(layer, 4), 0);
    address.set(this.intToBytes(tree, 8), 4);
    address.set(this.intToBytes(type, 4), 12);
    address.set(this.intToBytes(keyPair, 4), 16);
    
    return address;
  }
  
  /**
   * 验证参数有效性
   */
  static validateParameters(params: SphincsParameters): boolean {
    return (
      params.n > 0 &&
      params.h > 0 &&
      params.d > 0 &&
      params.a > 0 &&
      params.k > 0 &&
      params.w > 1 &&
      params.publicKeySize > 0 &&
      params.privateKeySize > 0 &&
      params.signatureSize > 0 &&
      params.hashFunction.length > 0
    );
  }
}