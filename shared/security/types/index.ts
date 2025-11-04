/**
 * TitanChain安全系统类型定义
 */

// 基础安全类型
export interface SecurityLevel {
  level: 0 | 1 | 2 | 3 | 4 | 5;
  name: string;
  description: string;
}

// 零知识证明类型
export interface ZKProof {
  proof_id: string;
  proof_type: 'SNARK' | 'STARK' | 'PLONK' | 'BULLETPROOF';
  proof_data: Uint8Array;
  public_inputs: Uint8Array;
  circuit_hash: string;
  verification_key_hash: string;
  gas_cost: bigint;
  verification_time_ms: number;
  created_at: Date;
  verified_at?: Date;
  is_valid?: boolean;
}

export interface SNARKProof {
  pi_a: G1Point;
  pi_b: G2Point;
  pi_c: G1Point;
  protocol: 'groth16' | 'plonk';
  curve: 'bn254' | 'bls12-381';
}

export interface STARKProof {
  trace_commitment: string;
  constraint_evaluations: string[];
  fri_proof: string;
  public_inputs: string[];
}

export interface G1Point {
  x: string;
  y: string;
}

export interface G2Point {
  x: [string, string];
  y: [string, string];
}

// ZK电路和见证类型
export interface ZKCircuit {
  circuit_id: string;
  name: string;
  description: string;
  constraints: number;
  public_inputs: number;
  private_inputs: number;
  circuit_type: string;
  compiled_circuit?: Uint8Array;
  verification_key?: Uint8Array;
  proving_key?: Uint8Array;
  created_at: Date;
  [key: string]: any; // 允许额外的特定于协议的字段
}

export interface ZKWitness {
  witness_id: string;
  circuit_id: string;
  private_inputs: Uint8Array;
  intermediate_values?: Uint8Array;
  created_at: Date;
  [key: string]: any; // 允许额外的特定于协议的字段
}

export interface ZKVerificationResult {
  is_valid: boolean;
  confidence_score: number;
  verification_time_ms: number;
  gas_cost?: bigint;
  error_message?: string;
}

export interface ZKBatchVerificationResult {
  total_proofs: number;
  valid_proofs: number;
  invalid_proofs: number;
  batch_verification_time_ms: number;
  individual_results: ZKVerificationResult[];
  batch_efficiency: number;
}



// TEE相关类型
export interface TEEAttestation {
  attestation_id: string;
  tee_type: 'SGX' | 'SEV' | 'TRUSTZONE' | 'KEYSTONE';
  enclave_id: string;
  report_data: Uint8Array;
  signature: Uint8Array;
  certificate_chain?: string;
  enclave_hash: string;
  measurement: string;
  security_version: number;
  created_at: Date;
  verified_at?: Date;
  is_valid?: boolean;
}

export interface SGXAttestation {
  report: SGXReport;
  signature: ECDSASignature;
  certificate_chain: X509Certificate[];
  enclave_held_data: Uint8Array;
}

export interface SEVAttestation {
  measurement: string;
  policy: SEVPolicy;
  signature: RSASignature;
  certificate: SEVCertificate;
}

export interface SGXReport {
  cpu_svn: Uint8Array;
  misc_select: number;
  attributes: Uint8Array;
  mr_enclave: Uint8Array;
  mr_signer: Uint8Array;
  isv_prod_id: number;
  isv_svn: number;
  report_data: Uint8Array;
}

export interface SEVPolicy {
  flags: number;
  minfw: number;
  guest_svn: number;
}

export interface ECDSASignature {
  r: Uint8Array;
  s: Uint8Array;
}

export interface RSASignature {
  signature: Uint8Array;
  algorithm: string;
}

export interface X509Certificate {
  raw: Uint8Array;
  subject: string;
  issuer: string;
  valid_from: Date;
  valid_to: Date;
}

export interface SEVCertificate {
  version: number;
  api_major: number;
  api_minor: number;
  build_id: number;
  policy: number;
}

// MPC相关类型
export interface MPCShare {
  share_id: string;
  session_id: string;
  party_id: number;
  share_value: Uint8Array;
  threshold: number;
  total_parties: number;
  protocol_type: 'SHAMIR' | 'BGW' | 'GMW' | 'ABY3';
  commitment?: Uint8Array;
  created_at: Date;
  used_at?: Date;
  is_consumed: boolean;
}

