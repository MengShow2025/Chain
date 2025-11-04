/**
 * 安全决策引擎核心类
 */

import { EventEmitter } from 'events';
import { 
  SecurityDecision, 
  SecurityContext, 
  ThreatLevel, 
  SecurityConfig,
  SecurityEvent, 
  SecurityError 
} from '../types/index.js';
import { ISecurityDecisionEngine } from './index.js';

export class SecurityDecisionEngine extends EventEmitter implements ISecurityDecisionEngine {
  private config: SecurityConfig;
  private threatModel: Map<string, any> = new Map();
  private riskFactors: Map<string, number> = new Map();
  private securityPolicies: Map<string, any> = new Map();
  private decisionHistory: SecurityDecision[] = [];
  private layerStatuses: Map<string, any> = new Map();

  constructor(config: SecurityConfig) {
    super();
    this.config = config;
    this.initializeEngine();
  }

  private async initializeEngine(): Promise<void> {
    try {
      console.log('Initializing Security Decision Engine... / 初始化安全决策引擎...');
      console.log('ZK protocols enabled / 启用的ZK协议:', this.config.zk_config.enabled_protocols);
      console.log('TEE platforms enabled / 启用的TEE平台:', this.config.tee_config.enabled_platforms);
      
      // Initialize threat model / 初始化威胁模型
      this.initializeThreatModel();
      
      // Initialize risk factors / 初始化风险因子
      this.initializeRiskFactors();
      
      // Initialize security policies / 初始化安全策略
      this.initializeSecurityPolicies();
      
      // Initialize layer statuses / 初始化层状态
      this.initializeLayerStatuses();
      
      this.emit('engine_initialized', {
        zk_protocols: this.config.zk_config.enabled_protocols,
        tee_platforms: this.config.tee_config.enabled_platforms,
        decision_threshold: this.config.decision_config.min_confidence_threshold
      });
      
      console.log('Security Decision Engine initialized successfully / 安全决策引擎初始化成功');
    } catch (error) {
      console.error('Failed to initialize Security Decision Engine / 安全决策引擎初始化失败:', error);
      throw new SecurityError('Engine initialization failed', 'INIT_ERROR', { level: 5, name: 'Decision Engine', description: 'Security Decision Engine Layer' }, error);
    }
  }

  private initializeThreatModel(): void {
    // 初始化威胁模型
    const threats = [
      {
        id: 'quantum_attack',
        name: 'Quantum Computing Attack',
        severity: 'HIGH',
        probability: 0.1,
        impact: 0.9,
        mitigation: ['quantum_resistant_crypto', 'key_rotation']
      },
      {
        id: 'side_channel_attack',
        name: 'Side Channel Attack',
        severity: 'MEDIUM',
        probability: 0.3,
        impact: 0.6,
        mitigation: ['tee_protection', 'constant_time_ops']
      },
      {
        id: 'collusion_attack',
        name: 'Collusion Attack',
        severity: 'HIGH',
        probability: 0.2,
        impact: 0.8,
        mitigation: ['mpc_protocols', 'threshold_schemes']
      },
      {
        id: 'replay_attack',
        name: 'Replay Attack',
        severity: 'MEDIUM',
        probability: 0.4,
        impact: 0.5,
        mitigation: ['nonce_verification', 'timestamp_checks']
      },
      {
        id: 'man_in_middle',
        name: 'Man-in-the-Middle Attack',
        severity: 'HIGH',
        probability: 0.25,
        impact: 0.7,
        mitigation: ['mutual_authentication', 'secure_channels']
      }
    ];

    threats.forEach(threat => {
      this.threatModel.set(threat.id, threat);
    });
  }

  private initializeRiskFactors(): void {
    // 初始化风险因子权重
    this.riskFactors.set('network_exposure', 0.2);
    this.riskFactors.set('data_sensitivity', 0.3);
    this.riskFactors.set('user_privilege', 0.15);
    this.riskFactors.set('transaction_value', 0.25);
    this.riskFactors.set('historical_attacks', 0.1);
  }

