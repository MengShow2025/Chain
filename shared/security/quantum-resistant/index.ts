/**
 * 量子抗性密码学模块入口
 */

export * from './quantum-crypto-system.js';
export * from './kyber-encryption.js';
export * from './dilithium-signature.js';
export * from './sphincs-signature.js';

// 量子抗性密码系统接口
export interface IQuantumCryptoSystem {
  generateKeyPair(algorithm: string): Promise<any>;
  encrypt(data: Uint8Array, publicKey: any): Promise<Uint8Array>;
  decrypt(encryptedData: Uint8Array, privateKey: any): Promise<Uint8Array>;
  sign(message: Uint8Array, privateKey: any): Promise<Uint8Array>;
  verify(message: Uint8Array, signature: Uint8Array, publicKey: any): Promise<boolean>;
}

// Kyber加密接口
export interface IKyberEncryption {
  generateKeyPair(): Promise<any>;
  encapsulate(publicKey: any): Promise<{ ciphertext: Uint8Array; sharedSecret: Uint8Array }>;
  decapsulate(ciphertext: Uint8Array, privateKey: any): Promise<Uint8Array>;
}

// Dilithium签名接口
export interface IDilithiumSignature {
  generateKeyPair(): Promise<any>;
  sign(message: Uint8Array, privateKey: any): Promise<Uint8Array>;
  verify(message: Uint8Array, signature: Uint8Array, publicKey: any): Promise<boolean>;
}

// SPHINCS+签名接口
export interface ISPHINCSSignature {
  generateKeyPair(): Promise<any>;
  sign(message: Uint8Array, privateKey: any): Promise<Uint8Array>;
  verify(message: Uint8Array, signature: Uint8Array, publicKey: any): Promise<boolean>;
}

// 量子密钥管理接口
export interface IQuantumKeyManager {
  generateMasterKey(): Promise<any>;
  deriveKey(masterKey: any, purpose: string, index: number): Promise<any>;
  rotateKeys(keyId: string): Promise<any>;
  revokeKey(keyId: string): Promise<void>;
}

// 量子安全通信接口
export interface IQuantumSecureChannel {
  establishChannel(remotePublicKey: any): Promise<string>;
  sendMessage(channelId: string, message: Uint8Array): Promise<void>;
  receiveMessage(channelId: string): Promise<Uint8Array>;
  closeChannel(channelId: string): Promise<void>;
}