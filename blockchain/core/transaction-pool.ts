import { Transaction } from '../../shared/types/blockchain.js';
import { PERFORMANCE_CONFIG, ZERO_GAS_CONFIG, ERROR_CODES } from '../../shared/constants/blockchain.js';
import { adaptiveBatchController } from '../../shared/utils/adaptive-batch.js';

/**
 * 高性能交易池
 * 支持0-gas费交易机制和批量处理
 */
export class TransactionPool {
  private pendingTransactions: Map<string, Transaction> = new Map();
  private zeroGasTransactions: Map<string, Transaction> = new Map();
  private nonceTracker: Map<string, number> = new Map();
  private gasTracker: Map<string, bigint> = new Map();
  // 压测模式：通过环境变量启用以绕过反作弊/限流/nonce连续性等，便于压力测试
  private testingMode: boolean = process.env.TESTING_MODE === 'true';
  
  // 反垃圾邮件保护
  private rateLimiter: Map<string, { count: number; lastReset: number }> = new Map();
  private blacklistedAddresses: Set<string> = new Set();
  private suspiciousPatterns: Map<string, number> = new Map();
  
  // 统计信息
  private stats = {
    totalTransactions: 0,
    zeroGasTransactions: 0,
    rejectedTransactions: 0,
    averageProcessingTime: 0
  };
  
  constructor() {
    console.log('Initializing Transaction Pool');
    
    // 定期清理过期交易
    setInterval(() => this.cleanupExpiredTransactions(), 30000);
  }
  
  /**
   * 添加交易到池中
   */
  async addTransaction(tx: Transaction): Promise<boolean> {
    try {
      // 1. 反垃圾邮件检查
      if (!this.antiSpamProtection(tx)) {
        console.error('Transaction rejected by anti-spam protection');
        this.stats.rejectedTransactions++;
        return false;
      }

      // 2. 基本验证
      if (!this.validateTransaction(tx)) {
        console.error('Transaction validation failed');
        this.stats.rejectedTransactions++;
        return false;
      }

      // 3. 检查黑名单
      if (this.blacklistedAddresses.has(tx.from)) {
        console.error(`Address ${tx.from} is blacklisted`);
        this.stats.rejectedTransactions++;
        return false;
      }

      // 4. 速率限制检查
      if (!this.checkRateLimit(tx.from)) {
        console.error(`Rate limit exceeded for address ${tx.from}`);
        this.stats.rejectedTransactions++;
        return false;
      }
      
      // 5. 处理不同类型的交易
      let added = false;
      if (tx.isZeroGas) {
        added = await this.addZeroGasTransaction(tx);
      } else {
        added = await this.addRegularTransaction(tx);
      }
      if (!added) {
        // 类型路由返回失败也应计入拒绝统计
        this.stats.rejectedTransactions++;
      }
      return added;
    } catch (error) {
      console.error('Error adding transaction:', error);
      this.stats.rejectedTransactions++;
      return false;
    }
  }
  
  /**
   * 添加0-gas费交易
   */
  private async addZeroGasTransaction(tx: Transaction): Promise<boolean> {
    // 验证0-gas费交易条件
    if (!this.validateZeroGasTransaction(tx)) {
      return false;
    }
    
    // 检查智能合约分层收费
    if (tx.contractTier) {
      return await this.addContractTierTransaction(tx);
    }
    
    // 添加到0-gas费交易池
    this.zeroGasTransactions.set(tx.hash, tx);
    this.stats.zeroGasTransactions++;
    this.stats.totalTransactions++;
    
    console.log(`Added zero-gas transaction ${tx.hash} to pool`);
    return true;
  }
  

  
  /**
   * 添加智能合约分层交易
   */
  private async addContractTierTransaction(tx: Transaction): Promise<boolean> {
    if (!tx.contractTier) return false;
    
    // 验证合约层级
    if (tx.contractTier < 1 || tx.contractTier > 3) {
      console.error(`Invalid contract tier: ${tx.contractTier}`);
      return false;
    }
    
    // 检查层级费用配置
    const tierConfig = ZERO_GAS_CONFIG.CONTRACT_TIER_FEES[tx.contractTier];
    if (!tierConfig) {
      console.error(`No configuration for contract tier ${tx.contractTier}`);
      return false;
    }
    
    // 验证交易是否符合层级要求
    if (tx.gas > tierConfig.maxGas) {
      console.error(`Transaction gas ${tx.gas} exceeds tier ${tx.contractTier} limit ${tierConfig.maxGas}`);
      return false;
    }
    
    // 添加到0-gas费交易池
    this.zeroGasTransactions.set(tx.hash, tx);
    this.stats.zeroGasTransactions++;
    this.stats.totalTransactions++;
    
    console.log(`Added tier-${tx.contractTier} contract transaction ${tx.hash} to pool`);
    return true;
  }
  
