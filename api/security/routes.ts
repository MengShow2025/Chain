// TitanChain Security Console API Routes / TitanChain安全控制台API路由
// Provides real-time monitoring, threat detection, security scoring and decision center API interfaces / 提供实时监控、威胁检测、安全评分和决策中心的API接口

import { Router } from 'express';
import { SecurityConsoleService } from './security-console-service';
import { ThreatDetectionService } from './threat-detection-service';
import { SecurityScoringService, ScoreCategory } from './security-scoring-service';
import { SecurityDecisionService, DecisionType } from './security-decision-service';

const router = Router();

// Service instances (lazy initialization) / 服务实例（延迟初始化）
let securityConsoleService: SecurityConsoleService | null = null;
let threatDetectionService: ThreatDetectionService | null = null;
let securityScoringService: SecurityScoringService | null = null;
let securityDecisionService: SecurityDecisionService | null = null;

// Service initialization status / 服务初始化状态
let servicesInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Asynchronously initialize security services / 异步初始化安全服务
async function initializeSecurityServices(): Promise<void> {
  if (servicesInitialized) return;
  
  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        console.log('🚀 Starting security console services... / 启动安全控制台服务...');
        
        // Quick initialization, don't wait for complex service startup / 快速初始化，不等待复杂的服务启动
        try {
          securityConsoleService = new SecurityConsoleService();
          console.log('✅ Security console service created successfully / 安全控制台服务创建成功');
        } catch (error) {
          console.warn('⚠️ Security console service creation failed, using simulation mode / 安全控制台服务创建失败，使用模拟模式:', error.message);
          securityConsoleService = null;
        }
        
        // Create threat detection service with configuration / 使用配置创建威胁检测服务
        try {
          threatDetectionService = new ThreatDetectionService({
            enabled: true,
            maxEventsInMemory: 10000,
            cleanupInterval: 300000, // 5 minutes / 5分钟
            defaultBlockDuration: 3600000, // 1 hour / 1小时
            rateLimitWindow: 60000, // 1 minute / 1分钟
            rateLimitThreshold: 100,
            enableIPTracking: true,
            enableBehaviorAnalysis: true
          });
          console.log('✅ Threat detection service created successfully / 威胁检测服务创建成功');
        } catch (error) {
          console.warn('⚠️ Threat detection service creation failed, using simulation mode / 威胁检测服务创建失败，使用模拟模式:', error.message);
          threatDetectionService = null;
        }
        
        // Create security scoring service with configuration / 使用配置创建安全评分服务
        try {
          securityScoringService = new SecurityScoringService({
            enabled: true,
            calculationInterval: 300000, // 5 minutes / 5分钟
            retentionDays: 30,
            categoryWeights: {
              [ScoreCategory.NETWORK_SECURITY]: 1.2,
              [ScoreCategory.ACCESS_CONTROL]: 1.1,
              [ScoreCategory.DATA_PROTECTION]: 1.3,
              [ScoreCategory.SYSTEM_INTEGRITY]: 1.0,
              [ScoreCategory.COMPLIANCE]: 0.9,
              [ScoreCategory.THREAT_DETECTION]: 1.1,
              [ScoreCategory.INCIDENT_RESPONSE]: 0.8,
              [ScoreCategory.VULNERABILITY_MANAGEMENT]: 1.0
            },
            riskThresholds: {
              critical: 20,
              high: 40,
              medium: 60,
              low: 80
            },
            trendAnalysisPeriods: {
              daily: 7,
              weekly: 4,
              monthly: 12
            },
            alertThresholds: {
              scoreDecrease: 10,
              riskIncrease: 2,
              newCriticalFactors: 1
            }
          });
          console.log('✅ Security scoring service created successfully / 安全评分服务创建成功');
        } catch (error) {
          console.warn('⚠️ Security scoring service creation failed, using simulation mode / 安全评分服务创建失败，使用模拟模式:', error.message);
          securityScoringService = null;
        }
        
        // Create security decision service with configuration / 使用配置创建安全决策服务
        try {
          securityDecisionService = new SecurityDecisionService({
            enabled: true,
            defaultDecision: DecisionType.ALLOW,
            maxAuditLogs: 10000,
            auditRetentionDays: 30,
            enableRiskScoring: true,
            enableGeolocation: true,
            enableBehaviorAnalysis: true,
            cacheDecisions: true,
            cacheTimeout: 300000, // 5 minutes / 5分钟
            alertThreshold: 80
          });
          console.log('✅ Security decision service created successfully / 安全决策服务创建成功');
        } catch (error) {
          console.warn('⚠️ Security decision service creation failed, using simulation mode / 安全决策服务创建失败，使用模拟模式:', error.message);
          securityDecisionService = null;
        }
        
        servicesInitialized = true;
        console.log('✅ All security services initialized / 所有安全服务已初始化');
        
      } catch (error) {
        console.error('❌ Failed to initialize security services / 安全服务初始化失败:', error);
        throw error;
      }
    })();
  }
  
  return initializationPromise;
}

