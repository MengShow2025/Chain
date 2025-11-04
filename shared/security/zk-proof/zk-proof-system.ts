/**
 * TitanChain ZK证明系统
 * 集成SNARK、STARK、PLONK三种证明系统，以及电路管理器和验证引擎
 */

import { EventEmitter } from 'events';
import { 
  ZKProof, 
  SNARKProof, 
  STARKProof, 
  PLONKProof,
  ZKCircuit, 
  ZKWitness, 
  ZKConfig,
  SecurityEvent, 
  ZKError,
  IZKProofGenerator 
} from '../types/index.js';
import { SNARKGenerator } from './snark-generator.js';
import { STARKGenerator } from './stark-generator.js';
import { PLONKGenerator } from './plonk-generator.js';
import { ZKCircuitManager, IZKCircuitManager } from './circuit-manager.js';
import { ZKVerificationEngine, IZKVerificationEngine, VerificationResult, BatchVerificationResult } from './verification-engine.js';

export interface IZKProofSystem {
  generateProof(proofType: 'SNARK' | 'STARK' | 'PLONK', circuit: ZKCircuit, witness: ZKWitness): Promise<ZKProof>;
  verifyProof(proof: ZKProof, publicInputs: Uint8Array): Promise<VerificationResult>;
  setupCircuit(proofType: 'SNARK' | 'STARK' | 'PLONK', circuitDefinition: any): Promise<ZKCircuit>;
  batchVerify(proofs: ZKProof[], publicInputs: Uint8Array[]): Promise<BatchVerificationResult>;
  getOptimalProofSystem(constraints: number, publicInputs: number): 'SNARK' | 'STARK' | 'PLONK';
  precomputeVerificationKeys(circuits: ZKCircuit[]): Promise<void>;
}

export class ZKProofSystem extends EventEmitter implements IZKProofSystem, IZKProofGenerator {
  private config: ZKConfig;
  private snarkGenerator: SNARKGenerator;
  private starkGenerator: STARKGenerator;
  private plonkGenerator: PLONKGenerator;
  private circuitManager: ZKCircuitManager;
  private verificationEngine: ZKVerificationEngine;
  private isInitialized: boolean = false;
  
  private proofCache: Map<string, ZKProof> = new Map();
  
  private statistics = {
    total_proofs_generated: 0,
    total_proofs_verified: 0,
    total_circuits_loaded: 0,
    average_generation_time: 0,
    average_verification_time: 0,
    snark_proofs: 0,
    stark_proofs: 0,
    plonk_proofs: 0,
    successful_verifications: 0,
    failed_verifications: 0,
    cached_verifications: 0,
    batch_verifications: 0,
    circuits_compiled: 0,
    circuits_cached: 0,
    system_uptime: Date.now()
  };

  constructor(config: ZKConfig) {
    super();
    this.config = config;
    
    // 初始化各个组件
    this.snarkGenerator = new SNARKGenerator(config);
    this.starkGenerator = new STARKGenerator(config);
    this.plonkGenerator = new PLONKGenerator(config);
    this.circuitManager = new ZKCircuitManager(config);
    this.verificationEngine = new ZKVerificationEngine(config);
  }

  async initializeSystem(): Promise<void> {
    if (this.isInitialized) {
      console.log('ZK Proof System already initialized');
      return;
    }

    try {
      console.log('Initializing ZK Proof System...');
      
      // 验证配置
      this.validateConfiguration();
      
      // 初始化各个组件
      await this.initializeComponents();
      
      // 设置事件监听器
      this.setupEventListeners();
      
      // 预加载电路
      await this.preloadCircuits();
      
      this.isInitialized = true;
      
      // 发出系统初始化事件
      this.emit('system_initialized', {
        event_id: this.generateEventId(),
        event_type: 'ZK_SYSTEM_INITIALIZED',
        layer: { level: 1, name: 'ZK-System', description: 'Zero-Knowledge Proof System' },
        timestamp: new Date(),
        data: {
          generators: ['SNARK', 'STARK', 'PLONK'],
          verification_engine: 'enabled',
          circuit_manager: 'enabled',
          config: {
            snark_enabled: this.config.zk.snark.enabled,
            stark_enabled: this.config.zk.stark.enabled,
            plonk_enabled: this.config.zk.plonk.enabled
          }
        },
        severity: 'INFO'
      } as SecurityEvent);
      
      console.log('ZK Proof System initialized successfully with SNARK, STARK, PLONK generators, circuit manager and verification engine');
      
    } catch (error) {
      console.error('Failed to initialize ZK Proof System:', error);
      throw new ZKError(`ZK system initialization failed: ${error.message}`, error);
    }
  }

