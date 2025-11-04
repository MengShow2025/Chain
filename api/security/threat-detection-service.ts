// Threat Detection Service for security monitoring / 安全监控的威胁检测服务
import { EventEmitter } from 'events';

// Threat types enumeration / 威胁类型枚举
export enum ThreatType {
  BRUTE_FORCE = 'brute_force',
  DDoS = 'ddos',
  SQL_INJECTION = 'sql_injection',
  XSS = 'xss',
  MALWARE = 'malware',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DATA_BREACH = 'data_breach',
  ANOMALY = 'anomaly'
}

// Threat severity levels / 威胁严重程度级别
export enum ThreatSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Threat detection rule interface / 威胁检测规则接口
export interface ThreatRule {
  id: string;
  name: string;
  type: ThreatType;
  severity: ThreatSeverity;
  enabled: boolean;
  pattern?: RegExp;
  threshold?: number;
  timeWindow?: number; // in milliseconds / 以毫秒为单位
  conditions: ThreatCondition[];
  actions: ThreatAction[];
  description?: string;
}

// Threat detection condition / 威胁检测条件
export interface ThreatCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than' | 'in_range';
  value: any;
  caseSensitive?: boolean;
}

// Threat response action / 威胁响应动作
export interface ThreatAction {
  type: 'block' | 'alert' | 'log' | 'quarantine' | 'notify';
  parameters?: Record<string, any>;
  delay?: number; // in milliseconds / 以毫秒为单位
}

// Threat detection event / 威胁检测事件
export interface ThreatEvent {
  id: string;
  type: ThreatType;
  severity: ThreatSeverity;
  timestamp: number;
  source: string;
  target?: string;
  description: string;
  metadata: Record<string, any>;
  ruleId: string;
  blocked: boolean;
  resolved: boolean;
}

// Request analysis data / 请求分析数据
export interface RequestAnalysis {
  ip: string;
  userAgent: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

// Threat detection statistics / 威胁检测统计
export interface ThreatStats {
  totalThreats: number;
  threatsBlocked: number;
  threatsByType: Record<ThreatType, number>;
  threatsBySeverity: Record<ThreatSeverity, number>;
  averageResponseTime: number;
  lastThreatTime: number;
  activeRules: number;
}

// IP tracking information / IP跟踪信息
export interface IPTracker {
  ip: string;
  requestCount: number;
  firstSeen: number;
  lastSeen: number;
  blocked: boolean;
  threats: ThreatEvent[];
  reputation: number; // 0-100 scale / 0-100分制
}

// Threat Detection Service configuration / 威胁检测服务配置
export interface ThreatDetectionConfig {
  enabled: boolean;
  maxEventsInMemory: number;
  cleanupInterval: number;
  defaultBlockDuration: number;
  rateLimitWindow: number;
  rateLimitThreshold: number;
  enableIPTracking: boolean;
  enableBehaviorAnalysis: boolean;
  alertWebhookUrl?: string;
}

// Main Threat Detection Service class / 主要威胁检测服务类
export class ThreatDetectionService extends EventEmitter {
  private config: ThreatDetectionConfig;
  private rules: Map<string, ThreatRule> = new Map();
  private events: ThreatEvent[] = [];
  private ipTrackers: Map<string, IPTracker> = new Map();
  private blockedIPs: Set<string> = new Set();
  private stats: ThreatStats;
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: ThreatDetectionConfig) {
    super();
    this.config = { ...config };
    
    this.stats = {
      totalThreats: 0,
      threatsBlocked: 0,
      threatsByType: {} as Record<ThreatType, number>,
      threatsBySeverity: {} as Record<ThreatSeverity, number>,
      averageResponseTime: 0,
      lastThreatTime: 0,
      activeRules: 0
    };

    this.initializeDefaultRules();
  }