export interface SecretShare {
  party_id: number;
  share_value: string;
  commitment: string;
  proof: ZKProof;
}

export interface MPCCircuit {
  gates: Gate[];
  input_wires: number[];
  output_wires: number[];
  security_parameter: number;
}

export interface Gate {
  gate_id: number;
  gate_type: 'AND' | 'OR' | 'XOR' | 'NOT' | 'ADD' | 'MUL';
  input_wires: number[];
  output_wire: number;
}

export interface MPCSession {
  session_id: string;
  parties: PartyInfo[];
  threshold: number;
  protocol: string;
  status: 'INITIALIZING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
  created_at: Date;
}

export interface PartyInfo {
  party_id: number;
  public_key: Uint8Array;
  endpoint: string;
  status: 'ONLINE' | 'OFFLINE' | 'SUSPICIOUS';
}

// 量子抗性密码学类型
export interface QuantumKey {
  key_id: string;
  algorithm_type: 'KYBER' | 'DILITHIUM' | 'SPHINCS' | 'FALCON';
  key_purpose: 'ENCRYPTION' | 'SIGNATURE' | 'KEM';
  public_key: Uint8Array;
  encrypted_private_key: Uint8Array;
  key_size: number;
  security_level: 1 | 3 | 5;
  created_at: Date;
  expires_at: Date;
  is_revoked: boolean;
  revoked_at?: Date;
}

export interface KyberKeyPair {
  public_key: Uint8Array;
  private_key: Uint8Array;
  security_level: 1 | 3 | 5;
}

export interface DilithiumKeyPair {
  public_key: Uint8Array;
  private_key: Uint8Array;
  security_level: 2 | 3 | 5;
}

export interface SPHINCSKeyPair {
  public_key: Uint8Array;
  private_key: Uint8Array;
  security_level: 1 | 3 | 5;
}

// Security decision types / 安全决策类型
export interface SecurityDecision {
  decision_id: string;
  request_id?: string;
  transaction_hash?: string;
  batch_id?: string;
  zk_proof_id?: string;
  tee_attestation_id?: string;
  mpc_session_id?: string;
  context?: SecurityContext;
  evaluation?: any;
  matched_policies?: any[];
  security_requirements?: string[];
  resource_availability?: { [key: string]: boolean };
  decision?: string;
  confidence?: number;
  alternatives?: any[];
  decision_time?: number;
  confidence_score?: number; // 0-1之间
  decision_result?: 'APPROVED' | 'REJECTED' | 'PENDING' | 'DISPUTED';
  security_metrics?: SecurityMetrics;
  risk_factors?: RiskFactor[];
  created_at?: Date;
  finalized_at?: Date;
  timestamp?: Date;
}

