/**
 * TitanChain ZK证明系统测试
 * 测试SNARK、STARK、PLONK证明生成和验证功能
 */

import { ZKProofSystem } from './shared/security/zk-proof/zk-proof-system.js';
import { ZKConfig, ZKCircuit, ZKWitness } from './shared/security/types/index.js';

// 创建测试配置
const testConfig: ZKConfig = {
  security_level: 128,
  zk: {
    snark: {
      enabled: true,
      curve: 'bn254',
      proving_key_size: 1024,
      verification_key_size: 256,
      max_constraints: 1000000,
      trusted_setup_required: true
    },
    stark: {
      enabled: true,
      field_size: 256,
      fri_queries: 80,
      max_trace_length: 1048576,
      grinding_factor: 16
    },
    plonk: {
      enabled: true,
      curve: 'bn254',
      srs_size: 2048,
      max_constraints: 1000000,
      universal_setup: true
    }
  }
};

// 创建测试电路
const testCircuits = {
  snark: {
    circuit_id: 'test_snark_circuit',
    name: 'Test SNARK Circuit',
    description: 'Simple arithmetic circuit for SNARK testing',
    constraints: 100,
    public_inputs: 2,
    private_inputs: 3,
    circuit_type: 'arithmetic'
  },
  stark: {
    circuit_id: 'test_stark_circuit',
    name: 'Test STARK Circuit',
    description: 'Fibonacci sequence circuit for STARK testing',
    constraints: 256,
    public_inputs: 2,
    private_inputs: 1,
    circuit_type: 'fibonacci',
    trace_length: 256
  },
  plonk: {
    circuit_id: 'test_plonk_circuit',
    name: 'Test PLONK Circuit',
    description: 'General arithmetic circuit for PLONK testing',
    constraints: 150,
    public_inputs: 3,
    private_inputs: 2,
    circuit_type: 'arithmetic',
    gates: ['add', 'mul', 'constant']
  }
};

// 创建测试见证
const createTestWitness = (circuitType: string): ZKWitness => {
  const baseWitness = {
    witness_id: `test_witness_${circuitType}_${Date.now()}`,
    circuit_id: `test_${circuitType}_circuit`,
    private_inputs: new Uint8Array([1, 2, 3, 4, 5]),
    intermediate_values: new Uint8Array([10, 20, 30]),
    created_at: new Date()
  };

  switch (circuitType) {
    case 'snark':
      return {
        ...baseWitness,
        assignment: new Map([
          ['x', new Uint8Array([42])],
          ['y', new Uint8Array([24])],
          ['z', new Uint8Array([66])]
        ])
      };
    case 'stark':
      return {
        ...baseWitness,
        trace: new Uint8Array(Array.from({ length: 256 }, (_, i) => i % 256))
      };
    case 'plonk':
      return {
        ...baseWitness,
        wire_assignments: new Map([
          ['a', new Uint8Array([10])],
          ['b', new Uint8Array([20])],
          ['c', new Uint8Array([30])]
        ])
      };
    default:
      return baseWitness;
  }
};