  private validateConfiguration(): void {
    if (!this.config.zk) {
      throw new ZKError('ZK configuration not found');
    }
    
    if (!this.config.zk.snark && !this.config.zk.stark && !this.config.zk.plonk) {
      throw new ZKError('At least one proof system must be enabled');
    }
    
    if (this.config.security_level < 80) {
      throw new ZKError('Security level must be at least 80 bits');
    }
  }

  private async initializeComponents(): Promise<void> {
    console.log('Initializing ZK components...');
    
    // 组件已经在构造函数中初始化，这里可以添加额外的初始化逻辑
    // 例如：预热各个组件、建立连接等
    
    console.log('All ZK components initialized');
  }

  private setupEventListeners(): void {
    // 监听SNARK生成器事件
    this.snarkGenerator.on('proof_generated', (event) => {
      this.statistics.snark_proofs++;
      this.statistics.total_proofs_generated++;
      this.updateAverageGenerationTime(event.data.generation_time_ms);
      this.emit('proof_generated', event);
    });

    this.snarkGenerator.on('circuit_setup', (event) => {
      this.statistics.circuits_compiled++;
      this.emit('circuit_setup', event);
    });

    // 监听STARK生成器事件
    this.starkGenerator.on('proof_generated', (event) => {
      this.statistics.stark_proofs++;
      this.statistics.total_proofs_generated++;
      this.updateAverageGenerationTime(event.data.generation_time_ms);
      this.emit('proof_generated', event);
    });

    this.starkGenerator.on('circuit_setup', (event) => {
      this.statistics.circuits_compiled++;
      this.emit('circuit_setup', event);
    });

    // 监听PLONK生成器事件
    this.plonkGenerator.on('proof_generated', (event) => {
      this.statistics.plonk_proofs++;
      this.statistics.total_proofs_generated++;
      this.updateAverageGenerationTime(event.data.generation_time_ms);
      this.emit('proof_generated', event);
    });

    this.plonkGenerator.on('circuit_setup', (event) => {
      this.statistics.circuits_compiled++;
      this.emit('circuit_setup', event);
    });

    // 监听验证引擎事件
    this.verificationEngine.on('proof_verified', (event) => {
      this.statistics.total_proofs_verified++;
      this.updateAverageVerificationTime(event.data.verification_time_ms);
      
      if (event.data.is_valid) {
        this.statistics.successful_verifications++;
      } else {
        this.statistics.failed_verifications++;
      }
      
      if (event.data.verification_method === 'cached') {
        this.statistics.cached_verifications++;
      }
      
      this.emit('proof_verified', event);
    });

    this.verificationEngine.on('batch_verification_completed', (event) => {
      this.statistics.batch_verifications++;
      this.emit('batch_verification_completed', event);
    });

    this.verificationEngine.on('verification_error', (event) => {
      this.statistics.failed_verifications++;
      this.emit('verification_error', event);
    });

    // 监听电路管理器事件
    this.circuitManager.on('circuit_compiled', (event) => {
      this.statistics.circuits_compiled++;
      this.emit('circuit_compiled', event);
    });

    this.circuitManager.on('circuit_cached', (event) => {
      this.statistics.circuits_cached++;
      this.emit('circuit_cached', event);
    });

    this.circuitManager.on('circuit_optimized', (event) => {
      this.emit('circuit_optimized', event);
    });
  }

  private updateAverageGenerationTime(newTime: number): void {
    const totalTime = this.statistics.average_generation_time * (this.statistics.total_proofs_generated - 1) + newTime;
    this.statistics.average_generation_time = totalTime / this.statistics.total_proofs_generated;
  }

  private updateAverageVerificationTime(newTime: number): void {
    const totalTime = this.statistics.average_verification_time * (this.statistics.total_proofs_verified - 1) + newTime;
    this.statistics.average_verification_time = totalTime / this.statistics.total_proofs_verified;
  }