  /**
   * 添加普通交易
   */
  private async addRegularTransaction(tx: Transaction): Promise<boolean> {
    // 检查gas价格
    if (!this.testingMode && tx.gasPrice < PERFORMANCE_CONFIG.MIN_GAS_PRICE) {
      console.error(`Gas price ${tx.gasPrice} below minimum ${PERFORMANCE_CONFIG.MIN_GAS_PRICE}`);
      return false;
    }
    
    // 检查池容量
    if (this.pendingTransactions.size >= PERFORMANCE_CONFIG.MAX_PENDING_TRANSACTIONS) {
      // 尝试移除gas价格最低的交易
      if (!this.evictLowestGasPriceTransaction()) {
        console.error('Transaction pool full and cannot evict transactions');
        return false;
      }
    }
    
    // 添加到普通交易池
    this.pendingTransactions.set(tx.hash, tx);
    this.stats.totalTransactions++;
    
    // 更新nonce跟踪
    this.nonceTracker.set(tx.from, Math.max(this.nonceTracker.get(tx.from) || 0, tx.nonce + 1));
    
    console.log(`Added regular transaction ${tx.hash} to pool`);
    return true;
  }
  
  /**
   * 验证交易基本信息
   */
  private validateTransaction(tx: Transaction): boolean {
    console.log('Validating transaction:', tx.hash);
    
    // 检查必需字段
    if (!tx.hash || !tx.from || !tx.to) {
      console.error('Transaction validation failed: missing required fields', {
        hash: !!tx.hash,
        from: !!tx.from,
        to: !!tx.to
      });
      return false;
    }
    
    // 检查地址格式
    if (!this.isValidAddress(tx.from) || !this.isValidAddress(tx.to)) {
      console.error('Transaction validation failed: invalid address format', {
        from: tx.from,
        to: tx.to,
        fromValid: this.isValidAddress(tx.from),
        toValid: this.isValidAddress(tx.to)
      });
      return false;
    }
    
    // 检查gas限制（BigInt 比较）
    if (tx.gas <= 0n || tx.gas > PERFORMANCE_CONFIG.MAX_GAS_LIMIT) {
      console.error('Transaction validation failed: invalid gas', {
        gas: tx.gas,
        maxGasLimit: PERFORMANCE_CONFIG.MAX_GAS_LIMIT
      });
      return false;
    }
    
    // 检查值（BigInt 比较）
    if (tx.value < 0n) {
      console.error('Transaction validation failed: negative value', { value: tx.value });
      return false;
    }
    
    // 检查时间戳
    const now = Date.now();
    if (tx.timestamp > now + 60000 || tx.timestamp < now - 300000) { // 允许1分钟未来，5分钟过去
      console.error('Transaction validation failed: invalid timestamp', {
        timestamp: tx.timestamp,
        now: now,
        diff: tx.timestamp - now
      });
      return false;
    }
    
    console.log('Transaction validation passed:', tx.hash);
    return true;
  }
  
  /**
   * 验证0-gas费交易
   */
  private validateZeroGasTransaction(tx: Transaction): boolean {
    if (!tx.contractTier) {
      console.error('Zero-gas transaction must have contractTier');
      return false;
    }
    
    // 验证合约层级
    if (tx.contractTier < 1 || tx.contractTier > 3) {
      console.error('Invalid contract tier');
      return false;
    }
    
    return true;
  }
  
