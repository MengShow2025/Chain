/**
 * TitanChain可信执行环境(TEE)模块
 * 支持Intel SGX、AMD SEV、ARM TrustZone等多种TEE平台
 */

// 导出TEE系统核心组件
export { TEESystem } from './tee-system.js';
export { SGXEnclave } from './sgx-enclave.js';
export { SEVSecureVM } from './sev-secure-vm.js';
export { TrustZoneSecureWorld } from './trustzone-secure-world.js';
export { TEEAttestationService } from './attestation-service.js';
export { TEEOrchestrator } from './tee-orchestrator.js';

// 导出TEE接口定义
export interface ITEESystem {
  // 系统管理
  initializeSystem(): Promise<void>;
  shutdownSystem(): Promise<void>;
  healthCheck(): Promise<TEEHealthStatus>;
  
  // 平台管理
  registerPlatform(platform: TEEPlatform): Promise<void>;
  unregisterPlatform(platformId: string): Promise<void>;
  getPlatforms(): TEEPlatform[];
  
  // Enclave/VM管理
  createSecureEnvironment(config: SecureEnvironmentConfig): Promise<SecureEnvironment>;
  destroySecureEnvironment(environmentId: string): Promise<void>;
  listSecureEnvironments(): SecureEnvironment[];
  
  // 远程证明
  generateAttestation(environmentId: string, reportData?: Uint8Array): Promise<TEEAttestation>;
  verifyAttestation(attestation: TEEAttestation): Promise<AttestationResult>;
  
  // 安全通信
  establishSecureChannel(environmentId: string, remotePublicKey: Uint8Array): Promise<SecureChannel>;
  sendSecureMessage(channelId: string, message: Uint8Array): Promise<void>;
  receiveSecureMessage(channelId: string): Promise<Uint8Array>;
  
  // 密钥管理
  generateKey(environmentId: string, keyType: string): Promise<TEEKey>;
  importKey(environmentId: string, keyData: Uint8Array): Promise<string>;
  exportKey(environmentId: string, keyId: string): Promise<Uint8Array>;
  deleteKey(environmentId: string, keyId: string): Promise<void>;
  
  // 统计和监控
  getStatistics(): TEEStatistics;
  on(event: string, listener: Function): void;
  off(event: string, listener: Function): void;
}

export interface ISGXEnclave {
  // Enclave生命周期
  createEnclave(config: SGXEnclaveConfig): Promise<SGXEnclaveInstance>;
  destroyEnclave(enclaveId: string): Promise<void>;
  
  // 远程证明
  generateQuote(enclaveId: string, reportData: Uint8Array): Promise<SGXQuote>;
  verifyQuote(quote: SGXQuote): Promise<QuoteVerificationResult>;
  
  // 密封和解封
  sealData(enclaveId: string, data: Uint8Array, policy: SealingPolicy): Promise<SealedData>;
  unsealData(enclaveId: string, sealedData: SealedData): Promise<Uint8Array>;
  
  // ECALL/OCALL
  invokeECall(enclaveId: string, functionId: number, parameters: any[]): Promise<any>;
  registerOCall(functionId: number, handler: Function): void;
}

export interface ISEVSecureVM {
  // 安全虚拟机管理
  createSecureVM(config: SEVVMConfig): Promise<SEVVMInstance>;
  destroySecureVM(vmId: string): Promise<void>;
  
  // 内存加密
  enableMemoryEncryption(vmId: string): Promise<void>;
  disableMemoryEncryption(vmId: string): Promise<void>;
  
  // 远程证明
  generateAttestation(vmId: string, nonce: Uint8Array): Promise<SEVAttestation>;
  verifyAttestation(attestation: SEVAttestation): Promise<AttestationResult>;
  
  // 安全迁移
  prepareMigration(vmId: string): Promise<MigrationPackage>;
  completeMigration(migrationPackage: MigrationPackage): Promise<string>;
}

export interface ITrustZoneSecureWorld {
  // 安全世界管理
  initializeSecureWorld(): Promise<void>;
  shutdownSecureWorld(): Promise<void>;
  
  // 可信应用管理
  loadTrustedApplication(taConfig: TrustedApplicationConfig): Promise<string>;
  unloadTrustedApplication(taId: string): Promise<void>;
  
  // 安全服务调用
  invokeSecureService(taId: string, commandId: number, parameters: any[]): Promise<any>;
  
  // 安全存储
  secureStore(key: string, data: Uint8Array): Promise<void>;
  secureRetrieve(key: string): Promise<Uint8Array>;
  secureDelete(key: string): Promise<void>;
}

export interface ITEEAttestationService {
  // 证明生成
  generateAttestation(request: AttestationRequest): Promise<TEEAttestation>;
  