  private async preloadCircuits(): Promise<void> {
    // 预加载各种类型的常用电路
    const commonCircuits = [
      // SNARK电路
      {
        proof_type: 'SNARK' as const,
        circuit_id: 'merkle_proof_snark',
        name: 'Merkle Proof SNARK',
        description: 'Prove membership in Merkle tree using SNARK',
        constraints: 1000,
        public_inputs: 2,
        private_inputs: 10
      },
      // STARK电路
      {
        proof_type: 'STARK' as const,
        circuit_id: 'fibonacci_stark',
        name: 'Fibonacci STARK',
        description: 'Prove Fibonacci computation using STARK',
        constraints: 1024,
        public_inputs: 2,
        private_inputs: 1,
        trace_length: 1024
      },
      // PLONK电路
      {
        proof_type: 'PLONK' as const,
        circuit_id: 'arithmetic_plonk',
        name: 'Arithmetic PLONK',
        description: 'General arithmetic operations using PLONK',
        constraints: 1000,
        public_inputs: 3,
        private_inputs: 5,
        gates: ['add', 'mul', 'constant']
      }
    ];

    for (const circuitDef of commonCircuits) {
      try {
        const circuit = await this.setupCircuit(circuitDef.proof_type, circuitDef);
        console.log(`Preloaded ${circuitDef.proof_type} circuit: ${circuit.circuit_id}`);
      } catch (error) {
        console.warn(`Failed to preload ${circuitDef.proof_type} circuit ${circuitDef.circuit_id}:`, error);
      }
    }
  }

  async setupCircuit(proofType: 'SNARK' | 'STARK' | 'PLONK', circuitDefinition: any): Promise<ZKCircuit> {
    try {
      // 首先尝试从电路管理器编译电路
      const circuit = await this.circuitManager.compileCircuit(circuitDefinition);
      
      // 然后在相应的生成器中设置电路
      switch (proofType) {
        case 'SNARK':
          await this.snarkGenerator.setupCircuit(circuitDefinition);
          break;
        case 'STARK':
          await this.starkGenerator.setupCircuit(circuitDefinition);
          break;
        case 'PLONK':
          await this.plonkGenerator.setupCircuit(circuitDefinition);
          break;
        default:
          throw new ZKError(`Unsupported proof type: ${proofType}`);
      }
      
      return circuit;
    } catch (error) {
      console.error(`Failed to setup ${proofType} circuit:`, error);
      throw new ZKError(`Circuit setup failed: ${error.message}`, error);
    }
  }

  async generateProof(proofType: 'SNARK' | 'STARK' | 'PLONK', circuit: ZKCircuit, witness: ZKWitness): Promise<ZKProof> {
    const startTime = Date.now();
    
    try {
      let proof: SNARKProof | STARKProof | PLONKProof;
      
      switch (proofType) {
        case 'SNARK':
          proof = await this.snarkGenerator.generateProof(circuit, witness);
          break;
        case 'STARK':
          proof = await this.starkGenerator.generateProof(circuit, witness);
          break;
        case 'PLONK':
          proof = await this.plonkGenerator.generateProof(circuit, witness);
          break;
        default:
          throw new ZKError(`Unsupported proof type: ${proofType}`);
      }
      
      // 转换为通用ZKProof格式
      const zkProof: ZKProof = {
        proof_id: proof.proof_id,
        proof_type: proof.proof_type,
        proof_data: new Uint8Array(Buffer.from(JSON.stringify(proof.proof_data))),
        public_inputs: proof.public_inputs,
        circuit_hash: this.hashCircuit(circuit),
        verification_key_hash: this.hashVerificationKey(proof.verification_key || new Uint8Array()),
        gas_cost: BigInt(circuit.constraints * this.getGasCostMultiplier(proofType)),
        verification_time_ms: 0, // 将在验证时更新
        created_at: proof.created_at,
        is_valid: proof.is_valid
      };
      
      // 缓存证明
      this.proofCache.set(zkProof.proof_id, zkProof);
      
      const generationTime = Date.now() - startTime;
      
      // 发出统一事件
      this.emit('proof_generated', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          proof_id: zkProof.proof_id,
          proof_type: proofType,
          circuit_id: circuit.circuit_id,
          constraints: circuit.constraints,
          generation_time_ms: generationTime
        },
        severity: 'INFO'
      } as SecurityEvent);
      
