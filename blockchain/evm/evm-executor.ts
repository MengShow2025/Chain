import { Transaction, Account, Contract, Log, EVMState } from '../../shared/types/blockchain.js';
import { ZERO_GAS_CONFIG, ERROR_CODES } from '../../shared/constants/blockchain.js';

/**
 * EVM执行器
 * 提供与以太坊虚拟机兼容的智能合约执行环境
 */
export class EVMExecutor {
  private state: EVMState;
  private accounts: Map<string, Account> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private logs: Log[] = [];
  
  constructor() {
    this.state = {
      blockNumber: 0,
      blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: Date.now(),
      gasLimit: BigInt(30000000),
      gasUsed: BigInt(0),
      baseFee: BigInt(0),
      difficulty: BigInt(1),
      coinbase: '0x0000000000000000000000000000000000000000'
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
      
      // 1. 预执行检查
      const preCheck = await this.preExecutionCheck(tx);
      if (!preCheck.success) {
        return {
          success: false,
          gasUsed: BigInt(21000), // 基础gas消耗
          logs: [],
          error: preCheck.error
        };
      }
      
      // 2. 扣除gas费用
      const gasCost = this.calculateGasCost(tx);
      if (!await this.deductGasFee(tx.from, gasCost)) {
        return {
          success: false,
          gasUsed: BigInt(21000),
          logs: [],
          error: 'Insufficient balance for gas'
        };
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
      this.state.gasUsed += result.gasUsed;
      
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
    const totalCost = tx.value + (tx.gas * tx.gasPrice);
    
    if (account.balance < totalCost) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    // 检查nonce
    if (tx.nonce !== account.nonce) {
      return { success: false, error: 'Invalid nonce' };
    }
    
    // 检查gas限制
    if (tx.gas > this.state.gasLimit) {
      return { success: false, error: 'Gas limit exceeded' };
    }
    
    return { success: true };
  }
  
  /**
   * 计算gas费用
   */
  private calculateGasCost(tx: Transaction): bigint {
    // 0-gas费交易处理
    if (tx.isZeroGas) {
      if (tx.exchangeBatch) {
        return BigInt(0); // 交易所批量处理免费
      }
      
      if (tx.contractTier) {
        // 智能合约分层收费
        const tierFee = ZERO_GAS_CONFIG.CONTRACT_TIER_FEES[tx.contractTier as keyof typeof ZERO_GAS_CONFIG.CONTRACT_TIER_FEES];
        return tierFee || BigInt(0);
      }
    }
    
    // 普通交易gas费用
    return tx.gas * tx.gasPrice;
  }
  
  /**
   * 扣除gas费用
   */
  private async deductGasFee(from: string, gasCost: bigint): Promise<boolean> {
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
        abi: [], // 实际应用中需要解析ABI
        storage: new Map(),
        createdAt: Date.now(),
        version: '1.0.0'
      };
      
      // 保存合约
      this.accounts.set(contractAddress, contractAccount);
      this.contracts.set(contractAddress, contract);
      
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
        blockNumber: this.state.blockNumber,
        transactionHash: tx.hash,
        transactionIndex: 0,
        blockHash: this.state.blockHash,
        logIndex: this.logs.length
      };
      
      this.logs.push(log);
      
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
      const contract = this.contracts.get(tx.to!);
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
        // 通用合约执行
        gasUsed = BigInt(50000); // 默认gas消耗
        
        // 生成执行日志
        const log: Log = {
          address: contract.address,
          topics: [methodSignature],
          data: tx.data,
          blockNumber: this.state.blockNumber,
          transactionHash: tx.hash,
          transactionIndex: 0,
          blockHash: this.state.blockHash,
          logIndex: this.logs.length
        };
        
        logs.push(log);
        this.logs.push(log);
        
        return {
          success: true,
          gasUsed,
          logs,
          returnData: '0x0000000000000000000000000000000000000000000000000000000000000001'
        };
    }
  }
  
  /**
   * 执行ERC20 transfer
   */
  private async executeTransfer(contract: Contract, tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs?: Log[];
    returnData?: string;
    error?: string;
  }> {
    try {
      // 解析参数
      const to = '0x' + tx.data.substring(34, 74);
      const amount = BigInt('0x' + tx.data.substring(74, 138));
      
      // 检查余额
      const fromBalance = contract.storage.get(tx.from) || BigInt(0);
      if (fromBalance < amount) {
        return {
          success: false,
          gasUsed: BigInt(21000),
          error: 'Insufficient token balance'
        };
      }
      
      // 执行转账
      contract.storage.set(tx.from, fromBalance - amount);
      const toBalance = contract.storage.get(to) || BigInt(0);
      contract.storage.set(to, toBalance + amount);
      
      // 生成Transfer事件
      const log: Log = {
        address: contract.address,
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer事件签名
          '0x' + tx.from.substring(2).padStart(64, '0'),
          '0x' + to.substring(2).padStart(64, '0')
        ],
        data: '0x' + amount.toString(16).padStart(64, '0'),
        blockNumber: this.state.blockNumber,
        transactionHash: tx.hash,
        transactionIndex: 0,
        blockHash: this.state.blockHash,
        logIndex: this.logs.length
      };
      
      this.logs.push(log);
      
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
        error: 'Transfer execution failed'
      };
    }
  }
  
  /**
   * 执行ERC20 balanceOf
   */
  private async executeBalanceOf(contract: Contract, tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs?: Log[];
    returnData?: string;
    error?: string;
  }> {
    try {
      // 解析地址参数
      const address = '0x' + tx.data.substring(34, 74);
      
      // 获取余额
      const balance = contract.storage.get(address) || BigInt(0);
      
      return {
        success: true,
        gasUsed: BigInt(2300),
        logs: [],
        returnData: '0x' + balance.toString(16).padStart(64, '0')
      };
      
    } catch (error) {
      return {
        success: false,
        gasUsed: BigInt(2300),
        error: 'BalanceOf execution failed'
      };
    }
  }
  
  /**
   * 执行ERC20 approve
   */
  private async executeApprove(contract: Contract, tx: Transaction): Promise<{
    success: boolean;
    gasUsed: bigint;
    logs?: Log[];
    returnData?: string;
    error?: string;
  }> {
    try {
      // 解析参数
      const spender = '0x' + tx.data.substring(34, 74);
      const amount = BigInt('0x' + tx.data.substring(74, 138));
      
      // 设置授权
      const approvalKey = `${tx.from}_${spender}`;
      contract.storage.set(approvalKey, amount);
      
      // 生成Approval事件
      const log: Log = {
        address: contract.address,
        topics: [
          '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925', // Approval事件签名
          '0x' + tx.from.substring(2).padStart(64, '0'),
          '0x' + spender.substring(2).padStart(64, '0')
        ],
        data: '0x' + amount.toString(16).padStart(64, '0'),
        blockNumber: this.state.blockNumber,
        transactionHash: tx.hash,
        transactionIndex: 0,
        blockHash: this.state.blockHash,
        logIndex: this.logs.length
      };
      
      this.logs.push(log);
      
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
        error: 'Approve execution failed'
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
      // 获取发送方和接收方账户
      const fromAccount = await this.getAccount(tx.from);
      const toAccount = await this.getAccount(tx.to!);
      
      // 检查余额
      if (fromAccount.balance < tx.value) {
        return {
          success: false,
          gasUsed: BigInt(21000),
          error: 'Insufficient balance'
        };
      }
      
      // 执行转账
      fromAccount.balance -= tx.value;
      fromAccount.nonce++;
      toAccount.balance += tx.value;
      
      return {
        success: true,
        gasUsed: BigInt(21000),
        logs: []
      };
      
    } catch (error) {
      return {
        success: false,
        gasUsed: BigInt(21000),
        error: 'Transfer failed'
      };
    }
  }
  
  /**
   * 获取账户信息
   */
  private async getAccount(address: string): Promise<Account> {
    let account = this.accounts.get(address);
    
    if (!account) {
      // 创建新账户
      account = {
        address,
        balance: BigInt(0),
        nonce: 0,
        codeHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        storageRoot: '0x0000000000000000000000000000000000000000000000000000000000000000'
      };
      
      this.accounts.set(address, account);
    }
    
    return account;
  }
  
  /**
   * 检查是否为合约地址
   */
  private isContract(address: string): boolean {
    return this.contracts.has(address);
  }
  
  /**
   * 计算合约地址
   */
  private calculateContractAddress(creator: string, nonce: number): string {
    // 简化实现：使用创建者地址和nonce生成合约地址
    const hash = Buffer.from(`${creator}${nonce}`).toString('hex');
    return '0x' + hash.substring(0, 40);
  }
  
  /**
   * 计算代码哈希
   */
  private calculateCodeHash(code: string): string {
    // 简化实现
    return '0x' + Buffer.from(code).toString('hex').substring(0, 64).padStart(64, '0');
  }
  
  /**
   * 更新EVM状态
   */
  updateState(blockNumber: number, blockHash: string, timestamp: number): void {
    this.state.blockNumber = blockNumber;
    this.state.blockHash = blockHash;
    this.state.timestamp = timestamp;
    this.state.gasUsed = BigInt(0);
  }
  
  /**
   * 获取EVM状态
   */
  getState(): EVMState {
    return { ...this.state };
  }
  
  /**
   * 获取合约信息
   */
  getContract(address: string): Contract | undefined {
    return this.contracts.get(address);
  }
  
  /**
   * 获取所有日志
   */
  getLogs(): Log[] {
    return [...this.logs];
  }
  
  /**
   * 清理日志
   */
  clearLogs(): void {
    this.logs = [];
  }
  
  /**
   * 重置状态
   */
  reset(): void {
    this.accounts.clear();
    this.contracts.clear();
    this.logs = [];
    this.state.gasUsed = BigInt(0);
  }
}