export interface SecurityMetrics {
  zk_verification_score: number;
  tee_integrity_score: number;
  mpc_consensus_score: number;
  quantum_resistance_score: number;
  overall_security_score: number;
  threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RiskFactor {
  factor_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  mitigation_suggestion?: string;
}

// 安全配置类型
export interface SecurityConfig {
  zk_config: ZKConfig;
  tee_config: TEEConfig;
  mpc_config: MPCConfig;
  quantum_config: QuantumConfig;
  decision_config: DecisionConfig;
}

export interface ZKConfig {
  enabled_protocols: ('SNARK' | 'STARK' | 'PLONK' | 'BULLETPROOF')[];
  default_curve: string;
  curve_type?: string; // Add curve_type property / 添加曲线类型属性
  proof_system?: string; // Add proof_system property / 添加证明系统属性
  max_proof_size: number;
  verification_timeout_ms: number;
  trusted_setup_required: boolean;
  security_level?: number;
  snark?: { // Add snark property at top level / 在顶层添加snark属性
    enabled: boolean;
    curve: string;
    proving_key_size: number;
    verification_key_size: number;
    max_constraints: number;
    trusted_setup_required: boolean;
  };
  zk?: {
    snark: {
      enabled: boolean;
      curve: string;
      proving_key_size: number;
      verification_key_size: number;
      max_constraints: number;
      trusted_setup_required: boolean;
    };
    stark: {
      enabled: boolean;
      field_size: number;
      fri_queries: number;
      max_trace_length: number;
      grinding_factor: number;
    };
    plonk: {
      enabled: boolean;
      curve: string;
      srs_size: number;
      max_constraints: number;
      universal_setup: boolean;
    };
  };
}

export interface TEEConfig {
  enabled_platforms: ('SGX' | 'SEV' | 'TRUSTZONE')[];
  min_security_version: number;
  attestation_timeout_ms: number;
  require_remote_attestation: boolean;
  trusted_measurements: string[];
}

export interface MPCConfig {
  enabled_protocols: ('SHAMIR' | 'BGW' | 'GMW' | 'ABY3')[];
  default_threshold: number;
  max_parties: number;
  session_timeout_ms: number;
  require_zk_proofs: boolean;
}

export interface QuantumConfig {
  enabled_algorithms: ('KYBER' | 'DILITHIUM' | 'SPHINCS')[];
  default_security_level: 1 | 3 | 5;
  key_rotation_interval_ms: number;
  require_quantum_safe: boolean;
}

export interface DecisionConfig {
  min_confidence_threshold: number;
  require_unanimous_consensus: boolean;
  max_decision_time_ms: number;
  enable_human_override: boolean;
  risk_tolerance_level: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
}

// 错误类型
export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly layer: SecurityLevel,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class ZKError extends SecurityError {
  constructor(message: string, details?: any) {
    super(message, 'ZK_ERROR', { level: 1, name: 'ZK', description: 'Zero Knowledge Layer' }, details);
  }
}

export class ZKProofError extends SecurityError {
  constructor(message: string, details?: any) {
    super(message, 'ZK_PROOF_ERROR', { level: 1, name: 'ZK_PROOF', description: 'Zero Knowledge Proof Layer' }, details);
  }
}

export class TEEError extends SecurityError {
  constructor(message: string, details?: any) {
    super(message, 'TEE_ERROR', { level: 2, name: 'TEE', description: 'Trusted Execution Environment Layer' }, details);
  }
}

export class MPCError extends SecurityError {
  constructor(message: string, details?: any) {
    super(message, 'MPC_ERROR', { level: 3, name: 'MPC', description: 'Multi-Party Computation Layer' }, details);
  }
}

export class QuantumError extends SecurityError {
  constructor(message: string, details?: any) {
    super(message, 'QUANTUM_ERROR', { level: 4, name: 'QUANTUM', description: 'Quantum Resistance Layer' }, details);
  }
}

// 事件类型
export interface SecurityEvent {
  event_id: string;
  event_type: 'PROOF_GENERATED' | 'ATTESTATION_VERIFIED' | 'MPC_COMPLETED' | 'THREAT_DETECTED' | 'DECISION_MADE' | 'SECURITY_EVALUATED';
  layer: SecurityLevel;
  timestamp: Date;
  data: any;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}

// 监控指标类型
export interface SecurityMetricsSnapshot {
  timestamp: Date;
  zk_metrics: {
    proofs_generated: number;
    verification_success_rate: number;
    average_proof_time_ms: number;
    invalid_proof_attempts: number;
  };
  tee_metrics: {
    attestations_verified: number;
    attestation_success_rate: number;
    average_attestation_time_ms: number;
    integrity_violations: number;
  };
  mpc_metrics: {
    sessions_completed: number;
    consensus_success_rate: number;
    average_session_time_ms: number;
    party_failures: number;
  };
  quantum_metrics: {
    keys_generated: number;
    keys_rotated: number;
    quantum_safe_operations: number;
    algorithm_usage: Record<string, number>;
  };
  overall_metrics: {
    total_transactions_processed: number;
    security_score_average: number;
    threat_detections: number;
    false_positive_rate: number;
  };
}

// Security context for decision making / 安全决策上下文
export interface SecurityContext {
  transaction_id?: string;
  user_id?: string;
  transaction_value?: number;
  data_sensitivity?: number;
  user_privilege?: number;
  network_type?: 'public' | 'private' | 'isolated';
  network_exposure?: number;
  recent_attack_count?: number;
  [key: string]: any;
}

// Threat levels / 威胁级别
export type ThreatLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';