/**
 * TitanChain安全系统配置
 */

import { SecurityConfig, ZKConfig, TEEConfig, MPCConfig, QuantumConfig, DecisionConfig } from './types/index.js';

// Re-export types for convenience / 为方便使用重新导出类型
export { SecurityConfig, ZKConfig, TEEConfig, MPCConfig, QuantumConfig, DecisionConfig };

// 默认ZK配置
const DEFAULT_ZK_CONFIG: ZKConfig = {
  enabled_protocols: ['SNARK', 'STARK', 'PLONK'],
  default_curve: 'bn254',
  max_proof_size: 1024 * 1024, // 1MB
  verification_timeout_ms: 5000,
  trusted_setup_required: false
};

// 默认TEE配置
const DEFAULT_TEE_CONFIG: TEEConfig = {
  enabled_platforms: ['SGX', 'SEV', 'TRUSTZONE'],
  min_security_version: 2,
  attestation_timeout_ms: 10000,
  require_remote_attestation: true,
  trusted_measurements: []
};

// 默认MPC配置
const DEFAULT_MPC_CONFIG: MPCConfig = {
  enabled_protocols: ['SHAMIR', 'BGW', 'ABY3'],
  default_threshold: 67, // 2/3 threshold
  max_parties: 108, // 匹配验证节点数量
  session_timeout_ms: 30000,
  require_zk_proofs: true
};

// 默认量子配置
const DEFAULT_QUANTUM_CONFIG: QuantumConfig = {
  enabled_algorithms: ['KYBER', 'DILITHIUM', 'SPHINCS'],
  default_security_level: 3,
  key_rotation_interval_ms: 24 * 60 * 60 * 1000, // 24小时
  require_quantum_safe: true
};

// 默认决策配置
const DEFAULT_DECISION_CONFIG: DecisionConfig = {
  min_confidence_threshold: 0.95,
  require_unanimous_consensus: false,
  max_decision_time_ms: 2000,
  enable_human_override: true,
  risk_tolerance_level: 'CONSERVATIVE'
};

// 默认安全配置
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  zk_config: DEFAULT_ZK_CONFIG,
  tee_config: DEFAULT_TEE_CONFIG,
  mpc_config: DEFAULT_MPC_CONFIG,
  quantum_config: DEFAULT_QUANTUM_CONFIG,
  decision_config: DEFAULT_DECISION_CONFIG
};

// 环境特定配置
export const DEVELOPMENT_CONFIG: SecurityConfig = {
  ...DEFAULT_SECURITY_CONFIG,
  zk_config: {
    ...DEFAULT_ZK_CONFIG,
    verification_timeout_ms: 10000, // 开发环境更长超时
    trusted_setup_required: false
  },
  tee_config: {
    ...DEFAULT_TEE_CONFIG,
    require_remote_attestation: false, // 开发环境可选
    min_security_version: 1
  },
  decision_config: {
    ...DEFAULT_DECISION_CONFIG,
    min_confidence_threshold: 0.8, // 开发环境较低阈值
    max_decision_time_ms: 5000
  }
};

export const PRODUCTION_CONFIG: SecurityConfig = {
  ...DEFAULT_SECURITY_CONFIG,
  zk_config: {
    ...DEFAULT_ZK_CONFIG,
    verification_timeout_ms: 2000, // 生产环境更严格
    trusted_setup_required: true
  },
  tee_config: {
    ...DEFAULT_TEE_CONFIG,
    require_remote_attestation: true,
    min_security_version: 3
  },
  decision_config: {
    ...DEFAULT_DECISION_CONFIG,
    min_confidence_threshold: 0.99, // 生产环境更高阈值
    max_decision_time_ms: 1000,
    risk_tolerance_level: 'CONSERVATIVE'
  }
};

export const TESTING_CONFIG: SecurityConfig = {
  ...DEFAULT_SECURITY_CONFIG,
  zk_config: {
    ...DEFAULT_ZK_CONFIG,
    enabled_protocols: ['SNARK'], // 测试环境简化
    verification_timeout_ms: 30000,
    trusted_setup_required: false
  },
  tee_config: {
    ...DEFAULT_TEE_CONFIG,
    enabled_platforms: ['SGX'], // 测试环境单一平台
    require_remote_attestation: false,
    min_security_version: 1
  },
  mpc_config: {
    ...DEFAULT_MPC_CONFIG,
    max_parties: 10, // 测试环境较少节点
    session_timeout_ms: 60000,
    require_zk_proofs: false
  },
  decision_config: {
    ...DEFAULT_DECISION_CONFIG,
    min_confidence_threshold: 0.7,
    max_decision_time_ms: 10000,
    risk_tolerance_level: 'MODERATE'
  }
};

// 配置工厂函数
export function createSecurityConfig(environment: 'development' | 'production' | 'testing' = 'development'): SecurityConfig {
  switch (environment) {
    case 'production':
      return PRODUCTION_CONFIG;
    case 'testing':
      return TESTING_CONFIG;
    case 'development':
    default:
      return DEVELOPMENT_CONFIG;
  }
}

