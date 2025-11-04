// Security Scoring Service for risk assessment and threat evaluation / 风险评估和威胁评估的安全评分服务
import { EventEmitter } from 'events';

// Risk levels / 风险等级
export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
  CRITICAL = 'critical'
}

// Score categories / 评分类别
export enum ScoreCategory {
  NETWORK_SECURITY = 'network_security',
  ACCESS_CONTROL = 'access_control',
  DATA_PROTECTION = 'data_protection',
  SYSTEM_INTEGRITY = 'system_integrity',
  COMPLIANCE = 'compliance',
  THREAT_DETECTION = 'threat_detection',
  INCIDENT_RESPONSE = 'incident_response',
  VULNERABILITY_MANAGEMENT = 'vulnerability_management'
}

// Security metric / 安全指标
export interface SecurityMetric {
  id: string;
  name: string;
  category: ScoreCategory;
  description: string;
  weight: number;
  currentValue: number;
  maxValue: number;
  minValue: number;
  unit: string;
  threshold: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lastUpdated: number;
  source: string;
  tags: string[];
}

// Risk factor / 风险因素
export interface RiskFactor {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: RiskLevel;
  probability: number; // Probability value 0-1 / 概率值 0-1
  impact: number; // Impact score 0-100 / 影响评分 0-100
  likelihood: number; // Likelihood score 0-100 / 可能性评分 0-100
  mitigation: string[];
  detectedAt: number;
  expiresAt?: number;
  source: string;
  evidence: Record<string, any>;
}

// Security score / 安全评分
export interface SecurityScore {
  overall: number;
  categories: Record<ScoreCategory, number>;
  riskLevel: RiskLevel;
  trends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  lastCalculated: number;
  factors: RiskFactor[];
  recommendations: string[];
  confidence: number;
}

// Mitigation action / 缓解措施
export interface MitigationAction {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: number; // hours / 小时
  estimatedCost: number;
  expectedImpact: number; // score improvement / 评分改善
  prerequisites: string[];
  steps: string[];
  riskFactors: string[]; // IDs of risk factors this action addresses / 此措施解决的风险因素ID
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  dueDate?: number;
  completedAt?: number;
}

// Scoring configuration / 评分配置
export interface ScoringConfig {
  enabled: boolean;
  calculationInterval: number; // milliseconds / 毫秒
  retentionDays: number;
  categoryWeights: Record<ScoreCategory, number>;
  riskThresholds: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  trendAnalysisPeriods: {
    daily: number; // days / 天
    weekly: number; // weeks / 周
    monthly: number; // months / 月
  };
  alertThresholds: {
    scoreDecrease: number;
    riskIncrease: number;
    newCriticalFactors: number;
  };
}

// Score history entry / 评分历史条目
export interface ScoreHistoryEntry {
  timestamp: number;
  overall: number;
  categories: Record<ScoreCategory, number>;
  riskLevel: RiskLevel;
  factors: number; // count of risk factors / 风险因素数量
  changes: {
    overall: number;
    categories: Record<ScoreCategory, number>;
  };
}