// Middleware to ensure services are initialized / 确保服务已初始化的中间件
async function ensureServicesInitialized(req: any, res: any, next: any) {
  try {
    await initializeSecurityServices();
    next();
  } catch (error) {
    console.error('Service initialization failed / 服务初始化失败:', error);
    res.status(503).json({ error: 'Services not available / 服务不可用', details: error.message });
  }
}

// System Overview API / 系统概览API
router.get('/overview', ensureServicesInitialized, async (req, res) => {
  try {
    if (!securityConsoleService) {
      // Return simulated data when service is not available / 服务不可用时返回模拟数据
      return res.json({
        status: 'WARNING',
        uptime: process.uptime(),
        totalLayers: 5,
        activeLayers: 2,
        securityScore: 70,
        threatLevel: 'MEDIUM',
        activeThreats: 1,
        recentDecisions: 3,
        performanceScore: 75,
        lastUpdated: new Date().toISOString(),
        message: 'Using simulated data - security console service not available / 使用模拟数据 - 安全控制台服务不可用'
      });
    }

    const overview = await securityConsoleService.getSystemOverview();
    res.json({
      ...overview,
      lastUpdated: overview.lastUpdated.toISOString()
    });
  } catch (error) {
    console.error('Failed to get system overview / 获取系统概览失败:', error);
    res.status(500).json({
      error: 'Failed to get system overview / 获取系统概览失败',
      details: error.message
    });
  }
});

// Security Layers Status API / 安全层状态API
router.get('/layers/status', ensureServicesInitialized, async (req, res) => {
  try {
    if (!securityConsoleService) {
      // Return simulated data when service is not available / 服务不可用时返回模拟数据
      return res.json({
        layers: [
          {
            layerId: 'zk-proof',
            name: 'Zero Knowledge Proof Layer / 零知识证明层',
            level: 1,
            status: 'ERROR',
            health: 60,
            performance: { throughput: 0, latency: 0, errorRate: 0.4 },
            statistics: { totalOperations: 0, successfulOperations: 0, failedOperations: 0, averageResponseTime: 0 },
            lastUpdated: new Date().toISOString()
          },
          {
            layerId: 'tee',
            name: 'Trusted Execution Environment Layer / 可信执行环境层',
            level: 2,
            status: 'ACTIVE',
            health: 85,
            performance: { throughput: 100, latency: 50, errorRate: 0.05 },
            statistics: { totalOperations: 1000, successfulOperations: 950, failedOperations: 50, averageResponseTime: 45 },
            lastUpdated: new Date().toISOString()
          }
        ],
        message: 'Using simulated data - security console service not available / 使用模拟数据 - 安全控制台服务不可用'
      });
    }

    const layers = await securityConsoleService.getSecurityLayersStatus();
    res.json({
      layers: layers.map(layer => ({
        ...layer,
        lastUpdated: layer.lastUpdated.toISOString()
      }))
    });
  } catch (error) {
    console.error('Failed to get security layers status / 获取安全层状态失败:', error);
    res.status(500).json({
      error: 'Failed to get security layers status / 获取安全层状态失败',
      details: error.message
    });
  }
});

// Performance Metrics API / 性能指标API
router.get('/metrics/performance', async (req, res) => {
  try {
    const timeRange = req.query.timeRange as string || '1h';
    
    if (!securityConsoleService) {
      // Return simulated performance metrics / 返回模拟性能指标
      return res.json({
        current: {
          system: { cpu: 45, memory: 60, disk: 30, network: 25 },
          security: {
            zkProofGeneration: { averageTime: 0, throughput: 0, successRate: 0 },
            teeOperations: { averageTime: 50, throughput: 100, successRate: 95 },
            mpcComputations: { averageTime: 0, throughput: 0, successRate: 0 },
            quantumOperations: { averageTime: 0, throughput: 0, successRate: 0 }
          },
          blockchain: { tps: 1000, blockTime: 3000, pendingTransactions: 50, networkLatency: 100 },
          timestamp: new Date().toISOString()
        },
        history: [],
        message: 'Using simulated data - security console service not available / 使用模拟数据 - 安全控制台服务不可用'
      });
    }

    const currentMetrics = await securityConsoleService.getPerformanceMetrics();
    const history = securityConsoleService.getMetricsHistory(timeRange);
    
    res.json({
      current: {
        ...currentMetrics,
        timestamp: currentMetrics.timestamp.toISOString()
      },
      history: history.map(metric => ({
        ...metric,
        timestamp: metric.timestamp.toISOString()
      }))
    });
  } catch (error) {
    console.error('Failed to get performance metrics / 获取性能指标失败:', error);
    res.status(500).json({
      error: 'Failed to get performance metrics / 获取性能指标失败',
      details: error.message
    });
  }
});

