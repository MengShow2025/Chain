// Security Console Service for centralized security management and monitoring / 集中安全管理和监控的安全控制台服务
import { EventEmitter } from 'events';
import { ZKProofSystem } from '../../shared/security/zk-proof/zk-proof-system';
import { TEESystem } from '../../shared/security/tee/tee-system';
import { MPCSystem } from '../../shared/security/mpc/mpc-system';
import { QuantumResistantSystem } from '../../shared/security/quantum/quantum-resistant-system';
import { SecurityDecisionEngine } from '../../shared/security/decision-engine/security-decision-engine';
import { ZKConfig, SecurityConfig } from '../../shared/security/types/index';

// System overview interface / 系统概览接口
export interface SystemOverview {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
  uptime: number;
  totalLayers: number;
  activeLayers: number;
  securityScore: number;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  activeThreats: number;
  recentDecisions: number;
  performanceScore: number;
  lastUpdated: Date;
}

// Security layer status interface / 安全层状态接口
export interface SecurityLayerStatus {
  layerId: string;
  name: string;
  level: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'MAINTENANCE';
  health: number;
  performance: {
    throughput: number;
    latency: number;
    errorRate: number;
  };
  statistics: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageResponseTime: number;
  };
  lastUpdated: Date;
}

// Performance metrics interface / 性能指标接口
export interface PerformanceMetrics {
  system: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  security: {
    zkProofGeneration: {
      averageTime: number;
      throughput: number;
      successRate: number;
    };
    teeOperations: {
      averageTime: number;
      throughput: number;
      successRate: number;
    };
    mpcComputations: {
      averageTime: number;
      throughput: number;
      successRate: number;
    };
    quantumOperations: {
      averageTime: number;
      throughput: number;
      successRate: number;
    };
  };
  blockchain: {
    tps: number;
    blockTime: number;
    pendingTransactions: number;
    networkLatency: number;
  };
  timestamp: Date;
}

// System health interface / 系统健康接口
export interface SystemHealth {
  overall: {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    score: number;
    issues: string[];
  };
  layers: {
    [layerId: string]: {
      status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
      score: number;
      issues: string[];
      recommendations: string[];
    };
  };
  resources: {
    cpu: { usage: number; status: string };
    memory: { usage: number; status: string };
    disk: { usage: number; status: string };
    network: { usage: number; status: string };
  };
  lastCheck: Date;
}

// Main Security Console Service class / 主要安全控制台服务类
export class SecurityConsoleService extends EventEmitter {
  private zkSystem: ZKProofSystem | null;
  private teeSystem: TEESystem | null;
  private mpcSystem: MPCSystem | null;
  private quantumSystem: QuantumResistantSystem | null;
  private decisionEngine: SecurityDecisionEngine | null;
  
  private isInitialized: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    super();
    this.zkSystem = null;
    this.teeSystem = null;
    this.mpcSystem = null;
    this.quantumSystem = null;
    this.decisionEngine = null;
    