  // Initialize default threat detection rules / 初始化默认威胁检测规则
  private initializeDefaultRules(): void {
    // Brute force detection rule / 暴力破解检测规则
    this.addRule({
      id: 'brute_force_login',
      name: 'Brute Force Login Detection',
      type: ThreatType.BRUTE_FORCE,
      severity: ThreatSeverity.HIGH,
      enabled: true,
      threshold: 5,
      timeWindow: 300000, // 5 minutes / 5分钟
      conditions: [
        {
          field: 'url',
          operator: 'contains',
          value: '/login'
        },
        {
          field: 'method',
          operator: 'equals',
          value: 'POST'
        }
      ],
      actions: [
        { type: 'block', parameters: { duration: 3600000 } }, // 1 hour / 1小时
        { type: 'alert' },
        { type: 'log' }
      ],
      description: 'Detects multiple failed login attempts from same IP / 检测来自同一IP的多次登录失败尝试'
    });

    // Rate limiting rule / 速率限制规则
    this.addRule({
      id: 'rate_limit_exceeded',
      name: 'Rate Limit Exceeded',
      type: ThreatType.RATE_LIMIT_EXCEEDED,
      severity: ThreatSeverity.MEDIUM,
      enabled: true,
      threshold: this.config.rateLimitThreshold,
      timeWindow: this.config.rateLimitWindow,
      conditions: [],
      actions: [
        { type: 'block', parameters: { duration: 600000 } }, // 10 minutes / 10分钟
        { type: 'log' }
      ],
      description: 'Blocks IPs exceeding request rate limits / 阻止超过请求速率限制的IP'
    });

    // SQL injection detection / SQL注入检测
    this.addRule({
      id: 'sql_injection',
      name: 'SQL Injection Detection',
      type: ThreatType.SQL_INJECTION,
      severity: ThreatSeverity.CRITICAL,
      enabled: true,
      pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b|['"]\s*(OR|AND)\s*['"]\s*=\s*['"]|--|\*\/)/i,
      conditions: [
        {
          field: 'body',
          operator: 'matches',
          value: 'pattern'
        }
      ],
      actions: [
        { type: 'block', parameters: { duration: 86400000 } }, // 24 hours / 24小时
        { type: 'alert' },
        { type: 'log' }
      ],
      description: 'Detects potential SQL injection attempts / 检测潜在的SQL注入尝试'
    });