// 配置验证函数
export function validateSecurityConfig(config: SecurityConfig): boolean {
  try {
    // 验证ZK配置
    if (config.zk_config.enabled_protocols.length === 0) {
      throw new Error('At least one ZK protocol must be enabled');
    }
    
    if (config.zk_config.max_proof_size <= 0) {
      throw new Error('Max proof size must be positive');
    }
    
    if (config.zk_config.verification_timeout_ms <= 0) {
      throw new Error('Verification timeout must be positive');
    }

    // 验证TEE配置
    if (config.tee_config.enabled_platforms.length === 0) {
      throw new Error('At least one TEE platform must be enabled');
    }
    
    if (config.tee_config.min_security_version < 1) {
      throw new Error('Minimum security version must be at least 1');
    }

    // 验证MPC配置
    if (config.mpc_config.default_threshold < 50 || config.mpc_config.default_threshold > 100) {
      throw new Error('MPC threshold must be between 50 and 100');
    }
    
    if (config.mpc_config.max_parties < 3) {
      throw new Error('MPC must support at least 3 parties');
    }

    // 验证量子配置
    if (config.quantum_config.enabled_algorithms.length === 0) {
      throw new Error('At least one quantum-resistant algorithm must be enabled');
    }
    
    if (![1, 3, 5].includes(config.quantum_config.default_security_level)) {
      throw new Error('Quantum security level must be 1, 3, or 5');
    }

    // 验证决策配置
    if (config.decision_config.min_confidence_threshold < 0 || config.decision_config.min_confidence_threshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    
    if (config.decision_config.max_decision_time_ms <= 0) {
      throw new Error('Max decision time must be positive');
    }

    return true;
  } catch (error) {
    console.error('Security config validation failed:', error);
    return false;
  }
}

// 配置合并函数
export function mergeSecurityConfig(base: SecurityConfig, override: Partial<SecurityConfig>): SecurityConfig {
  return {
    zk_config: { ...base.zk_config, ...override.zk_config },
    tee_config: { ...base.tee_config, ...override.tee_config },
    mpc_config: { ...base.mpc_config, ...override.mpc_config },
    quantum_config: { ...base.quantum_config, ...override.quantum_config },
    decision_config: { ...base.decision_config, ...override.decision_config }
  };
}

// 从环境变量加载配置
export function loadConfigFromEnv(): Partial<SecurityConfig> {
  const config: Partial<SecurityConfig> = {};

  // ZK配置
  if (process.env.ZK_ENABLED_PROTOCOLS) {
    config.zk_config = {
      ...DEFAULT_ZK_CONFIG,
      enabled_protocols: process.env.ZK_ENABLED_PROTOCOLS.split(',') as any[]
    };
  }

  if (process.env.ZK_VERIFICATION_TIMEOUT) {
    config.zk_config = {
      ...config.zk_config || DEFAULT_ZK_CONFIG,
      verification_timeout_ms: parseInt(process.env.ZK_VERIFICATION_TIMEOUT)
    };
  }

  // TEE配置
  if (process.env.TEE_ENABLED_PLATFORMS) {
    config.tee_config = {
      ...DEFAULT_TEE_CONFIG,
      enabled_platforms: process.env.TEE_ENABLED_PLATFORMS.split(',') as any[]
    };
  }

  if (process.env.TEE_MIN_SECURITY_VERSION) {
    config.tee_config = {
      ...config.tee_config || DEFAULT_TEE_CONFIG,
      min_security_version: parseInt(process.env.TEE_MIN_SECURITY_VERSION)
    };
  }

  // MPC配置
  if (process.env.MPC_DEFAULT_THRESHOLD) {
    config.mpc_config = {
      ...DEFAULT_MPC_CONFIG,
      default_threshold: parseInt(process.env.MPC_DEFAULT_THRESHOLD)
    };
  }

  if (process.env.MPC_MAX_PARTIES) {
    config.mpc_config = {
      ...config.mpc_config || DEFAULT_MPC_CONFIG,
      max_parties: parseInt(process.env.MPC_MAX_PARTIES)
    };
  }

  // 量子配置
  if (process.env.QUANTUM_SECURITY_LEVEL) {
    config.quantum_config = {
      ...DEFAULT_QUANTUM_CONFIG,
      default_security_level: parseInt(process.env.QUANTUM_SECURITY_LEVEL) as 1 | 3 | 5
    };
  }

  // 决策配置
  if (process.env.DECISION_CONFIDENCE_THRESHOLD) {
    config.decision_config = {
      ...DEFAULT_DECISION_CONFIG,
      min_confidence_threshold: parseFloat(process.env.DECISION_CONFIDENCE_THRESHOLD)
    };
  }

  if (process.env.DECISION_RISK_TOLERANCE) {
    config.decision_config = {
      ...config.decision_config || DEFAULT_DECISION_CONFIG,
      risk_tolerance_level: process.env.DECISION_RISK_TOLERANCE as any
    };
  }

  return config;
}