  // 证明验证
  verifyAttestation(attestation: TEEAttestation): Promise<AttestationResult>;
  batchVerifyAttestations(attestations: TEEAttestation[]): Promise<BatchAttestationResult>;
  
  // 证书管理
  registerCertificate(certificate: TEECertificate): Promise<void>;
  revokeCertificate(certificateId: string): Promise<void>;
  getCertificateChain(platformType: string): Promise<TEECertificate[]>;
  
  // 策略管理
  setVerificationPolicy(policy: AttestationPolicy): Promise<void>;
  getVerificationPolicy(): AttestationPolicy;
}

export interface ITEEOrchestrator {
  // 多平台协调
  coordinateMultiPlatformOperation(operation: MultiPlatformOperation): Promise<OperationResult>;
  
  // 负载均衡
  selectOptimalPlatform(requirements: PlatformRequirements): Promise<string>;
  distributeWorkload(workload: TEEWorkload): Promise<WorkloadDistribution>;
  
  // 故障恢复
  handlePlatformFailure(platformId: string): Promise<void>;
  migrateWorkload(workloadId: string, targetPlatformId: string): Promise<void>;
  
  // 性能监控
  monitorPlatformPerformance(): Promise<PlatformPerformanceMetrics>;
  optimizeResourceAllocation(): Promise<void>;
}

// 基础类型定义
export interface TEEPlatform {
  platform_id: string;
  platform_type: 'SGX' | 'SEV' | 'TRUSTZONE' | 'KEYSTONE';
  version: string;
  capabilities: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  created_at: Date;
}

export interface SecureEnvironment {
  environment_id: string;
  platform_id: string;
  environment_type: string;
  status: 'INITIALIZING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  measurement: string;
  created_at: Date;
}

export interface SecureEnvironmentConfig {
  platform_type: 'SGX' | 'SEV' | 'TRUSTZONE';
  environment_name: string;
  memory_size: number;
  cpu_count?: number;
  security_policy: SecurityPolicy;
  initial_code?: Uint8Array;
}

export interface SecurityPolicy {
  debug_allowed: boolean;
  production_signed: boolean;
  min_security_version: number;
  allowed_measurements: string[];
}

export interface AttestationRequest {
  environment_id: string;
  report_data?: Uint8Array;
  nonce?: Uint8Array;
  attestation_type: 'LOCAL' | 'REMOTE';
}

export interface AttestationResult {
  is_valid: boolean;
  confidence_score: number;
  verification_time_ms: number;
  platform_verified: boolean;
  measurement_verified: boolean;
  signature_verified: boolean;
  certificate_verified: boolean;
  error_details?: string[];
}

export interface BatchAttestationResult {
  total_attestations: number;
  valid_attestations: number;
  invalid_attestations: number;
  batch_verification_time_ms: number;
  individual_results: AttestationResult[];
}

export interface SecureChannel {
  channel_id: string;
  environment_id: string;
  remote_identity: string;
  encryption_algorithm: string;
  status: 'ESTABLISHING' | 'ACTIVE' | 'CLOSED';
  created_at: Date;
}

export interface TEEKey {
  key_id: string;
  environment_id: string;
  key_type: 'SYMMETRIC' | 'ASYMMETRIC' | 'SEALING';
  algorithm: string;
  key_size: number;
  created_at: Date;
}

export interface TEEHealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  platforms: Record<string, PlatformHealth>;
  environments: Record<string, EnvironmentHealth>;
  overall_score: number;
  last_check: Date;
}

export interface PlatformHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  cpu_usage: number;
  memory_usage: number;
  active_environments: number;
  error_rate: number;
}

export interface EnvironmentHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  uptime_ms: number;
  memory_usage: number;
  last_attestation: Date;
}

export interface TEEStatistics {
  total_platforms: number;
  active_platforms: number;
  total_environments: number;
  active_environments: number;
  total_attestations_generated: number;
  total_attestations_verified: number;
  successful_verifications: number;
  failed_verifications: number;
  average_attestation_time: number;
  average_verification_time: number;
  secure_channels_established: number;
  keys_generated: number;
  platform_stats: Record<string, PlatformStatistics>;
}

export interface PlatformStatistics {
  environments_created: number;
  attestations_generated: number;
  attestations_verified: number;
  uptime_percentage: number;
  average_response_time: number;
}

// SGX特定类型
export interface SGXEnclaveConfig {
  enclave_name: string;
  enclave_file: string;
  heap_size: number;
  stack_size: number;
  debug_mode: boolean;
  production_mode: boolean;
}

export interface SGXEnclaveInstance {
  enclave_id: string;
  enclave_token: Uint8Array;
  measurement: string;
  signer: string;
  product_id: number;
  security_version: number;
  status: 'CREATED' | 'INITIALIZED' | 'DESTROYED';
}

