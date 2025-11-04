/**
 * Jest测试环境设置
 */
import '@jest/globals';

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.TESTING_MODE = 'true';

// 模拟全局对象
const mockFn = () => () => {};

global.console = {
  ...console,
  // 在测试中减少日志输出
  log: mockFn(),
  debug: mockFn(),
  info: mockFn(),
  warn: mockFn(),
  error: mockFn()
};

// 模拟浏览器环境
Object.defineProperty(global, 'window', {
  value: {
    ethereum: {
      isMetaMask: false,
      isCoinbaseWallet: false,
      isTrust: false,
      request: mockFn(),
      on: mockFn(),
      removeListener: mockFn()
    }
  },
  writable: true
});

// 模拟fetch API
(global as any).fetch = mockFn();

export {};