// 简易见证注册表（内存），用于身份校验与签名验证
// 生产可替换为持久化存储与权限管理

const witnesses = new Set<string>();

export const witnessRegistry = {
  register(address: string) {
    if (typeof address === 'string') {
      witnesses.add(address.toLowerCase());
    }
  },
  isRegistered(address: string): boolean {
    return typeof address === 'string' && witnesses.has(address.toLowerCase());
  },
  list(): string[] {
    return Array.from(witnesses.values());
  },
  clear() {
    witnesses.clear();
  },
};