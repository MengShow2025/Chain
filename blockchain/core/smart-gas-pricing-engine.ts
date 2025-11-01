import { Transaction } from '../../shared/types/blockchain.js';
import { TOKEN_CONFIG } from '../../shared/constants/blockchain.js';

/**
 * 智能Gas费定价引擎
 * 基于ttUSD稳定币的动态gas费定价机制
 */
export class SmartGasPricingEngine {
  private baseFeePerGas: bigint = BigInt('1000000000'); // 1 Gwei 基础费用
  private maxFeePerGas: bigint = BigInt('100000000000'); // 100 Gwei 最大费用
  private targetGasUsed: bigint = BigInt('15000000'); // 目标gas使用量
  private gasUsedRatio: number = 0.5; // 当前gas使用比例
  
  // ttUSD相关配置
  private readonly MAX_IDLE_FEE_TTUSD = BigInt('500000000000000'); // 0.0005 ttUSD (18位精度)
  private readonly TTUSD_DECIMALS = 18;
  private readonly TTN_DECIMALS = 18;
  
  // 汇率管理
  private ttnToTtUsdRate: number = 1.0; // TTN/ttUSD汇率，默认1:1
  private lastRateUpdate: number = Date.now();
  private readonly RATE_UPDATE_INTERVAL = 60000; // 1分钟更新一次汇率
  
  // 网络状