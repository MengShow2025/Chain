import { TOKEN_CONFIG } from '../constants/blockchain.js';
import { Transaction } from '../types/blockchain.js';

/**
 * 原生代币工具函数
 * 用于识别和处理TTN和ttUSD原生代币
 */

/**
 * 检查地址是否为原生代币地址
 */
export function isNativeTokenAddress(address: string): boolean {
  if (!address) return false;
  
  // 标准化地址格式（转为小写）
  const normalizedAddress = address.toLowerCase();
  
  return TOKEN_CONFIG.NATIVE_TOKEN_ADDRESSES.some(
    nativeAddr => nativeAddr.toLowerCase() === normalizedAddress
  );
}

/**
 * 检查交易是否涉及原生代币
 */
export function isNativeTokenTransaction(tx: Transaction): boolean {
  if (!tx.to) return false;
  
  // 检查接收地址是否为原生代币地址
  if (isNativeTokenAddress(tx.to)) {
    return true;
  }
  
  // 检查交易数据中是否包含原生代币转账
  if (tx.data && tx.data.length > 0) {
    // 解析ERC20转账调用
    const transferSignature = '0xa9059cbb'; // transfer(address,uint256)
    if (tx.data.startsWith(transferSignature)) {
      // 这是ERC20转账，检查合约地址
      return isNativeTokenAddress(tx.to);
    }
  }
  
  // 检查是否为原生ETH转账（TTN转账）
  if (tx.value && tx.value > BigInt(0) && (!tx.data || tx.data === '0x')) {
    return true; // 原生TTN转账
  }
  
  return false;
}

/**
 * 获取交易涉及的代币类型
 */
export function getTransactionTokenType(tx: Transaction): 'TTN' | 'ttUSD' | 'OTHER' {
  if (!tx.to) return 'OTHER';
  
  const normalizedTo = tx.to.toLowerCase();
  
  // 检查是否为TTN原生转账
  if (tx.value && tx.value > BigInt(0) && (!tx.data || tx.data === '0x')) {
    return 'TTN';
  }
  
  // 检查是否为ttUSD转账
  if (normalizedTo === TOKEN_CONFIG.NATIVE_TOKENS.ttUSD.address.toLowerCase()) {
    return 'ttUSD';
  }
  
  // 检查是否为TTN合约调用
  if (normalizedTo === TOKEN_CONFIG.NATIVE_TOKENS.TTN.address.toLowerCase()) {
    return 'TTN';
  }
  
  return 'OTHER';
}

/**
 * 获取原生代币信息
 */
export function getNativeTokenInfo(address: string) {
  const normalizedAddress = address.toLowerCase();
  
  for (const [symbol, tokenInfo] of Object.entries(TOKEN_CONFIG.NATIVE_TOKENS)) {
    if (tokenInfo.address.toLowerCase() === normalizedAddress) {
      return {
        symbol,
        ...tokenInfo
      };
    }
  }
  
  return null;
}

/**
 * 检查交易是否应该享受0-gas费
 * 原生代币交易享受0-gas费
 */
export function shouldBeZeroGasTransaction(tx: Transaction): boolean {
  // 1. 已经标记为0-gas费的交易
  if (tx.isZeroGas) {
    return true;
  }
  
  // 3. 原生代币交易享受0-gas费
  // 根据用户需求：所有TTN和ttUSD交易都应该是0-gas费
  if (isNativeTokenTransaction(tx)) {
    return true;
  }
  
  return false;
}

/**
 * 自动为交易添加0-gas费标记
 */
export function markZeroGasTransaction(tx: Transaction): Transaction {
  if (shouldBeZeroGasTransaction(tx)) {
    return {
      ...tx,
      isZeroGas: true
    };
  }
  return tx;
}

/**
 * 检查交易的gas费是否应该进入奖励池
 * 原生代币交易的gas费不进入奖励池
 */
export function shouldGasFeeEnterRewardPool(tx: Transaction): boolean {
  return !isNativeTokenTransaction(tx);
}

/**
 * 计算交易的gas费分配
 */
export function calculateGasFeeAllocation(tx: Transaction, gasFee: bigint): {
  toRewardPool: bigint;
  toValidator: bigint;
  tokenType: 'TTN' | 'ttUSD' | 'OTHER';
} {
  const tokenType = getTransactionTokenType(tx);
  const isNative = tokenType === 'TTN' || tokenType === 'ttUSD';
  
  if (isNative) {
    // 原生代币交易：gas费全部给验证节点，不进入奖励池
    return {
      toRewardPool: BigInt(0),
      toValidator: gasFee,
      tokenType
    };
  } else {
    // 非原生代币交易：80%进入奖励池，20%给验证节点
    const toRewardPool = (gasFee * BigInt(80)) / BigInt(100);
    const toValidator = (gasFee * BigInt(20)) / BigInt(100);
    
    return {
      toRewardPool,
      toValidator,
      tokenType
    };
  }
}

/**
 * 获取所有原生代币地址
 */
export function getAllNativeTokenAddresses(): string[] {
  return [...TOKEN_CONFIG.NATIVE_TOKEN_ADDRESSES];
}

/**
 * 验证原生代币配置
 */
export function validateNativeTokenConfig(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // 检查TTN配置
  if (!TOKEN_CONFIG.NATIVE_TOKENS.TTN) {
    errors.push('TTN native token configuration missing');
  }
  
  // 检查ttUSD配置
  if (!TOKEN_CONFIG.NATIVE_TOKENS.ttUSD) {
    errors.push('ttUSD native token configuration missing');
  }
  
  // 检查地址列表
  if (TOKEN_CONFIG.NATIVE_TOKEN_ADDRESSES.length !== 2) {
    errors.push('Native token addresses list should contain exactly 2 addresses');
  }
  
  // 检查地址格式
  for (const address of TOKEN_CONFIG.NATIVE_TOKEN_ADDRESSES) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      errors.push(`Invalid address format: ${address}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 格式化代币金额
 */
export function formatTokenAmount(amount: bigint, tokenSymbol: string): string {
  const tokenInfo = Object.values(TOKEN_CONFIG.NATIVE_TOKENS)
    .find(token => token.symbol === tokenSymbol);
  
  if (!tokenInfo) {
    return amount.toString();
  }
  
  const decimals = tokenInfo.decimals;
  const divisor = BigInt(10) ** BigInt(decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  
  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  return trimmedFractional.length > 0 
    ? `${wholePart}.${trimmedFractional}`
    : wholePart.toString();
}

/**
 * 解析代币金额字符串
 */
export function parseTokenAmount(amountStr: string, tokenSymbol: string): bigint {
  const tokenInfo = Object.values(TOKEN_CONFIG.NATIVE_TOKENS)
    .find(token => token.symbol === tokenSymbol);
  
  if (!tokenInfo) {
    return BigInt(amountStr);
  }
  
  const decimals = tokenInfo.decimals;
  const [wholePart, fractionalPart = ''] = amountStr.split('.');
  
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  const wholeAmount = BigInt(wholePart || '0') * (BigInt(10) ** BigInt(decimals));
  const fractionalAmount = BigInt(paddedFractional || '0');
  
  return wholeAmount + fractionalAmount;
}