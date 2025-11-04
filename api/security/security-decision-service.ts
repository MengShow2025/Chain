// Security Decision Service for access control and authorization / 访问控制和授权的安全决策服务
import { EventEmitter } from 'events';

// Security decision types / 安全决策类型
export enum DecisionType {
  ALLOW = 'allow',
  DENY = 'deny',
  CHALLENGE = 'challenge',
  MONITOR = 'monitor',
  QUARANTINE = 'quarantine'
}

// Security context for decision making / 安全决策上下文
export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  ip: string;
  userAgent: string;
  timestamp: number;
  resource: string;
  action: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  riskScore: number;
  threatLevel: string;
  previousViolations: number;
  geolocation?: {
    country: string;
    region: string;
    city: string;
  };
}

// Security policy rule / 安全策略规则
export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: PolicyCondition[];
  decision: DecisionType;
  parameters?: Record<string, any>;
  validFrom?: Date;
  validUntil?: Date;
  tags: string[];
}

// Policy condition / 策略条件
export interface PolicyCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'matches' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'between';
  value: any;
  caseSensitive?: boolean;
}

// Security decision result / 安全决策结果
export interface SecurityDecision {
  decision: DecisionType;
  confidence: number;
  reason: string;
  appliedPolicies: string[];
  riskScore: number;
  metadata: Record<string, any>;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds / 生存时间（毫秒）
  challengeType?: string;
  monitoringLevel?: string;
}

// Decision audit log / 决策审计日志
export interface DecisionAuditLog {
  id: string;
  timestamp: number;
  context: SecurityContext;
  decision: SecurityDecision;
  executionTime: number;
  success: boolean;
  error?: string;
}

// Risk assessment factors / 风险评估因素
export interface RiskFactors {
  ipReputation: number;
  userBehavior: number;
  deviceTrust: number;
  locationRisk: number;
  timeRisk: number;
  resourceSensitivity: number;
  actionRisk: number;
}

// Security Decision Service configuration / 安全决策服务配置
export interface SecurityDecisionConfig {
  enabled: boolean;
  defaultDecision: DecisionType;
  maxAuditLogs: number;
  auditRetentionDays: number;
  enableRiskScoring: boolean;
  enableGeolocation: boolean;
  enableBehaviorAnalysis: boolean;
  cacheDecisions: boolean;
  cacheTimeout: number;
  alertThreshold: number;
}

