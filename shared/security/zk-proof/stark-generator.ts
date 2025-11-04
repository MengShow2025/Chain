/**
 * STARK证明生成器
 */

import { EventEmitter } from 'events';
import { 
  STARKProof, 
  ZKCircuit, 
  ZKWitness, 
  ZKConfig,
  SecurityEvent, 
  ZKError 
} from '../types/index.js';

export interface ISTARKGenerator {
  generateProof(circuit: ZKCircuit, witness: ZKWitness): Promise<STARKProof>;
  verifyProof(proof: STARKProof, publicInputs: Uint8Array): Promise<boolean>;
  setupCircuit(circuitDefinition: any): Promise<ZKCircuit>;
  batchVerify(proofs: STARKProof[], publicInputs: Uint8Array[]): Promise<boolean>;
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, any>;
    statistics: any;
  }>;
}

export class STARKGenerator extends EventEmitter implements ISTARKGenerator {
  private config: ZKConfig;
  private circuits: Map<string, ZKCircuit> = new Map();
  private proofCache: Map<string, STARKProof> = new Map();
  private fieldSize: bigint;
  private extensionDegree: number;

  constructor(config: ZKConfig) {
    super();
    this.config = config;
    this.fieldSize = BigInt('0x800000000000011000000000000000000000000000000000000000000000001'); // STARK-friendly prime
    this.extensionDegree = 3; // 立方扩域
    this.initializeGenerator();
  }

  private async initializeGenerator(): Promise<void> {
    try {
      console.log('Initializing STARK Generator...');
      console.log('Field size:', this.fieldSize.toString(16));
      console.log('Extension degree:', this.extensionDegree);
      
      // 初始化有限域参数
      await this.initializeField();
      
      // 预加载常用电路
      await this.preloadCircuits();
      
      this.emit('generator_initialized', {
        field_size: this.fieldSize.toString(),
        extension_degree: this.extensionDegree,
        proof_system: 'STARK'
      });
      
      console.log('STARK Generator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize STARK Generator:', error);
      throw new ZKError('STARK Generator initialization failed', error);
    }
  }

  private async initializeField(): Promise<void> {
    // 初始化STARK友好的有限域
    console.log('Initializing STARK-friendly field...');
    
    // 验证域大小是素数
    if (!this.isPrime(this.fieldSize)) {
      throw new ZKError('Field size must be prime');
    }
    
    // 验证域支持足够大的乘法子群
    const subgroupSize = this.findLargestSubgroup();
    console.log(`Largest multiplicative subgroup size: 2^${subgroupSize}`);
    
    if (subgroupSize < 20) {
      throw new ZKError('Field does not support large enough subgroups for STARK');
    }
  }

  private isPrime(n: bigint): boolean {
    // 简化的素数检测（实际应使用Miller-Rabin等算法）
    if (n < BigInt(2)) return false;
    if (n === BigInt(2)) return true;
    if (n % BigInt(2) === BigInt(0)) return false;
    
    const sqrt = BigInt(Math.floor(Math.sqrt(Number(n))));
    for (let i = BigInt(3); i <= sqrt; i += BigInt(2)) {
      if (n % i === BigInt(0)) return false;
    }
    return true;
  }

  private findLargestSubgroup(): number {
    // 找到最大的2的幂次子群
    let power = 0;
    let temp = this.fieldSize - BigInt(1);
    
    while (temp % BigInt(2) === BigInt(0)) {
      temp = temp / BigInt(2);
      power++;
    }
    
    return power;
  }

