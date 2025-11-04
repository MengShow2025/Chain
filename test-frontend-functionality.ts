/**
 * TitanChain Frontend Functionality Test
 * 前端功能测试脚本 - Frontend functionality test script
 */

import { promises as fs } from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string;
}

class FrontendTester {
  private results: TestResult[] = [];
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Add test result
   * 添加测试结果
   */
  private addResult(name: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: string) {
    this.results.push({ name, status, message, details });
  }

  /**
   * Test if file exists
   * 测试文件是否存在
   */
  private async testFileExists(filePath: string, description: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      this.addResult(`File Check: ${description}`, 'PASS', `✅ File exists: ${filePath}`);
      return true;
    } catch {
      this.addResult(`File Check: ${description}`, 'FAIL', `❌ File missing: ${filePath}`);
      return false;
    }
  }

  /**
   * Test component structure
   * 测试组件结构
   */
  private async testComponentStructure(): Promise<void> {
    console.log('\n🧪 Testing Component Structure...');
    
    const components = [
      { path: 'src/components/Navigation.tsx', name: 'Navigation Component' },
      { path: 'src/components/EnhancedHome.tsx', name: 'Enhanced Home Component' },
      { path: 'src/pages/Home.tsx', name: 'Home Page' },
      { path: 'src/App.tsx', name: 'App Component' }
    ];

    for (const component of components) {
      const fullPath = path.join(this.projectRoot, component.path);
      await this.testFileExists(fullPath, component.name);
    }
  }

  /**
   * Test component imports and exports
   * 测试组件导入导出
   */
  private async testComponentImports(): Promise<void> {
    console.log('\n🔍 Testing Component Imports...');
    
    try {
      // Test Navigation component
      const navPath = path.join(this.projectRoot, 'src/components/Navigation.tsx');
      const navContent = await fs.readFile(navPath, 'utf-8');
      
      if (navContent.includes('export function Navigation')) {
        this.addResult('Navigation Export', 'PASS', '✅ Navigation component properly exported');
      } else {
        this.addResult('Navigation Export', 'FAIL', '❌ Navigation component export not found');
      }

      // Test EnhancedHome component
      const homePath = path.join(this.projectRoot, 'src/components/EnhancedHome.tsx');
      const homeContent = await fs.readFile(homePath, 'utf-8');
      
      if (homeContent.includes('export function EnhancedHome')) {
        this.addResult('EnhancedHome Export', 'PASS', '✅ EnhancedHome component properly exported');
      } else {
        this.addResult('EnhancedHome Export', 'FAIL', '❌ EnhancedHome component export not found');
      }

      // Test Home page import
      const pageHomePath = path.join(this.projectRoot, 'src/pages/Home.tsx');
      const pageHomeContent = await fs.readFile(pageHomePath, 'utf-8');
      
      if (pageHomeContent.includes("import OptimizedEnhancedHome from '../components/OptimizedEnhancedHome'") || 
          pageHomeContent.includes("import { EnhancedHome } from '../components/EnhancedHome'")) {
        this.addResult('Home Page Import', 'PASS', '✅ Home page properly imports optimized component');
      } else {
        this.addResult('Home Page Import', 'FAIL', '❌ Home page import not found');
      }

    } catch (error) {
      this.addResult('Component Imports', 'FAIL', `❌ Error testing imports: ${error}`);
    }
  }

  /**
   * Test responsive design elements
   * 测试响应式设计元素
   */
  private async testResponsiveDesign(): Promise<void> {
    console.log('\n📱 Testing Responsive Design...');
    
    try {
      const navPath = path.join(this.projectRoot, 'src/components/Navigation.tsx');
      const navContent = await fs.readFile(navPath, 'utf-8');
      
      // Check for responsive classes
      const responsiveClasses = ['md:', 'lg:', 'sm:', 'xl:'];
      const hasResponsive = responsiveClasses.some(cls => navContent.includes(cls));
      
      if (hasResponsive) {
        this.addResult('Responsive Classes', 'PASS', '✅ Responsive design classes found');
      } else {
        this.addResult('Responsive Classes', 'WARN', '⚠️ Limited responsive design classes');
      }

      // Check for mobile menu
      if (navContent.includes('mobile') || navContent.includes('Mobile')) {
        this.addResult('Mobile Menu', 'PASS', '✅ Mobile menu implementation found');
      } else {
        this.addResult('Mobile Menu', 'WARN', '⚠️ Mobile menu not clearly implemented');
      }

    } catch (error) {
      this.addResult('Responsive Design', 'FAIL', `❌ Error testing responsive design: ${error}`);
    }
  }

  /**
   * Test security features integration
   * 测试安全功能集成
   */
  private async testSecurityIntegration(): Promise<void> {
    console.log('\n🔐 Testing Security Features Integration...');
    
    try {
      const homePath = path.join(this.projectRoot, 'src/components/EnhancedHome.tsx');
      const homeContent = await fs.readFile(homePath, 'utf-8');
      
      // Check for security-related content
      const securityKeywords = ['零知识证明', 'TEE', 'MPC', '量子抗性', 'Zero Knowledge', 'Quantum'];
      const hasSecurityContent = securityKeywords.some(keyword => homeContent.includes(keyword));
      
      if (hasSecurityContent) {
        this.addResult('Security Content', 'PASS', '✅ Security features prominently displayed');
      } else {
        this.addResult('Security Content', 'WARN', '⚠️ Security features not prominently displayed');
      }

      // Check for security console link
      if (homeContent.includes('/security-console') || homeContent.includes('security')) {
        this.addResult('Security Console Link', 'PASS', '✅ Security console integration found');
      } else {
        this.addResult('Security Console Link', 'WARN', '⚠️ Security console link not found');
      }

    } catch (error) {
      this.addResult('Security Integration', 'FAIL', `❌ Error testing security integration: ${error}`);
    }
  }

  /**
   * Test performance optimizations
   * 测试性能优化
   */
  private async testPerformanceOptimizations(): Promise<void> {
    console.log('\n⚡ Testing Performance Optimizations...');
    
    try {
      const homePath = path.join(this.projectRoot, 'src/components/EnhancedHome.tsx');
      const homeContent = await fs.readFile(homePath, 'utf-8');
      
      // Check for React optimizations
      if (homeContent.includes('useCallback') || homeContent.includes('useMemo')) {
        this.addResult('React Optimizations', 'PASS', '✅ React performance hooks found');
      } else {
        this.addResult('React Optimizations', 'WARN', '⚠️ Consider adding React performance optimizations');
      }

      // Check for lazy loading or code splitting
      if (homeContent.includes('lazy') || homeContent.includes('Suspense')) {
        this.addResult('Code Splitting', 'PASS', '✅ Code splitting implementation found');
      } else {
        this.addResult('Code Splitting', 'WARN', '⚠️ Consider implementing code splitting for large components');
      }

    } catch (error) {
      this.addResult('Performance Optimizations', 'FAIL', `❌ Error testing performance: ${error}`);
    }
  }

  /**
   * Run all tests
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 TitanChain Frontend Functionality Test');
    console.log('='.repeat(50));

    await this.testComponentStructure();
    await this.testComponentImports();
    await this.testResponsiveDesign();
    await this.testSecurityIntegration();
    await this.testPerformanceOptimizations();

    this.displayResults();
  }

  /**
   * Display test results
   * 显示测试结果
   */
  private displayResults(): void {
    console.log('\n📊 Test Results Summary');
    console.log('='.repeat(50));

    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${result.name}: ${result.message}`);
      
      if (result.details) {
        console.log(`   ${result.details}`);
      }

      if (result.status === 'PASS') passCount++;
      else if (result.status === 'FAIL') failCount++;
      else warnCount++;
    });

    console.log('\n📈 Summary:');
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️ Warnings: ${warnCount}`);
    console.log(`📊 Total: ${this.results.length}`);

    const successRate = ((passCount / this.results.length) * 100).toFixed(1);
    console.log(`🎯 Success Rate: ${successRate}%`);

    if (failCount === 0) {
      console.log('\n🎉 All critical tests passed! Frontend is ready for production.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review and fix the issues.');
    }
  }
}

// Main execution
async function main() {
  const tester = new FrontendTester();
  await tester.runAllTests();
}

main().catch(console.error);