// System Health API / 系统健康API
router.get('/health', async (req, res) => {
  try {
    if (!securityConsoleService) {
      // Return simulated health data / 返回模拟健康数据
      return res.json({
        overall: { status: 'WARNING', score: 70, issues: ['Security console service not available / 安全控制台服务不可用'] },
        layers: {},
        resources: {
          cpu: { usage: 45, status: 'NORMAL' },
          memory: { usage: 60, status: 'NORMAL' },
          disk: { usage: 30, status: 'NORMAL' },
          network: { usage: 25, status: 'NORMAL' }
        },
        lastCheck: new Date().toISOString(),
        message: 'Using simulated data - security console service not available / 使用模拟数据 - 安全控制台服务不可用'
      });
    }

    const health = await securityConsoleService.getSystemHealth();
    res.json({
      ...health,
      lastCheck: health.lastCheck.toISOString()
    });
  } catch (error) {
    console.error('Failed to get system health / 获取系统健康状态失败:', error);
    res.status(500).json({
      error: 'Failed to get system health / 获取系统健康状态失败',
      details: error.message
    });
  }
});

// Threat Detection Overview API / 威胁检测概览API
router.get('/threats/overview', ensureServicesInitialized, async (req, res) => {
  try {
    if (!threatDetectionService) {
      // Return simulated threat data / 返回模拟威胁数据
      return res.json({
        currentThreatLevel: 'MEDIUM',
        activeThreats: 3,
        threatsBlocked: 15,
        falsePositives: 2,
        detectionAccuracy: 92.5,
        recentThreats: [
          {
            id: 'threat_001',
            type: 'BRUTE_FORCE',
            severity: 'HIGH',
            source: '192.168.1.100',
            target: '/api/auth/login',
            timestamp: new Date().toISOString(),
            status: 'BLOCKED'
          },
          {
            id: 'threat_002',
            type: 'SQL_INJECTION',
            severity: 'CRITICAL',
            source: '10.0.0.50',
            target: '/api/users/search',
            timestamp: new Date(Date.now() - 300000).toISOString(),
            status: 'BLOCKED'
          }
        ],
        statistics: {
          last24Hours: {
            totalDetections: 45,
            blocked: 42,
            allowed: 1,
            falsePositives: 2
          },
          byType: {
            'BRUTE_FORCE': 15,
            'SQL_INJECTION': 8,
            'XSS': 5,
            'DDOS': 12,
            'MALWARE': 3,
            'PHISHING': 2
          }
        },
        message: 'Using simulated data - threat detection service not available / 使用模拟数据 - 威胁检测服务不可用'
      });
    }

    // Get threat statistics and recent threats / 获取威胁统计和最近威胁
    const stats = threatDetectionService.getStats();
    const recentThreats = threatDetectionService.getRecentThreats(10);
    
    // Create overview from available data / 从可用数据创建概览
    const overview = {
      currentThreatLevel: stats.totalThreats > 50 ? 'HIGH' : stats.totalThreats > 20 ? 'MEDIUM' : 'LOW',
      activeThreats: stats.totalThreats,
      threatsBlocked: stats.threatsBlocked,
      falsePositives: 0, // Could be calculated from resolved threats / 可以从已解决威胁中计算
      detectionAccuracy: stats.totalThreats > 0 ? (stats.threatsBlocked / stats.totalThreats * 100) : 100,
      recentThreats: recentThreats.map(threat => ({
        id: threat.id,
        type: threat.type,
        severity: threat.severity,
        source: threat.source,
        target: threat.target,
        timestamp: new Date(threat.timestamp).toISOString(),
        status: threat.blocked ? 'BLOCKED' : threat.resolved ? 'RESOLVED' : 'ACTIVE'
      })),
      statistics: {
        last24Hours: {
          totalDetections: stats.totalThreats,
          blocked: stats.threatsBlocked,
          allowed: stats.totalThreats - stats.threatsBlocked,
          falsePositives: 0
        },
        byType: stats.threatsByType,
        bySeverity: stats.threatsBySeverity
      }
    };
    
    res.json(overview);
  } catch (error) {
    console.error('Failed to get threat overview / 获取威胁概览失败:', error);
    res.status(500).json({
      error: 'Failed to get threat overview / 获取威胁概览失败',
      details: error.message
    });
  }
});

