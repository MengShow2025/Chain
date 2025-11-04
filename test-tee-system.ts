/**
 * TEE系统测试
 * 测试可信执行环境的各项功能
 */

import { TEEOrchestrator } from './shared/security/tee/tee-orchestrator.js';
import { TEESystem } from './shared/security/tee/tee-system.js';
import { TEEPlatform } from './shared/security/tee/index.js';

async function testTEESystem(): Promise<void> {
  console.log('🧪 Starting TEE System Tests...\n');
  
  try {
    // 1. 测试TEE编排器初始化
    console.log('1️⃣ Testing TEE Orchestrator Initialization...');
    const orchestrator = new TEEOrchestrator();
    await orchestrator.initialize();
    console.log('✅ TEE Orchestrator initialized successfully\n');
    
    // 2. 测试健康状态检查
    console.log('2️⃣ Testing Health Status Check...');
    const healthStatus = await orchestrator.getHealthStatus();
    console.log('Health Status:', {
      overall_status: healthStatus.overall_status,
      platform_health: healthStatus.platform_health,
      active_environments: healthStatus.active_environments,
      active_channels: healthStatus.active_channels,
      uptime_ms: healthStatus.uptime_ms
    });
    console.log('✅ Health status check completed\n');
    
    // 3. 测试创建安全环境
    console.log('3️⃣ Testing Security Environment Creation...');
    
    // 创建SGX环境
    const sgxEnv = await orchestrator.createSecurityEnvironment('SGX', {
      enclave_size: 1024 * 1024, // 1MB
      heap_size: 512 * 1024,     // 512KB
      stack_size: 64 * 1024,     // 64KB
      debug_mode: true
    });
    console.log('SGX Environment:', {
      environment_id: sgxEnv.environment_id,
      platform: sgxEnv.platform,
      status: sgxEnv.status
    });
    
    // 创建SEV环境
    const sevEnv = await orchestrator.createSecurityEnvironment('SEV', {
      vm_type: 'SEV-SNP',
      memory_size: 2 * 1024 * 1024 * 1024, // 2GB
      vcpu_count: 2,
      policy: 0x30000
    });
    console.log('SEV Environment:', {
      environment_id: sevEnv.environment_id,
      platform: sevEnv.platform,
      status: sevEnv.status
    });
    
    // 创建TrustZone环境
    const tzEnv = await orchestrator.createSecurityEnvironment('TrustZone', {
      app_uuid: 'test-ta-uuid-12345',
      app_name: 'TestTrustedApp',
      heap_size: 256 * 1024,
      stack_size: 32 * 1024
    });
    console.log('TrustZone Environment:', {
      environment_id: tzEnv.environment_id,
      platform: tzEnv.platform,
      status: tzEnv.status
    });
    
    console.log('✅ Security environments created successfully\n');
    
    // 4. 测试建立安全通道
    console.log('4️⃣ Testing Secure Channel Establishment...');
    
    // SGX <-> SEV 通道
    const sgxSevChannel = await orchestrator.establishSecureChannel(
      sgxEnv.environment_id,
      sevEnv.environment_id,
      { encryption: 'AES-256-GCM', authentication: 'HMAC-SHA256' }
    );
    console.log('SGX-SEV Channel:', {
      channel_id: sgxSevChannel.channel_id,
      source_platform: sgxSevChannel.source_platform,
      target_platform: sgxSevChannel.target_platform,
      status: sgxSevChannel.status
    });
    
    // SEV <-> TrustZone 通道
    const sevTzChannel = await orchestrator.establishSecureChannel(
      sevEnv.environment_id,
      tzEnv.environment_id,
      { encryption: 'ChaCha20-Poly1305', authentication: 'HMAC-SHA256' }
    );
    console.log('SEV-TrustZone Channel:', {
      channel_id: sevTzChannel.channel_id,
      source_platform: sevTzChannel.source_platform,
      target_platform: sevTzChannel.target_platform,
      status: sevTzChannel.status
    });
    
    console.log('✅ Secure channels established successfully\n');
    
    // 5. 测试安全消息传输
    console.log('5️⃣ Testing Secure Message Transmission...');
    
    const testMessage1 = new TextEncoder().encode('Hello from SGX to SEV!');
    await orchestrator.sendSecureMessage(sgxSevChannel.channel_id, testMessage1);
    console.log(`Message sent through SGX-SEV channel: "${new TextDecoder().decode(testMessage1)}"`);
    
    const testMessage2 = new TextEncoder().encode('Hello from SEV to TrustZone!');
    await orchestrator.sendSecureMessage(sevTzChannel.channel_id, testMessage2);
    console.log(`Message sent through SEV-TrustZone channel: "${new TextDecoder().decode(testMessage2)}"`);
    
    console.log('✅ Secure message transmission completed\n');
    
    // 6. 测试跨平台远程证明
    console.log('6️⃣ Testing Cross-Platform Remote Attestation...');
    
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const crossPlatformAttestation = await orchestrator.generateCrossPlatformAttestation(
      [sgxEnv.environment_id, sevEnv.environment_id, tzEnv.environment_id],
      challenge
    );
    
    console.log('Cross-Platform Attestation:', {
      attestation_id: crossPlatformAttestation.attestation_id,
      platforms: crossPlatformAttestation.platforms,
      environment_count: crossPlatformAttestation.individual_attestations.length,
      timestamp: crossPlatformAttestation.timestamp
    });
    
    console.log('✅ Cross-platform remote attestation completed\n');
    
    // 7. 测试编排器统计信息
    console.log('7️⃣ Testing Orchestrator Statistics...');
    
    const stats = orchestrator.getOrchestratorStats();
    console.log('Orchestrator Statistics:', {
      total_environments: stats.total_environments,
      active_environments: stats.active_environments,
      total_channels: stats.total_channels,
      active_channels: stats.active_channels,
      total_attestations: stats.total_attestations,
      successful_attestations: stats.successful_attestations,
      platform_usage: Object.fromEntries(stats.platform_usage),
      uptime_ms: stats.uptime_ms
    });
    
    console.log('✅ Orchestrator statistics retrieved successfully\n');
    
    // 8. 测试TEE系统集成
    console.log('8️⃣ Testing TEE System Integration...');
    
    const teeSystem = new TEESystem();
    await teeSystem.initializeSystem();
    
    // 注册平台
    await teeSystem.registerPlatform({
      platform_id: 'sgx_platform_1',
      platform_type: 'SGX',
      status: 'ACTIVE',
      capabilities: ['attestation', 'sealing', 'measurement'],
      config: {
        driver_path: '/opt/intel/sgx/driver',
        sdk_path: '/opt/intel/sgx/sdk'
      }
    });
    
    await teeSystem.registerPlatform({
      platform_id: 'sev_platform_1',
      platform_type: 'SEV',
      status: 'ACTIVE',
      capabilities: ['attestation', 'memory_encryption', 'measurement'],
      config: {
        driver_path: '/dev/sev',
        firmware_version: '1.51'
      }
    });
    
    await teeSystem.registerPlatform({
      platform_id: 'trustzone_platform_1',
      platform_type: 'TRUSTZONE',
      status: 'ACTIVE',
      capabilities: ['attestation', 'secure_storage', 'measurement'],
      config: {
        driver_path: '/dev/tee0',
        optee_version: '3.19.0'
      }
    });
    
    // 获取系统健康状态
    const systemHealth = await teeSystem.healthCheck();
    console.log('TEE System Health:', {
      status: systemHealth.status,
      platforms: Object.keys(systemHealth.platforms),
      environments: Object.keys(systemHealth.environments),
      overall_score: systemHealth.overall_score
    });
    
    // 获取系统统计信息
    const systemStats = teeSystem.getStatistics();
    console.log('TEE System Statistics:', {
      total_platforms: systemStats.total_platforms,
      active_platforms: systemStats.active_platforms,
      total_environments: systemStats.total_environments,
      total_attestations: systemStats.total_attestations
    });
    
    console.log('✅ TEE system integration test completed\n');
    
    // 9. 清理资源
    console.log('9️⃣ Cleaning up resources...');
    
    // 关闭安全通道
    await orchestrator.closeSecureChannel(sgxSevChannel.channel_id);
    await orchestrator.closeSecureChannel(sevTzChannel.channel_id);
    console.log('Secure channels closed');
    
    // 销毁安全环境
    await orchestrator.destroySecurityEnvironment(sgxEnv.environment_id);
    await orchestrator.destroySecurityEnvironment(sevEnv.environment_id);
    await orchestrator.destroySecurityEnvironment(tzEnv.environment_id);
    console.log('Security environments destroyed');
    
    // 关闭系统
    await orchestrator.shutdown();
    await teeSystem.shutdownSystem();
    console.log('TEE systems shutdown');
    
    console.log('✅ Resource cleanup completed\n');
    
    console.log('🎉 All TEE System Tests Passed Successfully!');
    
  } catch (error) {
    console.error('❌ TEE System Test Failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
testTEESystem().catch(console.error);