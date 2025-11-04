/**
 * TitanChain Zero-Knowledge Proof Module
 * 零知识证明模块 - 提供ZK-SNARK、ZK-STARK、PLONK等证明系统
 */

// Re-export from shared ZK modules
export * from '../../shared/security/zk-proof/index';
export * from '../../shared/security/zk-proof/zk-proof-system';
export * from '../../shared/security/zk-proof/snark-generator';
export * from '../../shared/security/zk-proof/stark-generator';
export * from '../../shared/security/zk-proof/plonk-generator';

// Import specific classes for aliasing
import { ZKProofSystem } from '../../shared/security/zk-proof/zk-proof-system';
import { SNARKGenerator } from '../../shared/security/zk-proof/snark-generator';
import { STARKGenerator } from '../../shared/security/zk-proof/stark-generator';
import { PLONKGenerator } from '../../shared/security/zk-proof/plonk-generator';
import { CircuitManager } from '../../shared/security/zk-proof/circuit-manager';

/**
 * ZK Manager - Main interface for zero-knowledge proof systems
 * ZK管理器 - 零知识证明系统的主要接口
 */
export class ZKManager extends ZKProofSystem {
  // SNARK proof system
  private snarkGenerator: SNARKGenerator;
  
  // STARK proof system
  private starkGenerator: STARKGenerator;
  
  // PLONK proof system
  private plonkGenerator: PLONKGenerator;
  
  // Circuit manager for ZK circuits
  private circuitManager: CircuitManager;

  constructor(config?: any) {
    super(config);
    this.snarkGenerator = new SNARKGenerator();
    this.starkGenerator = new STARKGenerator();
    this.plonkGenerator = new PLONKGenerator();
    this.circuitManager = new CircuitManager();
  }

  /**
   * Generate SNARK proof
   * 生成SNARK证明
   */
  async snarkProof(circuit: string, witness: any, provingKey: string): Promise<any> {
    return this.snarkGenerator.generateProof({
      circuit,
      witness,
      provingKey
    });
  }

  /**
   * Generate STARK proof
   * 生成STARK证明
   */
  async starkProof(computation: string, trace: any): Promise<any> {
    return this.starkGenerator.generateProof({
      computation,
      trace
    });
  }

  /**
   * Generate PLONK proof
   * 生成PLONK证明
   */
  async plonkProof(circuit: string, witness: any, setup: string): Promise<any> {
    return this.plonkGenerator.generateProof({
      circuit,
      witness,
      setup
    });
  }

  /**
   * Generate proof using specified system
   * 使用指定系统生成证明
   */
  async generateProof(
    system: 'snark' | 'stark' | 'plonk',
    params: {
      circuit?: string;
      witness: any;
      provingKey?: string;
      computation?: string;
      trace?: any;
      setup?: string;
    }
  ): Promise<any> {
    switch (system) {
      case 'snark':
        return this.snarkProof(params.circuit!, params.witness, params.provingKey!);
      case 'stark':
        return this.starkProof(params.computation!, params.trace);
      case 'plonk':
        return this.plonkProof(params.circuit!, params.witness, params.setup!);
      default:
        throw new Error(`Unsupported ZK proof system: ${system}`);
    }
  }

  /**
   * Verify proof using specified system
   * 使用指定系统验证证明
   */
  async verifyProof(
    system: 'snark' | 'stark' | 'plonk',
    proof: any,
    publicInputs: any,
    verificationKey: string
  ): Promise<boolean> {
    switch (system) {
      case 'snark':
        return this.snarkGenerator.verifyProof(proof, publicInputs, verificationKey);
      case 'stark':
        return this.starkGenerator.verifyProof(proof, publicInputs);
      case 'plonk':
        return this.plonkGenerator.verifyProof(proof, publicInputs, verificationKey);
      default:
        throw new Error(`Unsupported ZK proof system: ${system}`);
    }
  }

  /**
   * Create ZK circuit for computation
   * 为计算创建ZK电路
   */
  async zkCircuit(
    computation: string,
    inputs: string[],
    outputs: string[],
    constraints: any[]
  ): Promise<string> {
    return this.circuitManager.createCircuit({
      computation,
      inputs,
      outputs,
      constraints
    });
  }

  /**
   * Compile circuit for specific proof system
   * 为特定证明系统编译电路
   */
  async compileCircuit(
    circuit: string,
    system: 'snark' | 'stark' | 'plonk'
  ): Promise<any> {
    return this.circuitManager.compileCircuit(circuit, system);
  }

  /**
   * Setup trusted setup for SNARK/PLONK (if required)
   * 为SNARK/PLONK设置可信设置（如果需要）
   */
  async setupTrustedSetup(circuit: string, system: 'snark' | 'plonk'): Promise<{
    provingKey: string;
    verificationKey: string;
  }> {
    if (system === 'snark') {
      return this.snarkGenerator.setupTrustedSetup(circuit);
    } else if (system === 'plonk') {
      return this.plonkGenerator.setupTrustedSetup(circuit);
    } else {
      throw new Error(`Trusted setup not required for ${system}`);
    }
  }
}