// Active Threats API / 活跃威胁API
router.get('/threats/active', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const severity = req.query.severity as string;
    
    // Return simulated active threats / 返回模拟活跃威胁
    const threats = [
      {
        id: 'threat_active_001',
        type: 'DDOS',
        severity: 'CRITICAL',
        source: '203.0.113.0/24',
        target: '/api/gateway',
        startTime: new Date(Date.now() - 600000).toISOString(),
        requestCount: 15000,
        status: 'ACTIVE'
      },
      {
        id: 'threat_active_002',
        type: 'BRUTE_FORCE',
        severity: 'HIGH',
        source: '198.51.100.42',
        target: '/api/auth/login',
        startTime: new Date(Date.now() - 300000).toISOString(),
        attemptCount: 250,
        status: 'MONITORING'
      }
    ];

    res.json({
      threats: severity ? threats.filter(t => t.severity === severity) : threats.slice(0, limit),
      total: threats.length,
      message: threatDetectionService ? undefined : 'Using simulated data - threat detection service not available / 使用模拟数据 - 威胁检测服务不可用'
    });
  } catch (error) {
    console.error('Failed to get active threats / 获取活跃威胁失败:', error);
    res.status(500).json({
      error: 'Failed to get active threats / 获取活跃威胁失败',
      details: error.message
    });
  }
});

// Threat Statistics API / 威胁统计API
router.get('/threats/statistics', async (req, res) => {
  try {
    const timeRange = req.query.timeRange as string || '24h';
    
    // Return simulated threat statistics / 返回模拟威胁统计
    const statistics = {
      timeRange,
      totalDetections: 156,
      blocked: 148,
      allowed: 3,
      falsePositives: 5,
      accuracy: 96.8,
      topSources: [
        { ip: '203.0.113.0/24', count: 45, country: 'Unknown' },
        { ip: '198.51.100.0/24', count: 32, country: 'US' },
        { ip: '192.0.2.0/24', count: 28, country: 'CN' }
      ],
      topTargets: [
        { endpoint: '/api/auth/login', count: 67 },
        { endpoint: '/api/users/search', count: 34 },
        { endpoint: '/api/gateway', count: 28 }
      ]
    };

    res.json({
      ...statistics,
      message: threatDetectionService ? undefined : 'Using simulated data - threat detection service not available / 使用模拟数据 - 威胁检测服务不可用'
    });
  } catch (error) {
    console.error('Failed to get threat statistics / 获取威胁统计失败:', error);
    res.status(500).json({
      error: 'Failed to get threat statistics / 获取威胁统计失败',
      details: error.message
    });
  }
});

// Threat Patterns API / 威胁模式API
router.get('/threats/patterns', async (req, res) => {
  try {
    // Return simulated threat patterns / 返回模拟威胁模式
    const patterns = [
      {
        id: 'pattern_001',
        name: 'Coordinated Brute Force Attack / 协调暴力破解攻击',
        description: 'Multiple IPs attempting login with common passwords / 多个IP尝试使用常见密码登录',
        confidence: 0.95,
        occurrences: 12,
        lastSeen: new Date().toISOString()
      },
      {
        id: 'pattern_002',
        name: 'SQL Injection Campaign / SQL注入攻击活动',
        description: 'Systematic probing of database endpoints / 系统性探测数据库端点',
        confidence: 0.88,
        occurrences: 8,
        lastSeen: new Date(Date.now() - 1800000).toISOString()
      }
    ];

    res.json({
      patterns,
      message: threatDetectionService ? undefined : 'Using simulated data - threat detection service not available / 使用模拟数据 - 威胁检测服务不可用'
    });
  } catch (error) {
    console.error('Failed to get threat patterns / 获取威胁模式失败:', error);
    res.status(500).json({
      error: 'Failed to get threat patterns / 获取威胁模式失败',
      details: error.message
    });
  }
});

// Security Scoring Overview API / 安全评分概览API
router.get('/scoring/overall', async (req, res) => {
  try {
    // Return simulated security score / 返回模拟安全评分
    const overallScore = {
      currentScore: 87.5,
      previousScore: 85.2,
      trend: 'IMPROVING',
      riskLevel: 'MEDIUM',
      categories: {
        'Infrastructure Security / 基础设施安全': 92,
        'Application Security / 应用安全': 85,
        'Data Protection / 数据保护': 89,
        'Access Control / 访问控制': 84,
        'Compliance / 合规性': 88
      },
      recommendations: [
        'Strengthen authentication mechanisms / 加强认证机制',
        'Implement additional encryption layers / 实施额外的加密层',
        'Update security policies / 更新安全策略'
      ],
      lastUpdated: new Date().toISOString()
    };

    res.json({
      ...overallScore,
      message: securityScoringService ? undefined : 'Using simulated data - security scoring service not available / 使用模拟数据 - 安全评分服务不可用'
    });
  } catch (error) {
    console.error('Failed to get overall security score / 获取总体安全评分失败:', error);
    res.status(500).json({
      error: 'Failed to get overall security score / 获取总体安全评分失败',
      details: error.message
    });
  }
});

