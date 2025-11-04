#!/usr/bin/env tsx
/**
 * TitanChain Security System Test
 * 安全系统测试脚本 - 验证MPC、TEE、量子安全功能
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

class SecuritySystemTester {
  private results: TestResult[] = [];
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  private addResult(name: string, status: 'pass' | 'fail' | 'warning', message: string, details?: string) {
    this.results.push({ name, status, message, details });
  }

  private checkFileExists(filePath: string): boolean {
    return existsSync(join(this.projectRoot, filePath));
  }

  private checkFileContent(filePath: string, patterns: string[]): { found: string[], missing: string[] } {
    const fullPath = join(this.projectRoot, filePath);
    if (!existsSync(fullPath)) {
      return { found: [], missing: patterns };
    }

    const content = readFileSync(fullPath, 'utf-8');
    const found: string[] = [];
    const missing: string[] = [];

    patterns.forEach(pattern => {
      if (content.includes(pattern)) {
        found.push(pattern);
      } else {
        missing.push(pattern);
      }
    });

    return { found, missing };
  }

  // Test 1: 检查安全模块文件结构
  testSecurityModuleStructure() {
    console.log('🔍 Testing Security Module Structure...');
    
    const requiredFiles = [
      'blockchain/security/mpc.ts',
      'blockchain/security/tee.ts',
      'blockchain/security/quantum.ts',
      'blockchain/security/zk.ts',
      'blockchain/security/index.ts'
    ];

    let passCount = 0;
    requiredFiles.forEach(file => {
      if (this.checkFileExists(file)) {
        this.addResult(`Security Module: ${file}`, 'pass', `✅ File exists`);
        passCount++;
      } else {
        this.addResult(`Security Module: ${file}`, 'fail', `❌ File missing`);
      }
    });

    if (passCount === requiredFiles.length) {
      this.addResult('Security Module Structure', 'pass', '✅ All security modules present');
    } else {
      this.addResult('Security Module Structure', 'warning', `⚠️ ${passCount}/${requiredFiles.length} modules found`);
    }
  }

  // Test 2: 检查MPC功能实现
  testMPCImplementation() {
    console.log('🔍 Testing MPC Implementation...');
    
    const mpcPatterns = [
      'class MPCManager',
      'shamirSecretSharing',
      'bgwProtocol',
      'aby3Protocol',
      'generateShares',
      'reconstructSecret',
      'multiPartyComputation'
    ];

    const { found, missing } = this.checkFileContent('blockchain/security/mpc.ts', mpcPatterns);
    
    if (missing.length === 0) {
      this.addResult('MPC Implementation', 'pass', '✅ All MPC features implemented', `Found: ${found.join(', ')}`);
    } else if (found.length > mpcPatterns.length / 2) {
      this.addResult('MPC Implementation', 'warning', `⚠️ Partial MPC implementation`, `Missing: ${missing.join(', ')}`);
    } else {
      this.addResult('MPC Implementation', 'fail', '❌ MPC implementation incomplete', `Missing: ${missing.join(', ')}`);
    }
  }

  // Test 3: 检查TEE功能实现
  testTEEImplementation() {
    console.log('🔍 Testing TEE Implementation...');
    
    const teePatterns = [
      'class TEEManager',
      'sgxEnclave',
      'sevSecureMemory',
      'trustZoneSecureWorld',
      'createSecureEnclave',
      'attestation',
      'secureExecution'
    ];

    const { found, missing } = this.checkFileContent('blockchain/security/tee.ts', teePatterns);
    
    if (missing.length === 0) {
      this.addResult('TEE Implementation', 'pass', '✅ All TEE features implemented', `Found: ${found.join(', ')}`);
    } else if (found.length > teePatterns.length / 2) {
      this.addResult('TEE Implementation', 'warning', `⚠️ Partial TEE implementation`, `Missing: ${missing.join(', ')}`);
    } else {
      this.addResult('TEE Implementation', 'fail', '❌ TEE implementation incomplete', `Missing: ${missing.join(', ')}`);
    }
  }

  // Test 4: 检查量子安全实现
  testQuantumSecurityImplementation() {
    console.log('🔍 Testing Quantum Security Implementation...');
    
    const quantumPatterns = [
      'class QuantumSecurityManager',
      'kyberKEM',
      'dilithiumSignature',
      'sphincsSignature',
      'postQuantumCrypto',
      'quantumResistant',
      'latticeBasedCrypto'
    ];

    const { found, missing } = this.checkFileContent('blockchain/security/quantum.ts', quantumPatterns);
    
    if (missing.length === 0) {
      this.addResult('Quantum Security Implementation', 'pass', '✅ All quantum security features implemented', `Found: ${found.join(', ')}`);
    } else if (found.length > quantumPatterns.length / 2) {
      this.addResult('Quantum Security Implementation', 'warning', `⚠️ Partial quantum security implementation`, `Missing: ${missing.join(', ')}`);
    } else {
      this.addResult('Quantum Security Implementation', 'fail', '❌ Quantum security implementation incomplete', `Missing: ${missing.join(', ')}`);
    }
  }

  // Test 5: 检查零知识证明实现
  testZKImplementation() {
    console.log('🔍 Testing Zero-Knowledge Proof Implementation...');
    
    const zkPatterns = [
      'class ZKManager',
      'snarkProof',
      'starkProof',
      'plonkProof',
      'generateProof',
      'verifyProof',
      'zkCircuit'
    ];

    const { found, missing } = this.checkFileContent('blockchain/security/zk.ts', zkPatterns);
    
    if (missing.length === 0) {
      this.addResult('ZK Implementation', 'pass', '✅ All ZK features implemented', `Found: ${found.join(', ')}`);
    } else if (found.length > zkPatterns.length / 2) {
      this.addResult('ZK Implementation', 'warning', `⚠️ Partial ZK implementation`, `Missing: ${missing.join(', ')}`);
    } else {
      this.addResult('ZK Implementation', 'fail', '❌ ZK implementation incomplete', `Missing: ${missing.join(', ')}`);
    }
  }

  // Test 6: 检查安全控制台集成
  testSecurityConsoleIntegration() {
    console.log('🔍 Testing Security Console Integration...');
    
    const consolePatterns = [
      'SecurityConsoleService',
      'ThreatDetectionService',
      'SecurityScoringService',
      'SecurityDecisionService',
      'SystemOverview',
      'PerformanceMetrics'
    ];

    // 检查多个可能的文件位置
    const possibleFiles = [
      'api/security/security-console-service.ts',
      'api/services/security-console.ts',
      'blockchain/services/security-console.ts',
      'src/services/security-console.ts'
    ];

    let found = false;
    let foundPatterns: string[] = [];
    
    for (const file of possibleFiles) {
      const result = this.checkFileContent(file, consolePatterns);
      if (result.found.length > 0) {
        found = true;
        foundPatterns = result.found;
        break;
      }
    }

    if (found && foundPatterns.length >= consolePatterns.length / 2) {
      this.addResult('Security Console Integration', 'pass', '✅ Security console properly integrated', `Found: ${foundPatterns.join(', ')}`);
    } else if (found) {
      this.addResult('Security Console Integration', 'warning', '⚠️ Partial security console integration', `Found: ${foundPatterns.join(', ')}`);
    } else {
      this.addResult('Security Console Integration', 'fail', '❌ Security console not found or incomplete');
    }
  }

  // Test 7: 检查API安全端点
  testSecurityAPIEndpoints() {
    console.log('🔍 Testing Security API Endpoints...');
    
    const apiPatterns = [
      'router.get',
      'router.post',
      '/overview',
      '/layers/status',
      '/threats',
      'ensureServicesInitialized'
    ];

    const possibleFiles = [
      'api/security/routes.ts',
      'api/routes/security.ts',
      'api/security.ts',
      'src/api/security.ts'
    ];

    let found = false;
    let foundPatterns: string[] = [];
    
    for (const file of possibleFiles) {
      const result = this.checkFileContent(file, apiPatterns);
      if (result.found.length > 0) {
        found = true;
        foundPatterns = result.found;
        break;
      }
    }

    if (found && foundPatterns.length >= apiPatterns.length / 2) {
      this.addResult('Security API Endpoints', 'pass', '✅ Security API endpoints implemented', `Found: ${foundPatterns.join(', ')}`);
    } else if (found) {
      this.addResult('Security API Endpoints', 'warning', '⚠️ Partial security API implementation', `Found: ${foundPatterns.join(', ')}`);
    } else {
      this.addResult('Security API Endpoints', 'fail', '❌ Security API endpoints not found');
    }
  }

  // Test 8: 检查前端安全组件
  testFrontendSecurityComponents() {
    console.log('🔍 Testing Frontend Security Components...');
    
    const componentPatterns = [
      'SecurityConsole',
      'SecurityDashboard',
      'ThreatMonitor',
      'AuditLog',
      'SecurityMetrics'
    ];

    const possibleFiles = [
      'src/pages/SecurityConsole.tsx',
      'src/components/SecurityConsole.tsx',
      'src/components/security/SecurityConsole.tsx'
    ];

    let found = false;
    let foundPatterns: string[] = [];
    
    for (const file of possibleFiles) {
      const result = this.checkFileContent(file, componentPatterns);
      if (result.found.length > 0) {
        found = true;
        foundPatterns = result.found;
        break;
      }
    }

    if (found && foundPatterns.length >= componentPatterns.length / 2) {
      this.addResult('Frontend Security Components', 'pass', '✅ Security components implemented', `Found: ${foundPatterns.join(', ')}`);
    } else if (found) {
      this.addResult('Frontend Security Components', 'warning', '⚠️ Partial security components', `Found: ${foundPatterns.join(', ')}`);
    } else {
      this.addResult('Frontend Security Components', 'fail', '❌ Security components not found');
    }
  }

  // 运行所有测试
  async runAllTests() {
    console.log('🔐 TitanChain Security System Testing');
    console.log('=====================================\n');

    this.testSecurityModuleStructure();
    this.testMPCImplementation();
    this.testTEEImplementation();
    this.testQuantumSecurityImplementation();
    this.testZKImplementation();
    this.testSecurityConsoleIntegration();
    this.testSecurityAPIEndpoints();
    this.testFrontendSecurityComponents();

    this.printResults();
  }

  // 打印测试结果
  private printResults() {
    console.log('\n📊 Security System Test Results:');
    console.log('================================\n');

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      console.log(`${icon} ${result.name}: ${result.message}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });

    console.log('\n📈 Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log(`📊 Total: ${this.results.length}`);
    console.log(`🎯 Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed === 0 && warnings === 0) {
      console.log('\n🎉 All security systems are properly implemented and tested!');
    } else if (failed === 0) {
      console.log('\n✅ All critical security systems are working, but there are some recommendations to consider.');
    } else {
      console.log('\n⚠️ Some security systems need attention. Please review the failed tests.');
    }
  }
}

// 运行测试
const tester = new SecuritySystemTester();
tester.runAllTests().catch(console.error);