  private initializeSecurityPolicies(): void {
    // 初始化安全策略
    const policies = [
      {
        id: 'high_value_transaction',
        name: 'High Value Transaction Policy',
        conditions: { transaction_value: { min: 1000000 } },
        requirements: ['zk_proof', 'tee_execution', 'mpc_verification', 'quantum_signature']
      },
      {
        id: 'sensitive_data_access',
        name: 'Sensitive Data Access Policy',
        conditions: { data_sensitivity: { min: 0.8 } },
        requirements: ['tee_execution', 'quantum_encryption', 'audit_logging']
      },
      {
        id: 'privileged_operation',
        name: 'Privileged Operation Policy',
        conditions: { user_privilege: { min: 0.9 } },
        requirements: ['mpc_consensus', 'threshold_signature', 'multi_factor_auth']
      },
      {
        id: 'public_network_access',
        name: 'Public Network Access Policy',
        conditions: { network_exposure: { min: 0.7 } },
        requirements: ['zk_proof', 'quantum_signature', 'secure_channel']
      }
    ];

    policies.forEach(policy => {
      this.securityPolicies.set(policy.id, policy);
    });
  }

  private initializeLayerStatuses(): void {
    // 初始化各安全层状态
    this.layerStatuses.set('cryptography', { 
      level: 0, 
      name: 'Basic Cryptography', 
      status: 'ACTIVE', 
      health: 1.0 
    });
    this.layerStatuses.set('zk_proof', { 
      level: 1, 
      name: 'Zero-Knowledge Proof', 
      status: 'ACTIVE', 
      health: 1.0 
    });
    this.layerStatuses.set('tee', { 
      level: 2, 
      name: 'Trusted Execution Environment', 
      status: 'ACTIVE', 
      health: 1.0 
    });
    this.layerStatuses.set('mpc', { 
      level: 3, 
      name: 'Multi-Party Computation', 
      status: 'ACTIVE', 
      health: 1.0 
    });
    this.layerStatuses.set('quantum_resistant', { 
      level: 4, 
      name: 'Quantum-Resistant Cryptography', 
      status: 'ACTIVE', 
      health: 1.0 
    });
  }