      console.log(`${proofType} proof generated: ${zkProof.proof_id} in ${generationTime}ms`);
      return zkProof;
      
    } catch (error) {
      const generationTime = Date.now() - startTime;
      console.error(`${proofType} proof generation failed:`, error);
      
      this.emit('proof_generation_failed', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          proof_type: proofType,
          circuit_id: circuit.circuit_id,
          error: error.message,
          generation_time_ms: generationTime
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new ZKError(`${proofType} proof generation failed: ${error.message}`, error);
    }
  }

  async verifyProof(proof: ZKProof, publicInputs: Uint8Array): Promise<VerificationResult> {
    try {
      // 使用验证引擎进行验证
      const result = await this.verificationEngine.verifyProof(proof, publicInputs);
      
      // 更新缓存的证明
      const cachedProof = this.proofCache.get(proof.proof_id);
      if (cachedProof) {
        cachedProof.is_valid = result.is_valid;
        cachedProof.verification_time_ms = result.verification_time_ms;
      }
      
      return result;
    } catch (error) {
      console.error(`Proof verification failed for ${proof.proof_id}:`, error);
      throw new ZKError(`Proof verification failed: ${error.message}`, error);
    }
  }

  async batchVerify(proofs: ZKProof[], publicInputs: Uint8Array[]): Promise<BatchVerificationResult> {
    try {
      // 使用验证引擎进行批量验证
      return await this.verificationEngine.batchVerify(proofs, publicInputs);
    } catch (error) {
      console.error('Batch verification failed:', error);
      throw new ZKError(`Batch verification failed: ${error.message}`, error);
    }
  }

  async precomputeVerificationKeys(circuits: ZKCircuit[]): Promise<void> {
    try {
      // 使用验证引擎预计算验证密钥
      await this.verificationEngine.precomputeVerificationKeys(circuits);
      console.log(`Precomputed verification keys for ${circuits.length} circuits`);
    } catch (error) {
      console.error('Failed to precompute verification keys:', error);
      throw new ZKError(`Verification key precomputation failed: ${error.message}`, error);
    }
  }

  getOptimalProofSystem(constraints: number, publicInputs: number): 'SNARK' | 'STARK' | 'PLONK' {
    // 根据约束数量和公共输入数量选择最优的证明系统
    
    // SNARK: 适合小到中等规模的电路，证明大小小，验证快
    if (constraints <= 100000 && publicInputs <= 10) {
      return 'SNARK';
    }
    
    // STARK: 适合大规模电路，无需可信设置，后量子安全
    if (constraints > 100000 || publicInputs > 50) {
      return 'STARK';
    }
    
    // PLONK: 通用设置，支持电路更新，适合中等规模
    return 'PLONK';
  }

  // 兼容性方法（保持与原接口的兼容）
  async generateSNARKProof(circuit: ZKCircuit, witness: ZKWitness): Promise<SNARKProof> {
    const proof = await this.generateProof('SNARK', circuit, witness);
    return this.reconstructSNARKProof(proof);
  }

  async generateSTARKProof(circuit: ZKCircuit, witness: ZKWitness): Promise<STARKProof> {
    const proof = await this.generateProof('STARK', circuit, witness);
    return this.reconstructSTARKProof(proof);
  }

  // 重构证明对象的辅助方法
  private reconstructSNARKProof(proof: ZKProof): SNARKProof {
    const proofData = JSON.parse(Buffer.from(proof.proof_data).toString());
    return {
      proof_id: proof.proof_id,
      circuit_id: '', // 需要从circuit_hash反推
      proof_type: 'SNARK',
      proof_data: proofData,
      public_inputs: proof.public_inputs,
      verification_key: new Uint8Array(), // 需要从verification_key_hash获取
      created_at: proof.created_at,
      is_valid: proof.is_valid
    };
  }

  private reconstructSTARKProof(proof: ZKProof): STARKProof {
    const proofData = JSON.parse(Buffer.from(proof.proof_data).toString());
    return {
      proof_id: proof.proof_id,
      circuit_id: '', // 需要从circuit_hash反推
      proof_type: 'STARK',
      proof_data: proofData,
      public_inputs: proof.public_inputs,
      created_at: proof.created_at,
      is_valid: proof.is_valid
    };
  }

  private reconstructPLONKProof(proof: ZKProof): PLONKProof {
    const proofData = JSON.parse(Buffer.from(proof.proof_data).toString());
    return {
      proof_id: proof.proof_id,
      circuit_id: '', // 需要从circuit_hash反推
      proof_type: 'PLONK',
      proof_data: proofData,
      public_inputs: proof.public_inputs,
      verification_key: new Uint8Array(), // 需要从verification_key_hash获取
      created_at: proof.created_at,
      is_valid: proof.is_valid
    };
  }

  // 辅助方法
  private hashCircuit(circuit: ZKCircuit): string {
    const circuitData = JSON.stringify({
      circuit_id: circuit.circuit_id,
      constraints: circuit.constraints,
      public_inputs: circuit.public_inputs,
      private_inputs: circuit.private_inputs
    });
    
    // 简化的哈希实现
    let hash = 0;
    for (let i = 0; i < circuitData.length; i++) {
      const char = circuitData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return hash.toString(16);
  }

  private hashVerificationKey(key: Uint8Array): string {
    // 简化的哈希实现
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key[i];
      hash = hash & hash;
    }
    
    return hash.toString(16);
  }

  private getGasCostMultiplier(proofType: 'SNARK' | 'STARK' | 'PLONK'): number {
    switch (proofType) {
      case 'SNARK': return 2; // SNARK验证成本较低
      case 'STARK': return 5; // STARK验证成本较高
      case 'PLONK': return 3; // PLONK验证成本中等
      default: return 3;
    }
  }

  private generateEventId(): string {
    return 'zk_event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 获取统计信息
  getStatistics() {
    return {
      ...this.statistics,
      snark_generator: this.snarkGenerator.getStatistics(),
      stark_generator: this.starkGenerator.getStatistics(),
      plonk_generator: this.plonkGenerator.getStatistics(),
      circuit_manager: this.circuitManager.getStatistics(),
      verification_engine: this.verificationEngine.getStatistics(),
      total_cached_proofs: this.proofCache.size
    };
  }

  // 清理过期缓存
  cleanupCache(maxAge: number = 60 * 60 * 1000): void {
    const now = Date.now();
    let cleanedProofs = 0;
    
    // 清理证明缓存
    for (const [proofId, proof] of this.proofCache.entries()) {
      if (now - proof.created_at.getTime() > maxAge) {
        this.proofCache.delete(proofId);
        cleanedProofs++;
      }
    }
    
    // 清理各组件的缓存
    this.snarkGenerator.cleanupCache(maxAge);
    this.starkGenerator.cleanupCache(maxAge);
    this.plonkGenerator.cleanupCache(maxAge);
    this.circuitManager.cleanupCache(maxAge);
    this.verificationEngine.cleanupCache(maxAge);
    
    if (cleanedProofs > 0) {
      console.log(`Cleaned up ${cleanedProofs} expired proofs from ZK system cache`);
    }
  }

  // 获取电路信息
  getCircuit(circuitId: string): ZKCircuit | undefined {
    return this.circuitManager.getCircuit(circuitId) ||
           this.snarkGenerator.getCircuit(circuitId) ||
           this.starkGenerator.getCircuit(circuitId) ||
           this.plonkGenerator.getCircuit(circuitId);
  }

  // 获取缓存的证明
  getCachedProof(proofId: string): ZKProof | undefined {
    return this.proofCache.get(proofId);
  }

  // 系统健康检查
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, any>;
    statistics: any;
  }> {
    try {
      const [
        snarkHealth,
        starkHealth,
        plonkHealth,
        circuitManagerHealth,
        verificationEngineHealth
      ] = await Promise.all([
        this.snarkGenerator.healthCheck(),
        this.starkGenerator.healthCheck(),
        this.plonkGenerator.healthCheck(),
        this.circuitManager.healthCheck(),
        this.verificationEngine.healthCheck()
      ]);
      
      const components = {
        snark_generator: snarkHealth,
        stark_generator: starkHealth,
        plonk_generator: plonkHealth,
        circuit_manager: circuitManagerHealth,
        verification_engine: verificationEngineHealth
      };
      
      // 计算整体健康状态
      const healthyCount = Object.values(components).filter(c => c.status === 'healthy').length;
      const degradedCount = Object.values(components).filter(c => c.status === 'degraded').length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      
      if (healthyCount >= 4) {
        status = 'healthy';
      } else if (healthyCount + degradedCount >= 3) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
      
      return {
        status,
        components,
        statistics: this.getStatistics()
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        components: {},
        statistics: this.getStatistics()
      };
    }
  }
}