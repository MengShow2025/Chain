/**
 * 零知识证明模块 (L1层)
 * 
 * 支持多种ZK协议：
 * - zk-SNARK (Groth16, PLONK)
 * - zk-STARK
 * - Bulletproofs
 */

export * from './snark/index.js';
export * from './stark/index.js';
export * from './plonk/index.js';
export * from './circuits/index.js';
export * from './verifier/index.js';
export * from './generator/index.js';

// 主要接口
export { ZKProofSystem } from './zk-proof-system.js';
export { ZKCircuitManager } from './circuit-manager.js';
export { ZKVerificationEngine } from './verification-engine.js';