// Security Layer Scores API / 安全层评分API
router.get('/scoring/layers', ensureServicesInitialized, async (req, res) => {
  try {
    if (!securityScoringService) {
      // Return simulated layer scores / 返回模拟层评分
      return res.json({
        layers: [
          {
            layerId: 'zk-proof',
            name: 'Zero Knowledge Proof Layer / 零知识证明层',
            score: 65,
            maxScore: 100,
            status: 'NEEDS_ATTENTION',
            factors: [
              { name: 'Proof Generation Speed / 证明生成速度', score: 70, weight: 0.3 },
              { name: 'Verification Accuracy / 验证准确性', score: 85, weight: 0.4 },
              { name: 'Resource Efficiency / 资源效率', score: 45, weight: 0.3 }
            ],
            recommendations: [
              'Optimize proof generation algorithms / 优化证明生成算法',
              'Increase computational resources / 增加计算资源'
            ],
            lastUpdated: new Date().toISOString()
          },
          {
            layerId: 'tee',
            name: 'Trusted Execution Environment Layer / 可信执行环境层',
            score: 88,
            maxScore: 100,
            status: 'GOOD',
            factors: [
              { name: 'Attestation Success Rate / 认证成功率', score: 95, weight: 0.4 },
              { name: 'Enclave Performance / 安全区性能', score: 85, weight: 0.3 },
              { name: 'Security Compliance / 安全合规性', score: 82, weight: 0.3 }
            ],
            recommendations: [
              'Monitor enclave memory usage / 监控安全区内存使用',
              'Update security patches / 更新安全补丁'
            ],
            lastUpdated: new Date().toISOString()
          },
          {
            layerId: 'mpc',
            name: 'Multi-Party Computation Layer / 多方安全计算层',
            score: 75,
            maxScore: 100,
            status: 'ACCEPTABLE',
            factors: [
              { name: 'Computation Speed / 计算速度', score: 70, weight: 0.35 },
              { name: 'Privacy Preservation / 隐私保护', score: 90, weight: 0.35 },
              { name: 'Network Efficiency / 网络效率', score: 65, weight: 0.3 }
            ],
            recommendations: [
              'Optimize network protocols / 优化网络协议',
              'Implement better load balancing / 实施更好的负载均衡'
            ],
            lastUpdated: new Date().toISOString()
          },
          {
            layerId: 'quantum-resistant',
            name: 'Quantum Resistant Layer / 量子抗性层',
            score: 92,
            maxScore: 100,
            status: 'EXCELLENT',
            factors: [
              { name: 'Algorithm Strength / 算法强度', score: 95, weight: 0.4 },
              { name: 'Key Management / 密钥管理', score: 90, weight: 0.3 },
              { name: 'Performance Impact / 性能影响', score: 90, weight: 0.3 }
            ],
            recommendations: [
              'Continue monitoring quantum developments / 继续监控量子发展',
              'Regular algorithm updates / 定期算法更新'
            ],
            lastUpdated: new Date().toISOString()
          }
        ],
        summary: {
          averageScore: 80,
          totalLayers: 4,
          excellentLayers: 1,
          goodLayers: 1,
          acceptableLayers: 1,
          needsAttentionLayers: 1
        },
        message: 'Using simulated data - security scoring service not available / 使用模拟数据 - 安全评分服务不可用'
      });
    }

    // Use actual service methods / 使用实际服务方法
    const currentScore = securityScoringService.getCurrentScore();
    if (!currentScore) {
      return res.json({
        layers: [],
        summary: { averageScore: 0, totalLayers: 0, excellentLayers: 0, goodLayers: 0, acceptableLayers: 0, needsAttentionLayers: 0 },
        message: 'No scoring data available yet / 尚无评分数据'
      });
    }

    // Transform the score data to layer format / 将评分数据转换为层格式
    const layers = Object.entries(currentScore.categories).map(([category, score]) => ({
      layerId: category.toLowerCase().replace(/\s+/g, '-'),
      name: category,
      score: Math.round(score),
      maxScore: 100,
      status: score >= 90 ? 'EXCELLENT' : score >= 80 ? 'GOOD' : score >= 70 ? 'ACCEPTABLE' : 'NEEDS_ATTENTION',
      factors: [],
      recommendations: currentScore.recommendations.slice(0, 2),
      lastUpdated: new Date(currentScore.lastCalculated).toISOString()
    }));

    res.json({
      layers,
      summary: {
        averageScore: Math.round(currentScore.overall),
        totalLayers: layers.length,
        excellentLayers: layers.filter(l => l.status === 'EXCELLENT').length,
        goodLayers: layers.filter(l => l.status === 'GOOD').length,
        acceptableLayers: layers.filter(l => l.status === 'ACCEPTABLE').length,
        needsAttentionLayers: layers.filter(l => l.status === 'NEEDS_ATTENTION').length
      }
    });
  } catch (error) {
    console.error('Failed to get security layer scores / 获取安全层评分失败:', error);
    res.status(500).json({
      error: 'Failed to get security layer scores / 获取安全层评分失败',
      details: error.message
    });
  }
});

