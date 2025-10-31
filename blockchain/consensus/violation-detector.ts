import { 
  Validator, 
  ValidatorCandidate, 
  ViolationRecord, 
  ViolationType, 
  HardwareMetrics, 
  NetworkMetrics,
  AssociatedNodesAnalysis,
  AssociatedNodeGroup
} from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG } from '../../shared/constants/blockchain.js';

/**
 * 违规检测系统
 * 负责监控验证节点的各种违规行为并自动处理
 */
export class ViolationDetector {
  private violationHistory: Map<string, ViolationRecord[]> = new Map();
  private hardwareMetrics: Map<string, HardwareMetrics> = new Map();
  private networkMetrics: Map<string, NetworkMetrics> = new Map();
  private associatedNodesCache: AssociatedNodesAnalysis | null = null;
  private lastAssociatedNodesCheck: number = 0;
  private kickValidatorCallback?: (address: string, reason: string) => Promise<void>;
  
  // 违规阈值配置
  private readonly VIOLATION_THRESHOLDS = {
    // 硬件条件阈值
    MIN_CPU_AVAILABLE: 20, // 至少20%可用CPU
    MIN_MEMORY_AVAILABLE: 30, // 至少30%可用内存
    MIN_DISK_AVAILABLE: 20, // 至少20%可用磁盘
    MIN_NETWORK_BANDWIDTH: 100, // 至少100Mbps
    
    // 网络性能阈值
    MAX_LATENCY: 500, // 最大延迟500ms
    MIN_UPTIME: 95, // 最小在线时间95%
    MAX_RESPONSE_TIME: 1000, // 最大响应时间1秒
    MAX_MISSED_BLOCKS_RATIO: 0.05, // 最大错过区块比例5%
    
    // 违规累积阈值
    MAX_LOW_VIOLATIONS: 10,
    MAX_MEDIUM_VIOLATIONS: 5,
    MAX_HIGH_VIOLATIONS: 2,
    MAX_CRITICAL_VIOLATIONS: 1,
    
    // 时间窗口（毫秒）
    VIOLATION_WINDOW: 24 * 60 * 60 * 1000, // 24小时
    OFFLINE_THRESHOLD: 30 * 60 * 1000, // 30分钟离线视为违规
    
    // 关联节点检测
    ASSOCIATED_NODES_CHECK_INTERVAL: 60 * 60 * 1000, // 1小时检查一次
    MAX_SAME_IP_NODES: 2, // 同一IP最多2个节点
    BEHAVIOR_SIMILARITY_THRESHOLD: 0.8, // 行为相似度阈值
    STAKE_PATTERN_THRESHOLD: 0.9 // 质押模式相似度阈值
  };
  
  constructor() {
    console.log('Initializing Violation Detection System');
    this.startContinuousMonitoring();
  }
  
  /**
   * 设置踢出验证节点的回调函数
   */
  setKickValidatorCallback(callback: (address: string, reason: string) => Promise<void>): void {
    this.kickValidatorCallback = callback;
  }
  
  /**
   * 启动持续监控
   */
  private startContinuousMonitoring(): void {
    // 每分钟检查一次硬件和网络指标
    setInterval(() => {
      this.checkAllValidatorsHealth();
    }, 60 * 1000);
    
    // 每小时检查一次关联节点
    setInterval(() => {
      this.checkAssociatedNodes();
    }, this.VIOLATION_THRESHOLDS.ASSOCIATED_NODES_CHECK_INTERVAL);
    
    // 每天清理过期违规记录
    setInterval(() => {
      this.cleanupExpiredViolations();
    }, 24 * 60 * 60 * 1000);
    
    console.log('Continuous monitoring started');
  }
  
  /**
   * 检查所有验证节点健康状况
   */
  private async checkAllValidatorsHealth(): Promise<void> {
    for (const [address, metrics] of this.hardwareMetrics) {
      await this.checkHardwareViolations(address, metrics);
    }
    
    for (const [address, metrics] of this.networkMetrics) {
      await this.checkNetworkViolations(address, metrics);
    }
  }
  
