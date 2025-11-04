/**
 * TitanChain多层次安全防护系统
 * 
 * 本模块实现了五层安全架构：
 * L0: 基础密码学层
 * L1: 零知识证明层
 * L2: 可信执行环境层
 * L3: 多方安全计算层
 * L4: 量子抗性防护层
 * L5: 综合安全决策层
 */

export * from './zk-proof/index.js';
export * from './tee/index.js';
export * from './mpc/index.js';
export * from './quantum/index.js';
export * from './decision-engine/index.js';
export * from './types/index.js';

// 配置
export { SecurityConfig } from './config.js';