  private async preloadCircuits(): Promise<void> {
    // 预加载STARK优化的电路
    const starkCircuits = [
      {
        circuit_id: 'fibonacci_stark',
        name: 'Fibonacci STARK',
        description: 'Prove Fibonacci sequence computation',
        constraints: 1024, // 2的幂次，STARK友好
        public_inputs: 2,
        private_inputs: 1,
        trace_length: 1024
      },
      {
        circuit_id: 'hash_chain_stark',
        name: 'Hash Chain STARK',
        description: 'Prove hash chain computation',
        constraints: 2048,
        public_inputs: 2,
        private_inputs: 1,
        trace_length: 2048
      },
      {
        circuit_id: 'merkle_stark',
        name: 'Merkle Path STARK',
        description: 'Prove Merkle path without trusted setup',
        constraints: 512,
        public_inputs: 3,
        private_inputs: 20,
        trace_length: 512
      }
    ];

    for (const circuitDef of starkCircuits) {
      try {
        const circuit = await this.setupCircuit(circuitDef);
        console.log(`Preloaded STARK circuit: ${circuit.circuit_id}`);
      } catch (error) {
        console.warn(`Failed to preload STARK circuit ${circuitDef.circuit_id}:`, error);
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

      // 验证电路参数是否STARK友好
      this.validateSTARKCircuit(circuitDefinition);
      
      // 编译AIR (Algebraic Intermediate Representation)
      const airCircuit = await this.compileAIR(circuitDefinition);
      
      // 创建电路对象（STARK不需要可信设置）
      const circuit: ZKCircuit = {
        circuit_id: circuitId,
        name: circuitDefinition.name,
        description: circuitDefinition.description,
        constraints: circuitDefinition.constraints,
        public_inputs: circuitDefinition.public_inputs,
        private_inputs: circuitDefinition.private_inputs,
        compiled_circuit: airCircuit,
        setup_key: null, // STARK不需要可信设置
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
          trace_length: circuitDefinition.trace_length,
          setup_time_ms: setupTime,
          proof_system: 'STARK'
        },
        severity: 'INFO'
      } as SecurityEvent);

      console.log(`STARK circuit setup completed: ${circuitId} (trace length: ${circuitDefinition.trace_length}) in ${setupTime}ms`);
      return circuit;
      
    } catch (error) {
      const setupTime = Date.now() - startTime;
      console.error('STARK circuit setup failed:', error);
      
      this.emit('circuit_setup_failed', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          circuit_definition: circuitDefinition,
          error: error.message,
          setup_time_ms: setupTime,
          proof_system: 'STARK'
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new ZKError(`STARK circuit setup failed: ${error.message}`, error);
    }
  }

  private validateSTARKCircuit(circuitDefinition: any): void {
    // 验证约束数量是2的幂次
    const constraints = circuitDefinition.constraints;
    if (!this.isPowerOfTwo(constraints)) {
      throw new ZKError(`STARK constraints must be power of 2, got ${constraints}`);
    }
    
    // 验证轨迹长度
    const traceLength = circuitDefinition.trace_length || constraints;
    if (!this.isPowerOfTwo(traceLength)) {
      throw new ZKError(`STARK trace length must be power of 2, got ${traceLength}`);
    }
    
    // 验证轨迹长度不超过域的子群大小
    const maxTraceLength = Math.pow(2, this.findLargestSubgroup() - 1);
    if (traceLength > maxTraceLength) {
      throw new ZKError(`Trace length ${traceLength} exceeds maximum ${maxTraceLength}`);
    }
  }

  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  private async compileAIR(circuitDefinition: any): Promise<any> {
    // 编译代数中间表示 (AIR)
    console.log(`Compiling AIR for circuit: ${circuitDefinition.name}`);
    
    // 模拟AIR编译
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const traceLength = circuitDefinition.trace_length || circuitDefinition.constraints;
    
    return {
      trace_length: traceLength,
      trace_width: circuitDefinition.private_inputs + circuitDefinition.public_inputs + 10, // 额外的辅助列
      constraints: this.generateConstraintPolynomials(circuitDefinition),
      boundary_conditions: this.generateBoundaryConditions(circuitDefinition),
      transition_constraints: this.generateTransitionConstraints(circuitDefinition),
      public_inputs_positions: Array.from({length: circuitDefinition.public_inputs}, (_, i) => i)
    };
  }

  private generateConstraintPolynomials(circuitDefinition: any): any[] {
    // 生成约束多项式
    const constraints = [];
    
    // 根据电路类型生成不同的约束
    switch (circuitDefinition.circuit_id) {
      case 'fibonacci_stark':
        constraints.push({
          name: 'fibonacci_constraint',
          degree: 2,
          expression: 'x[i+2] - x[i+1] - x[i]' // f(n+2) = f(n+1) + f(n)
        });
        break;
        
      case 'hash_chain_stark':
        constraints.push({
          name: 'hash_constraint',
          degree: 3,
          expression: 'hash(x[i]) - x[i+1]' // 哈希链约束
        });
        break;
        
      default:
        // 通用约束
        constraints.push({
          name: 'generic_constraint',
          degree: 2,
          expression: 'x[i] * y[i] - z[i]' // 乘法约束
        });
    }
    
    return constraints;
  }