  /**
   * 检查硬件违规
   */
  private async checkHardwareViolations(address: string, metrics: HardwareMetrics): Promise<void> {
    const violations: ViolationRecord[] = [];
    
    // CPU使用率检查
    if (metrics.cpuUsage > (100 - this.VIOLATION_THRESHOLDS.MIN_CPU_AVAILABLE)) {
      violations.push({
        type: ViolationType.HARDWARE_INSUFFICIENT,
        severity: 'medium',
        timestamp: Date.now(),
        blockNumber: 0,
        description: `CPU usage too high: ${metrics.cpuUsage}%`,
        evidence: { cpuUsage: metrics.cpuUsage, threshold: this.VIOLATION_THRESHOLDS.MIN_CPU_AVAILABLE },
        penalty: BigInt('1000000000000000000'), // 1 TTN penalty
        resolved: false
      });
    }
    
    // 内存使用率检查
    if (metrics.memoryUsage > (100 - this.VIOLATION_THRESHOLDS.MIN_MEMORY_AVAILABLE)) {
      violations.push({
        type: ViolationType.HARDWARE_INSUFFICIENT,
        severity: 'medium',
        timestamp: Date.now(),
        blockNumber: 0,
        description: `Memory usage too high: ${metrics.memoryUsage}%`,
        evidence: { memoryUsage: metrics.memoryUsage, threshold: this.VIOLATION_THRESHOLDS.MIN_MEMORY_AVAILABLE },
        penalty: BigInt('1000000000000000000'),
        resolved: false
      });
    }
    
    // 磁盘使用率检查
    if (metrics.diskUsage > (100 - this.VIOLATION_THRESHOLDS.MIN_DISK_AVAILABLE)) {
      violations.push({
        type: ViolationType.HARDWARE_INSUFFICIENT,
        severity: 'high',
        timestamp: Date.now(),
        blockNumber: 0,
        description: `Disk usage too high: ${metrics.diskUsage}%`,
        evidence: { diskUsage: metrics.diskUsage, threshold: this.VIOLATION_THRESHOLDS.MIN_DISK_AVAILABLE },
        penalty: BigInt('5000000000000000000'), // 5 TTN penalty
        resolved: false
      });
    }
    
    // 网络带宽检查
    if (metrics.networkBandwidth < this.VIOLATION_THRESHOLDS.MIN_NETWORK_BANDWIDTH) {
      violations.push({
        type: ViolationType.HARDWARE_INSUFFICIENT,
        severity: 'high',
        timestamp: Date.now(),
        blockNumber: 0,
        description: `Network bandwidth insufficient: ${metrics.networkBandwidth}Mbps`,
        evidence: { bandwidth: metrics.networkBandwidth, threshold: this.VIOLATION_THRESHOLDS.MIN_NETWORK_BANDWIDTH },
        penalty: BigInt('3000000000000000000'), // 3 TTN penalty
        resolved: false
      });
    }
    
    // 记录违规
    for (const violation of violations) {
      await this.recordViolation(address, violation);
    }
  }
  
