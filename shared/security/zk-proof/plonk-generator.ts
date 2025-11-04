/**
 * PLONK证明生成器
 */

import { EventEmitter } from 'events';
import { 
  PLONKProof, 
  ZKCircuit, 
  ZKWitness, 
  ZKConfig,
  SecurityEvent, 
  ZKError 
} from '../types/index.js';

export interface IPLONKGenerator {
  generateProof(circuit: ZKCircuit, witness: ZKWitness): Promise<PLONKProof>;
  verifyProof(proof: PLONKProof, publicInputs: Uint8Array): Promise<boolean>;
  setupCircuit(circuitDefinition: any): Promise<ZKCircuit>;
  updateCircuit(circuitId: string, newConstraints: any): Promise<ZKCircuit>;
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, any>;
    statistics: any;
  }>;
}

export class PLONKGenerator extends EventEmitter implements IPLONKGenerator {
  private config: ZKConfig;
  private circuits: Map<string, ZKCircuit> = new Map();
  private proofCache: Map<string, PLONKProof> = new Map();
  private universalSRS: any; // Universal Structured Reference String
  private maxCircuitSize: number;

  constructor(config: ZKConfig) {
    super();
    this.config = config;
    this.maxCircuitSize = 2 ** 20; // 支持最大100万个约束
    this.initializeGenerator();
  }

  private async initializeGenerator(): Promise<void> {
    try {
      console.log('Initializing PLONK Generator...');
      console.log('Max circuit size:', this.maxCircuitSize);
      console.log('Curve type:', this.config.curve_type);
      
      // 初始化通用SRS
      await this.initializeUniversalSRS();
      
      // 预加载常用电路
      await this.preloadCircuits();
      
      this.emit('generator_initialized', {
        max_circuit_size: this.maxCircuitSize,
        curve_type: this.config.curve_type,
        proof_system: 'PLONK'
      });
      
      console.log('PLONK Generator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PLONK Generator:', error);
      throw new ZKError('PLONK Generator initialization failed', error);
    }
  }

  private async initializeUniversalSRS(): Promise<void> {
    // 初始化通用结构化参考字符串
    console.log('Initializing Universal SRS...');
    
    // 模拟SRS生成（实际需要可信设置仪式）
    await new Promise(resolve => setTimeout(resolve, 300));
    
    this.universalSRS = {
      g1_powers: Array(this.maxCircuitSize).fill(null).map(() => new Uint8Array(64)), // G1群元素
      g2_powers: Array(this.maxCircuitSize).fill(null).map(() => new Uint8Array(128)), // G2群元素
      max_degree: this.maxCircuitSize - 1,
      curve: this.config.curve_type,
      ceremony_id: 'universal_srs_' + Date.now()
    };
    
    console.log(`Universal SRS initialized with max degree: ${this.universalSRS.max_degree}`);
  }

  private async preloadCircuits(): Promise<void> {
    // 预加载PLONK优化的电路
    const plonkCircuits = [
      {
        circuit_id: 'arithmetic_plonk',
        name: 'Arithmetic Circuit PLONK',
        description: 'General arithmetic operations with PLONK',
        constraints: 1000,
        public_inputs: 3,
        private_inputs: 5,
        gates: ['add', 'mul', 'constant']
      },
      {
        circuit_id: 'lookup_plonk',
        name: 'Lookup Table PLONK',
        description: 'Circuit with lookup tables',
        constraints: 2000,
        public_inputs: 2,
        private_inputs: 8,
        gates: ['add', 'mul', 'lookup']
      },
      {
        circuit_id: 'custom_gate_plonk',
        name: 'Custom Gate PLONK',
        description: 'Circuit with custom gates',
        constraints: 1500,
        public_inputs: 4,
        private_inputs: 6,
        gates: ['add', 'mul', 'custom_xor', 'custom_and']
      }
    ];

    for (const circuitDef of plonkCircuits) {
      try {
        const circuit = await this.setupCircuit(circuitDef);
        console.log(`Preloaded PLONK circuit: ${circuit.circuit_id}`);
      } catch (error) {
        console.warn(`Failed to preload PLONK circuit ${circuitDef.circuit_id}:`, error);
      }
    }
  }