  private generateBoundaryConditions(circuitDefinition: any): any[] {
    // 生成边界条件
    return [
      { position: 0, value: BigInt(1) }, // 初始值
      { position: circuitDefinition.trace_length - 1, value: BigInt(0) } // 最终值
    ];
  }

  private generateTransitionConstraints(circuitDefinition: any): any[] {
    // 生成状态转换约束
    return [
      {
        name: 'state_transition',
        from_step: 'i',
        to_step: 'i+1',
        constraint: 'valid_transition(state[i], state[i+1])'
      }
    ];
  }

  async generateProof(circuit: ZKCircuit, witness: ZKWitness): Promise<STARKProof> {
    const startTime = Date.now();
    
    try {
      if (!circuit.is_active) {
        throw new ZKError(`Circuit is not active: ${circuit.circuit_id}`);
      }

      const proofId = this.generateProofId();
      
      // 验证见证数据
      this.validateWitness(circuit, witness);
      
      // 生成执行轨迹
      const executionTrace = await this.generateExecutionTrace(circuit, witness);
      
      // 计算承诺
      const commitment = await this.computeCommitment(executionTrace);
      
      // 生成FRI证明
      const friProof = await this.generateFRIProof(executionTrace, commitment);
      
      // 创建STARK证明对象
      const starkProof: STARKProof = {
        proof_id: proofId,
        circuit_id: circuit.circuit_id,
        proof_type: 'STARK',
        proof_data: {
          commitment: commitment,
          fri_proof: friProof,
          trace_length: executionTrace.length,
          trace_width: executionTrace[0]?.length || 0
        },
        public_inputs: this.extractPublicInputs(witness),
        created_at: new Date(),
        is_valid: true
      };

      // 缓存证明
      this.proofCache.set(proofId, starkProof);

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
          proof_type: 'STARK',
          trace_length: starkProof.proof_data.trace_length,
          generation_time_ms: generationTime
        },
        severity: 'INFO'
      } as SecurityEvent);

      console.log(`STARK proof generated: ${proofId} for circuit ${circuit.circuit_id} in ${generationTime}ms`);
      return starkProof;
      
    } catch (error) {
      const generationTime = Date.now() - startTime;
      console.error('STARK proof generation failed:', error);
      
      this.emit('proof_generation_failed', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          circuit_id: circuit.circuit_id,
          error: error.message,
          generation_time_ms: generationTime,
          proof_system: 'STARK'
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new ZKError(`STARK proof generation failed: ${error.message}`, error);
    }
  }

  private async generateExecutionTrace(circuit: ZKCircuit, witness: ZKWitness): Promise<bigint[][]> {
    // 生成执行轨迹矩阵
    console.log(`Generating execution trace for circuit: ${circuit.circuit_id}`);
    
    const airCircuit = circuit.compiled_circuit;
    const traceLength = airCircuit.trace_length;
    const traceWidth = airCircuit.trace_width;
    
    // 初始化轨迹矩阵
    const trace: bigint[][] = Array(traceLength).fill(null).map(() => Array(traceWidth).fill(BigInt(0)));
    
    // 填充公共输入
    for (let i = 0; i < witness.public_inputs.length; i++) {
      trace[0][i] = BigInt(witness.public_inputs[i]);
    }
    
    // 填充私有输入
    for (let i = 0; i < witness.private_inputs.length; i++) {
      trace[0][witness.public_inputs.length + i] = BigInt(witness.private_inputs[i]);
    }
    
    // 根据电路类型生成轨迹
    switch (circuit.circuit_id) {
      case 'fibonacci_stark':
        this.generateFibonacciTrace(trace, witness);
        break;
      case 'hash_chain_stark':
        this.generateHashChainTrace(trace, witness);
        break;
      default:
        this.generateGenericTrace(trace, witness);
    }
    
    // 模拟轨迹生成延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return trace;
  }

  private generateFibonacciTrace(trace: bigint[][], witness: ZKWitness): void {
    // 生成斐波那契数列轨迹
    const traceLength = trace.length;
    
    // 初始值
    trace[0][0] = BigInt(witness.private_inputs[0]); // F(0)
    trace[1][0] = BigInt(1); // F(1)
    
    // 计算斐波那契数列
    for (let i = 2; i < traceLength; i++) {
      trace[i][0] = (trace[i-1][0] + trace[i-2][0]) % this.fieldSize;
    }
  }

  private generateHashChainTrace(trace: bigint[][], witness: ZKWitness): void {
    // 生成哈希链轨迹
    const traceLength = trace.length;
    
    // 初始值
    trace[0][0] = BigInt(witness.private_inputs[0]);
    
    // 计算哈希链
    for (let i = 1; i < traceLength; i++) {
      trace[i][0] = this.simpleHash(trace[i-1][0]);
    }
  }

  private generateGenericTrace(trace: bigint[][], witness: ZKWitness): void {
    // 生成通用轨迹
    const traceLength = trace.length;
    const traceWidth = trace[0].length;
    
    for (let i = 1; i < traceLength; i++) {
      for (let j = 0; j < traceWidth; j++) {
        // 简单的状态转换
        trace[i][j] = (trace[i-1][j] * BigInt(2) + BigInt(1)) % this.fieldSize;
      }
    }
  }

  private simpleHash(input: bigint): bigint {
    // 简化的哈希函数（实际应使用Rescue或Poseidon等STARK友好哈希）
    return (input * input + input + BigInt(1)) % this.fieldSize;
  }

  private async computeCommitment(trace: bigint[][]): Promise<any> {
    // 计算Merkle承诺
    console.log('Computing Merkle commitment for execution trace...');
    
    // 模拟承诺计算
    await new Promise(resolve => setTimeout(resolve, 80));
    
    // 简化的Merkle树承诺
    const leaves = trace.map(row => this.hashRow(row));
    const merkleRoot = this.computeMerkleRoot(leaves);
    
    return {
      merkle_root: merkleRoot,
      tree_height: Math.ceil(Math.log2(trace.length)),
      leaf_count: trace.length,
      commitment_scheme: 'merkle_tree'
    };
  }

  private hashRow(row: bigint[]): bigint {
    // 哈希轨迹行
    let hash = BigInt(0);
    for (const value of row) {
      hash = this.simpleHash(hash + value);
    }
    return hash;
  }

  private computeMerkleRoot(leaves: bigint[]): bigint {
    // 计算Merkle根
    if (leaves.length === 0) return BigInt(0);
    if (leaves.length === 1) return leaves[0];
    
    const nextLevel: bigint[] = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = i + 1 < leaves.length ? leaves[i + 1] : left;
      nextLevel.push(this.simpleHash(left + right));
    }
    
    return this.computeMerkleRoot(nextLevel);
  }

  private async generateFRIProof(trace: bigint[][], commitment: any): Promise<any> {
    // 生成FRI (Fast Reed-Solomon Interactive Oracle Proof) 证明
    console.log('Generating FRI proof...');
    
    // 模拟FRI证明生成
    await new Promise(resolve => setTimeout(resolve, 120));
    
    const traceLength = trace.length;
    const rounds = Math.ceil(Math.log2(traceLength)) - 2; // FRI轮数
    
    return {
      rounds: rounds,
      commitments: Array(rounds).fill(null).map(() => ({
        merkle_root: BigInt(Math.floor(Math.random() * 1000000)),
        polynomial_degree: Math.floor(traceLength / Math.pow(2, rounds))
      })),
      final_polynomial: Array(4).fill(null).map(() => BigInt(Math.floor(Math.random() * 1000))),
      query_responses: Array(this.config.security_level || 80).fill(null).map(() => ({
        position: Math.floor(Math.random() * traceLength),
        value: BigInt(Math.floor(Math.random() * 1000)),
        merkle_path: Array(Math.ceil(Math.log2(traceLength))).fill(BigInt(0))
      }))
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

  async verifyProof(proof: STARKProof, publicInputs: Uint8Array): Promise<boolean> {
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

      // 验证FRI证明
      const isValid = await this.verifyFRIProof(proof, circuit);

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
          proof_system: 'STARK'
        },
        severity: isValid ? 'INFO' : 'WARNING'
      } as SecurityEvent);

      console.log(`STARK proof verification: ${proof.proof_id} -> ${isValid ? 'VALID' : 'INVALID'} in ${verificationTime}ms`);
      return isValid;
      
    } catch (error) {
      const verificationTime = Date.now() - startTime;
      console.error('STARK proof verification failed:', error);
      
      this.emit('proof_verification_failed', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          proof_id: proof.proof_id,
          error: error.message,
          verification_time_ms: verificationTime,
          proof_system: 'STARK'
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new ZKError(`STARK proof verification failed: ${error.message}`, error);
    }
  }

  private async verifyFRIProof(proof: STARKProof, circuit: ZKCircuit): Promise<boolean> {
    // 验证FRI证明
    console.log(`Verifying FRI proof for: ${proof.proof_id}`);
    
    // 模拟FRI验证
    await new Promise(resolve => setTimeout(resolve, 60));
    
    const friProof = proof.proof_data.fri_proof;
    
    // 验证FRI轮数
    if (!friProof.rounds || friProof.rounds < 1) {
      return false;
    }
    
    // 验证承诺数量
    if (!friProof.commitments || friProof.commitments.length !== friProof.rounds) {
      return false;
    }
    
    // 验证查询响应
    if (!friProof.query_responses || friProof.query_responses.length < 40) {
      return false; // 安全性要求至少40个查询
    }
    
    // 验证最终多项式
    if (!friProof.final_polynomial || friProof.final_polynomial.length < 1) {
      return false;
    }
    
    // 模拟验证成功率
    return Math.random() > 0.005; // 99.5%成功率用于测试
  }

  async batchVerify(proofs: STARKProof[]): Promise<boolean[]> {
    const startTime = Date.now();
    
    try {
      console.log(`Batch verifying ${proofs.length} STARK proofs...`);
      
      const results: boolean[] = [];
      
      // 并行验证多个证明
      const verificationPromises = proofs.map(async (proof) => {
        try {
          return await this.verifyProof(proof, proof.public_inputs);
        } catch (error) {
          console.error(`Batch verification failed for proof ${proof.proof_id}:`, error);
          return false;
        }
      });
      
      const verificationResults = await Promise.all(verificationPromises);
      results.push(...verificationResults);
      
      const batchTime = Date.now() - startTime;
      const validCount = results.filter(r => r).length;
      
      // 发出批量验证事件
      this.emit('batch_verification', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          total_proofs: proofs.length,
          valid_proofs: validCount,
          invalid_proofs: proofs.length - validCount,
          batch_time_ms: batchTime,
          proof_system: 'STARK'
        },
        severity: 'INFO'
      } as SecurityEvent);
      
      console.log(`Batch verification completed: ${validCount}/${proofs.length} valid in ${batchTime}ms`);
      return results;
      
    } catch (error) {
      const batchTime = Date.now() - startTime;
      console.error('Batch verification failed:', error);
      
      this.emit('batch_verification_failed', {
        event_id: this.generateEventId(),
        event_type: 'ZK_PROOF_GENERATED',
        layer: { level: 1, name: 'ZK-Proof', description: 'Zero-Knowledge Proof Layer' },
        timestamp: new Date(),
        data: {
          total_proofs: proofs.length,
          error: error.message,
          batch_time_ms: batchTime,
          proof_system: 'STARK'
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new ZKError(`Batch verification failed: ${error.message}`, error);
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
    return 'stark_circuit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateProofId(): string {
    return 'stark_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
      field_size: this.fieldSize.toString(),
      extension_degree: this.extensionDegree,
      proof_system: 'STARK'
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
      console.log(`Cleaned up ${cleanedCount} expired STARK proofs from cache`);
    }
  }

  // 获取电路信息
  getCircuit(circuitId: string): ZKCircuit | undefined {
    return this.circuits.get(circuitId);
  }

  // Get cached proof / 获取缓存的证明
  getCachedProof(proofId: string): STARKProof | undefined {
    return this.proofCache.get(proofId);
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
      
      // Determine health status / 确定健康状态
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (circuitCount === 0) {
        status = 'degraded';
      }
      
      if (stats.failed_proofs > stats.successful_proofs * 0.1) {
        status = 'unhealthy';
      }

      return {
        status,
        components: {
          field_size: this.fieldSize.toString(),
          extension_degree: this.extensionDegree,
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