  /**
   * 检查网络违规
   */
  private async checkNetworkViolations(address: string, metrics: NetworkMetrics): Promise<void> {
    const violations: ViolationRecord[] = [];
    
    // 延迟检查
    if (metrics.latency > this.VIOLATION_THRESHOLDS.MAX_LATENCY) {
      violations.push({
        type: ViolationType.RESPONSE_TIMEOUT,
        severity: 'medium',
        timestamp: Date.now(),
        blockNumber: 0,
        description: `High latency: ${metrics.latency}ms`,
        evidence: { latency: metrics.latency, threshold: this.VIOLATION_THRESHOLDS.MAX_LATENCY },
        penalty: BigInt('2000000000000000000'), // 2 TTN penalty
        resolved: false
      });
    }
    
    // 在线时间检查
    if (metrics.uptime < this.VIOLATION_THRESHOLDS.MIN_UPTIME) {
      const severity = metrics.uptime < 90 ? 'high' : 'medium';
      violations.push({
        type: ViolationType.LONG_OFFLINE,
        severity,
        timestamp: Date.now(),
        blockNumber: 0,
        description: `Low uptime: ${metrics.uptime}%`,
        evidence: { uptime: metrics.uptime, threshold: this.VIOLATION_THRESHOLDS.MIN_UPTIME },
        penalty: BigInt(severity === 'high' ? '10000000000000000000' : '5000000000000000000'), // 10 or 5 TTN
        resolved: false
      });
    }
    
    // 响应时间检查
    if (metrics.responseTime > this.VIOLATION_THRESHOLDS.MAX_RESPONSE_TIME) {
      violations.push({
        type: ViolationType.RESPONSE_TIMEOUT,
        severity: 'medium',
        timestamp: Date.now(),
        blockNumber: 0,
        description: `Slow response time: ${metrics.responseTime}ms`,
        evidence: { responseTime: metrics.responseTime, threshold: this.VIOLATION_THRESHOLDS.MAX_RESPONSE_TIME },
        penalty: BigInt('2000000000000000000'),
        resolved: false
      });
    }
    
    // 区块生产失败检查
    const totalBlocks = metrics.blocksProduced + metrics.blocksMissed;
    if (totalBlocks > 0) {
      const missedRatio = metrics.blocksMissed / totalBlocks;
      if (missedRatio > this.VIOLATION_THRESHOLDS.MAX_MISSED_BLOCKS_RATIO) {
        violations.push({
          type: ViolationType.BLOCK_PRODUCTION_FAILURE,
          severity: 'high',
          timestamp: Date.now(),
          blockNumber: 0,
          description: `High missed blocks ratio: ${(missedRatio * 100).toFixed(2)}%`,
          evidence: { 
            missedBlocks: metrics.blocksMissed, 
            totalBlocks, 
            ratio: missedRatio,
            threshold: this.VIOLATION_THRESHOLDS.MAX_MISSED_BLOCKS_RATIO 
          },
          penalty: BigInt('8000000000000000000'), // 8 TTN penalty
          resolved: false
        });
      }
    }
    
    // 记录违规
    for (const violation of violations) {
      await this.recordViolation(address, violation);
    }
  }
  
  /**
   * 检查关联节点
   */
  private async checkAssociatedNodes(): Promise<void> {
    const now = Date.now();
    if (now - this.lastAssociatedNodesCheck < this.VIOLATION_THRESHOLDS.ASSOCIATED_NODES_CHECK_INTERVAL) {
      return;
    }
    
    console.log('Checking for associated nodes...');
    
    const analysis = await this.analyzeAssociatedNodes();
    this.associatedNodesCache = analysis;
    this.lastAssociatedNodesCheck = now;
    
    // 处理发现的关联节点组
    for (const group of analysis.suspiciousGroups) {
      if (group.riskScore > 70) { // 高风险组
        await this.handleAssociatedNodesViolation(group);
      }
    }
  }
  
  /**
   * 分析关联节点
   */
  private async analyzeAssociatedNodes(): Promise<AssociatedNodesAnalysis> {
    const suspiciousGroups: AssociatedNodeGroup[] = [];
    const allNodes = Array.from(this.networkMetrics.keys());
    
    // 检查同一IP的节点
    const ipGroups = this.groupNodesByIP();
    for (const [ip, nodes] of ipGroups) {
      if (nodes.length > this.VIOLATION_THRESHOLDS.MAX_SAME_IP_NODES) {
        suspiciousGroups.push({
          nodes,
          associationType: 'same_ip',
          confidence: 95,
          riskScore: Math.min(100, nodes.length * 20),
          evidence: [{ ip, nodeCount: nodes.length }]
        });
      }
    }
    
    // 检查行为相似的节点
    const behaviorGroups = await this.findSimilarBehaviorNodes();
    suspiciousGroups.push(...behaviorGroups);
    
    // 计算整体风险等级
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const maxRiskScore = Math.max(...suspiciousGroups.map(g => g.riskScore), 0);
    
    if (maxRiskScore > 90) riskLevel = 'critical';
    else if (maxRiskScore > 70) riskLevel = 'high';
    else if (maxRiskScore > 50) riskLevel = 'medium';
    
    return {
      suspiciousGroups,
      riskLevel,
      totalNodes: allNodes.length,
      analysisTimestamp: Date.now()
    };
  }
  