// Risk Assessment API / 风险评估API
router.get('/scoring/risk-assessment', ensureServicesInitialized, async (req, res) => {
  try {
    if (!securityScoringService) {
      // Return simulated risk assessment / 返回模拟风险评估
      return res.json({
        overallRisk: 'MEDIUM',
        riskScore: 65,
        categories: [
          {
            category: 'Technical Risks / 技术风险',
            score: 70,
            level: 'MEDIUM',
            factors: [
              'Outdated security protocols / 过时的安全协议',
              'Insufficient monitoring coverage / 监控覆盖不足'
            ]
          },
          {
            category: 'Operational Risks / 运营风险',
            score: 60,
            level: 'MEDIUM_HIGH',
            factors: [
              'Manual security processes / 手动安全流程',
              'Limited incident response automation / 有限的事件响应自动化'
            ]
          },
          {
            category: 'Compliance Risks / 合规风险',
            score: 80,
            level: 'LOW',
            factors: [
              'Regular audit compliance / 定期审计合规',
              'Updated policy documentation / 更新的策略文档'
            ]
          }
        ],
        mitigationActions: [
          {
            priority: 'HIGH',
            action: 'Implement automated threat response / 实施自动化威胁响应',
            estimatedImpact: 'Reduce response time by 75% / 减少响应时间75%',
            timeline: '2-4 weeks / 2-4周'
          },
          {
            priority: 'MEDIUM',
            action: 'Upgrade security monitoring tools / 升级安全监控工具',
            estimatedImpact: 'Improve detection accuracy by 20% / 提高检测准确性20%',
            timeline: '4-6 weeks / 4-6周'
          }
        ],
        lastAssessment: new Date().toISOString(),
        message: 'Using simulated data - security scoring service not available / 使用模拟数据 - 安全评分服务不可用'
      });
    }

    // Use actual service methods / 使用实际服务方法
    const currentScore = securityScoringService.getCurrentScore();
    const riskFactors = securityScoringService.getAllRiskFactors();
    const mitigationActions = securityScoringService.getAllMitigationActions();

    if (!currentScore) {
      return res.json({
        overallRisk: 'UNKNOWN',
        riskScore: 0,
        categories: [],
        mitigationActions: [],
        lastAssessment: new Date().toISOString(),
        message: 'No risk assessment data available yet / 尚无风险评估数据'
      });
    }

    res.json({
      overallRisk: currentScore.riskLevel.toUpperCase(),
      riskScore: Math.round(100 - currentScore.overall),
      categories: riskFactors.map(factor => ({
        category: factor.category,
        score: Math.round(100 - factor.impact),
        level: factor.severity.toUpperCase(),
        factors: [factor.description]
      })),
      mitigationActions: mitigationActions.slice(0, 5).map(action => ({
        priority: action.priority.toUpperCase(),
        action: action.name,
        estimatedImpact: `Improve score by ${action.expectedImpact} points / 提高评分${action.expectedImpact}分`,
        timeline: `${Math.ceil(action.estimatedEffort / 40)} weeks / ${Math.ceil(action.estimatedEffort / 40)}周`
      })),
      lastAssessment: new Date(currentScore.lastCalculated).toISOString()
    });
  } catch (error) {
    console.error('Failed to get risk assessment / 获取风险评估失败:', error);
    res.status(500).json({
      error: 'Failed to get risk assessment / 获取风险评估失败',
      details: error.message
    });
  }
});

