/**
 * TitanChain MPC (Multi-Party Computation) Module
 * MPC多方计算模块 - 提供安全的多方计算功能
 */

// Re-export from shared MPC modules
export * from '../../shared/security/mpc/index';
export * from '../../shared/security/mpc/mpc-system';
export * from '../../shared/security/mpc/shamir-secret-sharing';
export * from '../../shared/security/mpc/threshold-signature';
export * from '../../shared/security/mpc/garbled-circuits';

// Import specific classes for aliasing
import { MPCSystem } from '../../shared/security/mpc/mpc-system';
import { ShamirSecretSharing } from '../../shared/security/mpc/shamir-secret-sharing';
import { ThresholdSignature } from '../../shared/security/mpc/threshold-signature';
import { GarbledCircuits } from '../../shared/security/mpc/garbled-circuits';

/**
 * MPC Manager - Main interface for multi-party computation
 * MPC管理器 - 多方计算的主要接口
 */
export class MPCManager extends MPCSystem {
  // Shamir Secret Sharing implementation
  public shamirSecretSharing: ShamirSecretSharing;
  
  // BGW Protocol (Boolean Garbled Wires) - implemented via garbled circuits
  public bgwProtocol: GarbledCircuits;
  
  // ABY3 Protocol - three-party computation protocol
  public aby3Protocol: ThresholdSignature;

  constructor(config?: any) {
    super(config);
    this.shamirSecretSharing = new ShamirSecretSharing();
    this.bgwProtocol = new GarbledCircuits();
    this.aby3Protocol = new ThresholdSignature();
  }

  /**
   * Generate secret shares using Shamir's scheme
   * 使用Shamir方案生成秘密份额
   */
  async generateShares(secret: string, threshold: number, totalShares: number): Promise<string[]> {
    return this.shamirSecretSharing.generateShares(secret, threshold, totalShares);
  }

  /**
   * Reconstruct secret from shares
   * 从份额重构秘密
   */
  async reconstructSecret(shares: string[], threshold: number): Promise<string> {
    return this.shamirSecretSharing.reconstructSecret(shares, threshold);
  }

  /**
   * Perform multi-party computation
   * 执行多方计算
   */
  async multiPartyComputation(
    parties: string[],
    computation: string,
    inputs: Record<string, any>
  ): Promise<any> {
    return this.performComputation({
      parties,
      computation,
      inputs,
      protocol: 'shamir'
    });
  }
}