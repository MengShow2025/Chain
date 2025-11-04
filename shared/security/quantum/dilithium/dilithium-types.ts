/**
 * Dilithium数字签名算法类型定义
 */

export interface DilithiumParameters {
  n: number;          // 多项式维度
  q: number;          // 模数
  k: number;          // 高阶位数
  l: number;          // 低阶位数
  eta: number;        // 噪声参数
  tau: number;        // 挑战参数
  beta: number;       // 最大L∞范数
  gamma1: number;     // 签名参数1
  gamma2: number;     // 签名参数2
  omega: number;      // 挑战权重
  publicKeySize: number;
  privateKeySize: number;
  signatureSize: number;
}

export interface DilithiumSecurityLevel {
  level: 1 | 3 | 5;
  variant: 'DILITHIUM_2' | 'DILITHIUM_3' | 'DILITHIUM_5';
  parameters: DilithiumParameters;
}

export interface DilithiumOperationResult {
  success: boolean;
  data?: Uint8Array;
  error?: string;
  executionTime: number;
}