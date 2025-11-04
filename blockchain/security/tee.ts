/**
 * TitanChain TEE (Trusted Execution Environment) Module
 * TEE可信执行环境模块 - 提供硬件级安全执行环境
 */

// Re-export from shared TEE modules
export * from '../../shared/security/tee/index';
export * from '../../shared/security/tee/tee-system';
export * from '../../shared/security/tee/sgx-enclave';
export * from '../../shared/security/tee/sev-secure-vm';
export * from '../../shared/security/tee/trustzone-secure-world';

// Import specific classes for aliasing
import { TEESystem } from '../../shared/security/tee/tee-system';
import { SGXEnclave } from '../../shared/security/tee/sgx-enclave';
import { SEVSecureVM } from '../../shared/security/tee/sev-secure-vm';
import { TrustZoneSecureWorld } from '../../shared/security/tee/trustzone-secure-world';

/**
 * TEE Manager - Main interface for trusted execution environments
 * TEE管理器 - 可信执行环境的主要接口
 */
export class TEEManager extends TEESystem {
  // Intel SGX Enclave support
  public sgxEnclave: SGXEnclave;
  
  // AMD SEV Secure Memory support
  public sevSecureMemory: SEVSecureVM;
  
  // ARM TrustZone Secure World support
  public trustZoneSecureWorld: TrustZoneSecureWorld;

  constructor(config?: any) {
    super(config);
    this.sgxEnclave = new SGXEnclave();
    this.sevSecureMemory = new SEVSecureVM();
    this.trustZoneSecureWorld = new TrustZoneSecureWorld();
  }

  /**
   * Create secure enclave for protected execution
   * 创建安全飞地用于受保护执行
   */
  async createSecureEnclave(
    code: string,
    data: any,
    platform: 'sgx' | 'sev' | 'trustzone' = 'sgx'
  ): Promise<string> {
    switch (platform) {
      case 'sgx':
        return this.sgxEnclave.createEnclave(code, data);
      case 'sev':
        return this.sevSecureMemory.createSecureVM(code, data);
      case 'trustzone':
        return this.trustZoneSecureWorld.createSecureWorld(code, data);
      default:
        throw new Error(`Unsupported TEE platform: ${platform}`);
    }
  }

  /**
   * Perform attestation to verify enclave integrity
   * 执行证明以验证飞地完整性
   */
  async attestation(enclaveId: string, platform: 'sgx' | 'sev' | 'trustzone' = 'sgx'): Promise<any> {
    switch (platform) {
      case 'sgx':
        return this.sgxEnclave.generateAttestation(enclaveId);
      case 'sev':
        return this.sevSecureMemory.generateAttestation(enclaveId);
      case 'trustzone':
        return this.trustZoneSecureWorld.generateAttestation(enclaveId);
      default:
        throw new Error(`Unsupported TEE platform: ${platform}`);
    }
  }

  /**
   * Execute code securely within TEE
   * 在TEE内安全执行代码
   */
  async secureExecution(
    enclaveId: string,
    operation: string,
    params: any,
    platform: 'sgx' | 'sev' | 'trustzone' = 'sgx'
  ): Promise<any> {
    switch (platform) {
      case 'sgx':
        return this.sgxEnclave.executeSecurely(enclaveId, operation, params);
      case 'sev':
        return this.sevSecureMemory.executeSecurely(enclaveId, operation, params);
      case 'trustzone':
        return this.trustZoneSecureWorld.executeSecurely(enclaveId, operation, params);
      default:
        throw new Error(`Unsupported TEE platform: ${platform}`);
    }
  }
}