  async evaluateSecurityLevel(context: SecurityContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 计算基础风险分数
      const riskScore = await this.calculateRiskScore(context);
      
      // 评估威胁级别
      const threatLevel = this.assessThreatLevel(context, riskScore);
      
      // 确定所需安全级别
      const requiredLevel = this.determineRequiredSecurityLevel(riskScore, threatLevel);
      
      // 检查可用安全层
      const availableLayers = this.getAvailableSecurityLayers();
      
      // 生成安全评估结果
      const evaluation = {
        evaluation_id: this.generateEvaluationId(),
        context,
        risk_score: riskScore,
        threat_level: threatLevel,
        required_security_level: requiredLevel,
        available_layers: availableLayers,
        recommended_layers: this.selectRecommendedLayers(requiredLevel, availableLayers),
        evaluation_time: Date.now() - startTime,
        timestamp: new Date()
      };

      // 发出事件
      this.emit('security_evaluated', {
        event_id: this.generateEventId(),
        event_type: 'SECURITY_EVALUATED',
        layer: { level: 5, name: 'Decision Engine', description: 'Security Decision Engine Layer' },
        timestamp: new Date(),
        data: {
          evaluation_id: evaluation.evaluation_id,
          risk_score: riskScore,
          threat_level: threatLevel,
          required_level: requiredLevel,
          evaluation_time: evaluation.evaluation_time
        },
        severity: this.getSeverityFromThreatLevel(threatLevel)
      } as SecurityEvent);

      console.log(`Security level evaluated: ${threatLevel} (risk: ${riskScore.toFixed(2)}) in ${evaluation.evaluation_time}ms`);
      return evaluation;
      
    } catch (error) {
      const evaluationTime = Date.now() - startTime;
      console.error('Security evaluation failed:', error);
      
      this.emit('evaluation_failed', {
        event_id: this.generateEventId(),
        event_type: 'SECURITY_EVALUATED',
        layer: { level: 5, name: 'Decision Engine', description: 'Security Decision Engine Layer' },
        timestamp: new Date(),
        data: {
          error: error.message,
          evaluation_time: evaluationTime
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new SecurityError(`Security evaluation failed: ${error.message}`, error);
    }
  }

  private async calculateRiskScore(context: SecurityContext): Promise<number> {
    let totalScore = 0;
    let totalWeight = 0;

    // 网络暴露风险
    const networkRisk = this.assessNetworkRisk(context);
    totalScore += networkRisk * this.riskFactors.get('network_exposure')!;
    totalWeight += this.riskFactors.get('network_exposure')!;

    // 数据敏感性风险
    const dataSensitivity = this.assessDataSensitivity(context);
    totalScore += dataSensitivity * this.riskFactors.get('data_sensitivity')!;
    totalWeight += this.riskFactors.get('data_sensitivity')!;

    // 用户权限风险
    const userPrivilege = this.assessUserPrivilege(context);
    totalScore += userPrivilege * this.riskFactors.get('user_privilege')!;
    totalWeight += this.riskFactors.get('user_privilege')!;

    // 交易价值风险
    const transactionValue = this.assessTransactionValue(context);
    totalScore += transactionValue * this.riskFactors.get('transaction_value')!;
    totalWeight += this.riskFactors.get('transaction_value')!;

    // 历史攻击风险
    const historicalRisk = this.assessHistoricalRisk(context);
    totalScore += historicalRisk * this.riskFactors.get('historical_attacks')!;
    totalWeight += this.riskFactors.get('historical_attacks')!;

    return totalScore / totalWeight;
  }

  private assessNetworkRisk(context: SecurityContext): number {
    // 评估网络暴露风险 (0-1)
    if (context.network_type === 'public') return 0.8;
    if (context.network_type === 'private') return 0.3;
    if (context.network_type === 'isolated') return 0.1;
    return 0.5; // default
  }

  private assessDataSensitivity(context: SecurityContext): number {
    // 评估数据敏感性 (0-1)
    const sensitivityMap: { [key: string]: number } = {
      'public': 0.1,
      'internal': 0.4,
      'confidential': 0.7,
      'secret': 0.9,
      'top_secret': 1.0
    };
    return sensitivityMap[context.data_classification] || 0.5;
  }

  private assessUserPrivilege(context: SecurityContext): number {
    // 评估用户权限风险 (0-1)
    const privilegeMap: { [key: string]: number } = {
      'guest': 0.1,
      'user': 0.3,
      'operator': 0.5,
      'admin': 0.8,
      'root': 1.0
    };
    return privilegeMap[context.user_role] || 0.5;
  }

  private assessTransactionValue(context: SecurityContext): number {
    // 评估交易价值风险 (0-1)
    const value = context.transaction_value || 0;
    if (value >= 10000000) return 1.0;
    if (value >= 1000000) return 0.8;
    if (value >= 100000) return 0.6;
    if (value >= 10000) return 0.4;
    if (value >= 1000) return 0.2;
    return 0.1;
  }

  private assessHistoricalRisk(context: SecurityContext): number {
    // 评估历史攻击风险 (0-1)
    const recentAttacks = context.recent_attack_count || 0;
    return Math.min(recentAttacks * 0.1, 1.0);
  }

  private assessThreatLevel(context: SecurityContext, riskScore: number): ThreatLevel {
    if (riskScore >= 0.8) return 'CRITICAL';
    if (riskScore >= 0.6) return 'HIGH';
    if (riskScore >= 0.4) return 'MEDIUM';
    if (riskScore >= 0.2) return 'LOW';
    return 'MINIMAL';
  }

  private determineRequiredSecurityLevel(riskScore: number, threatLevel: ThreatLevel): number {
    const levelMap: { [key in ThreatLevel]: number } = {
      'MINIMAL': 1,
      'LOW': 2,
      'MEDIUM': 3,
      'HIGH': 4,
      'CRITICAL': 5
    };
    return levelMap[threatLevel];
  }

  private getAvailableSecurityLayers(): any[] {
    return Array.from(this.layerStatuses.values())
      .filter(layer => layer.status === 'ACTIVE' && layer.health > 0.5)
      .sort((a, b) => a.level - b.level);
  }

  private selectRecommendedLayers(requiredLevel: number, availableLayers: any[]): any[] {
    return availableLayers.filter(layer => layer.level < requiredLevel);
  }

  async makeSecurityDecision(request: any): Promise<SecurityDecision> {
    const startTime = Date.now();
    
    try {
      const decisionId = this.generateDecisionId();
      
      // 评估安全级别
      const evaluation = await this.evaluateSecurityLevel(request.context);
      
      // 匹配安全策略
      const matchedPolicies = this.matchSecurityPolicies(request.context);
      
      // 生成安全要求
      const requirements = this.generateSecurityRequirements(evaluation, matchedPolicies);
      
      // 检查资源可用性
      const resourceAvailability = this.checkResourceAvailability(requirements);
      
      // 做出决策
      const decision: SecurityDecision = {
        decision_id: decisionId,
        request_id: request.id,
        context: request.context,
        evaluation,
        matched_policies: matchedPolicies,
        security_requirements: requirements,
        resource_availability: resourceAvailability,
        decision: this.makeDecision(evaluation, requirements, resourceAvailability),
        confidence: this.calculateConfidence(evaluation, requirements),
        alternatives: this.generateAlternatives(evaluation, requirements),
        decision_time: Date.now() - startTime,
        timestamp: new Date()
      };

      // 记录决策历史
      this.decisionHistory.push(decision);
      
      // 限制历史记录大小
      if (this.decisionHistory.length > 1000) {
        this.decisionHistory = this.decisionHistory.slice(-1000);
      }

      // 发出事件
      this.emit('decision_made', {
        event_id: this.generateEventId(),
        event_type: 'SECURITY_EVALUATED',
        layer: { level: 5, name: 'Decision Engine', description: 'Security Decision Engine Layer' },
        timestamp: new Date(),
        data: {
          decision_id: decisionId,
          request_id: request.id,
          decision: decision.decision,
          confidence: decision.confidence,
          decision_time: decision.decision_time
        },
        severity: 'INFO'
      } as SecurityEvent);

      console.log(`Security decision made: ${decision.decision} (confidence: ${decision.confidence.toFixed(2)}) in ${decision.decision_time}ms`);
      return decision;
      
    } catch (error) {
      const decisionTime = Date.now() - startTime;
      console.error('Security decision failed:', error);
      
      this.emit('decision_failed', {
        event_id: this.generateEventId(),
        event_type: 'SECURITY_EVALUATED',
        layer: { level: 5, name: 'Decision Engine', description: 'Security Decision Engine Layer' },
        timestamp: new Date(),
        data: {
          request_id: request.id,
          error: error.message,
          decision_time: decisionTime
        },
        severity: 'ERROR'
      } as SecurityEvent);
      
      throw new SecurityError(`Security decision failed: ${error.message}`, error);
    }
  }

  private matchSecurityPolicies(context: SecurityContext): any[] {
    const matchedPolicies = [];
    
    for (const policy of this.securityPolicies.values()) {
      if (this.evaluatePolicyConditions(policy.conditions, context)) {
        matchedPolicies.push(policy);
      }
    }
    
    return matchedPolicies;
  }

  private evaluatePolicyConditions(conditions: any, context: SecurityContext): boolean {
    for (const [key, condition] of Object.entries(conditions)) {
      const contextValue = (context as any)[key];
      const conditionObj = condition as any;
      
      if (conditionObj.min !== undefined && contextValue < conditionObj.min) {
        return false;
      }
      if (conditionObj.max !== undefined && contextValue > conditionObj.max) {
        return false;
      }
      if (conditionObj.equals !== undefined && contextValue !== conditionObj.equals) {
        return false;
      }
    }
    
    return true;
  }

  private generateSecurityRequirements(evaluation: any, policies: any[]): string[] {
    const requirements = new Set<string>();
    
    // 基于评估结果添加要求
    if (evaluation.threat_level === 'CRITICAL') {
      requirements.add('zk_proof');
      requirements.add('tee_execution');
      requirements.add('mpc_verification');
      requirements.add('quantum_signature');
    } else if (evaluation.threat_level === 'HIGH') {
      requirements.add('zk_proof');
      requirements.add('tee_execution');
      requirements.add('quantum_signature');
    } else if (evaluation.threat_level === 'MEDIUM') {
      requirements.add('zk_proof');
      requirements.add('quantum_signature');
    }
    
    // 基于策略添加要求
    for (const policy of policies) {
      for (const requirement of policy.requirements) {
        requirements.add(requirement);
      }
    }
    
    return Array.from(requirements);
  }

  private checkResourceAvailability(requirements: string[]): { [key: string]: boolean } {
    const availability: { [key: string]: boolean } = {};
    
    for (const requirement of requirements) {
      switch (requirement) {
        case 'zk_proof':
          availability[requirement] = this.layerStatuses.get('zk_proof')?.status === 'ACTIVE';
          break;
        case 'tee_execution':
          availability[requirement] = this.layerStatuses.get('tee')?.status === 'ACTIVE';
          break;
        case 'mpc_verification':
          availability[requirement] = this.layerStatuses.get('mpc')?.status === 'ACTIVE';
          break;
        case 'quantum_signature':
          availability[requirement] = this.layerStatuses.get('quantum_resistant')?.status === 'ACTIVE';
          break;
        default:
          availability[requirement] = true; // 假设其他要求可用
      }
    }
    
    return availability;
  }

  private makeDecision(evaluation: any, requirements: string[], availability: { [key: string]: boolean }): string {
    // 检查所有要求是否可用
    const allAvailable = requirements.every(req => availability[req]);
    
    if (allAvailable) {
      return 'APPROVE';
    }
    
    // 检查关键要求是否可用
    const criticalRequirements = ['zk_proof', 'tee_execution', 'quantum_signature'];
    const criticalAvailable = criticalRequirements.every(req => 
      !requirements.includes(req) || availability[req]
    );
    
    if (criticalAvailable && evaluation.threat_level !== 'CRITICAL') {
      return 'APPROVE_WITH_CONDITIONS';
    }
    
    return 'DENY';
  }

  private calculateConfidence(evaluation: any, requirements: string[]): number {
    let confidence = 0.5; // 基础置信度
    
    // 基于评估质量调整
    if (evaluation.available_layers.length >= 3) {
      confidence += 0.2;
    }
    
    // 基于要求满足度调整
    if (requirements.length > 0) {
      confidence += 0.2;
    }
    
    // 基于威胁级别调整
    const threatLevelBonus = {
      'MINIMAL': 0.1,
      'LOW': 0.05,
      'MEDIUM': 0.0,
      'HIGH': -0.05,
      'CRITICAL': -0.1
    };
    confidence += threatLevelBonus[evaluation.threat_level as ThreatLevel] || 0;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private generateAlternatives(evaluation: any, requirements: string[]): any[] {
    const alternatives = [];
    
    // 降级方案
    if (requirements.includes('mpc_verification')) {
      alternatives.push({
        type: 'DOWNGRADE',
        description: 'Use threshold signature instead of full MPC',
        requirements: requirements.filter(r => r !== 'mpc_verification').concat(['threshold_signature'])
      });
    }
    
    // 延迟方案
    if (evaluation.threat_level === 'CRITICAL') {
      alternatives.push({
        type: 'DELAY',
        description: 'Wait for all security layers to be available',
        delay_minutes: 5
      });
    }
    
    return alternatives;
  }

  async updateThreatModel(threats: any[]): Promise<void> {
    try {
      for (const threat of threats) {
        this.threatModel.set(threat.id, threat);
      }
      
      this.emit('threat_model_updated', {
        event_id: this.generateEventId(),
        event_type: 'SECURITY_EVALUATED',
        layer: { level: 5, name: 'Decision Engine', description: 'Security Decision Engine Layer' },
        timestamp: new Date(),
        data: {
          threats_updated: threats.length,
          total_threats: this.threatModel.size
        },
        severity: 'INFO'
      } as SecurityEvent);
      
      console.log(`Threat model updated with ${threats.length} threats`);
    } catch (error) {
      console.error('Failed to update threat model:', error);
      throw new SecurityError(`Failed to update threat model: ${error.message}`, error);
    }
  }

  async getSecurityRecommendations(context: SecurityContext): Promise<any[]> {
    try {
      const evaluation = await this.evaluateSecurityLevel(context);
      const recommendations = [];
      
      // 基于威胁级别生成建议
      if (evaluation.threat_level === 'CRITICAL' || evaluation.threat_level === 'HIGH') {
        recommendations.push({
          type: 'SECURITY_ENHANCEMENT',
          priority: 'HIGH',
          description: 'Enable all available security layers',
          actions: ['enable_zk_proof', 'enable_tee', 'enable_mpc', 'enable_quantum_crypto']
        });
      }
      
      // 基于风险分数生成建议
      if (evaluation.risk_score > 0.7) {
        recommendations.push({
          type: 'RISK_MITIGATION',
          priority: 'MEDIUM',
          description: 'Implement additional monitoring',
          actions: ['increase_logging', 'enable_anomaly_detection', 'setup_alerts']
        });
      }
      
      // 基于层健康状态生成建议
      for (const layer of this.layerStatuses.values()) {
        if (layer.health < 0.8) {
          recommendations.push({
            type: 'MAINTENANCE',
            priority: 'MEDIUM',
            description: `Improve ${layer.name} layer health`,
            actions: [`optimize_${layer.name.toLowerCase().replace(/\s+/g, '_')}`]
          });
        }
      }
      
      return recommendations;
    } catch (error) {
      console.error('Failed to generate security recommendations:', error);
      throw new SecurityError(`Failed to generate recommendations: ${error.message}`, error);
    }
  }

  private getSeverityFromThreatLevel(threatLevel: ThreatLevel): string {
    const severityMap: { [key in ThreatLevel]: string } = {
      'MINIMAL': 'INFO',
      'LOW': 'INFO',
      'MEDIUM': 'WARNING',
      'HIGH': 'ERROR',
      'CRITICAL': 'CRITICAL'
    };
    return severityMap[threatLevel];
  }

  private generateEvaluationId(): string {
    return 'eval_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateDecisionId(): string {
    return 'decision_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateEventId(): string {
    return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 获取系统统计信息
  getStatistics() {
    const recentDecisions = this.decisionHistory.slice(-100);
    const approvalRate = recentDecisions.filter(d => d.decision === 'APPROVE').length / recentDecisions.length;
    const avgConfidence = recentDecisions.reduce((sum, d) => sum + d.confidence, 0) / recentDecisions.length;
    
    return {
      total_decisions: this.decisionHistory.length,
      recent_decisions: recentDecisions.length,
      approval_rate: approvalRate || 0,
      average_confidence: avgConfidence || 0,
      threat_model_size: this.threatModel.size,
      security_policies: this.securityPolicies.size,
      active_layers: Array.from(this.layerStatuses.values()).filter(l => l.status === 'ACTIVE').length,
      total_layers: this.layerStatuses.size
    };
  }

  // 更新层状态
  updateLayerStatus(layerName: string, status: string, health: number): void {
    const layer = this.layerStatuses.get(layerName);
    if (layer) {
      layer.status = status;
      layer.health = health;
      
      this.emit('layer_status_updated', {
        event_id: this.generateEventId(),
        event_type: 'SECURITY_EVALUATED',
        layer: { level: 5, name: 'Decision Engine', description: 'Security Decision Engine Layer' },
        timestamp: new Date(),
        data: {
          layer_name: layerName,
          status,
          health
        },
        severity: health < 0.5 ? 'WARNING' : 'INFO'
      } as SecurityEvent);
    }
  }
}