    // XSS detection / XSS检测
    this.addRule({
      id: 'xss_detection',
      name: 'Cross-Site Scripting Detection',
      type: ThreatType.XSS,
      severity: ThreatSeverity.HIGH,
      enabled: true,
      pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      conditions: [
        {
          field: 'body',
          operator: 'matches',
          value: 'pattern'
        }
      ],
      actions: [
        { type: 'block', parameters: { duration: 3600000 } }, // 1 hour / 1小时
        { type: 'alert' },
        { type: 'log' }
      ],
      description: 'Detects potential XSS attacks / 检测潜在的XSS攻击'
    });
  }

  // Start the threat detection service / 启动威胁检测服务
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start cleanup timer / 启动清理定时器
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    console.log('Threat Detection Service started');
    this.emit('service_started');
  }

  // Stop the threat detection service / 停止威胁检测服务
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

    console.log('Threat Detection Service stopped');
    this.emit('service_stopped');
  }

  // Add a threat detection rule / 添加威胁检测规则
  addRule(rule: ThreatRule): void {
    this.rules.set(rule.id, { ...rule });
    this.stats.activeRules = this.rules.size;
    
    console.log(`Threat rule added: ${rule.name} (${rule.id})`);
    this.emit('rule_added', rule);
  }

  // Remove a threat detection rule / 移除威胁检测规则
  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
      this.stats.activeRules = this.rules.size;
      
      console.log(`Threat rule removed: ${ruleId}`);
      this.emit('rule_removed', rule);
    }
  }

  // Enable or disable a rule / 启用或禁用规则
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      console.log(`Threat rule ${enabled ? 'enabled' : 'disabled'}: ${ruleId}`);
      this.emit('rule_toggled', { ruleId, enabled });
    }
  }

  // Analyze a request for threats / 分析请求中的威胁
  async analyzeRequest(analysis: RequestAnalysis): Promise<ThreatEvent[]> {
    if (!this.isRunning) {
      return [];
    }

    const startTime = Date.now();
    const detectedThreats: ThreatEvent[] = [];

    try {
      // Update IP tracking / 更新IP跟踪
      if (this.config.enableIPTracking) {
        this.updateIPTracker(analysis.ip);
      }

      // Check if IP is blocked / 检查IP是否被阻止
      if (this.isIPBlocked(analysis.ip)) {
        const threat = this.createThreatEvent(
          ThreatType.UNAUTHORIZED_ACCESS,
          ThreatSeverity.HIGH,
          analysis.ip,
          'Request from blocked IP address / 来自被阻止IP地址的请求',
          { analysis },
          'blocked_ip_rule'
        );
        detectedThreats.push(threat);
        return detectedThreats;
      }

      // Apply all enabled rules / 应用所有启用的规则
      for (const rule of this.rules.values()) {
        if (!rule.enabled) continue;

        const threat = await this.evaluateRule(rule, analysis);
        if (threat) {
          detectedThreats.push(threat);
          
          // Execute threat actions / 执行威胁动作
          await this.executeThreatActions(rule, threat, analysis);
        }
      }

      // Update statistics / 更新统计
      const responseTime = Date.now() - startTime;
      this.updateStats(detectedThreats, responseTime);

      return detectedThreats;

    } catch (error) {
      console.error('Error analyzing request for threats:', error);
      return [];
    }
  }

  // Evaluate a single rule against request / 对请求评估单个规则
  private async evaluateRule(rule: ThreatRule, analysis: RequestAnalysis): Promise<ThreatEvent | null> {
    try {
      // Check rate limiting rules / 检查速率限制规则
      if (rule.type === ThreatType.RATE_LIMIT_EXCEEDED) {
        return this.checkRateLimit(rule, analysis);
      }

      // Check pattern-based rules / 检查基于模式的规则
      if (rule.pattern) {
        return this.checkPattern(rule, analysis);
      }

      // Check condition-based rules / 检查基于条件的规则
      if (rule.conditions.length > 0) {
        return this.checkConditions(rule, analysis);
      }

      return null;

    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
      return null;
    }
  }

  // Check rate limiting / 检查速率限制
  private checkRateLimit(rule: ThreatRule, analysis: RequestAnalysis): ThreatEvent | null {
    const tracker = this.ipTrackers.get(analysis.ip);
    if (!tracker) return null;

    const timeWindow = rule.timeWindow || this.config.rateLimitWindow;
    const threshold = rule.threshold || this.config.rateLimitThreshold;
    const cutoffTime = Date.now() - timeWindow;

    // Count recent requests / 计算最近的请求
    const recentRequests = tracker.threats.filter(
      threat => threat.timestamp > cutoffTime
    ).length + 1; // +1 for current request / +1表示当前请求

    if (recentRequests > threshold) {
      return this.createThreatEvent(
        rule.type,
        rule.severity,
        analysis.ip,
        `Rate limit exceeded: ${recentRequests} requests in ${timeWindow}ms / 速率限制超出：${timeWindow}毫秒内${recentRequests}个请求`,
        { analysis, recentRequests, threshold },
        rule.id
      );
    }

    return null;
  }

  // Check pattern matching / 检查模式匹配
  private checkPattern(rule: ThreatRule, analysis: RequestAnalysis): ThreatEvent | null {
    if (!rule.pattern) return null;

    const searchText = JSON.stringify(analysis);
    if (rule.pattern.test(searchText)) {
      return this.createThreatEvent(
        rule.type,
        rule.severity,
        analysis.ip,
        `Pattern match detected: ${rule.name} / 检测到模式匹配：${rule.name}`,
        { analysis, pattern: rule.pattern.source },
        rule.id
      );
    }

    return null;
  }

  // Check conditions / 检查条件
  private checkConditions(rule: ThreatRule, analysis: RequestAnalysis): ThreatEvent | null {
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, analysis)) {
        return null; // All conditions must match / 所有条件都必须匹配
      }
    }

    return this.createThreatEvent(
      rule.type,
      rule.severity,
      analysis.ip,
      `Condition match detected: ${rule.name} / 检测到条件匹配：${rule.name}`,
      { analysis, conditions: rule.conditions },
      rule.id
    );
  }

  // Evaluate a single condition / 评估单个条件
  private evaluateCondition(condition: ThreatCondition, analysis: RequestAnalysis): boolean {
    const fieldValue = this.getFieldValue(condition.field, analysis);
    if (fieldValue === undefined) return false;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'matches':
        if (condition.value === 'pattern') {
          // Special case for pattern matching / 模式匹配的特殊情况
          return true; // Already handled in checkPattern / 已在checkPattern中处理
        }
        const regex = new RegExp(condition.value, condition.caseSensitive ? 'g' : 'gi');
        return regex.test(String(fieldValue));
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'in_range':
        const [min, max] = condition.value;
        const numValue = Number(fieldValue);
        return numValue >= min && numValue <= max;
      default:
        return false;
    }
  }

  // Get field value from analysis / 从分析中获取字段值
  private getFieldValue(field: string, analysis: RequestAnalysis): any {
    const parts = field.split('.');
    let value: any = analysis;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  // Create a threat event / 创建威胁事件
  private createThreatEvent(
    type: ThreatType,
    severity: ThreatSeverity,
    source: string,
    description: string,
    metadata: Record<string, any>,
    ruleId: string
  ): ThreatEvent {
    const event: ThreatEvent = {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      timestamp: Date.now(),
      source,
      description,
      metadata,
      ruleId,
      blocked: false,
      resolved: false
    };

    // Add to events list / 添加到事件列表
    this.events.push(event);
    
    // Limit events in memory / 限制内存中的事件
    if (this.events.length > this.config.maxEventsInMemory) {
      this.events.shift();
    }

    return event;
  }

  // Execute threat response actions / 执行威胁响应动作
  private async executeThreatActions(rule: ThreatRule, threat: ThreatEvent, analysis: RequestAnalysis): Promise<void> {
    for (const action of rule.actions) {
      try {
        if (action.delay) {
          await new Promise(resolve => setTimeout(resolve, action.delay));
        }

        switch (action.type) {
          case 'block':
            await this.blockIP(analysis.ip, action.parameters?.duration || this.config.defaultBlockDuration);
            threat.blocked = true;
            break;
          case 'alert':
            await this.sendAlert(threat);
            break;
          case 'log':
            this.logThreat(threat);
            break;
          case 'quarantine':
            await this.quarantineRequest(analysis, action.parameters);
            break;
          case 'notify':
            await this.notifyAdministrators(threat, action.parameters);
            break;
        }
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
      }
    }
  }

  // Block an IP address / 阻止IP地址
  private async blockIP(ip: string, duration: number): Promise<void> {
    this.blockedIPs.add(ip);
    
    // Set unblock timer / 设置解除阻止定时器
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      console.log(`IP unblocked: ${ip}`);
      this.emit('ip_unblocked', { ip });
    }, duration);

    console.log(`IP blocked: ${ip} for ${duration}ms`);
    this.emit('ip_blocked', { ip, duration });
  }

  // Check if IP is blocked / 检查IP是否被阻止
  private isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  // Send threat alert / 发送威胁警报
  private async sendAlert(threat: ThreatEvent): Promise<void> {
    console.log(`THREAT ALERT: ${threat.type} - ${threat.description}`);
    
    if (this.config.alertWebhookUrl) {
      try {
        await fetch(this.config.alertWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            timestamp: new Date(threat.timestamp).toISOString(),
            threat,
            source: 'TitanChain Threat Detection'
          })
        });
      } catch (error) {
        console.error('Failed to send webhook alert:', error);
      }
    }

    this.emit('threat_alert', threat);
  }

  // Log threat event / 记录威胁事件
  private logThreat(threat: ThreatEvent): void {
    console.log(`Threat logged: ${threat.id} - ${threat.type} from ${threat.source}`);
    this.emit('threat_logged', threat);
  }

  // Quarantine request / 隔离请求
  private async quarantineRequest(analysis: RequestAnalysis, parameters?: Record<string, any>): Promise<void> {
    console.log(`Request quarantined from ${analysis.ip}`);
    this.emit('request_quarantined', { analysis, parameters });
  }

  // Notify administrators / 通知管理员
  private async notifyAdministrators(threat: ThreatEvent, parameters?: Record<string, any>): Promise<void> {
    console.log(`Administrator notification sent for threat: ${threat.id}`);
    this.emit('admin_notified', { threat, parameters });
  }

  // Update IP tracker / 更新IP跟踪器
  private updateIPTracker(ip: string): void {
    let tracker = this.ipTrackers.get(ip);
    
    if (!tracker) {
      tracker = {
        ip,
        requestCount: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        blocked: false,
        threats: [],
        reputation: 100 // Start with good reputation / 从良好声誉开始
      };
      this.ipTrackers.set(ip, tracker);
    }

    tracker.requestCount++;
    tracker.lastSeen = Date.now();
    tracker.blocked = this.isIPBlocked(ip);
  }

  // Update statistics / 更新统计
  private updateStats(threats: ThreatEvent[], responseTime: number): void {
    this.stats.totalThreats += threats.length;
    
    for (const threat of threats) {
      // Update by type / 按类型更新
      this.stats.threatsByType[threat.type] = (this.stats.threatsByType[threat.type] || 0) + 1;
      
      // Update by severity / 按严重程度更新
      this.stats.threatsBySeverity[threat.severity] = (this.stats.threatsBySeverity[threat.severity] || 0) + 1;
      
      // Update blocked count / 更新阻止计数
      if (threat.blocked) {
        this.stats.threatsBlocked++;
      }
      
      this.stats.lastThreatTime = threat.timestamp;
    }

    // Update average response time / 更新平均响应时间
    this.stats.averageResponseTime = 
      ((this.stats.averageResponseTime * (this.stats.totalThreats - threats.length)) + responseTime) / this.stats.totalThreats;
  }

  // Cleanup old data / 清理旧数据
  private cleanup(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours / 24小时

    // Clean up old events / 清理旧事件
    this.events = this.events.filter(event => event.timestamp > cutoffTime);

    // Clean up old IP trackers / 清理旧IP跟踪器
    for (const [ip, tracker] of this.ipTrackers.entries()) {
      if (tracker.lastSeen < cutoffTime) {
        this.ipTrackers.delete(ip);
      } else {
        // Clean up old threats in tracker / 清理跟踪器中的旧威胁
        tracker.threats = tracker.threats.filter(threat => threat.timestamp > cutoffTime);
      }
    }

    console.log('Threat detection cleanup completed');
  }

  // Get threat statistics / 获取威胁统计
  getStats(): ThreatStats {
    return { ...this.stats };
  }

  // Get recent threats / 获取最近威胁
  getRecentThreats(limit: number = 100): ThreatEvent[] {
    return this.events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Get threats by type / 按类型获取威胁
  getThreatsByType(type: ThreatType): ThreatEvent[] {
    return this.events.filter(event => event.type === type);
  }

  // Get blocked IPs / 获取被阻止的IP
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }

  // Get IP tracker information / 获取IP跟踪器信息
  getIPTracker(ip: string): IPTracker | undefined {
    return this.ipTrackers.get(ip);
  }

  // Get all IP trackers / 获取所有IP跟踪器
  getAllIPTrackers(): Map<string, IPTracker> {
    return new Map(this.ipTrackers);
  }

  // Manually resolve a threat / 手动解决威胁
  resolveThreat(threatId: string): boolean {
    const threat = this.events.find(event => event.id === threatId);
    if (threat) {
      threat.resolved = true;
      console.log(`Threat resolved: ${threatId}`);
      this.emit('threat_resolved', threat);
      return true;
    }
    return false;
  }

  // Manually unblock an IP / 手动解除IP阻止
  unblockIP(ip: string): boolean {
    if (this.blockedIPs.has(ip)) {
      this.blockedIPs.delete(ip);
      console.log(`IP manually unblocked: ${ip}`);
      this.emit('ip_unblocked', { ip, manual: true });
      return true;
    }
    return false;
  }

  // Update configuration / 更新配置
  updateConfig(newConfig: Partial<ThreatDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Threat Detection Service configuration updated');
    this.emit('config_updated', this.config);
  }

  // Check if service is running / 检查服务是否正在运行
  isActive(): boolean {
    return this.isRunning;
  }
}