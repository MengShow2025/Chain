/**
 * 安全决策引擎模块入口
 */

export * from './security-decision-engine.js';
export * from './threat-detector.js';
export * from './risk-assessor.js';
export * from './security-orchestrator.js';

// 安全决策引擎接口
export interface ISecurityDecisionEngine {
  evaluateSecurityLevel(context: any): Promise<any>;
  makeSecurityDecision(request: any): Promise<any>;
  updateThreatModel(threats: any[]): Promise<void>;
  getSecurityRecommendations(context: any): Promise<any[]>;
}

// 威胁检测器接口
export interface IThreatDetector {
  detectThreats(data: any): Promise<any[]>;
  analyzeBehavior(events: any[]): Promise<any>;
  updateThreatSignatures(signatures: any[]): Promise<void>;
  getDetectionStatistics(): any;
}

// 风险评估器接口
export interface IRiskAssessor {
  assessRisk(context: any): Promise<any>;
  calculateRiskScore(factors: any[]): Promise<number>;
  updateRiskModel(model: any): Promise<void>;
  getRiskReport(): any;
}

// 安全编排器接口
export interface ISecurityOrchestrator {
  orchestrateSecurityMeasures(decision: any): Promise<void>;
  executeSecurityPolicy(policy: any): Promise<void>;
  coordinateSecurityLayers(layers: any[]): Promise<void>;
  getOrchestrationStatus(): any;
}