  /**
   * 按IP分组节点
   */
  private groupNodesByIP(): Map<string, string[]> {
    const ipGroups = new Map<string, string[]>();
    
    for (const [address, metrics] of this.networkMetrics) {
      const ip = metrics.ipAddress;
      if (!ipGroups.has(ip)) {
        ipGroups.set(ip, []);
      }
      ipGroups.get(ip)!.push(address);
    }
    
    return ipGroups;
  }
  
  /**
   * 查找行为相似的节点
   */
  private async findSimilarBehaviorNodes(): Promise<AssociatedNodeGroup[]> {
    const groups: AssociatedNodeGroup[] = [];
    const nodes = Array.from(this.networkMetrics.keys());
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const similarity = this.calculateBehaviorSimilarity(nodes[i], nodes[j]);
        if (similarity > this.VIOLATION_THRESHOLDS.BEHAVIOR_SIMILARITY_THRESHOLD) {
          groups.push({
            nodes: [nodes[i], nodes[j]],
            associationType: 'similar_behavior',
            confidence: Math.round(similarity * 100),
            riskScore: Math.round(similarity * 80),
            evidence: [{ similarity, type: 'behavior_pattern' }]
          });
        }
      }
    }
    
    return groups;
  }
  
  /**
   * 计算行为相似度
   */
  private calculateBehaviorSimilarity(address1: string, address2: string): number {
    const metrics1 = this.networkMetrics.get(address1);
    const metrics2 = this.networkMetrics.get(address2);
    
    if (!metrics1 || !metrics2) return 0;
    
    // 计算各项指标的相似度
    const latencySimilarity = 1 - Math.abs(metrics1.latency - metrics2.latency) / Math.max(metrics1.latency, metrics2.latency);
    const uptimeSimilarity = 1 - Math.abs(metrics1.uptime - metrics2.uptime) / 100;
    const responseSimilarity = 1 - Math.abs(metrics1.responseTime - metrics2.responseTime) / Math.max(metrics1.responseTime, metrics2.responseTime);
    
    // 加权平均
    return (latencySimilarity * 0.4 + uptimeSimilarity * 0.3 + responseSimilarity * 0.3);
  }
  
  /**
   * 处理关联节点违规
   */
  private async handleAssociatedNodesViolation(group: AssociatedNodeGroup): Promise<void> {
    const violation: ViolationRecord = {
      type: ViolationType.ASSOCIATED_NODES,
      severity: group.riskScore > 90 ? 'critical' : 'high',
      timestamp: Date.now(),
      blockNumber: 0,
      description: `Associated nodes detected: ${group.associationType}`,
      evidence: { group },
      penalty: BigInt('50000000000000000000'), // 50 TTN penalty per node
      resolved: false
    };
    
    // 对组内所有节点记录违规
    for (const address of group.nodes) {
      await this.recordViolation(address, violation);
    }
    
    console.log(`Associated nodes violation recorded for group: ${group.nodes.join(', ')}`);
  }
  
  /**
   * 记录违规
   */
  private async recordViolation(address: string, violation: ViolationRecord): Promise<void> {
    if (!this.violationHistory.has(address)) {
      this.violationHistory.set(address, []);
    }
    
    const history = this.violationHistory.get(address)!;
    history.push(violation);
    
    // 保持历史记录在合理范围内
    if (history.length > 100) {
      history.shift();
    }
    
    console.log(`Violation recorded for ${address}: ${violation.type} (${violation.severity})`);
    
    // 检查是否需要自动踢出
    if (await this.shouldKickValidator(address)) {
      await this.kickValidator(address, 'Violation threshold exceeded');
    }
  }
  
  /**
   * 检查是否应该踢出验证节点
   */
  private async shouldKickValidator(address: string): Promise<boolean> {
    const history = this.violationHistory.get(address) || [];
    const now = Date.now();
    const windowStart = now - this.VIOLATION_THRESHOLDS.VIOLATION_WINDOW;
    
    // 只考虑时间窗口内的违规
    const recentViolations = history.filter(v => v.timestamp >= windowStart && !v.resolved);
    
    // 按严重程度统计
    const counts = {
      low: recentViolations.filter(v => v.severity === 'low').length,
      medium: recentViolations.filter(v => v.severity === 'medium').length,
      high: recentViolations.filter(v => v.severity === 'high').length,
      critical: recentViolations.filter(v => v.severity === 'critical').length
    };
    
    // 检查是否超过阈值
    return (
      counts.critical >= this.VIOLATION_THRESHOLDS.MAX_CRITICAL_VIOLATIONS ||
      counts.high >= this.VIOLATION_THRESHOLDS.MAX_HIGH_VIOLATIONS ||
      counts.medium >= this.VIOLATION_THRESHOLDS.MAX_MEDIUM_VIOLATIONS ||
      counts.low >= this.VIOLATION_THRESHOLDS.MAX_LOW_VIOLATIONS
    );
  }
  
  /**
   * 踢出验证节点
   */
  private async kickValidator(address: string, reason: string): Promise<void> {
    console.log(`Kicking validator ${address}: ${reason}`);
    
    // 调用外部回调函数来踢出验证节点
    if (this.kickValidatorCallback) {
      await this.kickValidatorCallback(address, reason);
    }
    
    // 记录踢出事件
    const violation: ViolationRecord = {
      type: ViolationType.NETWORK_ATTACK,
      severity: 'critical',
      timestamp: Date.now(),
      blockNumber: 0,
      description: `Validator kicked: ${reason}`,
      evidence: { reason, violationHistory: this.violationHistory.get(address) },
      penalty: BigInt('0'), // 踢出本身就是惩罚
      resolved: true
    };
    
    const history = this.violationHistory.get(address) || [];
    history.push(violation);
    this.violationHistory.set(address, history);
  }
  
  /**
   * 更新硬件指标
   */
  updateHardwareMetrics(address: string, metrics: HardwareMetrics): void {
    this.hardwareMetrics.set(address, metrics);
  }
  
  /**
   * 更新网络指标
   */
  updateNetworkMetrics(address: string, metrics: NetworkMetrics): void {
    this.networkMetrics.set(address, metrics);
  }
  
  /**
   * 获取违规历史
   */
  getViolationHistory(address: string): ViolationRecord[] {
    return this.violationHistory.get(address) || [];
  }
  
  /**
   * 获取关联节点分析结果
   */
  getAssociatedNodesAnalysis(): AssociatedNodesAnalysis | null {
    return this.associatedNodesCache;
  }
  
  /**
   * 检查验证节点是否健康
   */
  isValidatorHealthy(address: string): boolean {
    return !this.shouldKickValidator(address);
  }
  
  /**
   * 获取最近的违规记录
   */
  getRecentViolations(address: string): ViolationRecord[] {
    const history = this.violationHistory.get(address) || [];
    const now = Date.now();
    const windowStart = now - this.VIOLATION_THRESHOLDS.VIOLATION_WINDOW;
    
    return history.filter(v => v.timestamp >= windowStart && !v.resolved);
  }
  
  /**
   * 清理过期的违规记录
   */
  private cleanupExpiredViolations(): void {
    const now = Date.now();
    const expiryTime = now - (this.VIOLATION_THRESHOLDS.VIOLATION_WINDOW * 2); // 保留2倍时间窗口的记录
    
    for (const [address, history] of this.violationHistory) {
      const filteredHistory = history.filter(v => v.timestamp >= expiryTime);
      if (filteredHistory.length === 0) {
        this.violationHistory.delete(address);
      } else {
        this.violationHistory.set(address, filteredHistory);
      }
    }
    
    console.log('Expired violation records cleaned up');
  }
}