    console.log('Security Console Service initialized / 安全控制台服务已初始化');
  }

  // Initialize the console service / 初始化控制台服务
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.initializeServices();
      this.startMonitoring();
      this.isInitialized = true;
      console.log('✅ Security Console Service initialized successfully / 安全控制台服务初始化成功');
      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Security Console Service / 安全控制台服务初始化失败:', error);
      throw error;
    }
  }

  // Initialize security services / 初始化安全服务
  private async initializeServices(): Promise<void> {
    try {
      // Initialize ZK Proof System / 初始化零知识证明系统
      await this.initializeZKSystem();
      
      // Initialize TEE System / 初始化可信执行环境系统
      await this.initializeTEESystem();
      
      // Initialize MPC System / 初始化多方安全计算系统
      await this.initializeMPCSystem();
      
      // Initialize Quantum Resistant System / 初始化量子抗性系统
      await this.initializeQuantumSystem();
      
      // Initialize Decision Engine / 初始化决策引擎
      await this.initializeDecisionEngine();
      
      console.log('All security services initialized / 所有安全服务已初始化');
    } catch (error) {
      console.error('Failed to initialize security services / 安全服务初始化失败:', error);
      throw error;
    }
  }

  // Initialize ZK Proof System / 初始化零知识证明系统
  private async initializeZKSystem(): Promise<void> {
    try {
      const zkConfig: ZKConfig = {
        enabled_protocols: ['SNARK', 'STARK', 'PLONK'],
        default_curve: 'bn254',
        max_proof_size: 1024 * 1024,
        verification_timeout_ms: 5000,
        trusted_setup_required: false,
        zk: {
          snark: {
            enabled: true,
            curve: 'bn254',
            proving_key_size: 1024,
            verification_key_size: 512,
            max_constraints: 1000000,
            trusted_setup_required: false
          },
          stark: {
            enabled: true,
            field_size: 256,
            fri_queries: 80,
            max_trace_length: 1048576,
            grinding_factor: 16
          },
          plonk: {
            enabled: true,
            curve: 'bn254',
            srs_size: 1048576,
            max_constraints: 1000000,
            universal_setup: true
          }
        }
      };

      this.zkSystem = new ZKProofSystem(zkConfig);
      await this.zkSystem.initializeSystem();
      console.log('ZK Proof System initialized / 零知识证明系统已初始化');
    } catch (error) {
      console.warn('ZK Proof System initialization failed, continuing without it / 零知识证明系统初始化失败，继续运行:', error);
      this.zkSystem = null;
    }
  }

  // Initialize TEE System / 初始化可信执行环境系统
  private async initializeTEESystem(): Promise<void> {
    try {
      this.teeSystem = new TEESystem();
      await this.teeSystem.initializeSystem();
      console.log('TEE System initialized / 可信执行环境系统已初始化');
    } catch (error) {
      console.warn('TEE System initialization failed, continuing without it / 可信执行环境系统初始化失败，继续运行:', error);
      this.teeSystem = null;
    }
  }

  // Initialize MPC System / 初始化多方安全计算系统
  private async initializeMPCSystem(): Promise<void> {
    try {
      this.mpcSystem = new MPCSystem();
      await this.mpcSystem.initializeSystem();
      console.log('MPC System initialized / 多方安全计算系统已初始化');
    } catch (error) {
      console.warn('MPC System initialization failed, continuing without it / 多方安全计算系统初始化失败，继续运行:', error);
      this.mpcSystem = null;
    }
  }

  // Initialize Quantum Resistant System / 初始化量子抗性系统
  private async initializeQuantumSystem(): Promise<void> {
    try {
      this.quantumSystem = new QuantumResistantSystem();
      await this.quantumSystem.initialize();
      console.log('Quantum Resistant System initialized / 量子抗性系统已初始化');
    } catch (error) {
      console.warn('Quantum Resistant System initialization failed, continuing without it / 量子抗性系统初始化失败，继续运行:', error);
      this.quantumSystem = null;
    }
  }

  // Initialize Decision Engine / 初始化决策引擎
  private async initializeDecisionEngine(): Promise<void> {
    try {
      const securityConfig: SecurityConfig = {
        zk_config: {
          enabled_protocols: ['SNARK', 'STARK', 'PLONK'],
          default_curve: 'bn254',
          max_proof_size: 1024 * 1024,
          verification_timeout_ms: 5000,
          trusted_setup_required: false
        },
        tee_config: {
          enabled_platforms: ['SGX', 'SEV', 'TRUSTZONE'],
          min_security_version: 2,
          attestation_timeout_ms: 10000,
          require_remote_attestation: true,
          trusted_measurements: []
        },
        mpc_config: {
          enabled_protocols: ['SHAMIR', 'BGW', 'ABY3'],
          default_threshold: 67,
          max_parties: 108,
          session_timeout_ms: 30000,
          require_zk_proofs: true
        },
        quantum_config: {
          enabled_algorithms: ['KYBER', 'DILITHIUM', 'SPHINCS'],
          default_security_level: 3,
          key_rotation_interval_ms: 24 * 60 * 60 * 1000,
          require_quantum_safe: true
        },
        decision_config: {
          min_confidence_threshold: 0.95,
          require_unanimous_consensus: false,
          max_decision_time_ms: 2000,
          enable_human_override: true,
          risk_tolerance_level: 'CONSERVATIVE'
        }
      };

      // SecurityDecisionEngine initializes itself in constructor / SecurityDecisionEngine在构造函数中自初始化
      this.decisionEngine = new SecurityDecisionEngine(securityConfig);
      console.log('Security Decision Engine initialized / 安全决策引擎已初始化');
    } catch (error) {
      console.warn('Security Decision Engine initialization failed, continuing without it / 安全决策引擎初始化失败，继续运行:', error);
      this.decisionEngine = null;
    }
  }

  // Start monitoring / 开始监控
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectPerformanceMetrics();
        this.addMetricsToHistory(metrics);
        this.emit('metrics_updated', metrics);
      } catch (error) {
        console.error('Error collecting metrics / 收集指标时出错:', error);
      }
    }, 30000); // Every 30 seconds / 每30秒

    console.log('Performance monitoring started / 性能监控已启动');
  }

  // Add metrics to history / 将指标添加到历史记录
  private addMetricsToHistory(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  // Get system overview / 获取系统概览
  async getSystemOverview(): Promise<SystemOverview> {
    if (!this.isInitialized) {
      // Return simulated data / 返回模拟数据
      return {
        status: 'WARNING',
        uptime: process.uptime(),
        totalLayers: 5,
        activeLayers: 2,
        securityScore: 70,
        threatLevel: 'MEDIUM',
        activeThreats: 1,
        recentDecisions: 3,
        performanceScore: 75,
        lastUpdated: new Date()
      };
    }

    try {
      const systemHealth = await this.getSystemHealth();
      const layersStatus = await this.getSecurityLayersStatus();
      const performanceMetrics = await this.getPerformanceMetrics();
      
      // Calculate active layers / 计算活跃层数
      const activeLayers = layersStatus.filter(layer => layer.status === 'ACTIVE').length;
      
      // Calculate overall security score / 计算综合安全评分
      const securityScore = this.calculateOverallSecurityScore(layersStatus);
      
      // Assess threat level / 评估威胁级别
      const threatLevel = this.assessThreatLevel(systemHealth);
      
      // Calculate performance score / 计算性能评分
      const performanceScore = this.calculatePerformanceScore(performanceMetrics);

      return {
        status: systemHealth.overall.status,
        uptime: process.uptime(),
        totalLayers: layersStatus.length,
        activeLayers,
        securityScore,
        threatLevel,
        activeThreats: 0, // Will be implemented in threat detection service / 将在威胁检测服务中实现
        recentDecisions: 0, // Will be implemented in decision service / 将在决策服务中实现
        performanceScore,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Failed to get system overview / 获取系统总览失败:', error);
      throw error;
    }
  }

  // Get security layers status / 获取安全层状态
  async getSecurityLayersStatus(): Promise<SecurityLayerStatus[]> {
    if (!this.isInitialized) {
      // Return simulated data / 返回模拟数据
      return [
        {
          layerId: 'zk-proof',
          name: 'Zero Knowledge Proof Layer / 零知识证明层',
          level: 1,
          status: 'ERROR',
          health: 60,
          performance: { throughput: 0, latency: 0, errorRate: 0.4 },
          statistics: { totalOperations: 0, successfulOperations: 0, failedOperations: 0, averageResponseTime: 0 },
          lastUpdated: new Date()
        },
        {
          layerId: 'tee',
          name: 'Trusted Execution Environment Layer / 可信执行环境层',
          level: 2,
          status: 'ACTIVE',
          health: 85,
          performance: { throughput: 100, latency: 50, errorRate: 0.05 },
          statistics: { totalOperations: 1000, successfulOperations: 950, failedOperations: 50, averageResponseTime: 45 },
          lastUpdated: new Date()
        }
      ];
    }

    try {
      const layers: SecurityLayerStatus[] = [];

      // ZK Proof Layer / ZK证明层
      if (this.zkSystem) {
        try {
          const zkStats = this.zkSystem.getStatistics();
          const zkHealth = await this.zkSystem.healthCheck();
          
          // Calculate health score based on status / 根据状态计算健康分数
          const healthScore = zkHealth.status === 'healthy' ? 95 : 
                             zkHealth.status === 'degraded' ? 70 : 30;
          
          layers.push({
            layerId: 'zk-proof',
            name: 'Zero Knowledge Proof Layer / 零知识证明层',
            level: 1,
            status: zkHealth.status === 'healthy' ? 'ACTIVE' : 'ERROR',
            health: healthScore,
            performance: {
              throughput: zkStats.total_proofs_generated / (Date.now() / 1000 / 3600), // per hour / 每小时
              latency: zkStats.average_generation_time,
              errorRate: (zkStats.total_proofs_generated > 0) ? 
                        ((zkStats.total_proofs_generated - zkStats.successful_verifications) / zkStats.total_proofs_generated) : 0
            },
            statistics: {
              totalOperations: zkStats.total_proofs_generated,
              successfulOperations: zkStats.successful_verifications,
              failedOperations: zkStats.total_proofs_generated - zkStats.successful_verifications,
              averageResponseTime: zkStats.average_generation_time
            },
            lastUpdated: new Date()
          });
        } catch (error) {
          console.warn('ZK system status retrieval failed, using simulation data / ZK系统状态获取失败，使用模拟数据:', error);
          layers.push({
            layerId: 'zk-proof',
            name: 'Zero Knowledge Proof Layer / 零知识证明层',
            level: 1,
            status: 'ERROR',
            health: 0,
            performance: { throughput: 0, latency: 0, errorRate: 100 },
            statistics: { totalOperations: 0, successfulOperations: 0, failedOperations: 0, averageResponseTime: 0 },
            lastUpdated: new Date()
          });
        }
      }

      // TEE Layer / TEE层
      if (this.teeSystem) {
        try {
          const teeStats = await this.teeSystem.getStatistics();
          const teeHealth = await this.teeSystem.healthCheck();
          
          // Calculate health score based on overall_score / 根据overall_score计算健康分数
          const healthScore = teeHealth.overall_score * 100;
          
          layers.push({
            layerId: 'tee',
            name: 'Trusted Execution Environment Layer / 可信执行环境层',
            level: 2,
            status: teeHealth.status === 'HEALTHY' ? 'ACTIVE' : 'ERROR',
            health: healthScore,
            performance: {
              throughput: teeStats.total_environments / (Date.now() / 1000 / 3600),
              latency: teeStats.average_attestation_time,
              errorRate: teeStats.total_attestations_verified > 0 ? 
                        (teeStats.failed_verifications / teeStats.total_attestations_verified) : 0
            },
            statistics: {
              totalOperations: teeStats.total_attestations_verified,
              successfulOperations: teeStats.successful_verifications,
              failedOperations: teeStats.failed_verifications,
              averageResponseTime: teeStats.average_verification_time
            },
            lastUpdated: new Date()
          });
        } catch (error) {
          console.warn('TEE system status retrieval failed, using simulation data / TEE系统状态获取失败，使用模拟数据:', error);
          layers.push({
            layerId: 'tee',
            name: 'Trusted Execution Environment Layer / 可信执行环境层',
            level: 2,
            status: 'ERROR',
            health: 0,
            performance: { throughput: 0, latency: 0, errorRate: 100 },
            statistics: { totalOperations: 0, successfulOperations: 0, failedOperations: 0, averageResponseTime: 0 },
            lastUpdated: new Date()
          });
        }
      }

      return layers;
    } catch (error) {
      console.error('Failed to get security layers status / 获取安全层状态失败:', error);
      throw error;
    }
  }

  // Get performance metrics / 获取性能指标
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return this.collectPerformanceMetrics();
  }

  // Collect performance metrics / 收集性能指标
  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      // System resource metrics / 系统资源指标
      const systemMetrics = {
        cpu: process.cpuUsage().user / 1000000, // Convert to seconds / 转换为秒
        memory: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
        disk: 0, // Need to implement disk usage detection / 需要实现磁盘使用率检测
        network: 0 // Need to implement network usage detection / 需要实现网络使用率检测
      };

      // Security system metrics / 安全系统指标
      const securityMetrics = {
        zkProofGeneration: (() => {
          try {
            const stats = this.zkSystem?.getStatistics();
            return {
              averageTime: stats?.average_generation_time || 0,
              throughput: stats?.total_proofs_generated || 0,
              successRate: this.calculateSuccessRate(
                stats?.successful_verifications || 0,
                stats?.failed_verifications || 0
              )
            };
          } catch (error) {
            return { averageTime: 0, throughput: 0, successRate: 0 };
          }
        })(),
        teeOperations: (() => {
          try {
            const stats = this.teeSystem?.getStatistics();
            return {
              averageTime: stats?.average_attestation_time || 0,
              throughput: stats?.total_attestations_generated || 0,
              successRate: this.calculateSuccessRate(
                stats?.successful_verifications || 0,
                stats?.failed_verifications || 0
              )
            };
          } catch (error) {
            return { averageTime: 0, throughput: 0, successRate: 0 };
          }
        })(),
        mpcComputations: await (async () => {
          try {
            const stats = await this.mpcSystem?.getStatistics();
            return {
              averageTime: stats?.average_computation_time || 0,
              throughput: stats?.completed_sessions || 0,
              successRate: this.calculateSuccessRate(
                stats?.completed_sessions || 0,
                stats?.failed_sessions || 0
              )
            };
          } catch (error) {
            return { averageTime: 0, throughput: 0, successRate: 0 };
          }
        })(),
        quantumOperations: await (async () => {
          try {
            const stats = await this.quantumSystem?.getStatistics();
            return {
              averageTime: stats?.averageKeyGenerationTime || 0,
              throughput: stats?.totalKeyPairsGenerated || 0,
              successRate: this.calculateSuccessRate(
                stats?.successfulOperations || 0,
                stats?.failedOperations || 0
              )
            };
          } catch (error) {
            return { averageTime: 0, throughput: 0, successRate: 0 };
          }
        })()
      };

      // Blockchain metrics (simulated data, need to get from actual blockchain system) / 区块链指标（模拟数据，需要从实际区块链系统获取）
      const blockchainMetrics = {
        tps: 1000, // Simulated TPS / 模拟TPS
        blockTime: 3000, // Simulated block time (milliseconds) / 模拟出块时间（毫秒）
        pendingTransactions: 50, // Simulated pending transactions / 模拟待处理交易数
        networkLatency: 100 // Simulated network latency (milliseconds) / 模拟网络延迟（毫秒）
      };

      return {
        system: systemMetrics,
        security: securityMetrics,
        blockchain: blockchainMetrics,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Failed to collect performance metrics / 收集性能指标失败:', error);
      throw error;
    }
  }

  // Get system health / 获取系统健康状态
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const health: SystemHealth = {
        overall: {
          status: 'HEALTHY',
          score: 0,
          issues: []
        },
        layers: {},
        resources: {
          cpu: { usage: 0, status: 'NORMAL' },
          memory: { usage: 0, status: 'NORMAL' },
          disk: { usage: 0, status: 'NORMAL' },
          network: { usage: 0, status: 'NORMAL' }
        },
        lastCheck: new Date()
      };

      let totalScore = 0;
      let layerCount = 0;

      // Check health status of each security layer / 检查各安全层健康状态
      const layers = await this.getSecurityLayersStatus();
      for (const layer of layers) {
        const layerHealth = {
          status: layer.health > 0.8 ? 'HEALTHY' : layer.health > 0.5 ? 'WARNING' : 'CRITICAL' as any,
          score: layer.health,
          issues: [],
          recommendations: []
        };

        // Add issues and recommendations / 添加问题和建议
        if (layer.health < 0.8) {
          layerHealth.issues.push(`${layer.name} performance below expected / ${layer.name}性能低于预期`);
          layerHealth.recommendations.push(`Check ${layer.name} configuration and resource allocation / 检查${layer.name}配置和资源分配`);
        }

        if (layer.performance.errorRate > 0.05) {
          layerHealth.issues.push(`${layer.name} error rate too high / ${layer.name}错误率过高`);
          layerHealth.recommendations.push(`Analyze ${layer.name} error logs and optimize / 分析${layer.name}错误日志并优化`);
        }

        health.layers[layer.layerId] = layerHealth;
        totalScore += layer.health;
        layerCount++;
      }

      // Calculate overall health score / 计算总体健康分数
      health.overall.score = layerCount > 0 ? totalScore / layerCount : 0;
      
      // Determine overall status / 确定总体状态
      if (health.overall.score > 0.8) {
        health.overall.status = 'HEALTHY';
      } else if (health.overall.score > 0.5) {
        health.overall.status = 'WARNING';
        health.overall.issues.push('Some security layers performance degraded / 部分安全层性能下降');
      } else {
        health.overall.status = 'CRITICAL';
        health.overall.issues.push('Multiple security layers have serious issues / 多个安全层存在严重问题');
      }

      // Check resource usage / 检查资源使用情况
      const metrics = await this.getPerformanceMetrics();
      health.resources.cpu.usage = metrics.system.cpu;
      health.resources.memory.usage = metrics.system.memory;
      health.resources.disk.usage = metrics.system.disk;
      health.resources.network.usage = metrics.system.network;

      // Evaluate resource status / 评估资源状态
      Object.keys(health.resources).forEach(resource => {
        const usage = health.resources[resource].usage;
        if (usage > 90) {
          health.resources[resource].status = 'CRITICAL';
          health.overall.issues.push(`${resource} usage too high / ${resource}使用率过高`);
        } else if (usage > 70) {
          health.resources[resource].status = 'WARNING';
        } else {
          health.resources[resource].status = 'NORMAL';
        }
      });

      return health;
    } catch (error) {
      console.error('Failed to get system health / 获取系统健康状态失败:', error);
      throw error;
    }
  }

  // Get historical performance metrics / 获取历史性能指标
  getMetricsHistory(timeRange: string = '1h'): PerformanceMetrics[] {
    const now = Date.now();
    let timeRangeMs: number;

    switch (timeRange) {
      case '5m':
        timeRangeMs = 5 * 60 * 1000;
        break;
      case '15m':
        timeRangeMs = 15 * 60 * 1000;
        break;
      case '1h':
        timeRangeMs = 60 * 60 * 1000;
        break;
      case '6h':
        timeRangeMs = 6 * 60 * 60 * 1000;
        break;
      case '24h':
        timeRangeMs = 24 * 60 * 60 * 1000;
        break;
      default:
        timeRangeMs = 60 * 60 * 1000;
    }

    return this.metricsHistory.filter(
      metric => now - metric.timestamp.getTime() <= timeRangeMs
    );
  }

  // Helper methods / 辅助方法

  private calculateSuccessRate(successful: number, failed: number): number {
    const total = successful + failed;
    return total > 0 ? (successful / total) * 100 : 100;
  }

  private calculateOverallSecurityScore(layers: SecurityLayerStatus[]): number {
    if (layers.length === 0) return 0;
    const totalScore = layers.reduce((sum, layer) => sum + layer.health, 0);
    return (totalScore / layers.length) * 100;
  }

  private assessThreatLevel(health: SystemHealth): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (health.overall.status === 'CRITICAL') return 'CRITICAL';
    if (health.overall.status === 'WARNING') return 'HIGH';
    if (health.overall.score < 0.9) return 'MEDIUM';
    return 'LOW';
  }

  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    // Comprehensive performance score calculation / 综合计算性能评分
    const systemScore = (100 - metrics.system.cpu) * 0.3 + (100 - metrics.system.memory) * 0.3;
    const securityScore = (
      metrics.security.zkProofGeneration.successRate * 0.25 +
      metrics.security.teeOperations.successRate * 0.25 +
      metrics.security.mpcComputations.successRate * 0.25 +
      metrics.security.quantumOperations.successRate * 0.25
    );
    
    return (systemScore + securityScore) / 2;
  }

  // Cleanup resources / 清理资源
  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Close each security system / 关闭各个安全系统
    try {
      if (this.zkSystem) {
        // ZKProofSystem doesn't have a shutdown method, just clean up / ZKProofSystem没有关闭方法，只需清理
        console.log('ZK System cleanup completed / ZK系统清理完成');
      }
      if (this.teeSystem) {
        await this.teeSystem.shutdownSystem();
      }
      if (this.mpcSystem) {
        await this.mpcSystem.shutdownSystem();
      }
      if (this.quantumSystem) {
        await this.quantumSystem.shutdown();
      }
      if (this.decisionEngine) {
        // SecurityDecisionEngine doesn't have a shutdown method, just clean up / SecurityDecisionEngine没有关闭方法，只需清理
        console.log('Decision Engine cleanup completed / 决策引擎清理完成');
      }
    } catch (error) {
      console.warn('Error occurred while shutting down security systems / 关闭安全系统时出现错误:', error);
    }

    this.isInitialized = false;
    console.log('✅ Security Console Service shutdown / 安全控制台服务已关闭');
  }
}