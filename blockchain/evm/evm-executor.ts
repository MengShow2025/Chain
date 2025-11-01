import { Transaction, Account, Contract, Log, EVMState } from '../../shared/types/blockchain.js';
import { ZERO_GAS_CONFIG, ERROR_CODES } from '../../shared/constants/blockchain.js';
import { calculateGasFeeAllocation, isNativeTokenTransaction, getTransactionTokenType, shouldBeZeroGasTransaction } from '../../shared/utils/native-token-utils.js';
import { smartGasEngine } from '../gas/smart-gas-engine.js';
import { networkCongestionMonitor } from '../gas/network-congestion-monitor.js';
import { gasStabilityPool } from '../gas/gas-stability-pool.js';

/**
 * EVM执行器
 * 提供与以太坊虚拟机兼容的智能合约执行环境
 */
export class EVMExecutor {
  private state: EVMState;
  private blockNumber: number = 0;
  private blockHash: string = '0x0000000000000000000000000000000000000000000000000000000000000000';
  private gasUsed: bigint = BigInt(0);
  private gasLimit: bigint = BigInt(30000000);
  
  constructor() {
    this.state = {
      accounts: new Map(),
      contracts: new Map(),
      storage: new Map(),
      logs: []
    };
  }
  
  /**
   * 执行交易
   */
  async executeTransaction(tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs: Log[];
    returnData?: string;
    error?: string;
  }> {
    try {
      console.log(`Executing transaction ${tx.hash}`);
      
      // 0. 自动标记0-gas费交易
      if (!tx.isZeroGas && shouldBeZeroGasTransaction(tx)) {
        tx.isZeroGas = true;
        console.log(`自动标记交易 ${tx.hash} 为0-gas费交易`);
      }
      
      // 1. 计算gas费用
      const gasCost = this.calculateGasCost(tx);
      
      // 2. 预执行检查
      const preCheck = await this.preExecutionCheck(tx);
      if (!preCheck.success) {
        // 即使预检查失败，也要扣除gas费（除非是0-gas费交易）
        if (gasCost > BigInt(0)) {
          await this.deductGasFee(tx.from, gasCost);
        }
        return {
          success: false,
          gasUsed: BigInt(21000), // 基础gas消耗
          logs: [],
          error: preCheck.error
        };
      }
      
      // 3. 扣除gas费用
      if (!await this.deductGasFee(tx.from, gasCost)) {
        return {
          success: false,
          gasUsed: BigInt(21000),
          logs: [],
          error: 'Insufficient balance for gas'
        };
      }
      
      // 记录0-gas费交易
      if (gasCost === BigInt(0)) {
        console.log(`✅ 0-gas费交易执行: ${tx.hash}, 类型: ${isNativeTokenTransaction(tx) ? '原生代币' : '链下撮合'}`);
      }
      
      // 3. 执行交易逻辑
      let result;
      if (tx.to === null || tx.to === '') {
        // 合约部署
        result = await this.deployContract(tx);
      } else if (this.isContract(tx.to)) {
        // 合约调用
        result = await this.callContract(tx);
      } else {
        // 普通转账
        result = await this.transferValue(tx);
      }
      
      // 4. 更新状态
      this.gasUsed += result.gasUsed;
      
      // 5. 返回执行结果
      return {
        success: result.success,
        gasUsed: result.gasUsed,
        logs: result.logs || [],
        returnData: result.returnData,
        error: result.error
      };
      
    } catch (error) {
      console.error('Transaction execution error:', error);
      
      // 即使交易执行失败，也要扣除gas费（除非是0-gas费交易）
      const gasCost = this.calculateGasCost(tx);
      if (gasCost > BigInt(0)) {
        await this.deductGasFee(tx.from, gasCost);
      }
      
      return {
        success: false,
        gasUsed: BigInt(21000),
        logs: [],
        error: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }
  
  /**
   * 预执行检查
   */
  private async preExecutionCheck(tx: Transaction): Promise<{ success: boolean; error?: string }> {
    // 检查账户余额
    const account = await this.getAccount(tx.from);
    
    // 对于0-gas费交易，只检查转账金额，不检查gas费
    let totalCost: bigint;
    if (tx.isZeroGas || shouldBeZeroGasTransaction(tx)) {
      totalCost = tx.value; // 0-gas费交易只需要检查转账金额
    } else {
      totalCost = tx.value + (tx.gas * tx.gasPrice); // 普通交易需要检查转账金额+gas费
    }
    
    if (account.balance < totalCost) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    // 检查nonce
    if (tx.nonce !== account.nonce) {
      return { success: false, error: 'Invalid nonce' };
    }
    
    // 检查gas限制
    if (tx.gas > this.gasLimit) {
      return { success: false, error: 'Gas limit exceeded' };
    }
    
    return { success: true };
  }
  
  /**
   * 计算gas费用 - 集成智能gas费系统
   */
  private calculateGasCost(tx: Transaction): bigint {
    // 检查是否为0-gas费交易
    if (tx.isZeroGas || shouldBeZeroGasTransaction(tx)) {
      // 原生代币交易完全免费
      if (isNativeTokenTransaction(tx)) {
        return BigInt(0);
      }
      
      // 链下撮合交易完全免费
      if (tx.exchangeBatch) {
        return BigInt(0);
      }
      
      // 智能合约分层收费（如果有配置）
      if (tx.contractTier) {
        const tierConf = ZERO_GAS_CONFIG.CONTRACT_TIER_FEES[tx.contractTier as keyof typeof ZERO_GAS_CONFIG.CONTRACT_TIER_FEES];
        const tierFee = tierConf?.fee ?? BigInt(0);
        return tierFee;
      }
      
      // 其他0-gas费交易也免费
      return BigInt(0);
    }
    
    // 普通交易使用智能gas费系统
    return this.calculateSmartGasCost(tx);
  }

  /**
   * 使用智能gas费系统计算费用
   */
  private calculateSmartGasCost(tx: Transaction): bigint {
    try {
      // 获取网络拥堵因子
      const congestionFactor = networkCongestionMonitor.getCongestionFactor();
      
      // 计算智能gas价格
      const smartGasResult = smartGasEngine.calculateSmartGasPrice(congestionFactor);
      
      // 应用稳定性缓冲池
      const stabilizedGasPrice = gasStabilityPool.getStabilizedPrice(smartGasResult.gasPrice);
      
      // 计算最终gas费用
      const gasCost = tx.gas * stabilizedGasPrice;
      
      console.log(`智能gas费计算 - 交易: ${tx.hash}`);
      console.log(`  原始gasPrice: ${tx.gasPrice}`);
      console.log(`  智能gasPrice: ${smartGasResult.gasPrice}`);
      console.log(`  稳定化gasPrice: ${stabilizedGasPrice}`);
      console.log(`  拥堵因子: ${congestionFactor}`);
      console.log(`  调整原因: ${smartGasResult.adjustmentReason}`);
      console.log(`  最终gas费用: ${gasCost}`);
      
      return gasCost;
      
    } catch (error) {
      console.error('智能gas费计算失败，使用原始价格:', error);
      // 降级到原始gas费计算
      return tx.gas * tx.gasPrice;
    }
  }

  /**
   * 处理交易gas费分配
   * 根据代币类型决定gas费的分配方式
   */
  processGasFeeAllocation(tx: Transaction, gasFee: bigint): {
    toRewardPool: bigint;
    toValidator: bigint;
    tokenType: 'TTN' | 'ttUSD' | 'OTHER';
    isNativeToken: boolean;
  } {
    const allocation = calculateGasFeeAllocation(tx, gasFee);
    const isNative = isNativeTokenTransaction(tx);
    
    console.log(`Gas费分配 - 交易: ${tx.hash}, 代币类型: ${allocation.tokenType}, 原生代币: ${isNative}, 奖励池: ${allocation.toRewardPool}, 验证节点: ${allocation.toValidator}`);
    
    return {
      ...allocation,
      isNativeToken: isNative
    };
  }
  
  /**
   * 扣除gas费用
   */
  private async deductGasFee(from: string, gasCost: bigint): Promise<boolean> {
    // 如果gas费为0，直接返回成功，不扣除任何费用
    if (gasCost === BigInt(0)) {
      return true;
    }
    
    const account = await this.getAccount(from);
    
    if (account.balance < gasCost) {
      return false;
    }
    
    account.balance -= gasCost;
    return true;
  }
  
  /**
   * 部署合约
   */
  private async deployContract(tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs?: Log[];
    returnData?: string;
    error?: string;
  }> {
    try {
      // 计算合约地址
      const contractAddress = this.calculateContractAddress(tx.from, tx.nonce);
      
      // 创建合约账户
      const contractAccount: Account = {
        address: contractAddress,
        balance: tx.value,
        nonce: 0,
        codeHash: this.calculateCodeHash(tx.data),
        storageRoot: '0x0000000000000000000000000000000000000000000000000000000000000000'
      };
      
      // 创建合约对象
      const contract: Contract = {
        address: contractAddress,
        creator: tx.from,
        code: tx.data,
        storage: new Map<string, string>(),
        createdAt: Date.now(),
        tier: tx.contractTier ?? 0
      };
      
      // 保存合约
      this.state.accounts.set(contractAddress, contractAccount);
      this.state.contracts.set(contractAddress, contract);
      
      // 从部署者账户转移资金
      const deployerAccount = await this.getAccount(tx.from);
      deployerAccount.balance -= tx.value;
      deployerAccount.nonce++;
      
      // 计算gas消耗
      const gasUsed = BigInt(200000) + BigInt(tx.data.length * 200); // 简化计算
      
      // 生成日志
      const log: Log = {
        address: contractAddress,
        topics: ['0x' + 'ContractDeployed'.padEnd(64, '0')],
        data: tx.data,
        blockNumber: this.blockNumber,
        transactionHash: tx.hash,
        transactionIndex: 0,
        logIndex: this.state.logs.length
      };
      
      this.state.logs.push(log);
      
      console.log(`Contract deployed at ${contractAddress}`);
      
      return {
        success: true,
        gasUsed,
        logs: [log],
        returnData: contractAddress
      };
      
    } catch (error) {
      console.error('Contract deployment error:', error);
      return {
        success: false,
        gasUsed: BigInt(21000),
        error: error instanceof Error ? error.message : 'Deployment failed'
      };
    }
  }
  
  /**
   * 调用合约
   */
  private async callContract(tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs?: Log[];
    returnData?: string;
    error?: string;
  }> {
    try {
      const contract = this.state.contracts.get(tx.to!);
      if (!contract) {
        return {
          success: false,
          gasUsed: BigInt(21000),
          error: 'Contract not found'
        };
      }
      
      // 简化的合约执行
      // 实际实现需要完整的EVM字节码解释器
      const result = await this.executeContractCode(contract, tx);
      
      // 更新调用者nonce
      const callerAccount = await this.getAccount(tx.from);
      callerAccount.nonce++;
      
      return result;
      
    } catch (error) {
      console.error('Contract call error:', error);
      return {
        success: false,
        gasUsed: BigInt(21000),
        error: error instanceof Error ? error.message : 'Contract call failed'
      };
    }
  }
  
  /**
   * 执行合约代码
   */
  private async executeContractCode(contract: Contract, tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs?: Log[];
    returnData?: string;
    error?: string;
  }> {
    // 简化实现：根据合约类型执行不同逻辑
    const methodSignature = tx.data.substring(0, 10); // 前4字节是方法签名
    
    let gasUsed = BigInt(21000); // 基础gas
    const logs: Log[] = [];
    
    // 模拟一些常见的合约方法
    switch (methodSignature) {
      case '0xa9059cbb': // transfer(address,uint256)
        return await this.executeTransfer(contract, tx);
        
      case '0x70a08231': // balanceOf(address)
        return await this.executeBalanceOf(contract, tx);
        
      case '0x095ea7b3': // approve(address,uint256)
        return await this.executeApprove(contract, tx);
        
      default:
        // 默认处理：简单的状态更新
        gasUsed = BigInt(50000);
        
        const log: Log = {
          address: contract.address,
          topics: ['0x' + methodSignature.substring(2).padEnd(64, '0')],
          data: tx.data,
          blockNumber: this.blockNumber,
          transactionHash: tx.hash,
          transactionIndex: 0,
          logIndex: this.state.logs.length
        };
        
        this.state.logs.push(log);
        
        return {
          success: true,
          gasUsed,
          logs: [log],
          returnData: '0x0000000000000000000000000000000000000000000000000000000000000001'
        };
    }
  }
  
  /**
   * 执行转账操作
   */
  private async executeTransfer(contract: Contract, tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs?: Log[];
    returnData?: string;
    error?: string;
  }> {
    try {
      // 解析参数：to地址和金额
      const toAddress = '0x' + tx.data.substring(34, 74);
      const amount = BigInt('0x' + tx.data.substring(74, 138));
      
      // 检查余额
      const fromBalanceRaw = contract.storage.get(`balance_${tx.from}`);
      const fromBalance = fromBalanceRaw ? BigInt(fromBalanceRaw) : BigInt(0);
      
      if (fromBalance < amount) {
        return {
          success: false,
          gasUsed: BigInt(21000),
          error: 'Insufficient token balance'
        };
      }
      
      // 执行转账
      contract.storage.set(`balance_${tx.from}`, (fromBalance - amount).toString());
      const toBalanceRaw = contract.storage.get(`balance_${toAddress}`);
      const toBalance = toBalanceRaw ? BigInt(toBalanceRaw) : BigInt(0);
      contract.storage.set(`balance_${toAddress}`, (toBalance + amount).toString());
      
      // 生成Transfer事件日志
      const log: Log = {
        address: contract.address,
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer事件签名
          '0x' + tx.from.substring(2).padStart(64, '0'),
          '0x' + toAddress.substring(2).padStart(64, '0')
        ],
        data: '0x' + amount.toString(16).padStart(64, '0'),
        blockNumber: this.blockNumber,
        transactionHash: tx.hash,
        transactionIndex: 0,
        logIndex: this.state.logs.length
      };
      
      this.state.logs.push(log);
      
      return {
        success: true,
        gasUsed: BigInt(51000),
        logs: [log],
        returnData: '0x0000000000000000000000000000000000000000000000000000000000000001'
      };
      
    } catch (error) {
      return {
        success: false,
        gasUsed: BigInt(21000),
        error: error instanceof Error ? error.message : 'Transfer failed'
      };
    }
  }
  
  /**
   * 执行余额查询
   */
  private async executeBalanceOf(contract: Contract, tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs?: Log[];
    returnData?: string;
    error?: string;
  }> {
    try {
      // 解析参数：查询地址
      const queryAddress = '0x' + tx.data.substring(34, 74);
      
      // 获取余额
      const balanceRaw = contract.storage.get(`balance_${queryAddress}`);
      const balance = balanceRaw ? BigInt(balanceRaw) : BigInt(0);
      const balanceHex = '0x' + balance.toString(16).padStart(64, '0');
      
      return {
        success: true,
        gasUsed: BigInt(2300),
        logs: [],
        returnData: balanceHex
      };
      
    } catch (error) {
      return {
        success: false,
        gasUsed: BigInt(2300),
        error: error instanceof Error ? error.message : 'Balance query failed'
      };
    }
  }
  
  /**
   * 执行授权操作
   */
  private async executeApprove(contract: Contract, tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs?: Log[];
    returnData?: string;
    error?: string;
  }> {
    try {
      // 解析参数：被授权地址和金额
      const spenderAddress = '0x' + tx.data.substring(34, 74);
      const amount = BigInt('0x' + tx.data.substring(74, 138));
      
      // 设置授权
      contract.storage.set(`allowance_${tx.from}_${spenderAddress}`, amount.toString());
      
      // 生成Approval事件日志
      const log: Log = {
        address: contract.address,
        topics: [
          '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925', // Approval事件签名
          '0x' + tx.from.substring(2).padStart(64, '0'),
          '0x' + spenderAddress.substring(2).padStart(64, '0')
        ],
        data: '0x' + amount.toString(16).padStart(64, '0'),
        blockNumber: this.blockNumber,
        transactionHash: tx.hash,
        transactionIndex: 0,
        logIndex: this.state.logs.length
      };
      
      this.state.logs.push(log);
      
      return {
        success: true,
        gasUsed: BigInt(46000),
        logs: [log],
        returnData: '0x0000000000000000000000000000000000000000000000000000000000000001'
      };
      
    } catch (error) {
      return {
        success: false,
        gasUsed: BigInt(21000),
        error: error instanceof Error ? error.message : 'Approval failed'
      };
    }
  }
  
  /**
   * 普通转账
   */
  private async transferValue(tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs?: Log[];
    returnData?: string;
    error?: string;
  }> {
    try {
      const fromAccount = await this.getAccount(tx.from);
      const toAccount = await this.getAccount(tx.to!);
      
      // 检查余额
      if (fromAccount.balance < tx.value) {
        return {
          success: false,
          gasUsed: BigInt(21000),
          error: 'Insufficient balance for transfer'
        };
      }
      
      // 执行转账
      fromAccount.balance -= tx.value;
      fromAccount.nonce++;
      toAccount.balance += tx.value;
      
      console.log(`Transferred ${tx.value} from ${tx.from} to ${tx.to}`);
      
      return {
        success: true,
        gasUsed: BigInt(21000),
        logs: [],
        returnData: '0x'
      };
      
    } catch (error) {
      console.error('Transfer error:', error);
      return {
        success: false,
        gasUsed: BigInt(21000),
        error: error instanceof Error ? error.message : 'Transfer failed'
      };
    }
  }
  
  /**
   * 获取账户信息
   */
  private async getAccount(address: string): Promise<Account> {
    let account = this.state.accounts.get(address);
    
    if (!account) {
      // 创建新账户
      account = {
        address,
        balance: BigInt(0),
        nonce: 0,
        codeHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        storageRoot: '0x0000000000000000000000000000000000000000000000000000000000000000'
      };
      
      this.state.accounts.set(address, account);
    }
    
    return account;
  }
  
  /**
   * 检查是否为合约地址
   */
  private isContract(address: string): boolean {
    return this.state.contracts.has(address);
  }
  
  /**
   * 计算合约地址
   */
  private calculateContractAddress(creator: string, nonce: number): string {
    // 简化的合约地址计算
    const hash = creator + nonce.toString();
    return '0x' + hash.substring(2, 42).padStart(40, '0');
  }
  
  /**
   * 计算代码哈希
   */
  private calculateCodeHash(code: string): string {
    // 简化的代码哈希计算
    return '0x' + code.substring(2, 66).padStart(64, '0');
  }
  
  /**
   * 更新状态
   */
  updateState(blockNumber: number, blockHash: string, timestamp: number): void {
    this.blockNumber = blockNumber;
    this.blockHash = blockHash;
  }

  /**
   * 获取状态根（简化实现：使用当前blockHash作为stateRoot）
   */
  getStateRoot(): string {
    return this.blockHash;
  }
  
  /**
   * 获取状态
   */
  getState(): EVMState {
    return {
      accounts: new Map(this.state.accounts),
      contracts: new Map(this.state.contracts),
      storage: new Map(this.state.storage),
      logs: [...this.state.logs]
    };
  }
  
  /**
   * 获取合约
   */
  getContract(address: string): Contract | undefined {
    return this.state.contracts.get(address);
  }
  
  /**
   * 获取日志
   */
  getLogs(): Log[] {
    return [...this.state.logs];
  }
  
  /**
   * 清除日志
   */
  clearLogs(): void {
    this.state.logs = [];
  }
  
  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      accounts: new Map(),
      contracts: new Map(),
      storage: new Map(),
      logs: []
    };
    this.gasUsed = BigInt(0);
  }

  /**
   * 获取账户余额（公共方法）
   */
  async getAccountBalance(address: string): Promise<bigint> {
    const account = await this.getAccount(address);
    return account.balance;
  }

  /**
   * 创建账户（公共方法）
   */
  async createAccount(address: string, balance: bigint): Promise<void> {
    const account: Account = {
      address,
      balance,
      nonce: 0
    };
    this.state.accounts.set(address, account);
  }

  /**
   * 获取账户信息（公共方法）
   */
  async getAccountInfo(address: string): Promise<Account> {
    return await this.getAccount(address);
  }

  /**
   * 获取账户余额（别名方法）
   */
  async getBalance(address: string): Promise<bigint> {
    return await this.getAccountBalance(address);
  }

  /**
   * 更新账户余额
   */
  async updateBalance(address: string, newBalance: bigint): Promise<void> {
    const account = await this.getAccount(address);
    account.balance = newBalance;
    this.state.accounts.set(address, account);
  }

  /**
   * 获取智能gas费价格等级
   */
  public getGasPriceTiers(): {
    slow: { gasPrice: bigint; estimatedTime: number; costUSD: number };
    standard: { gasPrice: bigint; estimatedTime: number; costUSD: number };
    fast: { gasPrice: bigint; estimatedTime: number; costUSD: number };
  } {
    try {
      const congestionFactor = networkCongestionMonitor.getCongestionFactor();
      const tiers = smartGasEngine.getGasPriceTiers(congestionFactor);
      const networkSummary = networkCongestionMonitor.getNetworkSummary();
      
      // 标准gas限制用于估算
      const standardGasLimit = BigInt(21000);
      
      return {
        slow: {
          gasPrice: gasStabilityPool.getStabilizedPrice(tiers.slow.gasPrice),
          estimatedTime: networkSummary.congestion.estimatedWaitTime * 1.5,
          costUSD: smartGasEngine.estimateTransactionCostUSD(standardGasLimit, tiers.slow.gasPrice)
        },
        standard: {
          gasPrice: gasStabilityPool.getStabilizedPrice(tiers.standard.gasPrice),
          estimatedTime: networkSummary.congestion.estimatedWaitTime,
          costUSD: smartGasEngine.estimateTransactionCostUSD(standardGasLimit, tiers.standard.gasPrice)
        },
        fast: {
          gasPrice: gasStabilityPool.getStabilizedPrice(tiers.fast.gasPrice),
          estimatedTime: networkSummary.congestion.estimatedWaitTime * 0.7,
          costUSD: smartGasEngine.estimateTransactionCostUSD(standardGasLimit, tiers.fast.gasPrice)
        }
      };
    } catch (error) {
      console.error('获取gas价格等级失败:', error);
      // 返回默认值
      const defaultGasPrice = BigInt('20000000000'); // 20 Gwei
      return {
        slow: { gasPrice: defaultGasPrice, estimatedTime: 120, costUSD: 0.001 },
        standard: { gasPrice: defaultGasPrice, estimatedTime: 60, costUSD: 0.001 },
        fast: { gasPrice: defaultGasPrice, estimatedTime: 30, costUSD: 0.002 }
      };
    }
  }

  /**
   * 获取网络状态和gas费建议
   */
  public getNetworkStatus(): {
    congestion: string;
    trend: string;
    recommendation: string;
    gasOptimization: string;
    stabilityScore: number;
  } {
    try {
      const networkSummary = networkCongestionMonitor.getNetworkSummary();
      const stabilityMetrics = gasStabilityPool.getStabilityMetrics();
      const gasOptimization = smartGasEngine.getOptimizationSuggestion();
      
      return {
        congestion: networkSummary.congestion.description,
        trend: networkSummary.trend === 'increasing' ? '拥堵加剧' : 
               networkSummary.trend === 'decreasing' ? '拥堵缓解' : '稳定',
        recommendation: networkSummary.recommendation,
        gasOptimization,
        stabilityScore: stabilityMetrics.stabilityScore
      };
    } catch (error) {
      console.error('获取网络状态失败:', error);
      return {
        congestion: '网络状态未知',
        trend: '稳定',
        recommendation: '可以正常进行交易',
        gasOptimization: '当前是交易的好时机',
        stabilityScore: 50
      };
    }
  }

  /**
   * 估算交易费用（包含智能gas费）
   */
  public estimateTransactionFee(tx: Partial<Transaction>): {
    estimatedGasCost: bigint;
    costUSD: number;
    gasPrice: bigint;
    adjustmentReason: string;
  } {
    try {
      const mockTx: Transaction = {
         hash: 'estimate',
         from: tx.from || '0x0000000000000000000000000000000000000000',
         to: tx.to || '0x0000000000000000000000000000000000000000',
         value: tx.value || BigInt(0),
         gas: tx.gas || BigInt(21000),
         gasPrice: tx.gasPrice || BigInt('20000000000'),
         nonce: tx.nonce || 0,
         data: tx.data || '0x',
         timestamp: Date.now(),
         status: 'pending',
         isZeroGas: tx.isZeroGas || false
       };
      
      // 检查是否为0-gas费交易
      if (mockTx.isZeroGas || shouldBeZeroGasTransaction(mockTx)) {
        return {
          estimatedGasCost: BigInt(0),
          costUSD: 0,
          gasPrice: BigInt(0),
          adjustmentReason: '0-gas费交易'
        };
      }
      
      const congestionFactor = networkCongestionMonitor.getCongestionFactor();
      const smartGasResult = smartGasEngine.calculateSmartGasPrice(congestionFactor);
      const stabilizedGasPrice = gasStabilityPool.getStabilizedPrice(smartGasResult.gasPrice);
      const estimatedGasCost = mockTx.gas * stabilizedGasPrice;
      const costUSD = smartGasEngine.estimateTransactionCostUSD(mockTx.gas, stabilizedGasPrice);
      
      return {
        estimatedGasCost,
        costUSD,
        gasPrice: stabilizedGasPrice,
        adjustmentReason: smartGasResult.adjustmentReason
      };
      
    } catch (error) {
      console.error('估算交易费用失败:', error);
      const fallbackGasPrice = BigInt('20000000000');
      const fallbackGas = BigInt(21000);
      return {
        estimatedGasCost: fallbackGas * fallbackGasPrice,
        costUSD: 0.001,
        gasPrice: fallbackGasPrice,
        adjustmentReason: '使用默认费率'
      };
    }
  }
}