  /**
   * 验证nonce
   */
  private validateNonce(tx: Transaction): boolean {
    // 测试模式下跳过nonce连续性校验，允许并发乱序
    if (this.testingMode) return true;
    const expectedNonce = this.nonceTracker.get(tx.from) || 0;
    
    // nonce必须连续
    if (tx.nonce < expectedNonce) {
      console.error(`Nonce ${tx.nonce} too low, expected ${expectedNonce}`);
      return false;
    }
    
    // 不允许nonce跳跃太大
    if (tx.nonce > expectedNonce + 10) {
      console.error(`Nonce ${tx.nonce} too high, expected around ${expectedNonce}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * 移除gas价格最低的交易
   */
  private evictLowestGasPriceTransaction(): boolean {
    let lowestGasPrice = BigInt(Number.MAX_SAFE_INTEGER);
    let lowestTxHash = '';
    
    for (const [hash, tx] of this.pendingTransactions) {
      if (tx.gasPrice < lowestGasPrice) {
        lowestGasPrice = tx.gasPrice;
        lowestTxHash = hash;
      }
    }
    
    if (lowestTxHash) {
      this.pendingTransactions.delete(lowestTxHash);
      console.log(`Evicted transaction ${lowestTxHash} with gas price ${lowestGasPrice}`);
      return true;
    }
    
    return false;
  }
  
  /**
   * 获取待打包交易
   */
  getTransactionsForBlock(maxGas: bigint, maxTransactions: number): Transaction[] {
    const transactions: Transaction[] = [];
    let totalGas = BigInt(0);
    
    // 优先处理0-gas费交易
    for (const tx of this.zeroGasTransactions.values()) {
      if (transactions.length >= maxTransactions) break;
      if (totalGas + tx.gas > maxGas) continue;
      
      transactions.push(tx);
      totalGas += tx.gas;
    }
    
    // 然后处理普通交易（按gas价格排序）
    const sortedTransactions = Array.from(this.pendingTransactions.values())
      .sort((a, b) => Number(b.gasPrice - a.gasPrice));
    
    for (const tx of sortedTransactions) {
      if (transactions.length >= maxTransactions) break;
      if (totalGas + tx.gas > maxGas) continue;
      
      transactions.push(tx);
      totalGas += tx.gas;
    }
    
    return transactions;
  }
  
  /**
   * 移除已打包的交易
   */
  removeTransactions(txHashes: string[]): void {
    for (const hash of txHashes) {
      this.pendingTransactions.delete(hash);
      this.zeroGasTransactions.delete(hash);
    }
    
    console.log(`Removed ${txHashes.length} transactions from pool`);
  }
  
  /**
   * 清理过期交易
   */
  private cleanupExpiredTransactions(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟
    let cleaned = 0;
    
    // 清理普通交易
    for (const [hash, tx] of this.pendingTransactions) {
      if (now - tx.timestamp > maxAge) {
        this.pendingTransactions.delete(hash);
        cleaned++;
      }
    }
    
    // 清理0-gas费交易
    for (const [hash, tx] of this.zeroGasTransactions) {
      if (now - tx.timestamp > maxAge) {
        this.zeroGasTransactions.delete(hash);
        cleaned++;
      }
    }
    

    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired transactions`);
    }
  }
  
  /**
   * 验证地址格式
   */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  
  /**
   * 获取池统计信息
   */
  getPoolStats() {
    return {
      ...this.stats,
      pendingTransactions: this.pendingTransactions.size,
      zeroGasPoolSize: this.zeroGasTransactions.size,
      totalPoolSize: this.pendingTransactions.size + this.zeroGasTransactions.size
    };
  }
  
  /**
   * 获取交易详情
   */
  getTransaction(hash: string): Transaction | null {
    return this.pendingTransactions.get(hash) || this.zeroGasTransactions.get(hash) || null;
  }
  