// Main Security Decision Service class / 主要安全决策服务类
export class SecurityDecisionService extends EventEmitter {
  private config: SecurityDecisionConfig;
  private policies: Map<string, SecurityPolicy> = new Map();
  private auditLogs: DecisionAuditLog[] = [];
  private decisionCache: Map<string, SecurityDecision> = new Map();
  private riskProfiles: Map<string, RiskFactors> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: SecurityDecisionConfig) {
    super();
    this.config = { ...config };
    this.initializeDefaultPolicies();
  }

  // Initialize default security policies / 初始化默认安全策略
  private initializeDefaultPolicies(): void {
    // High risk IP blocking policy / 高风险IP阻止策略
    this.addPolicy({
      id: 'block_high_risk_ips',
      name: 'Block High Risk IPs',
      description: 'Block requests from high risk IP addresses / 阻止来自高风险IP地址的请求',
      enabled: true,
      priority: 100,
      conditions: [
        {
          field: 'riskScore',
          operator: 'greater_than',
          value: 80
        }
      ],
      decision: DecisionType.DENY,
      tags: ['ip-security', 'risk-based']
    });

    // Rate limiting policy / 速率限制策略
    this.addPolicy({
      id: 'rate_limit_challenge',
      name: 'Rate Limit Challenge',
      description: 'Challenge users exceeding rate limits / 对超过速率限制的用户进行质询',
      enabled: true,
      priority: 90,
      conditions: [
        {
          field: 'previousViolations',
          operator: 'greater_than',
          value: 5
        }
      ],
      decision: DecisionType.CHALLENGE,
      parameters: {
        challengeType: 'captcha',
        timeout: 300000 // 5 minutes / 5分钟
      },
      tags: ['rate-limiting', 'challenge']
    });

    // Suspicious location policy / 可疑位置策略
    this.addPolicy({
      id: 'monitor_suspicious_locations',
      name: 'Monitor Suspicious Locations',
      description: 'Monitor requests from suspicious locations / 监控来自可疑位置的请求',
      enabled: true,
      priority: 70,
      conditions: [
        {
          field: 'geolocation.country',
          operator: 'in',
          value: ['XX', 'YY', 'ZZ'] // Placeholder countries / 占位符国家
        }
      ],
      decision: DecisionType.MONITOR,
      parameters: {
        monitoringLevel: 'high',
        alertOnAccess: true
      },
      tags: ['geolocation', 'monitoring']
    });

    // Admin resource protection / 管理员资源保护
    this.addPolicy({
      id: 'protect_admin_resources',
      name: 'Protect Admin Resources',
      description: 'Extra protection for admin resources / 对管理员资源的额外保护',
      enabled: true,
      priority: 95,
      conditions: [
        {
          field: 'resource',
          operator: 'contains',
          value: '/admin'
        },
        {
          field: 'riskScore',
          operator: 'greater_than',
          value: 30
        }
      ],
      decision: DecisionType.CHALLENGE,
      parameters: {
        challengeType: 'mfa',
        timeout: 600000 // 10 minutes / 10分钟
      },
      tags: ['admin-protection', 'mfa']
    });

    // Default allow policy / 默认允许策略
    this.addPolicy({
      id: 'default_allow',
      name: 'Default Allow',
      description: 'Default policy to allow normal requests / 允许正常请求的默认策略',
      enabled: true,
      priority: 1,
      conditions: [],
      decision: DecisionType.ALLOW,
      tags: ['default']
    });
  }

  // Start the security decision service / 启动安全决策服务
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start cleanup timer / 启动清理定时器
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute / 每分钟

    console.log('Security Decision Service started');
    this.emit('service_started');
  }

  // Stop the security decision service / 停止安全决策服务
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear cleanup timer / 清除清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    console.log('Security Decision Service stopped');
    this.emit('service_stopped');
  }

  // Add a security policy / 添加安全策略
  addPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.id, { ...policy });
    console.log(`Security policy added: ${policy.name} (${policy.id})`);
    this.emit('policy_added', policy);
  }

  // Remove a security policy / 移除安全策略
  removePolicy(policyId: string): void {
    const policy = this.policies.get(policyId);
    if (policy) {
      this.policies.delete(policyId);
      console.log(`Security policy removed: ${policyId}`);
      this.emit('policy_removed', policy);
    }
  }

  // Enable or disable a policy / 启用或禁用策略
  togglePolicy(policyId: string, enabled: boolean): void {
    const policy = this.policies.get(policyId);
    if (policy) {
      policy.enabled = enabled;
      console.log(`Security policy ${enabled ? 'enabled' : 'disabled'}: ${policyId}`);
      this.emit('policy_toggled', { policyId, enabled });
    }
  }

  // Make a security decision / 做出安全决策
  async makeDecision(context: SecurityContext): Promise<SecurityDecision> {
    const startTime = Date.now();
    
    try {
      // Check cache first / 首先检查缓存
      if (this.config.cacheDecisions) {
        const cacheKey = this.generateCacheKey(context);
        const cachedDecision = this.decisionCache.get(cacheKey);
        if (cachedDecision && this.isCacheValid(cachedDecision)) {
          return cachedDecision;
        }
      }

      // Calculate risk score / 计算风险分数
      if (this.config.enableRiskScoring) {
        context.riskScore = await this.calculateRiskScore(context);
      }

      // Get applicable policies / 获取适用的策略
      const applicablePolicies = this.getApplicablePolicies(context);

      // Evaluate policies / 评估策略
      const decision = await this.evaluatePolicies(applicablePolicies, context);

      // Cache the decision / 缓存决策
      if (this.config.cacheDecisions && decision.ttl) {
        const cacheKey = this.generateCacheKey(context);
        this.decisionCache.set(cacheKey, decision);
      }

      // Log the decision / 记录决策
      const executionTime = Date.now() - startTime;
      await this.logDecision(context, decision, executionTime, true);

      // Emit decision event / 发出决策事件
      this.emit('decision_made', { context, decision });

      // Check for alerts / 检查警报
      if (decision.riskScore >= this.config.alertThreshold) {
        this.emit('high_risk_decision', { context, decision });
      }

      return decision;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorDecision: SecurityDecision = {
        decision: this.config.defaultDecision,
        confidence: 0,
        reason: `Error making decision: ${error.message}`,
        appliedPolicies: [],
        riskScore: context.riskScore || 50,
        metadata: { error: error.message },
        timestamp: Date.now()
      };

      await this.logDecision(context, errorDecision, executionTime, false, error.message);
      console.error('Error making security decision:', error);
      
      return errorDecision;
    }
  }

  // Calculate risk score based on various factors / 基于各种因素计算风险分数
  private async calculateRiskScore(context: SecurityContext): Promise<number> {
    const factors: RiskFactors = {
      ipReputation: await this.assessIPReputation(context.ip),
      userBehavior: await this.assessUserBehavior(context),
      deviceTrust: await this.assessDeviceTrust(context),
      locationRisk: await this.assessLocationRisk(context),
      timeRisk: await this.assessTimeRisk(context),
      resourceSensitivity: await this.assessResourceSensitivity(context.resource),
      actionRisk: await this.assessActionRisk(context.action)
    };

    // Store risk profile / 存储风险档案
    this.riskProfiles.set(context.ip, factors);

    // Calculate weighted risk score / 计算加权风险分数
    const weights = {
      ipReputation: 0.25,
      userBehavior: 0.20,
      deviceTrust: 0.15,
      locationRisk: 0.15,
      timeRisk: 0.10,
      resourceSensitivity: 0.10,
      actionRisk: 0.05
    };

    let riskScore = 0;
    for (const [factor, value] of Object.entries(factors)) {
      riskScore += value * weights[factor as keyof typeof weights];
    }

    return Math.min(100, Math.max(0, riskScore));
  }

  // Assess IP reputation / 评估IP声誉
  private async assessIPReputation(ip: string): Promise<number> {
    // Simulate IP reputation check / 模拟IP声誉检查
    // In real implementation, this would query threat intelligence feeds / 在实际实现中，这将查询威胁情报源
    const knownBadIPs = ['192.168.1.100', '10.0.0.50']; // Example bad IPs / 示例恶意IP
    
    if (knownBadIPs.includes(ip)) {
      return 90; // High risk / 高风险
    }
    
    // Check if IP is from known cloud providers / 检查IP是否来自已知云提供商
    if (ip.startsWith('54.') || ip.startsWith('52.')) { // AWS IPs example / AWS IP示例
      return 30; // Medium risk / 中等风险
    }
    
    return 10; // Low risk / 低风险
  }

  // Assess user behavior / 评估用户行为
  private async assessUserBehavior(context: SecurityContext): Promise<number> {
    if (!context.userId) {
      return 40; // Anonymous users have higher risk / 匿名用户风险较高
    }

    // Simulate behavior analysis / 模拟行为分析
    const riskFactors = [
      context.previousViolations > 3 ? 30 : 0,
      context.method === 'POST' ? 10 : 0,
      context.headers['user-agent']?.includes('bot') ? 20 : 0
    ];

    return Math.min(100, riskFactors.reduce((sum, factor) => sum + factor, 0));
  }

  // Assess device trust / 评估设备信任度
  private async assessDeviceTrust(context: SecurityContext): Promise<number> {
    const userAgent = context.userAgent.toLowerCase();
    
    // Check for suspicious user agents / 检查可疑用户代理
    const suspiciousPatterns = ['curl', 'wget', 'python', 'bot', 'crawler'];
    const isSuspicious = suspiciousPatterns.some(pattern => userAgent.includes(pattern));
    
    if (isSuspicious) {
      return 70; // High risk for automated tools / 自动化工具高风险
    }
    
    // Check for mobile devices / 检查移动设备
    const isMobile = userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone');
    
    return isMobile ? 20 : 30; // Mobile devices slightly lower risk / 移动设备风险稍低
  }

  // Assess location risk / 评估位置风险
  private async assessLocationRisk(context: SecurityContext): Promise<number> {
    if (!this.config.enableGeolocation || !context.geolocation) {
      return 25; // Default risk when location unknown / 位置未知时的默认风险
    }

    // High risk countries / 高风险国家
    const highRiskCountries = ['XX', 'YY', 'ZZ']; // Placeholder / 占位符
    
    if (highRiskCountries.includes(context.geolocation.country)) {
      return 80;
    }
    
    return 15; // Low risk for normal countries / 正常国家低风险
  }

  // Assess time-based risk / 评估基于时间的风险
  private async assessTimeRisk(context: SecurityContext): Promise<number> {
    const hour = new Date(context.timestamp).getHours();
    
    // Higher risk during off-hours / 非工作时间风险较高
    if (hour < 6 || hour > 22) {
      return 30;
    }
    
    return 10; // Normal business hours / 正常工作时间
  }

  // Assess resource sensitivity / 评估资源敏感性
  private async assessResourceSensitivity(resource: string): Promise<number> {
    const sensitivePatterns = [
      { pattern: '/admin', risk: 90 },
      { pattern: '/api/auth', risk: 70 },
      { pattern: '/api/user', risk: 50 },
      { pattern: '/api/public', risk: 10 }
    ];

    for (const { pattern, risk } of sensitivePatterns) {
      if (resource.includes(pattern)) {
        return risk;
      }
    }

    return 25; // Default sensitivity / 默认敏感性
  }

  // Assess action risk / 评估动作风险
  private async assessActionRisk(action: string): Promise<number> {
    const actionRisks: Record<string, number> = {
      'DELETE': 80,
      'PUT': 60,
      'POST': 40,
      'PATCH': 50,
      'GET': 10,
      'HEAD': 5,
      'OPTIONS': 5
    };

    return actionRisks[action.toUpperCase()] || 30;
  }

  // Get applicable policies for the context / 获取适用于上下文的策略
  private getApplicablePolicies(context: SecurityContext): SecurityPolicy[] {
    const now = new Date();
    
    return Array.from(this.policies.values())
      .filter(policy => {
        // Check if policy is enabled / 检查策略是否启用
        if (!policy.enabled) return false;
        
        // Check validity period / 检查有效期
        if (policy.validFrom && now < policy.validFrom) return false;
        if (policy.validUntil && now > policy.validUntil) return false;
        
        // Check if conditions match / 检查条件是否匹配
        return this.evaluateConditions(policy.conditions, context);
      })
      .sort((a, b) => b.priority - a.priority); // Sort by priority descending / 按优先级降序排序
  }

  // Evaluate policy conditions / 评估策略条件
  private evaluateConditions(conditions: PolicyCondition[], context: SecurityContext): boolean {
    if (conditions.length === 0) return true; // No conditions means always applicable / 无条件意味着总是适用

    return conditions.every(condition => this.evaluateCondition(condition, context));
  }

  // Evaluate a single condition / 评估单个条件
  private evaluateCondition(condition: PolicyCondition, context: SecurityContext): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);
    if (fieldValue === undefined) return false;

    const conditionValue = condition.value;
    const caseSensitive = condition.caseSensitive !== false;

    switch (condition.operator) {
      case 'equals':
        return caseSensitive ? fieldValue === conditionValue : 
               String(fieldValue).toLowerCase() === String(conditionValue).toLowerCase();
      
      case 'not_equals':
        return caseSensitive ? fieldValue !== conditionValue :
               String(fieldValue).toLowerCase() !== String(conditionValue).toLowerCase();
      
      case 'contains':
        return caseSensitive ? String(fieldValue).includes(String(conditionValue)) :
               String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      
      case 'not_contains':
        return caseSensitive ? !String(fieldValue).includes(String(conditionValue)) :
               !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      
      case 'matches':
        const regex = new RegExp(conditionValue, caseSensitive ? 'g' : 'gi');
        return regex.test(String(fieldValue));
      
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      
      case 'between':
        if (Array.isArray(conditionValue) && conditionValue.length === 2) {
          const numValue = Number(fieldValue);
          return numValue >= conditionValue[0] && numValue <= conditionValue[1];
        }
        return false;
      
      default:
        return false;
    }
  }

  // Get field value from context / 从上下文获取字段值
  private getFieldValue(field: string, context: SecurityContext): any {
    const parts = field.split('.');
    let value: any = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  // Evaluate policies and make decision / 评估策略并做出决策
  private async evaluatePolicies(policies: SecurityPolicy[], context: SecurityContext): Promise<SecurityDecision> {
    const appliedPolicies: string[] = [];
    let finalDecision = this.config.defaultDecision;
    let confidence = 0.5;
    let reason = 'Default decision applied / 应用默认决策';
    const metadata: Record<string, any> = {};

    // Apply the first matching policy with highest priority / 应用优先级最高的第一个匹配策略
    for (const policy of policies) {
      appliedPolicies.push(policy.id);
      finalDecision = policy.decision;
      confidence = 0.9; // High confidence when policy matches / 策略匹配时高置信度
      reason = `Policy applied: ${policy.name} / 应用策略：${policy.name}`;
      
      // Merge policy parameters into metadata / 将策略参数合并到元数据中
      if (policy.parameters) {
        Object.assign(metadata, policy.parameters);
      }
      
      break; // Use first matching policy / 使用第一个匹配的策略
    }

    return {
      decision: finalDecision,
      confidence,
      reason,
      appliedPolicies,
      riskScore: context.riskScore,
      metadata,
      timestamp: Date.now(),
      ttl: this.config.cacheTimeout,
      challengeType: metadata.challengeType,
      monitoringLevel: metadata.monitoringLevel
    };
  }

  // Generate cache key for decision / 为决策生成缓存键
  private generateCacheKey(context: SecurityContext): string {
    const keyParts = [
      context.ip,
      context.userId || 'anonymous',
      context.resource,
      context.action,
      Math.floor(context.riskScore / 10) * 10 // Round to nearest 10 / 四舍五入到最近的10
    ];
    
    return keyParts.join('|');
  }

  // Check if cached decision is still valid / 检查缓存决策是否仍然有效
  private isCacheValid(decision: SecurityDecision): boolean {
    if (!decision.ttl) return false;
    return (Date.now() - decision.timestamp) < decision.ttl;
  }

  // Log security decision / 记录安全决策
  private async logDecision(
    context: SecurityContext,
    decision: SecurityDecision,
    executionTime: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    const auditLog: DecisionAuditLog = {
      id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      context: { ...context },
      decision: { ...decision },
      executionTime,
      success,
      error
    };

    this.auditLogs.push(auditLog);

    // Limit audit logs in memory / 限制内存中的审计日志
    if (this.auditLogs.length > this.config.maxAuditLogs) {
      this.auditLogs.shift();
    }

    this.emit('decision_logged', auditLog);
  }

  // Cleanup old data / 清理旧数据
  private cleanup(): void {
    const now = Date.now();
    const retentionTime = this.config.auditRetentionDays * 24 * 60 * 60 * 1000;

    // Clean up old audit logs / 清理旧审计日志
    this.auditLogs = this.auditLogs.filter(log => 
      (now - log.timestamp) < retentionTime
    );

    // Clean up expired cache entries / 清理过期缓存条目
    for (const [key, decision] of Array.from(this.decisionCache.entries())) {
      if (!this.isCacheValid(decision)) {
        this.decisionCache.delete(key);
      }
    }

    console.log('Security decision service cleanup completed');
  }

  // Get decision statistics / 获取决策统计
  getStats(): any {
    const recentLogs = this.auditLogs.filter(log => 
      (Date.now() - log.timestamp) < (24 * 60 * 60 * 1000) // Last 24 hours / 最近24小时
    );

    const decisionCounts = recentLogs.reduce((counts, log) => {
      const decision = log.decision.decision;
      counts[decision] = (counts[decision] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const averageExecutionTime = recentLogs.length > 0 ?
      recentLogs.reduce((sum, log) => sum + log.executionTime, 0) / recentLogs.length : 0;

    const successRate = recentLogs.length > 0 ?
      recentLogs.filter(log => log.success).length / recentLogs.length : 1;

    return {
      totalDecisions: recentLogs.length,
      decisionCounts,
      averageExecutionTime,
      successRate,
      activePolicies: Array.from(this.policies.values()).filter(p => p.enabled).length,
      cacheSize: this.decisionCache.size,
      auditLogCount: this.auditLogs.length
    };
  }

  // Get recent decisions / 获取最近决策
  getRecentDecisions(limit: number = 100): DecisionAuditLog[] {
    return this.auditLogs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Get decisions by type / 按类型获取决策
  getDecisionsByType(decisionType: DecisionType): DecisionAuditLog[] {
    return this.auditLogs.filter(log => log.decision.decision === decisionType);
  }

  // Get all policies / 获取所有策略
  getAllPolicies(): SecurityPolicy[] {
    return Array.from(this.policies.values());
  }

  // Get risk profile for IP / 获取IP的风险档案
  getRiskProfile(ip: string): RiskFactors | undefined {
    return this.riskProfiles.get(ip);
  }

  // Update configuration / 更新配置
  updateConfig(newConfig: Partial<SecurityDecisionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Security Decision Service configuration updated');
    this.emit('config_updated', this.config);
  }

  // Check if service is running / 检查服务是否正在运行
  isActive(): boolean {
    return this.isRunning;
  }

  // Clear decision cache / 清除决策缓存
  clearCache(): void {
    this.decisionCache.clear();
    console.log('Decision cache cleared');
    this.emit('cache_cleared');
  }

  // Export audit logs / 导出审计日志
  exportAuditLogs(startTime?: number, endTime?: number): DecisionAuditLog[] {
    let logs = this.auditLogs;
    
    if (startTime) {
      logs = logs.filter(log => log.timestamp >= startTime);
    }
    
    if (endTime) {
      logs = logs.filter(log => log.timestamp <= endTime);
    }
    
    return logs.sort((a, b) => a.timestamp - b.timestamp);
  }
}