  async setupCircuit(circuitDefinition: any): Promise<ZKCircuit> {
    const startTime = Date.now();
    
    try {
      const circuitId = circuitDefinition.circuit_id || this.generateCircuitId();
      
      // 检查是否已存在
      if (this.circuits.has(circuitId)) {
        return this.circuits.get(circuitId)!;
      }

      // 验证电路大小
      if (circuitDefinition.constraints > this.maxCircuitSize) {
        throw new ZKError(`Circuit too large: ${circuitDefinition.constraints} > ${this.maxCircuitSize}`);
      }
      
      // 编译PLONK电路
      const plonkCircuit = await this.compilePLONKCircuit(circuitDefinition);
      
      // 从通用SRS派生电路特定的密钥
      const circuitKeys = await this.deriveCircuitKeys(plonkCircuit);
      
      // 创建电路对象
      const circuit: ZKCircuit = {
        circuit_id: circuitId,
        name: circuitDefinition.name,
        description: circuitDefinition.description,
        constraints: circuitDefinition.constraints,
        public_inputs: circuitDefinition.public_inputs,
        private_inputs: circuitDefinition.private_inputs,
        compiled_circuit: plonkCircuit,
        setup_key: circuitKeys,
        created_at: new Date(),
        is_active: true
      };

      // 存储电路
      this.circuits.set(circuitId, circuit);

      const setupTime = Date.now() - startTime;
      
      // 发出事件
      this.emit('circuit_setup', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          circuit_id: circuitId,
          name: circuit.name,
          constraints: circuit.constraints,
          gates: circuitDefinition.gates,
          setup_time_ms: setupTime,
          proof_system: 'PLONK'
        },
        severity: 'INFO'
      } as SecurityEvent);