export interface SGXQuote {
  version: number;
  sign_type: number;
  epid_group_id: Uint8Array;
  qe_svn: number;
  pce_svn: number;
  basename: Uint8Array;
  report_body: SGXReportBody;
  signature: Uint8Array;
}

export interface SGXReportBody {
  cpu_svn: Uint8Array;
  misc_select: number;
  attributes: Uint8Array;
  mr_enclave: Uint8Array;
  mr_signer: Uint8Array;
  isv_prod_id: number;
  isv_svn: number;
  report_data: Uint8Array;
}

export interface SealedData {
  sealed_data: Uint8Array;
  additional_mac_text: Uint8Array;
  key_policy: number;
  key_id: Uint8Array;
}

export interface SealingPolicy {
  policy_type: 'MRENCLAVE' | 'MRSIGNER';
  additional_mac_text?: Uint8Array;
}

// SEV特定类型
export interface SEVVMConfig {
  vm_name: string;
  memory_size: number;
  cpu_count: number;
  policy: SEVPolicy;
  owner_public_key?: Uint8Array;
}

export interface SEVVMInstance {
  vm_id: string;
  handle: number;
  policy: SEVPolicy;
  measurement: string;
  status: 'CREATED' | 'LAUNCHED' | 'RUNNING' | 'DESTROYED';
}

export interface SEVPolicy {
  flags: number;
  minfw: number;
  guest_svn: number;
}

export interface MigrationPackage {
  vm_id: string;
  encrypted_state: Uint8Array;
  transport_key: Uint8Array;
  policy: SEVPolicy;
}

// TrustZone特定类型
export interface TrustedApplicationConfig {
  ta_name: string;
  ta_uuid: string;
  ta_binary: Uint8Array;
  stack_size: number;
  heap_size: number;
  permissions: string[];
}

// 其他辅助类型
export interface MultiPlatformOperation {
  operation_id: string;
  operation_type: string;
  platforms: string[];
  parameters: any;
  coordination_policy: 'ALL' | 'MAJORITY' | 'ANY';
}

export interface OperationResult {
  operation_id: string;
  success: boolean;
  results: Record<string, any>;
  execution_time_ms: number;
}

export interface PlatformRequirements {
  min_security_level: number;
  required_capabilities: string[];
  performance_requirements: PerformanceRequirements;
  availability_requirements: AvailabilityRequirements;
}

export interface PerformanceRequirements {
  max_latency_ms: number;
  min_throughput: number;
  max_cpu_usage: number;
  max_memory_usage: number;
}

export interface AvailabilityRequirements {
  min_uptime_percentage: number;
  max_recovery_time_ms: number;
  redundancy_required: boolean;
}

export interface TEEWorkload {
  workload_id: string;
  workload_type: string;
  resource_requirements: ResourceRequirements;
  security_requirements: SecurityRequirements;
  data: Uint8Array;
}

export interface ResourceRequirements {
  cpu_cores: number;
  memory_mb: number;
  storage_mb: number;
  network_bandwidth_mbps: number;
}

export interface SecurityRequirements {
  attestation_required: boolean;
  encryption_required: boolean;
  isolation_level: 'PROCESS' | 'VM' | 'HARDWARE';
  trusted_computing_base_size: 'MINIMAL' | 'MODERATE' | 'LARGE';
}

export interface WorkloadDistribution {
  distribution_id: string;
  workload_assignments: WorkloadAssignment[];
  load_balancing_strategy: string;
  estimated_completion_time_ms: number;
}

export interface WorkloadAssignment {
  platform_id: string;
  environment_id: string;
  workload_portion: number; // 0-1之间的比例
  estimated_execution_time_ms: number;
}

export interface PlatformPerformanceMetrics {
  timestamp: Date;
  platform_metrics: Record<string, PlatformMetrics>;
  overall_performance_score: number;
}

export interface PlatformMetrics {
  cpu_utilization: number;
  memory_utilization: number;
  network_throughput: number;
  attestation_latency: number;
  error_rate: number;
  availability: number;
}

export interface AttestationPolicy {
  require_debug_disabled: boolean;
  require_production_signed: boolean;
  min_security_version: number;
  allowed_measurements: string[];
  trusted_signers: string[];
  max_attestation_age_ms: number;
}

export interface TEECertificate {
  certificate_id: string;
  platform_type: string;
  certificate_data: Uint8Array;
  issuer: string;
  subject: string;
  valid_from: Date;
  valid_to: Date;
  is_revoked: boolean;
}

export interface QuoteVerificationResult {
  is_valid: boolean;
  quote_status: string;
  platform_info_blob?: Uint8Array;
  revocation_reason?: string;
  advisory_ids?: string[];
}