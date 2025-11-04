/**
 * TitanChain Security Module Index
 * 安全模块索引 - 统一导出所有安全功能
 */

// Re-export from shared security modules
export * from '../../shared/security/index';
export * from '../../shared/security/mpc/index';
export * from '../../shared/security/tee/index';
export * from '../../shared/security/quantum/index';
export * from '../../shared/security/zk-proof/index';

// Import and re-export specific managers
import { MPCSystem } from '../../shared/security/mpc/mpc-system';
import { TEESystem } from '../../shared/security/tee/tee-system';
import { QuantumResistantSystem } from '../../shared/security/quantum/quantum-resistant-system';
import { ZKProofSystem } from '../../shared/security/zk-proof/zk-proof-system';

// Export as aliases for backward compatibility
export { MPCSystem as MPCManager };
export { TEESystem as TEEManager };
export { QuantumResistantSystem as QuantumSecurityManager };
export { ZKProofSystem as ZKManager };

// Export types
export type {
  SecurityConfig,
  MPCConfig,
  TEEConfig,
  QuantumConfig,
  ZKConfig
} from '../../shared/security/types/index';