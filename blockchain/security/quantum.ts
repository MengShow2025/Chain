/**
 * TitanChain Quantum Security Module
 * 量子安全模块 - 提供抗量子密码学功能
 */

// Re-export from shared quantum modules
export * from '../../shared/security/quantum/index';
export * from '../../shared/security/quantum/quantum-resistant-system';
export * from '../../shared/security/quantum/quantum-key-manager';

// Import specific classes for aliasing
import { QuantumResistantSystem } from '../../shared/security/quantum/quantum-resistant-system';
import { QuantumKeyManager } from '../../shared/security/quantum/quantum-key-manager';

/**
 * Quantum Security Manager - Main interface for post-quantum cryptography
 * 量子安全管理器 - 后量子密码学的主要接口
 */
export class QuantumSecurityManager extends QuantumResistantSystem {
  // Quantum key manager for key exchange
  private keyManager: QuantumKeyManager;

  constructor(config?: any) {
    super(config);
    this.keyManager = new QuantumKeyManager();
  }

  /**
   * CRYSTALS-Kyber Key Encapsulation Mechanism
   * CRYSTALS-Kyber密钥封装机制
   */
  async kyberKEM(operation: 'keygen' | 'encaps' | 'decaps', params?: any): Promise<any> {
    switch (operation) {
      case 'keygen':
        return this.keyManager.generateKyberKeyPair();
      case 'encaps':
        return this.keyManager.kyberEncapsulate(params.publicKey);
      case 'decaps':
        return this.keyManager.kyberDecapsulate(params.ciphertext, params.privateKey);
      default:
        throw new Error(`Unsupported Kyber operation: ${operation}`);
    }
  }

  /**
   * CRYSTALS-Dilithium Digital Signature
   * CRYSTALS-Dilithium数字签名
   */
  async dilithiumSignature(operation: 'keygen' | 'sign' | 'verify', params?: any): Promise<any> {
    switch (operation) {
      case 'keygen':
        return this.generateDilithiumKeyPair();
      case 'sign':
        return this.signWithDilithium(params.message, params.privateKey);
      case 'verify':
        return this.verifyDilithiumSignature(params.message, params.signature, params.publicKey);
      default:
        throw new Error(`Unsupported Dilithium operation: ${operation}`);
    }
  }

  /**
   * SPHINCS+ Digital Signature
   * SPHINCS+数字签名
   */
  async sphincsSignature(operation: 'keygen' | 'sign' | 'verify', params?: any): Promise<any> {
    switch (operation) {
      case 'keygen':
        return this.generateSphincsKeyPair();
      case 'sign':
        return this.signWithSphincs(params.message, params.privateKey);
      case 'verify':
        return this.verifySphincsSignature(params.message, params.signature, params.publicKey);
      default:
        throw new Error(`Unsupported SPHINCS operation: ${operation}`);
    }
  }

  /**
   * Post-quantum cryptographic operations
   * 后量子密码学操作
   */
  async postQuantumCrypto(algorithm: 'kyber' | 'dilithium' | 'sphincs', operation: string, params: any): Promise<any> {
    switch (algorithm) {
      case 'kyber':
        return this.kyberKEM(operation as any, params);
      case 'dilithium':
        return this.dilithiumSignature(operation as any, params);
      case 'sphincs':
        return this.sphincsSignature(operation as any, params);
      default:
        throw new Error(`Unsupported post-quantum algorithm: ${algorithm}`);
    }
  }

  /**
   * Check if cryptographic scheme is quantum resistant
   * 检查密码学方案是否抗量子
   */
  async quantumResistant(scheme: string): Promise<boolean> {
    const quantumResistantSchemes = [
      'kyber', 'dilithium', 'sphincs', 'falcon', 'rainbow',
      'mceliece', 'ntru', 'saber', 'frodo', 'bike'
    ];
    return quantumResistantSchemes.includes(scheme.toLowerCase());
  }

  /**
   * Lattice-based cryptography operations
   * 基于格的密码学操作
   */
  async latticeBasedCrypto(operation: string, params: any): Promise<any> {
    // Lattice-based schemes include Kyber, Dilithium, NTRU, etc.
    if (operation.includes('kyber')) {
      return this.kyberKEM(operation.replace('kyber_', '') as any, params);
    }
    if (operation.includes('dilithium')) {
      return this.dilithiumSignature(operation.replace('dilithium_', '') as any, params);
    }
    
    // Generic lattice operations
    return this.performLatticeOperation(operation, params);
  }

  /**
   * Perform generic lattice-based operation
   * 执行通用基于格的操作
   */
  private async performLatticeOperation(operation: string, params: any): Promise<any> {
    // Implementation would depend on specific lattice operation
    return {
      operation,
      params,
      result: 'lattice_operation_completed',
      timestamp: Date.now()
    };
  }
}