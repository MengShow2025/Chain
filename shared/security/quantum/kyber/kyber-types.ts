/**
 * Kyber密钥封装机制类型定义
 */

export interface KyberParameters {
  n: number;          // 多项式维度
  q: number;          // 模数
  k: number;          // 模块维度
  eta1: number;       // 噪声参数1
  eta2: number;       // 噪声参数2
  du: number;         // 压缩参数u
  dv: number;         // 压缩参数v
  publicKeySize: number;
  privateKeySize: number;
  ciphertextSize: number;
  sharedSecretSize: number;
}

export interface KyberSecurityLevel {
  level: 1 | 3 | 5;
  variant: 'KYBER_512' | 'KYBER_768' | 'KYBER_1024';
  parameters: KyberParameters;
}

export interface KyberOperationResult {
  success: boolean;
  data?: Uint8Array;
  error?: string;
  executionTime: number;
}