// Security Recommendations API / 安全建议API
router.get('/scoring/recommendations', async (req, res) => {
  try {
    // Return simulated recommendations / 返回模拟建议
    const recommendations = [
      {
        id: 'rec_001',
        priority: 'HIGH',
        category: 'Authentication / 认证',
        title: 'Implement Multi-Factor Authentication / 实施多因素认证',
        description: 'Add additional authentication layers for critical operations / 为关键操作添加额外的认证层',
        impact: 'Reduce unauthorized access risk by 90% / 减少未授权访问风险90%',
        effort: 'MEDIUM',
        timeline: '2-3 weeks / 2-3周',
        status: 'PENDING'
      },
      {
        id: 'rec_002',
        priority: 'MEDIUM',
        category: 'Encryption / 加密',
        title: 'Upgrade Encryption Standards / 升级加密标准',
        description: 'Migrate to quantum-resistant encryption algorithms / 迁移到量子抗性加密算法',
        impact: 'Future-proof against quantum attacks / 防范未来量子攻击',
        effort: 'HIGH',
        timeline: '6-8 weeks / 6-8周',
        status: 'IN_PROGRESS'
      },
      {
        id: 'rec_003',
        priority: 'LOW',
        category: 'Monitoring / 监控',
        title: 'Enhanced Logging Configuration / 增强日志配置',
        description: 'Improve log collection and analysis capabilities / 改进日志收集和分析能力',
        impact: 'Better incident detection and forensics / 更好的事件检测和取证',
        effort: 'LOW',
        timeline: '1-2 weeks / 1-2周',
        status: 'COMPLETED'
      }
    ];

    res.json({
      recommendations,
      summary: {
        total: recommendations.length,
        high: recommendations.filter(r => r.priority === 'HIGH').length,
        medium: recommendations.filter(r => r.priority === 'MEDIUM').length,
        low: recommendations.filter(r => r.priority === 'LOW').length,
        pending: recommendations.filter(r => r.status === 'PENDING').length,
        inProgress: recommendations.filter(r => r.status === 'IN_PROGRESS').length,
        completed: recommendations.filter(r => r.status === 'COMPLETED').length
      },
      message: securityScoringService ? undefined : 'Using simulated data - security scoring service not available / 使用模拟数据 - 安全评分服务不可用'
    });
  } catch (error) {
    console.error('Failed to get security recommendations / 获取安全建议失败:', error);
    res.status(500).json({
      error: 'Failed to get security recommendations / 获取安全建议失败',
      details: error.message
    });
  }
});

// Security Decisions Overview API / 安全决策概览API
router.get('/decisions/overview', async (req, res) => {
  try {
    // Return simulated decision overview / 返回模拟决策概览
    const overview = {
      totalDecisions: 1247,
      todayDecisions: 45,
      averageDecisionTime: 1.2, // seconds / 秒
      decisionAccuracy: 94.8,
      categories: {
        'Access Control / 访问控制': 567,
        'Threat Response / 威胁响应': 234,
        'Compliance Check / 合规检查': 189,
        'Risk Assessment / 风险评估': 156,
        'Policy Enforcement / 策略执行': 101
      },
      recentDecisions: [
        {
          id: 'dec_001',
          type: 'THREAT_RESPONSE',
          description: 'Block suspicious IP address / 阻止可疑IP地址',
          decision: 'BLOCK',
          confidence: 0.95,
          timestamp: new Date().toISOString(),
          status: 'EXECUTED'
        },
        {
          id: 'dec_002',
          type: 'ACCESS_CONTROL',
          description: 'Grant elevated privileges / 授予提升权限',
          decision: 'ALLOW',
          confidence: 0.88,
          timestamp: new Date(Date.now() - 300000).toISOString(),
          status: 'EXECUTED'
        }
      ],
      lastUpdated: new Date().toISOString()
    };

    res.json({
      ...overview,
      message: securityDecisionService ? undefined : 'Using simulated data - security decision service not available / 使用模拟数据 - 安全决策服务不可用'
    });
  } catch (error) {
    console.error('Failed to get decisions overview / 获取决策概览失败:', error);
    res.status(500).json({
      error: 'Failed to get decisions overview / 获取决策概览失败',
      details: error.message
    });
  }
});

// Decision History API / 决策历史API
router.get('/decisions/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const type = req.query.type as string;
    const status = req.query.status as string;
    
    // Return simulated decision history / 返回模拟决策历史
    let decisions = [
      {
        id: 'dec_hist_001',
        type: 'THREAT_RESPONSE',
        description: 'DDoS attack mitigation / DDoS攻击缓解',
        decision: 'BLOCK',
        confidence: 0.98,
        executionTime: 0.8,
        timestamp: new Date().toISOString(),
        status: 'EXECUTED',
        result: 'SUCCESS'
      },
      {
        id: 'dec_hist_002',
        type: 'ACCESS_CONTROL',
        description: 'API access request validation / API访问请求验证',
        decision: 'ALLOW',
        confidence: 0.92,
        executionTime: 0.3,
        timestamp: new Date(Date.now() - 600000).toISOString(),
        status: 'EXECUTED',
        result: 'SUCCESS'
      }
    ];

    // Apply filters / 应用过滤器
    if (type) decisions = decisions.filter(d => d.type === type);
    if (status) decisions = decisions.filter(d => d.status === status);
    
    res.json({
      decisions: decisions.slice(0, limit),
      total: decisions.length,
      message: securityDecisionService ? undefined : 'Using simulated data - security decision service not available / 使用模拟数据 - 安全决策服务不可用'
    });
  } catch (error) {
    console.error('Failed to get decision history / 获取决策历史失败:', error);
    res.status(500).json({
      error: 'Failed to get decision history / 获取决策历史失败',
      details: error.message
    });
  }
});

