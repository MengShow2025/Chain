import { Block, Transaction, BatchCommit } from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG, PERFORMANCE_CONFIG, SECURITY_VALIDATION, SEQUENCER_CONFIG } from '../../shared/constants/blockchain.js';
import { casClient } from '../../shared/da/cas-client.js';
import { computeBatchRoots } from '../../shared/utils/merkle.js';
import { witnessRegistry } from '../../shared/security/witness-registry.js';
import { keccak256, toUtf8Bytes } from 'ethers';
import { verifyMessage } from 'ethers';

/**
 * 区块验证器
 * 负责验证区块的有效性，包括结构、交易、共识等
 */
export class BlockValidator {
  
  /**
   * 验证区块
   */
  async validateBlock(block: Block, parentBlock?: Block): Promise<boolean> {
    try {
      // 1. 基本结构验证
      if (!this.validateBlockStructure(block)) {
        console.error('Block structure validation failed');
        return false;
      }
      
      // 2. 父区块验证
      if (parentBlock && !this.validateParentBlock(block, parentBlock)) {
        console.error('Parent block validation failed');
        return false;
      }
      
      // 3. 交易验证
      if (!await this.validateTransactions(block.transactions)) {
        console.error('Transactions validation failed');
        return false;
      }
      
      // 4. Gas验证
      if (!this.validateGasUsage(block)) {
        console.error('Gas usage validation failed');
        return false;
      }
      
      // 5. 时间戳验证
      if (!this.validateTimestamp(block, parentBlock)) {
        console.error('Timestamp validation failed');
        return false;
      }
      
      // 6. 区块大小验证
      if (!this.validateBlockSize(block)) {
        console.error('Block size validation failed');
        return false;
      }
      
      // 7. Merkle根验证
      if (!this.validateMerkleRoots(block)) {
        console.error('Merkle roots validation failed');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Block validation error:', error);
      return false;
    }
  }

  /**
   * 批次承诺校验（占位实现）
   * 用于验证 off-chain 匹配引擎生成的批次承诺结构与基础约束
   */
  async validateOffchainBatchCommit(commit: BatchCommit): Promise<{ ok: boolean; reason?: string }>{
    try {
      // 根据安全模式与环境变量决定是否跳过见证校验
      const mode = SECURITY_VALIDATION.SECURITY_MODE;
      const envSkip = process.env.SKIP_WITNESS_VALIDATION === 'true';
      const SKIP_WITNESS_VALIDATION = envSkip || mode === 'perf_eval';
      const DO_DA_CHECK = !!(SECURITY_VALIDATION.LAYERED_VALIDATION?.L1_DA_CHECK) && mode !== 'perf_eval';
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Validator] Security mode=${mode} envSkip=${envSkip} -> skipWitness=${SKIP_WITNESS_VALIDATION} daCheck=${DO_DA_CHECK}`);
      }

      if (!commit || typeof commit.batchId !== 'string' || !commit.batchId) {
        return { ok: false, reason: 'invalid_batchId' };
      }

      // 校验配方版本
      if (commit.recipeVersion && commit.recipeVersion !== SECURITY_VALIDATION.RECIPE_FORMAT_VERSION) {
        return { ok: false, reason: 'recipe_version_mismatch' };
      }

      // 需要包含的根根据排序器配置进行校验
      const requireHex66 = (v?: string) => !!v && typeof v === 'string' && v.startsWith('0x') && v.length === 66;
      if (SEQUENCER_CONFIG.BATCH_COMMIT_FIELDS.includeNextStateRoot && !requireHex66(commit.nextStateRoot)) {
        return { ok: false, reason: 'missing_or_invalid_nextStateRoot' };
      }
      if (SEQUENCER_CONFIG.BATCH_COMMIT_FIELDS.includeLiquidityMetaRoot && !requireHex66(commit.liquidityMetaRoot)) {
        return { ok: false, reason: 'missing_or_invalid_liquidityMetaRoot' };
      }
      if (SEQUENCER_CONFIG.BATCH_COMMIT_FIELDS.includeFeeReceiptsRoot && !requireHex66(commit.feeReceiptsRoot)) {
        return { ok: false, reason: 'missing_or_invalid_feeReceiptsRoot' };
      }
      if (SEQUENCER_CONFIG.BATCH_COMMIT_FIELDS.includeDistributionPlanRoot && !requireHex66(commit.distributionPlanRoot)) {
        return { ok: false, reason: 'missing_or_invalid_distributionPlanRoot' };
      }

      // 如提供其他根，必须满足格式
      const optionalRoots: (keyof BatchCommit)[] = [
        'ordersRoot', 'matchesRoot', 'cancellationsRoot', 'balanceDiffsRoot', 'auditLogRoot',
        'gasCostRoot', 'sponsorAccountsRoot', 'prevStateRoot'
      ];
      for (const key of optionalRoots) {
        const val = commit[key] as unknown as string | undefined;
        if (val && !requireHex66(val)) {
          return { ok: false, reason: `invalid_${String(key)}` };
        }
      }

      // 赞助与燃气根一致性校验：若使用其中任一，则两者必须同时提供
      const hasGasCostRoot = !!commit.gasCostRoot;
      const hasSponsorAccountsRoot = !!commit.sponsorAccountsRoot;
      if (hasGasCostRoot !== hasSponsorAccountsRoot) {
        return { ok: false, reason: 'inconsistent_sponsor_gas_roots' };
      }

      // 门限见证（基础校验：数量）
      const witnesses = Array.isArray(commit.witnessSigs) ? commit.witnessSigs : [];
      if (witnesses.length < SEQUENCER_CONFIG.WITNESS_THRESHOLD) {
        return { ok: false, reason: 'insufficient_witness_signatures' };
      }
      // 在开发模式下跳过签名与身份校验，仅进行数量与重复签名字符串检测
      if (!SKIP_WITNESS_VALIDATION) {
        // 见证签名与身份校验（恢复地址并验证是否在注册表）
        // 固化摘要字段顺序，确保签名一致性
        const digestString = this.computeCommitDigestString(commit);
        console.log('[Validator] Commit digest:', digestString);
        const recoveredSet = new Set<string>();
        const signatureSet = new Set<string>();
        for (const sig of witnesses) {
          if (typeof sig !== 'string' || !sig.startsWith('0x')) {
            return { ok: false, reason: 'invalid_witness_signature' };
          }
          // 签名字符串层面的重复检测（同一签名重复提交）
          const sigLower = sig.toLowerCase();
          if (signatureSet.has(sigLower)) {
            console.warn('[Validator] Duplicate signature string detected');
            return { ok: false, reason: 'duplicate_witness' };
          }
          signatureSet.add(sigLower);
          let addr: string;
          try {
            // 使用 EIP-191 前缀消息签名与恢复
            addr = verifyMessage(digestString, sig);
          } catch (e) {
            return { ok: false, reason: 'invalid_witness_signature' };
          }
          console.log('[Validator] Recovered witness addr:', addr);
          if (!witnessRegistry.isRegistered(addr)) {
            return { ok: false, reason: 'unauthorized_witness' };
          }
          if (recoveredSet.has(addr.toLowerCase())) {
            console.warn('[Validator] Duplicate witness detected:', addr);
            return { ok: false, reason: 'duplicate_witness' };
          }
          recoveredSet.add(addr.toLowerCase());
        }
        console.log('[Validator] Unique witnesses collected:', recoveredSet.size, 'submitted:', witnesses.length);
        // 除了门限，还要求唯一见证数量与提交数量一致（避免同一地址重复签名）
        if (recoveredSet.size < SEQUENCER_CONFIG.WITNESS_THRESHOLD) {
          return { ok: false, reason: 'insufficient_unique_witnesses' };
        }
        if (recoveredSet.size !== witnesses.length) {
          return { ok: false, reason: 'duplicate_witness' };
        }
      }

      // 时间戳存在性校验
      if (commit.timestamp && typeof commit.timestamp !== 'number') {
        return { ok: false, reason: 'invalid_timestamp' };
      }

      // 数据可用性 CID（如提供）格式校验
      if (commit.cid && typeof commit.cid !== 'string') {
        return { ok: false, reason: 'invalid_cid' };
      }

      // L1 数据可用性检查：如启用则拉取批次数据并校验 Merkle 根一致性
      if (DO_DA_CHECK) {
        if (!commit.cid) {
          return { ok: false, reason: 'missing_cid_for_da_check' };
        }
        const data = casClient.get(commit.cid);
        if (!data) {
          return { ok: false, reason: 'da_data_unavailable' };
        }
        const roots = computeBatchRoots({
          orders: data.orders || [],
          matches: data.matches || [],
          balanceDiffs: data.balanceDiffs || [],
          auditLog: data.auditLog || [],
        });
        // 如提交了对应根，则必须与数据一致
        if (commit.ordersRoot && commit.ordersRoot !== roots.ordersRoot) {
          return { ok: false, reason: 'orders_root_mismatch' };
        }
        if (commit.matchesRoot && commit.matchesRoot !== roots.matchesRoot) {
          return { ok: false, reason: 'matches_root_mismatch' };
        }
        if (commit.balanceDiffsRoot && commit.balanceDiffsRoot !== roots.balanceDiffsRoot) {
          return { ok: false, reason: 'balance_diffs_root_mismatch' };
        }
        if (commit.auditLogRoot && commit.auditLogRoot !== roots.auditLogRoot) {
          return { ok: false, reason: 'audit_log_root_mismatch' };
        }
      }

      // 严格模式下：要求提供审计日志根以支持公平性验证占位（可选增强）
      if (mode === 'strict') {
        const requireHex66 = (v?: string) => !!v && typeof v === 'string' && v.startsWith('0x') && v.length === 66;
        if (!requireHex66(commit.auditLogRoot)) {
          return { ok: false, reason: 'missing_or_invalid_auditLogRoot' };
        }
      }

      // 后续：在严格模式下可进行更深层的重放与公平性检查
      // 当前为占位实现，仅进行结构与门限校验
      return { ok: true };
    } catch (e) {
      console.error('validateOffchainBatchCommit error:', e);
      return { ok: false, reason: 'internal_error' };
    }
  }

  private computeCommitDigestString(commit: BatchCommit): string {
    const parts = [
      commit.batchId || '',
      commit.cid || '',
      commit.ordersRoot || '',
      commit.matchesRoot || '',
      commit.balanceDiffsRoot || '',
      commit.auditLogRoot || '',
      // 新增：将赞助账户根与燃气成本根纳入摘要以增强一致性
      commit.sponsorAccountsRoot || '',
      commit.gasCostRoot || '',
      commit.prevStateRoot || '',
      commit.nextStateRoot || '',
      commit.feeReceiptsRoot || '',
      commit.distributionPlanRoot || '',
      commit.liquidityMetaRoot || '',
      String(commit.timestamp || 0),
    ];
    // 可选：外部验证哈希值为 keccak256(toUtf8Bytes(parts.join('|')))
    return parts.join('|');
  }
  
  /**
   * 验证区块基本结构
   */
  private validateBlockStructure(block: Block): boolean {
    // 检查必需字段
    if (typeof block.number !== 'number' || block.number < 0) {
      return false;
    }
    
    if (!block.hash || typeof block.hash !== 'string' || !block.hash.startsWith('0x')) {
      return false;
    }
    
    if (!block.parentHash || typeof block.parentHash !== 'string' || !block.parentHash.startsWith('0x')) {
      return false;
    }
    
    if (typeof block.timestamp !== 'number' || block.timestamp <= 0) {
      return false;
    }
    
    if (!block.validator || typeof block.validator !== 'string') {
      return false;
    }
    
    if (!Array.isArray(block.transactions)) {
      return false;
    }
    
    if (typeof block.gasUsed !== 'bigint' || block.gasUsed < 0) {
      return false;
    }
    
    if (typeof block.gasLimit !== 'bigint' || block.gasLimit <= 0) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 验证父区块关系
   */
  private validateParentBlock(block: Block, parentBlock: Block): boolean {
    // 区块号必须连续
    if (block.number !== parentBlock.number + 1) {
      return false;
    }
    
    // 父哈希必须匹配
    if (block.parentHash !== parentBlock.hash) {
      return false;
    }
    
    // 时间戳必须递增
    if (block.timestamp <= parentBlock.timestamp) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 验证交易列表
   */
  private async validateTransactions(transactions: Transaction[]): Promise<boolean> {
    const seenHashes = new Set<string>();
    
    for (const tx of transactions) {
      // 检查交易重复
      if (seenHashes.has(tx.hash)) {
        return false;
      }
      seenHashes.add(tx.hash);
      
      // 验证单个交易
      if (!await this.validateTransaction(tx)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 验证单个交易
   */
  private async validateTransaction(tx: Transaction): Promise<boolean> {
    // 基本字段验证
    if (!tx.hash || !tx.from || !tx.to) {
      return false;
    }
    
    // 地址格式验证
    if (!this.isValidAddress(tx.from) || !this.isValidAddress(tx.to)) {
      return false;
    }
    
    // Gas验证
    if (typeof tx.gas !== 'bigint' || tx.gas <= 0) {
      return false;
    }
    
    if (typeof tx.gasPrice !== 'bigint' || tx.gasPrice < 0) {
      return false;
    }
    
    // 值验证
    if (typeof tx.value !== 'bigint' || tx.value < 0) {
      return false;
    }
    
    // Nonce验证
    if (typeof tx.nonce !== 'number' || tx.nonce < 0) {
      return false;
    }
    
    // 0-gas费交易验证
    if (tx.isZeroGas) {
      if (tx.contractTier && (tx.contractTier < 1 || tx.contractTier > 3)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 验证Gas使用量
   */
  private validateGasUsage(block: Block): boolean {
    // Gas使用量不能超过限制
    if (block.gasUsed > block.gasLimit) {
      return false;
    }
    
    // Gas使用量不能超过全局限制
    if (block.gasLimit > PERFORMANCE_CONFIG.MAX_GAS_LIMIT) {
      return false;
    }
    
    // 计算交易Gas总和
    const totalGas = block.transactions.reduce((sum, tx) => sum + tx.gas, BigInt(0));
    
    // Gas使用量应该等于交易Gas总和（简化验证）
    if (block.gasUsed > totalGas) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 验证时间戳
   */
  private validateTimestamp(block: Block, parentBlock?: Block): boolean {
    const now = Date.now();
    const maxFutureTime = 15 * 1000; // 允许15秒的未来时间
    
    // 不能太远的未来
    if (block.timestamp > now + maxFutureTime) {
      return false;
    }
    
    // 不能太远的过去
    if (block.timestamp < now - 24 * 60 * 60 * 1000) { // 24小时前
      return false;
    }
    
    // 必须晚于父区块
    if (parentBlock && block.timestamp <= parentBlock.timestamp) {
      return false;
    }
    
    // 区块间隔不能太短
    if (parentBlock) {
      const minInterval = CONSENSUS_CONFIG.BLOCK_TIME * 1000 * 0.5; // 最小间隔为目标时间的50%
      if (block.timestamp - parentBlock.timestamp < minInterval) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 验证区块大小
   */
  private validateBlockSize(block: Block): boolean {
    // 计算区块大小
    const blockSize = this.calculateBlockSize(block);
    
    // 不能超过最大限制
    if (blockSize > PERFORMANCE_CONFIG.MAX_BLOCK_SIZE) {
      return false;
    }
    
    // 区块大小应该与记录的大小匹配
    if (Math.abs(blockSize - block.size) > 1024) { // 允许1KB的误差
      return false;
    }
    
    return true;
  }
  
  /**
   * 验证Merkle根
   */
  private validateMerkleRoots(block: Block): boolean {
    // 验证交易根
    const calculatedTxRoot = this.calculateTransactionsRoot(block.transactions);
    if (calculatedTxRoot !== block.transactionsRoot) {
      return false;
    }
    
    // 验证收据根
    const calculatedReceiptsRoot = this.calculateReceiptsRoot(block.transactions);
    if (calculatedReceiptsRoot !== block.receiptsRoot) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 验证地址格式
   */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  
  /**
   * 计算区块大小
   */
  private calculateBlockSize(block: Block): number {
    // 简化计算：基础大小 + 交易数据大小
    const baseSize = 1024; // 区块头等基础数据
    const txSize = block.transactions.reduce((sum, tx) => {
      return sum + tx.data.length + 200; // 交易数据 + 元数据
    }, 0);
    
    return baseSize + txSize;
  }
  
  /**
   * 计算交易根哈希
   */
  private calculateTransactionsRoot(transactions: Transaction[]): string {
    if (transactions.length === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }
    
    // 简化实现：将所有交易哈希连接后计算哈希
    const txHashes = transactions.map(tx => tx.hash).join('');
    return '0x' + Buffer.from(txHashes).toString('hex').substring(0, 64).padStart(64, '0');
  }
  
  /**
   * 计算收据根哈希
   */
  private calculateReceiptsRoot(transactions: Transaction[]): string {
    // 简化实现：与交易根相同
    return this.calculateTransactionsRoot(transactions);
  }
  
  /**
   * 验证区块哈希
   */
  validateBlockHash(block: Block): boolean {
    // 简化实现：检查哈希格式
    if (!block.hash || !block.hash.startsWith('0x') || block.hash.length !== 66) {
      return false;
    }
    
    // 实际实现应该重新计算区块哈希并比较
    return true;
  }
  
  /**
   * 验证难度调整
   */
  validateDifficulty(block: Block, parentBlock?: Block): boolean {
    // TitanChain使用PoS，难度固定为1
    return block.difficulty === BigInt(1);
  }
  
  /**
   * 验证验证节点权限
   */
  async validateValidatorPermission(validator: string, blockNumber: number): Promise<boolean> {
    // 这里应该检查验证节点是否有权在指定区块高度出块
    // 简化实现：假设所有验证节点都有权限
    return this.isValidAddress(validator);
  }
  
  /**
   * 验证区块头（增强版）
   */
  validateBlockHeader(block: Block, parentBlock?: Block): boolean {
    try {
      // 1. 基本结构验证
      if (!this.validateBlockStructure(block)) {
        console.error('Block header structure validation failed');
        return false;
      }
  
      // 2. 哈希验证
      if (!this.validateBlockHash(block)) {
        console.error('Block hash validation failed');
        return false;
      }
  
      // 3. 父区块关系验证
      if (parentBlock && !this.validateParentBlock(block, parentBlock)) {
        console.error('Parent block validation failed');
        return false;
      }
  
      // 4. 时间戳验证（增强）
      if (!this.validateTimestampEnhanced(block, parentBlock)) {
        console.error('Enhanced timestamp validation failed');
        return false;
      }
  
      // 5. 验证节点权限验证
      if (!this.validateValidatorPermissionEnhanced(block)) {
        console.error('Validator permission validation failed');
        return false;
      }
  
      // 6. 难度验证
      if (!this.validateDifficulty(block, parentBlock)) {
        console.error('Difficulty validation failed');
        return false;
      }
  
      // 7. Gas限制验证
      if (!this.validateGasLimitEnhanced(block, parentBlock)) {
        console.error('Gas limit validation failed');
        return false;
      }
  
      return true;
    } catch (error) {
      console.error('Block header validation error:', error);
      return false;
    }
  }
  
  /**
   * 增强时间戳验证
   */
  private validateTimestampEnhanced(block: Block, parentBlock?: Block): boolean {
    const now = Date.now();
    const blockTime = block.timestamp;
  
    // 1. 不能是未来时间（允许5秒误差）
    if (blockTime > now + 5000) {
      console.error(`Block timestamp ${blockTime} is too far in the future`);
      return false;
    }
  
    // 2. 不能太旧（不超过1小时前）
    if (blockTime < now - 3600000) {
      console.error(`Block timestamp ${blockTime} is too old`);
      return false;
    }
  
    // 3. 必须大于父区块时间戳
    if (parentBlock && blockTime <= parentBlock.timestamp) {
      console.error(`Block timestamp ${blockTime} is not greater than parent ${parentBlock.timestamp}`);
      return false;
    }
  
    // 4. 检查出块时间间隔
    if (parentBlock) {
      const timeDiff = blockTime - parentBlock.timestamp;
      const expectedBlockTime = CONSENSUS_CONFIG.BLOCK_TIME * 1000; // 转换为毫秒
      
      // 出块时间不能太快（至少1秒）
      if (timeDiff < 1000) {
        console.error(`Block time interval ${timeDiff}ms is too short`);
        return false;
      }
      
      // 出块时间不能太慢（不超过预期时间的10倍）
      if (timeDiff > expectedBlockTime * 10) {
        console.error(`Block time interval ${timeDiff}ms is too long`);
        return false;
      }
    }
  
    return true;
  }
  
  /**
   * 增强验证节点权限验证
   */
  private validateValidatorPermissionEnhanced(block: Block): boolean {
    // 1. 验证节点地址格式
    if (!this.isValidAddress(block.validator)) {
      console.error(`Invalid validator address format: ${block.validator}`);
      return false;
    }
  
    // 2. 检查验证节点是否在黑名单中
    if (this.isValidatorBlacklisted(block.validator)) {
      console.error(`Validator ${block.validator} is blacklisted`);
      return false;
    }
  
    // 3. 检查验证节点是否有足够的质押
    if (!this.hasMinimumStake(block.validator)) {
      console.error(`Validator ${block.validator} does not have minimum stake`);
      return false;
    }
  
    return true;
  }
  
  /**
   * 增强Gas限制验证
   */
  private validateGasLimitEnhanced(block: Block, parentBlock?: Block): boolean {
    // 1. 基本Gas限制检查
    if (block.gasLimit > PERFORMANCE_CONFIG.MAX_GAS_LIMIT) {
      console.error(`Block gas limit ${block.gasLimit} exceeds maximum ${PERFORMANCE_CONFIG.MAX_GAS_LIMIT}`);
      return false;
    }
  
    if (block.gasLimit <= 0) {
      console.error(`Block gas limit ${block.gasLimit} must be positive`);
      return false;
    }
  
    // 2. Gas使用量不能超过限制
    if (block.gasUsed > block.gasLimit) {
      console.error(`Block gas used ${block.gasUsed} exceeds limit ${block.gasLimit}`);
      return false;
    }
  
    // 3. 检查Gas限制调整是否合理
    if (parentBlock) {
      const gasLimitDiff = Number(block.gasLimit - parentBlock.gasLimit);
      const maxAdjustment = Number(parentBlock.gasLimit) * 0.1; // 最多调整10%
      
      if (Math.abs(gasLimitDiff) > maxAdjustment) {
        console.error(`Gas limit adjustment ${gasLimitDiff} exceeds maximum ${maxAdjustment}`);
        return false;
      }
    }
  
    return true;
  }
  
  /**
   * 检查验证节点是否被列入黑名单
   */
  private isValidatorBlacklisted(validator: string): boolean {
    // 这里应该检查验证节点黑名单
    // 简化实现：假设没有黑名单
    return false;
  }
  
  /**
   * 检查验证节点是否有最小质押
   */
  private hasMinimumStake(validator: string): boolean {
    // 这里应该检查验证节点的实际质押量
    // 简化实现：假设都有足够质押
    return true;
  }
  
  /**
   * 验证区块签名
   */
  validateBlockSignature(block: Block): boolean {
    // 这里应该验证区块的数字签名
    // 简化实现：检查基本格式
    if (!block.hash || block.hash.length !== 66) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 验证区块完整性
   */
  validateBlockIntegrity(block: Block): boolean {
    try {
      // 1. 验证区块大小
      if (!this.validateBlockSize(block)) {
        return false;
      }
  
      // 2. 验证交易数量
      if (block.transactions.length > PERFORMANCE_CONFIG.MAX_TRANSACTIONS_PER_BLOCK) {
        console.error(`Too many transactions: ${block.transactions.length}`);
        return false;
      }
  
      // 3. 验证状态根
      if (!block.stateRoot || block.stateRoot.length !== 66) {
        console.error('Invalid state root');
        return false;
      }
  
      // 4. 验证收据根
      if (!block.receiptsRoot || block.receiptsRoot.length !== 66) {
        console.error('Invalid receipts root');
        return false;
      }
  
      return true;
    } catch (error) {
      console.error('Block integrity validation error:', error);
      return false;
    }
  }
}