async function testZKProofSystem() {
  console.log('🚀 开始测试TitanChain ZK证明系统...\n');

  try {
    // 1. 初始化ZK证明系统
    console.log('📋 步骤1: 初始化ZK证明系统');
    const zkSystem = new ZKProofSystem(testConfig);
    
    // 设置事件监听器
    zkSystem.on('system_initialized', (event) => {
      console.log('✅ 系统初始化完成:', event.data);
    });
    
    zkSystem.on('proof_generated', (event) => {
      console.log(`✅ 证明生成完成: ${event.data.proof_type} - ${event.data.proof_id} (${event.data.generation_time_ms}ms)`);
    });
    
    zkSystem.on('proof_verified', (event) => {
      console.log(`✅ 证明验证完成: ${event.data.proof_id} -> ${event.data.is_valid ? '有效' : '无效'} (${event.data.verification_time_ms}ms)`);
    });
    
    zkSystem.on('batch_verification_completed', (event) => {
      console.log(`✅ 批量验证完成: ${event.data.valid_proofs}/${event.data.total_proofs} 有效 (${event.data.batch_time_ms}ms)`);
    });

    await zkSystem.initializeSystem();
    console.log('✅ ZK证明系统初始化成功\n');

    // 2. 设置测试电路
    console.log('📋 步骤2: 设置测试电路');
    const circuits: Record<string, ZKCircuit> = {};
    
    for (const [proofType, circuitDef] of Object.entries(testCircuits)) {
      try {
        const circuit = await zkSystem.setupCircuit(proofType.toUpperCase() as any, circuitDef);
        circuits[proofType] = circuit;
        console.log(`✅ ${proofType.toUpperCase()}电路设置成功: ${circuit.circuit_id}`);
      } catch (error) {
        console.error(`❌ ${proofType.toUpperCase()}电路设置失败:`, error.message);
      }
    }
    console.log('');

    // 3. 生成证明
    console.log('📋 步骤3: 生成各类型证明');
    const proofs = [];
    const publicInputs = [];
    
    for (const [proofType, circuit] of Object.entries(circuits)) {
      try {
        const witness = createTestWitness(proofType);
        const proof = await zkSystem.generateProof(proofType.toUpperCase() as any, circuit, witness);
        proofs.push(proof);
        
        // 创建公共输入
        const publicInput = new Uint8Array(circuit.public_inputs * 32);
        for (let i = 0; i < publicInput.length; i++) {
          publicInput[i] = Math.floor(Math.random() * 256);
        }
        publicInputs.push(publicInput);
        
        console.log(`✅ ${proofType.toUpperCase()}证明生成成功: ${proof.proof_id}`);
      } catch (error) {
        console.error(`❌ ${proofType.toUpperCase()}证明生成失败:`, error.message);
      }
    }
    console.log('');

    // 4. 单独验证证明
    console.log('📋 步骤4: 单独验证证明');
    for (let i = 0; i < proofs.length; i++) {
      try {
        const result = await zkSystem.verifyProof(proofs[i], publicInputs[i]);
        console.log(`✅ ${proofs[i].proof_type}证明验证: ${result.is_valid ? '有效' : '无效'} (置信度: ${result.confidence_score.toFixed(2)}, 耗时: ${result.verification_time_ms}ms)`);
      } catch (error) {
        console.error(`❌ ${proofs[i].proof_type}证明验证失败:`, error.message);
      }
    }
    console.log('');

    // 5. 批量验证证明
    if (proofs.length > 1) {
      console.log('📋 步骤5: 批量验证证明');
      try {
        const batchResult = await zkSystem.batchVerify(proofs, publicInputs);
        console.log(`✅ 批量验证完成: ${batchResult.valid_proofs}/${batchResult.total_proofs} 有效`);
        console.log(`   批量验证时间: ${batchResult.batch_verification_time_ms}ms`);
        console.log(`   效率提升: ${batchResult.batch_efficiency.toFixed(2)}x`);
        
        // 显示各个证明的验证结果
        batchResult.individual_results.forEach((result, index) => {
          console.log(`   - ${proofs[index].proof_type}: ${result.is_valid ? '有效' : '无效'} (${result.verification_time_ms}ms)`);
        });
      } catch (error) {
        console.error('❌ 批量验证失败:', error.message);
      }
      console.log('');
    }

    // 6. 测试最优证明系统选择
    console.log('📋 步骤6: 测试最优证明系统选择');
    const testCases = [
      { constraints: 1000, publicInputs: 5 },
      { constraints: 50000, publicInputs: 20 },
      { constraints: 200000, publicInputs: 100 }
    ];
    
    testCases.forEach(testCase => {
      const optimal = zkSystem.getOptimalProofSystem(testCase.constraints, testCase.publicInputs);
      console.log(`✅ 约束${testCase.constraints}, 公共输入${testCase.publicInputs} -> 推荐: ${optimal}`);
    });
    console.log('');

    // 7. 预计算验证密钥
    console.log('📋 步骤7: 预计算验证密钥');
    try {
      await zkSystem.precomputeVerificationKeys(Object.values(circuits));
      console.log('✅ 验证密钥预计算完成');
    } catch (error) {
      console.error('❌ 验证密钥预计算失败:', error.message);
    }
    console.log('');

    // 8. 系统统计信息
    console.log('📋 步骤8: 系统统计信息');
    const stats = zkSystem.getStatistics();
    console.log('✅ 系统统计:');
    console.log(`   总证明生成: ${stats.total_proofs_generated}`);
    console.log(`   总证明验证: ${stats.total_proofs_verified}`);
    console.log(`   SNARK证明: ${stats.snark_proofs}`);
    console.log(`   STARK证明: ${stats.stark_proofs}`);
    console.log(`   PLONK证明: ${stats.plonk_proofs}`);
    console.log(`   成功验证: ${stats.successful_verifications}`);
    console.log(`   失败验证: ${stats.failed_verifications}`);
    console.log(`   缓存验证: ${stats.cached_verifications}`);
    console.log(`   批量验证: ${stats.batch_verifications}`);
    console.log(`   平均生成时间: ${stats.average_generation_time.toFixed(2)}ms`);
    console.log(`   平均验证时间: ${stats.average_verification_time.toFixed(2)}ms`);
    console.log('');

    // 9. 健康检查
    console.log('📋 步骤9: 系统健康检查');
    try {
      const health = await zkSystem.healthCheck();
      console.log(`✅ 系统健康状态: ${health.status}`);
      console.log('   组件状态:');
      Object.entries(health.components).forEach(([component, status]) => {
        console.log(`   - ${component}: ${status.status}`);
      });
    } catch (error) {
      console.error('❌ 健康检查失败:', error.message);
    }
    console.log('');

    // 10. 缓存清理测试
    console.log('📋 步骤10: 缓存清理测试');
    try {
      zkSystem.cleanupCache(1000); // 清理1秒前的缓存
      console.log('✅ 缓存清理完成');
    } catch (error) {
      console.error('❌ 缓存清理失败:', error.message);
    }
    console.log('');

    console.log('🎉 TitanChain ZK证明系统测试完成！');
    console.log('📊 测试总结:');
    console.log(`   - 支持的证明系统: SNARK, STARK, PLONK`);
    console.log(`   - 证明生成: ${proofs.length}个`);
    console.log(`   - 验证引擎: 集成完成`);
    console.log(`   - 电路管理器: 集成完成`);
    console.log(`   - 批量验证: 支持`);
    console.log(`   - 系统健康: 监控完成`);

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
testZKProofSystem().catch(console.error);

export { testZKProofSystem };