      console.log(`PLONK circuit setup completed: ${circuitId} (${circuit.constraints} constraints) in ${setupTime}ms`);
      return circuit;
      
    } catch (error) {
      const setupTime = Date.now() - startTime;
      console.error('PLONK circuit setup failed:', error);
      
      this.emit('circuit_setup_failed', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          circuit_definition: circuitDefinition,
          error: error.message,
          setup_time_ms: setupTime,
          proof_system: 'PLONK'
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new ZKError(`PLONK circuit setup failed: ${error.message}`, error);
    }
  }

  private async compilePLONKCircuit(circuitDefinition: any): Promise<any> {
    // 编译PLONK电路
    console.log(`Compiling PLONK circuit: ${circuitDefinition.name}`);
    
    // 模拟电路编译
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const gates = circuitDefinition.gates || ['add', 'mul', 'constant'];
    const constraints = circuitDefinition.constraints;
    
    // 生成选择器多项式
    const selectors = this.generateSelectors(gates, constraints);
    
    // 生成置换多项式
    const permutation = this.generatePermutation(circuitDefinition);
    
    // 生成查找表（如果需要）
    const lookupTables = gates.includes('lookup') ? this.generateLookupTables() : null;
    
    return {
      constraints: constraints,
      public_inputs: circuitDefinition.public_inputs,
      private_inputs: circuitDefinition.private_inputs,
      gates: gates,
      selectors: selectors,
      permutation: permutation,
      lookup_tables: lookupTables,
      domain_size: this.nextPowerOfTwo(constraints + circuitDefinition.public_inputs + 1),
      wire_count: 3 // PLONK使用3个wire: a, b, c
    };
  }

  private generateSelectors(gates: string[], constraints: number): any {
    // 生成选择器多项式
    const selectors = {
      q_l: new Array(constraints).fill(0), // 左wire选择器
      q_r: new Array(constraints).fill(0), // 右wire选择器
      q_o: new Array(constraints).fill(0), // 输出wire选择器
      q_m: new Array(constraints).fill(0), // 乘法选择器
      q_c: new Array(constraints).fill(0)  // 常数选择器
    };
    
    // 根据门类型设置选择器
    for (let i = 0; i < constraints; i++) {
      const gateType = gates[i % gates.length];
      
      switch (gateType) {
        case 'add':
          selectors.q_l[i] = 1;
          selectors.q_r[i] = 1;
          selectors.q_o[i] = -1;
          break;
        case 'mul':
          selectors.q_m[i] = 1;
          selectors.q_o[i] = -1;
          break;
        case 'constant':
          selectors.q_c[i] = Math.floor(Math.random() * 100);
          selectors.q_o[i] = -1;
          break;
        case 'lookup':
          // 查找门的选择器
          selectors.q_l[i] = 1;
          break;
        default:
          // 自定义门
          selectors.q_l[i] = Math.random() > 0.5 ? 1 : 0;
          selectors.q_r[i] = Math.random() > 0.5 ? 1 : 0;
          selectors.q_m[i] = Math.random() > 0.5 ? 1 : 0;
          selectors.q_o[i] = -1;
      }
    }
    
    return selectors;
  }

  private generatePermutation(circuitDefinition: any): any {
    // 生成置换多项式（copy constraints）
    const totalWires = circuitDefinition.constraints * 3; // 每个约束3个wire
    const permutation = Array.from({length: totalWires}, (_, i) => i);
    
    // 随机生成一些copy constraints
    const copyConstraints = Math.floor(circuitDefinition.constraints * 0.3);
    
    for (let i = 0; i < copyConstraints; i++) {
      const wire1 = Math.floor(Math.random() * totalWires);
      const wire2 = Math.floor(Math.random() * totalWires);
      
      // 交换置换
      [permutation[wire1], permutation[wire2]] = [permutation[wire2], permutation[wire1]];
    }
    
    return {
      sigma_1: permutation.slice(0, circuitDefinition.constraints),
      sigma_2: permutation.slice(circuitDefinition.constraints, circuitDefinition.constraints * 2),
      sigma_3: permutation.slice(circuitDefinition.constraints * 2, circuitDefinition.constraints * 3)
    };
  }

  private generateLookupTables(): any {
    // 生成查找表
    return {
      xor_table: Array.from({length: 256}, (_, i) => ({
        input_a: i,
        input_b: (i + 1) % 256,
        output: i ^ ((i + 1) % 256)
      })),
      and_table: Array.from({length: 256}, (_, i) => ({
        input_a: i,
        input_b: (i + 1) % 256,
        output: i & ((i + 1) % 256)
      }))
    };
  }

  private nextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  private async deriveCircuitKeys(plonkCircuit: any): Promise<any> {
    // 从通用SRS派生电路特定的密钥
    console.log('Deriving circuit-specific keys from Universal SRS...');
    
    // 模拟密钥派生
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const domainSize = plonkCircuit.domain_size;
    
    return {
      proving_key: {
        srs_g1: this.universalSRS.g1_powers.slice(0, domainSize),
        srs_g2: this.universalSRS.g2_powers.slice(0, 2),
        selectors: plonkCircuit.selectors,
        permutation: plonkCircuit.permutation,
        domain_size: domainSize
      },
      verification_key: {
        srs_g2: this.universalSRS.g2_powers.slice(0, 2),
        selector_commitments: {
          q_l: new Uint8Array(64),
          q_r: new Uint8Array(64),
          q_o: new Uint8Array(64),
          q_m: new Uint8Array(64),
          q_c: new Uint8Array(64)
        },
        permutation_commitments: {
          sigma_1: new Uint8Array(64),
          sigma_2: new Uint8Array(64),
          sigma_3: new Uint8Array(64)
        },
        domain_size: domainSize
      }
    };
  }

  async generateProof(circuit: ZKCircuit, witness: ZKWitness): Promise<PLONKProof> {
    const startTime = Date.now();
    
    try {
      if (!circuit.is_active) {
        throw new ZKError(`Circuit is not active: ${circuit.circuit_id}`);
      }

      const proofId = this.generateProofId();
      
      // 验证见证数据
      this.validateWitness(circuit, witness);
      
      // 计算wire赋值
      const wireAssignments = await this.computeWireAssignments(circuit, witness);
      
      // 生成PLONK证明
      const proof = await this.generatePLONKProof(circuit, wireAssignments);
      
      // 创建PLONK证明对象
      const plonkProof: PLONKProof = {
        proof_id: proofId,
        circuit_id: circuit.circuit_id,
        proof_type: 'PLONK',
        proof_data: proof,
        public_inputs: this.extractPublicInputs(witness),
        verification_key: circuit.setup_key.verification_key,
        created_at: new Date(),
        is_valid: true
      };

      // 缓存证明
      this.proofCache.set(proofId, plonkProof);

      const generationTime = Date.now() - startTime;
      
      // 发出事件
      this.emit('proof_generated', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          proof_id: proofId,
          circuit_id: circuit.circuit_id,
          proof_type: 'PLONK',
          constraints: circuit.constraints,
          generation_time_ms: generationTime
        },
        severity: 'INFO'
      } as SecurityEvent);

      console.log(`PLONK proof generated: ${proofId} for circuit ${circuit.circuit_id} in ${generationTime}ms`);
      return plonkProof;
      
    } catch (error) {
      const generationTime = Date.now() - startTime;
      console.error('PLONK proof generation failed:', error);
      
      this.emit('proof_generation_failed', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          circuit_id: circuit.circuit_id,
          error: error.message,
          generation_time_ms: generationTime,
          proof_system: 'PLONK'
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new ZKError(`PLONK proof generation failed: ${error.message}`, error);
    }
  }

  private validateWitness(circuit: ZKCircuit, witness: ZKWitness): void {
    // 验证见证数据
    if (!witness.private_inputs || !witness.public_inputs) {
      throw new ZKError('Invalid witness: missing inputs');
    }
    
    if (witness.public_inputs.length !== circuit.public_inputs) {
      throw new ZKError(`Public inputs count mismatch: expected ${circuit.public_inputs}, got ${witness.public_inputs.length}`);
    }
    
    if (witness.private_inputs.length !== circuit.private_inputs) {
      throw new ZKError(`Private inputs count mismatch: expected ${circuit.private_inputs}, got ${witness.private_inputs.length}`);
    }
  }

  private async computeWireAssignments(circuit: ZKCircuit, witness: ZKWitness): Promise<any> {
    // 计算wire赋值
    console.log(`Computing wire assignments for circuit: ${circuit.circuit_id}`);
    
    const plonkCircuit = circuit.compiled_circuit;
    const constraints = plonkCircuit.constraints;
    
    // 初始化wire赋值
    const wireA = new Array(constraints);
    const wireB = new Array(constraints);
    const wireC = new Array(constraints);
    
    // 填充公共输入
    for (let i = 0; i < witness.public_inputs.length; i++) {
      wireA[i] = BigInt(witness.public_inputs[i]);
      wireB[i] = BigInt(0);
      wireC[i] = BigInt(witness.public_inputs[i]);
    }
    
    // 填充私有输入
    let inputIndex = witness.public_inputs.length;
    for (let i = 0; i < witness.private_inputs.length && inputIndex < constraints; i++, inputIndex++) {
      wireA[inputIndex] = BigInt(witness.private_inputs[i]);
      wireB[inputIndex] = BigInt(0);
      wireC[inputIndex] = BigInt(witness.private_inputs[i]);
    }
    
    // 计算剩余的wire赋值
    for (let i = inputIndex; i < constraints; i++) {
      const gateType = plonkCircuit.gates[i % plonkCircuit.gates.length];
      
      switch (gateType) {
        case 'add':
          wireA[i] = wireA[i - 1] || BigInt(1);
          wireB[i] = wireB[i - 1] || BigInt(1);
          wireC[i] = wireA[i] + wireB[i];
          break;
        case 'mul':
          wireA[i] = wireA[i - 1] || BigInt(2);
          wireB[i] = wireB[i - 1] || BigInt(3);
          wireC[i] = wireA[i] * wireB[i];
          break;
        case 'constant':
          wireA[i] = BigInt(0);
          wireB[i] = BigInt(0);
          wireC[i] = BigInt(plonkCircuit.selectors.q_c[i]);
          break;
        default:
          // 自定义门或查找门
          wireA[i] = BigInt(Math.floor(Math.random() * 100));
          wireB[i] = BigInt(Math.floor(Math.random() * 100));
          wireC[i] = wireA[i] ^ wireB[i]; // 示例：XOR操作
      }
    }
    
    // 模拟计算延迟
    await new Promise(resolve => setTimeout(resolve, 80));
    
    return { wireA, wireB, wireC };
  }

  private async generatePLONKProof(circuit: ZKCircuit, wireAssignments: any): Promise<any> {
    // 生成PLONK证明
    console.log(`Generating PLONK proof for circuit: ${circuit.circuit_id}`);
    
    // 模拟PLONK证明生成的各个阶段
    
    // 第1轮：承诺wire多项式
    const round1 = await this.plonkRound1(wireAssignments);
    
    // 第2轮：承诺置换多项式
    const round2 = await this.plonkRound2(circuit, wireAssignments);
    
    // 第3轮：承诺商多项式
    const round3 = await this.plonkRound3(circuit, wireAssignments);
    
    // 第4轮：计算评估证明
    const round4 = await this.plonkRound4(circuit, wireAssignments);
    
    // 第5轮：生成批量开启证明
    const round5 = await this.plonkRound5(circuit, wireAssignments);
    
    return {
      round_1: round1,
      round_2: round2,
      round_3: round3,
      round_4: round4,
      round_5: round5,
      protocol: 'plonk',
      curve: this.config.curve_type
    };
  }

  private async plonkRound1(wireAssignments: any): Promise<any> {
    // PLONK第1轮：承诺wire多项式
    console.log('PLONK Round 1: Committing to wire polynomials...');
    await new Promise(resolve => setTimeout(resolve, 30));
    
    return {
      a_commitment: new Uint8Array(64),
      b_commitment: new Uint8Array(64),
      c_commitment: new Uint8Array(64)
    };
  }

  private async plonkRound2(circuit: ZKCircuit, wireAssignments: any): Promise<any> {
    // PLONK第2轮：承诺置换多项式
    console.log('PLONK Round 2: Committing to permutation polynomial...');
    await new Promise(resolve => setTimeout(resolve, 25));
    
    return {
      z_commitment: new Uint8Array(64)
    };
  }

  private async plonkRound3(circuit: ZKCircuit, wireAssignments: any): Promise<any> {
    // PLONK第3轮：承诺商多项式
    console.log('PLONK Round 3: Committing to quotient polynomial...');
    await new Promise(resolve => setTimeout(resolve, 35));
    
    return {
      t_lo_commitment: new Uint8Array(64),
      t_mid_commitment: new Uint8Array(64),
      t_hi_commitment: new Uint8Array(64)
    };
  }

  private async plonkRound4(circuit: ZKCircuit, wireAssignments: any): Promise<any> {
    // PLONK第4轮：计算评估证明
    console.log('PLONK Round 4: Computing evaluation proofs...');
    await new Promise(resolve => setTimeout(resolve, 20));
    
    return {
      a_eval: new Uint8Array(32),
      b_eval: new Uint8Array(32),
      c_eval: new Uint8Array(32),
      s_sigma1_eval: new Uint8Array(32),
      s_sigma2_eval: new Uint8Array(32),
      z_omega_eval: new Uint8Array(32)
    };
  }

  private async plonkRound5(circuit: ZKCircuit, wireAssignments: any): Promise<any> {
    // PLONK第5轮：生成批量开启证明
    console.log('PLONK Round 5: Generating batch opening proof...');
    await new Promise(resolve => setTimeout(resolve, 40));
    
    return {
      w_zeta_commitment: new Uint8Array(64),
      w_zeta_omega_commitment: new Uint8Array(64)
    };
  }

  private extractPublicInputs(witness: ZKWitness): Uint8Array {
    // 提取公共输入
    const publicInputs = new Uint8Array(witness.public_inputs.length * 32);
    
    for (let i = 0; i < witness.public_inputs.length; i++) {
      const bytes = this.bigIntToBytes(BigInt(witness.public_inputs[i]));
      publicInputs.set(bytes, i * 32);
    }
    
    return publicInputs;
  }

  async verifyProof(proof: PLONKProof, publicInputs: Uint8Array): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!proof.is_valid) {
        return false;
      }

      // 获取电路信息
      const circuit = this.circuits.get(proof.circuit_id);
      if (!circuit) {
        throw new ZKError(`Circuit not found: ${proof.circuit_id}`);
      }

      // 验证公共输入
      if (publicInputs.length !== proof.public_inputs.length) {
        return false;
      }
      
      for (let i = 0; i < publicInputs.length; i++) {
        if (publicInputs[i] !== proof.public_inputs[i]) {
          return false;
        }
      }

      // 执行PLONK验证
      const isValid = await this.performPLONKVerification(proof, circuit);

      const verificationTime = Date.now() - startTime;
      
      // 发出事件
      this.emit('proof_verified', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          proof_id: proof.proof_id,
          circuit_id: proof.circuit_id,
          is_valid: isValid,
          verification_time_ms: verificationTime,
          proof_system: 'PLONK'
        },
        severity: isValid ? 'INFO' : 'WARNING'
      } as SecurityEvent);

      console.log(`PLONK proof verification: ${proof.proof_id} -> ${isValid ? 'VALID' : 'INVALID'} in ${verificationTime}ms`);
      return isValid;
      
    } catch (error) {
      const verificationTime = Date.now() - startTime;
      console.error('PLONK proof verification failed:', error);
      
      this.emit('proof_verification_failed', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          proof_id: proof.proof_id,
          error: error.message,
          verification_time_ms: verificationTime,
          proof_system: 'PLONK'
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new ZKError(`PLONK proof verification failed: ${error.message}`, error);
    }
  }

  private async performPLONKVerification(proof: PLONKProof, circuit: ZKCircuit): Promise<boolean> {
    // 执行PLONK验证
    console.log(`Performing PLONK verification for proof: ${proof.proof_id}`);
    
    // 模拟PLONK验证过程
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const proofData = proof.proof_data;
    
    // 验证证明结构
    if (!proofData.round_1 || !proofData.round_2 || !proofData.round_3 || 
        !proofData.round_4 || !proofData.round_5) {
      return false;
    }
    
    // 验证承诺
    if (!proofData.round_1.a_commitment || !proofData.round_1.b_commitment || 
        !proofData.round_1.c_commitment) {
      return false;
    }
    
    // 验证置换证明
    if (!proofData.round_2.z_commitment) {
      return false;
    }
    
    // 验证商多项式
    if (!proofData.round_3.t_lo_commitment || !proofData.round_3.t_mid_commitment || 
        !proofData.round_3.t_hi_commitment) {
      return false;
    }
    
    // 验证评估
    if (!proofData.round_4.a_eval || !proofData.round_4.b_eval || !proofData.round_4.c_eval) {
      return false;
    }
    
    // 验证批量开启
    if (!proofData.round_5.w_zeta_commitment || !proofData.round_5.w_zeta_omega_commitment) {
      return false;
    }
    
    // 模拟验证成功率
    return Math.random() > 0.008; // 99.2%成功率用于测试
  }

  async updateCircuit(circuitId: string, newConstraints: any): Promise<ZKCircuit> {
    // 更新电路（PLONK支持通用设置，可以更新电路而不需要重新设置）
    const startTime = Date.now();
    
    try {
      const existingCircuit = this.circuits.get(circuitId);
      if (!existingCircuit) {
        throw new ZKError(`Circuit not found: ${circuitId}`);
      }

      console.log(`Updating PLONK circuit: ${circuitId}`);
      
      // 重新编译电路
      const updatedCircuitDef = {
        ...existingCircuit,
        ...newConstraints,
        circuit_id: circuitId
      };
      
      const plonkCircuit = await this.compilePLONKCircuit(updatedCircuitDef);
      
      // 从通用SRS重新派生密钥
      const circuitKeys = await this.deriveCircuitKeys(plonkCircuit);
      
      // 更新电路
      const updatedCircuit: ZKCircuit = {
        ...existingCircuit,
        constraints: newConstraints.constraints || existingCircuit.constraints,
        public_inputs: newConstraints.public_inputs || existingCircuit.public_inputs,
        private_inputs: newConstraints.private_inputs || existingCircuit.private_inputs,
        compiled_circuit: plonkCircuit,
        setup_key: circuitKeys,
        created_at: new Date()
      };
      
      this.circuits.set(circuitId, updatedCircuit);
      
      const updateTime = Date.now() - startTime;
      
      // 发出事件
      this.emit('circuit_updated', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          circuit_id: circuitId,
          old_constraints: existingCircuit.constraints,
          new_constraints: updatedCircuit.constraints,
          update_time_ms: updateTime,
          proof_system: 'PLONK'
        },
        severity: 'INFO'
      } as SecurityEvent);
      
      console.log(`PLONK circuit updated: ${circuitId} in ${updateTime}ms`);
      return updatedCircuit;
      
    } catch (error) {
      const updateTime = Date.now() - startTime;
      console.error('PLONK circuit update failed:', error);
      
      this.emit('circuit_update_failed', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          circuit_id: circuitId,
          error: error.message,
          update_time_ms: updateTime,
          proof_system: 'PLONK'
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new ZKError(`PLONK circuit update failed: ${error.message}`, error);
    }
  }

  private bigIntToBytes(value: bigint): Uint8Array {
    const bytes: number[] = [];
    let temp = value;
    
    if (temp === BigInt(0)) {
      return new Uint8Array(32).fill(0);
    }
    
    while (temp > BigInt(0) && bytes.length < 32) {
      bytes.unshift(Number(temp & BigInt(255)));
      temp = temp >> BigInt(8);
    }
    
    // 填充到32字节
    while (bytes.length < 32) {
      bytes.unshift(0);
    }
    
    return new Uint8Array(bytes);
  }

  private generateCircuitId(): string {
    return 'plonk_circuit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateProofId(): string {
    return 'plonk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateEventId(): string {
    return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 获取统计信息
  getStatistics() {
    const activeCircuits = Array.from(this.circuits.values()).filter(c => c.is_active);
    const totalConstraints = activeCircuits.reduce((sum, c) => sum + c.constraints, 0);
    
    return {
      total_circuits: this.circuits.size,
      active_circuits: activeCircuits.length,
      total_constraints: totalConstraints,
      cached_proofs: this.proofCache.size,
      max_circuit_size: this.maxCircuitSize,
      universal_srs_degree: this.universalSRS?.max_degree || 0,
      curve_type: this.config.curve_type,
      proof_system: 'PLONK'
    };
  }

  // 清理过期缓存
  cleanupCache(maxAge: number = 60 * 60 * 1000): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [proofId, proof] of this.proofCache.entries()) {
      if (now - proof.created_at.getTime() > maxAge) {
        this.proofCache.delete(proofId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired PLONK proofs from cache`);
    }
  }

  // 获取电路信息
  getCircuit(circuitId: string): ZKCircuit | undefined {
    return this.circuits.get(circuitId);
  }

  // Get cached proof / 获取缓存的证明
  getCachedProof(proofId: string): PLONKProof | undefined {
    return this.proofCache.get(proofId);
  }

  // Get universal SRS information / 获取通用SRS信息
  getUniversalSRSInfo() {
    return {
      max_degree: this.universalSRS?.max_degree || 0,
      curve: this.universalSRS?.curve || 'unknown',
      ceremony_id: this.universalSRS?.ceremony_id || 'unknown'
    };
  }

  // Health check method / 健康检查方法
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, any>;
    statistics: any;
  }> {
    try {
      const stats = this.getStatistics();
      const circuitCount = this.circuits.size;
      const cacheSize = this.proofCache.size;
      const srsInfo = this.getUniversalSRSInfo();
      
      // Determine health status / 确定健康状态
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (!this.universalSRS || srsInfo.max_degree === 0) {
        status = 'degraded';
      }
      
      if (circuitCount === 0) {
        status = 'degraded';
      }
      
      if (stats.failed_proofs > stats.successful_proofs * 0.1) {
        status = 'unhealthy';
      }

      return {
        status,
        components: {
          universal_srs: srsInfo,
          max_circuit_size: this.maxCircuitSize,
          circuits_loaded: circuitCount,
          cache_size: cacheSize,
          uptime: Date.now() - stats.system_uptime
        },
        statistics: stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        components: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        statistics: {}
      };
    }
  }
}