// Main Security Scoring Service class / 主要安全评分服务类
export class SecurityScoringService extends EventEmitter {
  private config: ScoringConfig;
  private metrics: Map<string, SecurityMetric> = new Map();
  private riskFactors: Map<string, RiskFactor> = new Map();
  private mitigationActions: Map<string, MitigationAction> = new Map();
  private scoreHistory: ScoreHistoryEntry[] = [];
  private currentScore?: SecurityScore;
  private calculationTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: ScoringConfig) {
    super();
    this.config = { ...config };
    this.initializeDefaultMetrics();
  }

  // Initialize default security metrics / 初始化默认安全指标
  private initializeDefaultMetrics(): void {
    const defaultMetrics: SecurityMetric[] = [
      // Network Security metrics / 网络安全指标
      {
        id: 'firewall_rules_active',
        name: 'Active Firewall Rules',
        category: ScoreCategory.NETWORK_SECURITY,
        description: 'Number of active firewall rules / 活跃防火墙规则数量',
        weight: 0.8,
        currentValue: 0,
        maxValue: 100,
        minValue: 0,
        unit: 'count',
        threshold: { critical: 10, high: 25, medium: 50, low: 75 },
        lastUpdated: Date.now(),
        source: 'firewall_monitor',
        tags: ['network', 'firewall']
      },
      {
        id: 'intrusion_attempts_blocked',
        name: 'Blocked Intrusion Attempts',
        category: ScoreCategory.NETWORK_SECURITY,
        description: 'Percentage of intrusion attempts blocked / 阻止的入侵尝试百分比',
        weight: 0.9,
        currentValue: 0,
        maxValue: 100,
        minValue: 0,
        unit: 'percentage',
        threshold: { critical: 50, high: 70, medium: 85, low: 95 },
        lastUpdated: Date.now(),
        source: 'ids_monitor',
        tags: ['network', 'intrusion']
      },

      // Access Control metrics / 访问控制指标
      {
        id: 'failed_login_rate',
        name: 'Failed Login Rate',
        category: ScoreCategory.ACCESS_CONTROL,
        description: 'Rate of failed login attempts / 登录失败尝试率',
        weight: 0.7,
        currentValue: 0,
        maxValue: 100,
        minValue: 0,
        unit: 'percentage',
        threshold: { critical: 20, high: 15, medium: 10, low: 5 },
        lastUpdated: Date.now(),
        source: 'auth_monitor',
        tags: ['access', 'authentication']
      },
      {
        id: 'privileged_access_usage',
        name: 'Privileged Access Usage',
        category: ScoreCategory.ACCESS_CONTROL,
        description: 'Usage of privileged accounts / 特权账户使用情况',
        weight: 0.8,
        currentValue: 0,
        maxValue: 100,
        minValue: 0,
        unit: 'score',
        threshold: { critical: 30, high: 50, medium: 70, low: 85 },
        lastUpdated: Date.now(),
        source: 'privilege_monitor',
        tags: ['access', 'privilege']
      },

      // Data Protection metrics / 数据保护指标
      {
        id: 'encryption_coverage',
        name: 'Data Encryption Coverage',
        category: ScoreCategory.DATA_PROTECTION,
        description: 'Percentage of data encrypted / 数据加密覆盖率',
        weight: 0.9,
        currentValue: 0,
        maxValue: 100,
        minValue: 0,
        unit: 'percentage',
        threshold: { critical: 50, high: 70, medium: 85, low: 95 },
        lastUpdated: Date.now(),
        source: 'encryption_monitor',
        tags: ['data', 'encryption']
      },
      {
        id: 'backup_success_rate',
        name: 'Backup Success Rate',
        category: ScoreCategory.DATA_PROTECTION,
        description: 'Success rate of data backups / 数据备份成功率',
        weight: 0.8,
        currentValue: 0,
        maxValue: 100,
        minValue: 0,
        unit: 'percentage',
        threshold: { critical: 80, high: 90, medium: 95, low: 98 },
        lastUpdated: Date.now(),
        source: 'backup_monitor',
        tags: ['data', 'backup']
      },

      // System Integrity metrics / 系统完整性指标
      {
        id: 'system_patch_level',
        name: 'System Patch Level',
        category: ScoreCategory.SYSTEM_INTEGRITY,
        description: 'Percentage of systems with latest patches / 系统补丁更新率',
        weight: 0.9,
        currentValue: 0,
        maxValue: 100,
        minValue: 0,
        unit: 'percentage',
        threshold: { critical: 60, high: 75, medium: 85, low: 95 },
        lastUpdated: Date.now(),
        source: 'patch_monitor',
        tags: ['system', 'patches']
      },
      {
        id: 'malware_detection_rate',
        name: 'Malware Detection Rate',
        category: ScoreCategory.SYSTEM_INTEGRITY,
        description: 'Rate of malware detection and removal / 恶意软件检测和清除率',
        weight: 0.8,
        currentValue: 0,
        maxValue: 100,
        minValue: 0,
        unit: 'percentage',
        threshold: { critical: 70, high: 80, medium: 90, low: 95 },
        lastUpdated: Date.now(),
        source: 'antivirus_monitor',
        tags: ['system', 'malware']
      }
    ];

    for (const metric of defaultMetrics) {
      this.metrics.set(metric.id, metric);
    }

    console.log('Default security metrics initialized');
  }

  // Start the scoring service / 启动评分服务
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start calculation timer / 启动计算定时器
    this.calculationTimer = setInterval(() => {
      this.calculateScore();
    }, this.config.calculationInterval);

    // Start cleanup timer / 启动清理定时器
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute / 每分钟

    // Calculate initial score / 计算初始评分
    this.calculateScore();

    console.log('Security Scoring Service started');
    this.emit('service_started');
  }

  // Stop the scoring service / 停止评分服务
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear timers / 清除定时器
    if (this.calculationTimer) {
      clearInterval(this.calculationTimer);
      this.calculationTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    console.log('Security Scoring Service stopped');
    this.emit('service_stopped');
  }

  // Add or update a security metric / 添加或更新安全指标
  updateMetric(metricId: string, value: number, source?: string): void {
    const metric = this.metrics.get(metricId);
    if (!metric) {
      console.warn(`Unknown metric: ${metricId}`);
      return;
    }

    const oldValue = metric.currentValue;
    metric.currentValue = Math.max(metric.minValue, Math.min(metric.maxValue, value));
    metric.lastUpdated = Date.now();
    
    if (source) {
      metric.source = source;
    }

    console.log(`Metric updated: ${metric.name} = ${metric.currentValue} (was ${oldValue})`);
    this.emit('metric_updated', { metric, oldValue, newValue: metric.currentValue });

    // Trigger score recalculation if significant change / 如果有重大变化则触发评分重新计算
    const changePercent = Math.abs(metric.currentValue - oldValue) / metric.maxValue;
    if (changePercent > 0.05) { // 5% change threshold / 5%变化阈值
      this.calculateScore();
    }
  }

  // Add a risk factor / 添加风险因素
  addRiskFactor(factor: RiskFactor): void {
    this.riskFactors.set(factor.id, { ...factor });
    console.log(`Risk factor added: ${factor.name} (${factor.severity})`);
    this.emit('risk_factor_added', factor);
    
    // Recalculate score / 重新计算评分
    this.calculateScore();
  }

  // Remove a risk factor / 移除风险因素
  removeRiskFactor(factorId: string): void {
    const factor = this.riskFactors.get(factorId);
    if (factor) {
      this.riskFactors.delete(factorId);
      console.log(`Risk factor removed: ${factorId}`);
      this.emit('risk_factor_removed', factor);
      
      // Recalculate score / 重新计算评分
      this.calculateScore();
    }
  }

  // Calculate overall security score / 计算总体安全评分
  private calculateScore(): void {
    const now = Date.now();
    
    // Calculate category scores / 计算类别评分
    const categoryScores: Record<ScoreCategory, number> = {} as Record<ScoreCategory, number>;
    
    for (const category of Object.values(ScoreCategory)) {
      categoryScores[category] = this.calculateCategoryScore(category);
    }

    // Calculate weighted overall score / 计算加权总体评分
    let overallScore = 0;
    let totalWeight = 0;
    
    for (const [category, score] of Object.entries(categoryScores)) {
      const weight = this.config.categoryWeights[category as ScoreCategory] || 1;
      overallScore += score * weight;
      totalWeight += weight;
    }
    
    overallScore = totalWeight > 0 ? overallScore / totalWeight : 0;

    // Apply risk factor penalties / 应用风险因素惩罚
    const riskPenalty = this.calculateRiskPenalty();
    overallScore = Math.max(0, overallScore - riskPenalty);

    // Determine risk level / 确定风险等级
    const riskLevel = this.determineRiskLevel(overallScore);

    // Generate recommendations / 生成建议
    const recommendations = this.generateRecommendations(categoryScores, Array.from(this.riskFactors.values()));

    // Calculate confidence / 计算置信度
    const confidence = this.calculateConfidence();

    // Create score object / 创建评分对象
    const newScore: SecurityScore = {
      overall: Math.round(overallScore * 100) / 100,
      categories: categoryScores,
      riskLevel,
      trends: this.calculateTrends(),
      lastCalculated: now,
      factors: Array.from(this.riskFactors.values()),
      recommendations,
      confidence
    };

    // Store previous score for comparison / 存储之前的评分以进行比较
    const previousScore = this.currentScore;
    this.currentScore = newScore;

    // Add to history / 添加到历史记录
    this.addToHistory(newScore, previousScore);

    // Emit events / 发出事件
    this.emit('score_calculated', newScore);

    // Check for alerts / 检查警报
    this.checkAlerts(newScore, previousScore);

    console.log(`Security score calculated: ${newScore.overall} (${newScore.riskLevel})`);
  }

  // Calculate score for a specific category / 计算特定类别的评分
  private calculateCategoryScore(category: ScoreCategory): number {
    const categoryMetrics = Array.from(this.metrics.values())
      .filter(metric => metric.category === category);

    if (categoryMetrics.length === 0) {
      return 50; // Default score when no metrics / 无指标时的默认评分
    }

    let totalScore = 0;
    let totalWeight = 0;

    for (const metric of categoryMetrics) {
      const normalizedValue = (metric.currentValue - metric.minValue) / (metric.maxValue - metric.minValue);
      const score = normalizedValue * 100;
      
      totalScore += score * metric.weight;
      totalWeight += metric.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 50;
  }

  // Calculate risk penalty from active risk factors / 计算活跃风险因素的风险惩罚
  private calculateRiskPenalty(): number {
    let penalty = 0;
    const now = Date.now();

    for (const factor of this.riskFactors.values()) {
      // Skip expired factors / 跳过过期因素
      if (factor.expiresAt && factor.expiresAt < now) {
        continue;
      }

      // Calculate penalty based on severity and probability / 基于严重性和概率计算惩罚
      const severityMultiplier = {
        [RiskLevel.VERY_LOW]: 0.5,
        [RiskLevel.LOW]: 1,
        [RiskLevel.MEDIUM]: 2,
        [RiskLevel.HIGH]: 4,
        [RiskLevel.VERY_HIGH]: 8,
        [RiskLevel.CRITICAL]: 15
      };

      const factorPenalty = (factor.impact * factor.probability * severityMultiplier[factor.severity]) / 100;
      penalty += factorPenalty;
    }

    return Math.min(50, penalty); // Cap penalty at 50 points / 惩罚上限为50分
  }

  // Determine risk level based on score / 基于评分确定风险等级
  private determineRiskLevel(score: number): RiskLevel {
    if (score >= this.config.riskThresholds.low) {
      return RiskLevel.VERY_LOW;
    } else if (score >= this.config.riskThresholds.medium) {
      return RiskLevel.LOW;
    } else if (score >= this.config.riskThresholds.high) {
      return RiskLevel.MEDIUM;
    } else if (score >= this.config.riskThresholds.critical) {
      return RiskLevel.HIGH;
    } else {
      return RiskLevel.CRITICAL;
    }
  }

  // Generate security recommendations / 生成安全建议
  private generateRecommendations(categoryScores: Record<ScoreCategory, number>, riskFactors: RiskFactor[]): string[] {
    const recommendations: string[] = [];

    // Category-based recommendations / 基于类别的建议
    for (const [category, score] of Object.entries(categoryScores)) {
      if (score < 70) {
        switch (category as ScoreCategory) {
          case ScoreCategory.NETWORK_SECURITY:
            recommendations.push('Strengthen network security controls and firewall rules / 加强网络安全控制和防火墙规则');
            break;
          case ScoreCategory.ACCESS_CONTROL:
            recommendations.push('Improve access control policies and authentication mechanisms / 改进访问控制策略和认证机制');
            break;
          case ScoreCategory.DATA_PROTECTION:
            recommendations.push('Enhance data encryption and backup procedures / 增强数据加密和备份程序');
            break;
          case ScoreCategory.SYSTEM_INTEGRITY:
            recommendations.push('Update system patches and improve malware protection / 更新系统补丁并改进恶意软件防护');
            break;
          case ScoreCategory.COMPLIANCE:
            recommendations.push('Address compliance gaps and regulatory requirements / 解决合规差距和监管要求');
            break;
          case ScoreCategory.THREAT_DETECTION:
            recommendations.push('Improve threat detection capabilities and monitoring / 改进威胁检测能力和监控');
            break;
          case ScoreCategory.INCIDENT_RESPONSE:
            recommendations.push('Enhance incident response procedures and training / 增强事件响应程序和培训');
            break;
          case ScoreCategory.VULNERABILITY_MANAGEMENT:
            recommendations.push('Strengthen vulnerability management and patching processes / 加强漏洞管理和补丁流程');
            break;
        }
      }
    }

    // Risk factor-based recommendations / 基于风险因素的建议
    const criticalFactors = riskFactors.filter(f => f.severity === RiskLevel.CRITICAL || f.severity === RiskLevel.VERY_HIGH);
    if (criticalFactors.length > 0) {
      recommendations.push(`Address ${criticalFactors.length} critical risk factors immediately / 立即解决${criticalFactors.length}个关键风险因素`);
    }

    // Generic recommendations / 通用建议
    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring and maintain current security posture / 继续监控并保持当前安全态势');
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations / 限制为5个建议
  }

  // Calculate confidence in the score / 计算评分的置信度
  private calculateConfidence(): number {
    const totalMetrics = this.metrics.size;
    const recentMetrics = Array.from(this.metrics.values())
      .filter(m => (Date.now() - m.lastUpdated) < 24 * 60 * 60 * 1000) // Last 24 hours / 最近24小时
      .length;

    const dataFreshness = totalMetrics > 0 ? recentMetrics / totalMetrics : 0;
    const factorCount = this.riskFactors.size;
    const factorConfidence = Math.min(1, factorCount / 10); // More factors = higher confidence / 更多因素 = 更高置信度

    return Math.round((dataFreshness * 0.7 + factorConfidence * 0.3) * 100);
  }

  // Calculate trend data / 计算趋势数据
  private calculateTrends(): { daily: number[]; weekly: number[]; monthly: number[] } {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    // Daily trends / 日趋势
    const daily: number[] = [];
    for (let i = this.config.trendAnalysisPeriods.daily - 1; i >= 0; i--) {
      const targetTime = now - (i * dayMs);
      const score = this.getHistoricalScore(targetTime, dayMs / 2);
      daily.push(score);
    }

    // Weekly trends / 周趋势
    const weekly: number[] = [];
    for (let i = this.config.trendAnalysisPeriods.weekly - 1; i >= 0; i--) {
      const targetTime = now - (i * weekMs);
      const score = this.getHistoricalScore(targetTime, weekMs / 2);
      weekly.push(score);
    }

    // Monthly trends / 月趋势
    const monthly: number[] = [];
    for (let i = this.config.trendAnalysisPeriods.monthly - 1; i >= 0; i--) {
      const targetTime = now - (i * monthMs);
      const score = this.getHistoricalScore(targetTime, monthMs / 2);
      monthly.push(score);
    }

    return { daily, weekly, monthly };
  }

  // Get historical score near a specific time / 获取特定时间附近的历史评分
  private getHistoricalScore(targetTime: number, tolerance: number): number {
    const candidates = this.scoreHistory.filter(entry => 
      Math.abs(entry.timestamp - targetTime) <= tolerance
    );

    if (candidates.length === 0) {
      return this.currentScore?.overall || 50;
    }

    // Return the closest match / 返回最接近的匹配
    const closest = candidates.reduce((prev, curr) => 
      Math.abs(curr.timestamp - targetTime) < Math.abs(prev.timestamp - targetTime) ? curr : prev
    );

    return closest.overall;
  }

  // Add score to history / 将评分添加到历史记录
  private addToHistory(newScore: SecurityScore, previousScore?: SecurityScore): void {
    const changes = {
      overall: previousScore ? newScore.overall - previousScore.overall : 0,
      categories: {} as Record<ScoreCategory, number>
    };

    // Calculate category changes / 计算类别变化
    for (const category of Object.values(ScoreCategory)) {
      changes.categories[category] = previousScore ? 
        newScore.categories[category] - previousScore.categories[category] : 0;
    }

    const historyEntry: ScoreHistoryEntry = {
      timestamp: newScore.lastCalculated,
      overall: newScore.overall,
      categories: newScore.categories,
      riskLevel: newScore.riskLevel,
      factors: newScore.factors.length,
      changes
    };

    this.scoreHistory.push(historyEntry);

    // Limit history size / 限制历史记录大小
    const maxEntries = this.config.retentionDays * 24; // Assuming hourly calculations / 假设每小时计算
    if (this.scoreHistory.length > maxEntries) {
      this.scoreHistory.shift();
    }
  }

  // Check for alert conditions / 检查警报条件
  private checkAlerts(newScore: SecurityScore, previousScore?: SecurityScore): void {
    if (!previousScore) return;

    // Score decrease alert / 评分下降警报
    const scoreDecrease = previousScore.overall - newScore.overall;
    if (scoreDecrease >= this.config.alertThresholds.scoreDecrease) {
      this.emit('alert', {
        type: 'score_decrease',
        message: `Security score decreased by ${scoreDecrease.toFixed(1)} points / 安全评分下降了${scoreDecrease.toFixed(1)}分`,
        severity: scoreDecrease >= 20 ? 'critical' : scoreDecrease >= 10 ? 'high' : 'medium',
        data: { previousScore: previousScore.overall, newScore: newScore.overall, decrease: scoreDecrease }
      });
    }

    // Risk level increase alert / 风险等级增加警报
    const riskLevels = [RiskLevel.VERY_LOW, RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH, RiskLevel.CRITICAL];
    const previousRiskIndex = riskLevels.indexOf(previousScore.riskLevel);
    const newRiskIndex = riskLevels.indexOf(newScore.riskLevel);
    
    if (newRiskIndex > previousRiskIndex) {
      this.emit('alert', {
        type: 'risk_increase',
        message: `Risk level increased from ${previousScore.riskLevel} to ${newScore.riskLevel} / 风险等级从${previousScore.riskLevel}增加到${newScore.riskLevel}`,
        severity: newScore.riskLevel === RiskLevel.CRITICAL ? 'critical' : 'high',
        data: { previousRisk: previousScore.riskLevel, newRisk: newScore.riskLevel }
      });
    }

    // New critical factors alert / 新关键因素警报
    const criticalFactors = newScore.factors.filter(f => f.severity === RiskLevel.CRITICAL);
    if (criticalFactors.length >= this.config.alertThresholds.newCriticalFactors) {
      this.emit('alert', {
        type: 'critical_factors',
        message: `${criticalFactors.length} critical risk factors detected / 检测到${criticalFactors.length}个关键风险因素`,
        severity: 'critical',
        data: { factors: criticalFactors }
      });
    }
  }

  // Add mitigation action / 添加缓解措施
  addMitigationAction(action: MitigationAction): void {
    this.mitigationActions.set(action.id, { ...action });
    console.log(`Mitigation action added: ${action.name}`);
    this.emit('mitigation_action_added', action);
  }

  // Update mitigation action status / 更新缓解措施状态
  updateMitigationAction(actionId: string, updates: Partial<MitigationAction>): void {
    const action = this.mitigationActions.get(actionId);
    if (action) {
      Object.assign(action, updates);
      console.log(`Mitigation action updated: ${actionId}`);
      this.emit('mitigation_action_updated', action);

      // If completed, remove associated risk factors / 如果完成，移除相关风险因素
      if (updates.status === 'completed') {
        for (const factorId of action.riskFactors) {
          this.removeRiskFactor(factorId);
        }
      }
    }
  }

  // Cleanup old data / 清理旧数据
  private cleanup(): void {
    const now = Date.now();
    const retentionTime = this.config.retentionDays * 24 * 60 * 60 * 1000;

    // Clean up expired risk factors / 清理过期风险因素
    for (const [id, factor] of this.riskFactors.entries()) {
      if (factor.expiresAt && factor.expiresAt < now) {
        this.riskFactors.delete(id);
        console.log(`Expired risk factor removed: ${id}`);
      }
    }

    // Clean up old score history / 清理旧评分历史
    this.scoreHistory = this.scoreHistory.filter(entry => 
      (now - entry.timestamp) < retentionTime
    );

    // Clean up completed mitigation actions / 清理已完成的缓解措施
    for (const [id, action] of this.mitigationActions.entries()) {
      if (action.status === 'completed' && action.completedAt && 
          (now - action.completedAt) > (30 * 24 * 60 * 60 * 1000)) { // 30 days / 30天
        this.mitigationActions.delete(id);
        console.log(`Old mitigation action removed: ${id}`);
      }
    }

    console.log('Security scoring service cleanup completed');
  }

  // Get current security score / 获取当前安全评分
  getCurrentScore(): SecurityScore | undefined {
    return this.currentScore;
  }

  // Get score history / 获取评分历史
  getScoreHistory(limit?: number): ScoreHistoryEntry[] {
    const history = [...this.scoreHistory].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? history.slice(0, limit) : history;
  }

  // Get all metrics / 获取所有指标
  getAllMetrics(): SecurityMetric[] {
    return Array.from(this.metrics.values());
  }

  // Get metrics by category / 按类别获取指标
  getMetricsByCategory(category: ScoreCategory): SecurityMetric[] {
    return Array.from(this.metrics.values()).filter(m => m.category === category);
  }

  // Get all risk factors / 获取所有风险因素
  getAllRiskFactors(): RiskFactor[] {
    return Array.from(this.riskFactors.values());
  }

  // Get risk factors by severity / 按严重性获取风险因素
  getRiskFactorsBySeverity(severity: RiskLevel): RiskFactor[] {
    return Array.from(this.riskFactors.values()).filter(f => f.severity === severity);
  }

  // Get all mitigation actions / 获取所有缓解措施
  getAllMitigationActions(): MitigationAction[] {
    return Array.from(this.mitigationActions.values());
  }

  // Get mitigation actions by status / 按状态获取缓解措施
  getMitigationActionsByStatus(status: MitigationAction['status']): MitigationAction[] {
    return Array.from(this.mitigationActions.values()).filter(a => a.status === status);
  }

  // Get service statistics / 获取服务统计
  getStats(): any {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const recentFactors = Array.from(this.riskFactors.values())
      .filter(f => (now - f.detectedAt) < dayMs);

    const recentActions = Array.from(this.mitigationActions.values())
      .filter(a => a.completedAt && (now - a.completedAt) < dayMs);

    return {
      currentScore: this.currentScore?.overall || 0,
      riskLevel: this.currentScore?.riskLevel || RiskLevel.MEDIUM,
      totalMetrics: this.metrics.size,
      totalRiskFactors: this.riskFactors.size,
      recentRiskFactors: recentFactors.length,
      totalMitigationActions: this.mitigationActions.size,
      completedActionsToday: recentActions.length,
      historyEntries: this.scoreHistory.length,
      confidence: this.currentScore?.confidence || 0,
      isRunning: this.isRunning
    };
  }

  // Update configuration / 更新配置
  updateConfig(newConfig: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Security Scoring Service configuration updated');
    this.emit('config_updated', this.config);
  }

  // Check if service is running / 检查服务是否正在运行
  isActive(): boolean {
    return this.isRunning;
  }

  // Force score recalculation / 强制重新计算评分
  recalculateScore(): void {
    this.calculateScore();
  }

  // Export score data / 导出评分数据
  exportData(): any {
    return {
      currentScore: this.currentScore,
      metrics: Array.from(this.metrics.values()),
      riskFactors: Array.from(this.riskFactors.values()),
      mitigationActions: Array.from(this.mitigationActions.values()),
      scoreHistory: this.scoreHistory,
      config: this.config
    };
  }
}