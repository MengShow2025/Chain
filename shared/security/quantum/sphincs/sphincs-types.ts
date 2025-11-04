/**
 * SPHINCS+哈希签名算法类型定义
 */

export interface SphincsParameters {
  n: number;          // 哈希输出长度
  h: number;          // 超树高度
  d: number;          // 超树层数
  a: number;          // FORS树地址位数
  k: number;          // FORS树数量
  w: number;          // Winternitz参数
  publicKeySize: number;
  privateKeySize: number;
  signatureSize: number;
  hashFunction: string;
  robust: boolean;    // 是否使用robust变体
}

export interface SphincsSecurityLevel {
  level: 1 | 3 | 5;
  variant: string;
  parameters: SphincsParameters;
}

export interface SphincsOperationResult {
  success: boolean;
  data?: Uint8Array;
  error?: string;
  executionTime: number;
}

export interface SphincsTreeNode {
  value: Uint8Array;
  left?: SphincsTreeNode;
  right?: SphincsTreeNode;
}

export interface SphincsAuthPath {
  nodes: Uint8Array[];
  indices: number[];
}