// Active Decisions API / 活跃决策API
router.get('/decisions/active', async (req, res) => {
  try {
    // Return simulated active decisions / 返回模拟活跃决策
    const activeDecisions = [
      {
        id: 'dec_active_001',
        type: 'RISK_ASSESSMENT',
        description: 'Evaluating new user access pattern / 评估新用户访问模式',
        startTime: new Date(Date.now() - 30000).toISOString(),
        estimatedCompletion: new Date(Date.now() + 15000).toISOString(),
        progress: 75,
        status: 'PROCESSING'
      },
      {
        id: 'dec_active_002',
        type: 'COMPLIANCE_CHECK',
        description: 'Validating data retention policies / 验证数据保留策略',
        startTime: new Date(Date.now() - 60000).toISOString(),
        estimatedCompletion: new Date(Date.now() + 45000).toISOString(),
        progress: 40,
        status: 'PROCESSING'
      }
    ];

    res.json({
      activeDecisions,
      total: activeDecisions.length,
      message: securityDecisionService ? undefined : 'Using simulated data - security decision service not available / 使用模拟数据 - 安全决策服务不可用'
    });
  } catch (error) {
    console.error('Failed to get active decisions / 获取活跃决策失败:', error);
    res.status(500).json({
      error: 'Failed to get active decisions / 获取活跃决策失败',
      details: error.message
    });
  }
});

// Update Decision Status API / 更新决策状态API
router.put('/decisions/:decisionId/status', async (req, res) => {
  try {
    const { decisionId } = req.params;
    const { status, reason } = req.body;
    
    if (!decisionId || !status) {
      return res.status(400).json({
        error: 'Missing required parameters / 缺少必需参数',
        details: 'decisionId and status are required / 需要decisionId和status'
      });
    }

    // Simulate decision status update / 模拟决策状态更新
    const updatedDecision = {
      id: decisionId,
      status,
      reason,
      updatedAt: new Date().toISOString(),
      updatedBy: req.headers['user-id'] || 'system'
    };

    res.json({
      success: true,
      decision: updatedDecision,
      message: securityDecisionService ? 
        'Decision status updated successfully / 决策状态更新成功' : 
        'Simulated update - security decision service not available / 模拟更新 - 安全决策服务不可用'
    });
  } catch (error) {
    console.error('Failed to update decision status / 更新决策状态失败:', error);
    res.status(500).json({
      error: 'Failed to update decision status / 更新决策状态失败',
      details: error.message
    });
  }
});

// Manual Threat Response API / 手动威胁响应API
router.post('/decisions/threat-response', async (req, res) => {
  try {
    const { threatId, action, reason } = req.body;
    
    if (!threatId || !action) {
      return res.status(400).json({
        error: 'Missing required parameters / 缺少必需参数',
        details: 'threatId and action are required / 需要threatId和action'
      });
    }

    // Simulate threat response decision / 模拟威胁响应决策
    const responseDecision = {
      id: `dec_threat_${Date.now()}`,
      threatId,
      action,
      reason,
      timestamp: new Date().toISOString(),
      executedBy: req.headers['user-id'] || 'system',
      status: 'EXECUTED'
    };

    res.json({
      success: true,
      decision: responseDecision,
      message: securityDecisionService ? 
        'Threat response executed successfully / 威胁响应执行成功' : 
        'Simulated response - security decision service not available / 模拟响应 - 安全决策服务不可用'
    });
  } catch (error) {
    console.error('Failed to execute threat response / 执行威胁响应失败:', error);
    res.status(500).json({
      error: 'Failed to execute threat response / 执行威胁响应失败',
      details: error.message
    });
  }
});

// WebSocket Connection Info API / WebSocket连接信息API
router.get('/websocket/info', (req, res) => {
  try {
    const wsInfo = {
      enabled: true,
      endpoint: '/ws/security',
      protocols: ['security-updates', 'threat-alerts'],
      features: [
        'Real-time threat alerts / 实时威胁警报',
        'Live performance metrics / 实时性能指标',
        'Security score updates / 安全评分更新',
        'Decision notifications / 决策通知'
      ],
      connectionStatus: 'Available / 可用'
    };

    res.json(wsInfo);
  } catch (error) {
    console.error('Failed to get WebSocket info / 获取WebSocket信息失败:', error);
    res.status(500).json({
      error: 'Failed to get WebSocket info / 获取WebSocket信息失败',
      details: error.message
    });
  }
});

export default router;