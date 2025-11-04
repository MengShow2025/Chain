#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

/**
 * TitanChain Performance Optimization Test / TitanChain性能优化测试
 * 验证React性能优化和代码分割的实现
 * Verify React performance optimizations and code splitting implementation
 */

class PerformanceOptimizationTester {
  private results: Array<{ test: string; status: 'pass' | 'fail' | 'warning'; message: string }> = [];
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * 检查文件是否存在 / Check if file exists
   */
  private fileExists(filePath: string): boolean {
    return fs.existsSync(path.join(this.projectRoot, filePath));
  }

  /**
   * 读取文件内容 / Read file content
   */
  private readFile(filePath: string): string {
    try {
      return fs.readFileSync(path.join(this.projectRoot, filePath), 'utf-8');
    } catch (error) {
      return '';
    }
  }

  /**
   * 添加测试结果 / Add test result
   */
  private addResult(test: string, status: 'pass' | 'fail' | 'warning', message: string) {
    this.results.push({ test, status, message });
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${test}: ${message}`);
  }

  /**
   * 测试优化组件的存在 / Test optimized components existence
   */
  testOptimizedComponents() {
    console.log('\n🔧 Testing Optimized Components...');

    const optimizedComponents = [
      'src/components/OptimizedEnhancedHome.tsx',
      'src/components/OptimizedNavigation.tsx',
      'src/components/OptimizedWalletConnector.tsx',
      'src/components/OptimizedApp.tsx'
    ];

    optimizedComponents.forEach(component => {
      const exists = this.fileExists(component);
      this.addResult(
        `Optimized Component: ${path.basename(component)}`,
        exists ? 'pass' : 'fail',
        exists ? `✅ Component exists: ${component}` : `❌ Component missing: ${component}`
      );
    });
  }

  /**
   * 测试React.memo的使用 / Test React.memo usage
   */
  testReactMemoUsage() {
    console.log('\n🧠 Testing React.memo Usage...');

    const componentsToCheck = [
      'src/components/OptimizedEnhancedHome.tsx',
      'src/components/OptimizedNavigation.tsx',
      'src/components/OptimizedWalletConnector.tsx'
    ];

    componentsToCheck.forEach(component => {
      if (this.fileExists(component)) {
        const content = this.readFile(component);
        const hasMemo = content.includes('React.memo');
        this.addResult(
          `React.memo in ${path.basename(component)}`,
          hasMemo ? 'pass' : 'warning',
          hasMemo ? '✅ React.memo optimization found' : '⚠️ Consider adding React.memo for performance'
        );
      }
    });
  }

  /**
   * 测试useCallback和useMemo的使用 / Test useCallback and useMemo usage
   */
  testHooksOptimization() {
    console.log('\n🎣 Testing Hooks Optimization...');

    const componentsToCheck = [
      'src/components/OptimizedEnhancedHome.tsx',
      'src/components/OptimizedNavigation.tsx',
      'src/components/OptimizedWalletConnector.tsx'
    ];

    componentsToCheck.forEach(component => {
      if (this.fileExists(component)) {
        const content = this.readFile(component);
        const hasUseCallback = content.includes('useCallback');
        const hasUseMemo = content.includes('useMemo');

        this.addResult(
          `useCallback in ${path.basename(component)}`,
          hasUseCallback ? 'pass' : 'warning',
          hasUseCallback ? '✅ useCallback optimization found' : '⚠️ Consider adding useCallback for event handlers'
        );

        this.addResult(
          `useMemo in ${path.basename(component)}`,
          hasUseMemo ? 'pass' : 'warning',
          hasUseMemo ? '✅ useMemo optimization found' : '⚠️ Consider adding useMemo for expensive calculations'
        );
      }
    });
  }

  /**
   * 测试代码分割实现 / Test code splitting implementation
   */
  testCodeSplitting() {
    console.log('\n📦 Testing Code Splitting...');

    const appComponent = 'src/components/OptimizedApp.tsx';
    if (this.fileExists(appComponent)) {
      const content = this.readFile(appComponent);
      const hasLazy = content.includes('lazy(');
      const hasSuspense = content.includes('Suspense');

      this.addResult(
        'Lazy Loading',
        hasLazy ? 'pass' : 'fail',
        hasLazy ? '✅ React.lazy implementation found' : '❌ React.lazy not implemented'
      );

      this.addResult(
        'Suspense Wrapper',
        hasSuspense ? 'pass' : 'fail',
        hasSuspense ? '✅ Suspense wrapper found' : '❌ Suspense wrapper missing'
      );
    } else {
      this.addResult(
        'Code Splitting',
        'fail',
        '❌ OptimizedApp component not found'
      );
    }
  }

  /**
   * 测试组件分离和模块化 / Test component separation and modularity
   */
  testComponentModularity() {
    console.log('\n🧩 Testing Component Modularity...');

    // 检查是否有子组件分离
    const optimizedNavigation = 'src/components/OptimizedNavigation.tsx';
    if (this.fileExists(optimizedNavigation)) {
      const content = this.readFile(optimizedNavigation);
      const hasSubComponents = content.includes('const Logo = React.memo') || 
                              content.includes('const NavigationItem = React.memo');

      this.addResult(
        'Sub-component Separation',
        hasSubComponents ? 'pass' : 'warning',
        hasSubComponents ? '✅ Sub-components properly separated and memoized' : '⚠️ Consider separating complex components into smaller parts'
      );
    }

    // 检查displayName的使用
    const componentsToCheck = [
      'src/components/OptimizedEnhancedHome.tsx',
      'src/components/OptimizedNavigation.tsx',
      'src/components/OptimizedWalletConnector.tsx'
    ];

    componentsToCheck.forEach(component => {
      if (this.fileExists(component)) {
        const content = this.readFile(component);
        const hasDisplayName = content.includes('.displayName');
        this.addResult(
          `DisplayName in ${path.basename(component)}`,
          hasDisplayName ? 'pass' : 'warning',
          hasDisplayName ? '✅ DisplayName set for debugging' : '⚠️ Consider adding displayName for better debugging'
        );
      }
    });
  }

  /**
   * 测试性能最佳实践 / Test performance best practices
   */
  testPerformanceBestPractices() {
    console.log('\n⚡ Testing Performance Best Practices...');

    const componentsToCheck = [
      'src/components/OptimizedEnhancedHome.tsx',
      'src/components/OptimizedNavigation.tsx',
      'src/components/OptimizedWalletConnector.tsx'
    ];

    componentsToCheck.forEach(component => {
      if (this.fileExists(component)) {
        const content = this.readFile(component);
        
        // 检查是否避免了内联对象和函数
        const hasInlineObjects = content.includes('style={{') || content.includes('className={`');
        const hasOptimizedEventHandlers = content.includes('useCallback');

        this.addResult(
          `Event Handler Optimization in ${path.basename(component)}`,
          hasOptimizedEventHandlers ? 'pass' : 'warning',
          hasOptimizedEventHandlers ? '✅ Event handlers optimized with useCallback' : '⚠️ Consider optimizing event handlers'
        );

        // 检查是否使用了passive事件监听器
        const hasPassiveListeners = content.includes('{ passive: true }');
        if (content.includes('addEventListener')) {
          this.addResult(
            `Passive Event Listeners in ${path.basename(component)}`,
            hasPassiveListeners ? 'pass' : 'warning',
            hasPassiveListeners ? '✅ Passive event listeners used' : '⚠️ Consider using passive event listeners for scroll events'
          );
        }
      }
    });
  }

  /**
   * 测试Bundle大小优化 / Test bundle size optimization
   */
  testBundleOptimization() {
    console.log('\n📊 Testing Bundle Optimization...');

    // 检查是否有不必要的导入
    const appComponent = 'src/components/OptimizedApp.tsx';
    if (this.fileExists(appComponent)) {
      const content = this.readFile(appComponent);
      const hasTreeShaking = !content.includes('import *');
      
      this.addResult(
        'Tree Shaking Friendly Imports',
        hasTreeShaking ? 'pass' : 'warning',
        hasTreeShaking ? '✅ Named imports used for better tree shaking' : '⚠️ Avoid wildcard imports for better tree shaking'
      );
    }

    // 检查是否有动态导入
    const homeComponent = 'src/pages/Home.tsx';
    if (this.fileExists(homeComponent)) {
      const content = this.readFile(homeComponent);
      const usesDynamicImport = content.includes('OptimizedEnhancedHome');
      
      this.addResult(
        'Optimized Component Usage',
        usesDynamicImport ? 'pass' : 'warning',
        usesDynamicImport ? '✅ Using optimized components' : '⚠️ Consider using optimized component versions'
      );
    }
  }

  /**
   * 运行所有测试 / Run all tests
   */
  async runAllTests() {
    console.log('🚀 TitanChain Performance Optimization Test');
    console.log('==================================================');

    this.testOptimizedComponents();
    this.testReactMemoUsage();
    this.testHooksOptimization();
    this.testCodeSplitting();
    this.testComponentModularity();
    this.testPerformanceBestPractices();
    this.testBundleOptimization();

    this.printSummary();
  }

  /**
   * 打印测试总结 / Print test summary
   */
  private printSummary() {
    console.log('\n📊 Performance Optimization Test Results Summary');
    console.log('==================================================');

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const total = this.results.length;
    const successRate = ((passed / total) * 100).toFixed(1);

    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      console.log(`${icon} ${result.test}: ${result.message}`);
    });

    console.log('\n📈 Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log(`📊 Total: ${total}`);
    console.log(`🎯 Success Rate: ${successRate}%`);

    if (failed > 0) {
      console.log('\n❌ Some critical optimizations are missing. Please review and implement them.');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('\n⚠️ All critical optimizations are in place, but there are some recommendations to consider.');
    } else {
      console.log('\n🎉 Excellent! All performance optimizations are properly implemented.');
    }
  }
}

// 运行测试 / Run tests
const tester = new PerformanceOptimizationTester();
tester.runAllTests().catch(console.error);