  /**
   * 获取账户的待处理交易
   */
  getPendingTransactions(address: string): Transaction[] {
    const transactions: Transaction[] = [];
    
    for (const tx of this.pendingTransactions.values()) {
      if (tx.from === address) {
        transactions.push(tx);
      }
    }
    
    for (const tx of this.zeroGasTransactions.values()) {
      if (tx.from === address) {
        transactions.push(tx);
      }
    }
    
    return transactions.sort((a, b) => a.nonce - b.nonce);
  }
  

  
  /**
   * 反垃圾邮件保护
   */
  private antiSpamProtection(tx: Transaction): boolean {
    console.log('Running anti-spam protection for transaction:', tx.hash);
    // 测试模式直接通过反垃圾检测
    if (this.testingMode) {
      return true;
    }
    
    // 1. 检查交易是否已存在
    if (this.pendingTransactions.has(tx.hash) || this.zeroGasTransactions.has(tx.hash)) {
      console.error('Anti-spam failed: duplicate transaction', { hash: tx.hash });
      return false;
    }

    // 2. 检查nonce
    if (!this.validateNonce(tx)) {
      console.error('Anti-spam failed: invalid nonce', { 
        from: tx.from, 
        nonce: tx.nonce,
        expected: this.nonceTracker.get(tx.from) || 0
      });
      return false;
    }

    // 3. 检查可疑模式
    if (this.detectSuspiciousPattern(tx)) {
      console.error('Anti-spam failed: suspicious pattern detected', { from: tx.from });
      return false;
    }

    // 4. 检查交易频率
    if (this.isHighFrequencySpam(tx.from)) {
      console.error('Anti-spam failed: high frequency spam detected', { from: tx.from });
      return false;
    }

    console.log('Anti-spam protection passed for transaction:', tx.hash);
    return true;
  }

  /**
   * 速率限制检查
   */
  private checkRateLimit(address: string): boolean {
    // 测试模式禁用速率限制
    if (this.testingMode) return true;
    const now = Date.now();
    const limit = this.rateLimiter.get(address);
    
    if (!limit) {
      // 首次交易，设置限制
      this.rateLimiter.set(address, { count: 1, lastReset: now });
      return true;
    }

    // 检查是否需要重置计数器（每分钟重置）
    if (now - limit.lastReset > 60000) {
      this.rateLimiter.set(address, { count: 1, lastReset: now });
      return true;
    }

    // 检查是否超过限制（每分钟最多100笔交易）
    if (limit.count >= 100) {
      return false;
    }

    // 增加计数
    limit.count++;
    return true;
  }

  /**
   * 检测可疑模式
   */
  private detectSuspiciousPattern(tx: Transaction): boolean {
    // 测试模式禁用可疑模式检测
    if (this.testingMode) return false;
    const pattern = `${tx.from}-${tx.to}-${tx.value}`;
    const count = this.suspiciousPatterns.get(pattern) || 0;
    
    // 如果相同模式的交易超过10次，标记为可疑
    if (count >= 10) {
      return true;
    }
    
    this.suspiciousPatterns.set(pattern, count + 1);
    return false;
  }

  /**
   * 检查高频垃圾邮件
   */
  private isHighFrequencySpam(address: string): boolean {
    const now = Date.now();
    let recentTxCount = 0;
    
    // 检查过去1分钟内的交易数量
    for (const tx of this.pendingTransactions.values()) {
      if (tx.from === address && (now - tx.timestamp) < 60000) {
        recentTxCount++;
      }
    }
    
    // 如果1分钟内超过50笔交易，认为是垃圾邮件
    return recentTxCount > 50;
  }

  /**
   * 添加地址到黑名单
   */
  addToBlacklist(address: string): void {
    this.blacklistedAddresses.add(address);
    console.log(`Address ${address} added to blacklist`);
  }

  /**
   * 从黑名单移除地址
   */
  removeFromBlacklist(address: string): void {
    this.blacklistedAddresses.delete(address);
    console.log(`Address ${address} removed from blacklist`);
  }

  /**
   * 获取安全统计信息
   */
  getSecurityStats() {
    return {
      blacklistedAddresses: this.blacklistedAddresses.size,
      rateLimitedAddresses: this.rateLimiter.size,
      suspiciousPatterns: this.suspiciousPatterns.size,
      rejectedTransactions: this.stats.rejectedTransactions
    };
  }
}