/**
 * TitanChain多方安全计算（MPC）系统
 * 
 * 提供Shamir秘密共享、混淆电路、门限签名等MPC协议的统一接口
 * 支持多方协作计算，保护参与方的隐私数据
 */

export * from './mpc-system';
export * from './shamir-secret-sharing';
export * from './garbled-circuits';
export * from './threshold-signature';
export * from './mpc-coordinator';

// 基础类型定义
export interface MPCParticipant {
  participant_id: string;
  public_key: string;
  endpoint: string;
  status: 'ACTIVE' | 'INACTIVE' | 'OFFLINE';
  capabilities: string[];
  last_seen: Date;
}

export interface MPCSession {
  session_id: string;
  protocol_type: 'SECRET_SHARING' | 'GARBLED_CIRCUIT' | 'THRESHOLD_SIGNATURE';
  participants: MPCParticipant[];
  status: 'INITIALIZING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
  created_at: Date;
  completed_at?: Date;
  result?: any;
}

export interface SecretShare {
  share_id: string;
  participant_id: string;
  share_value: string;
  threshold: number;
  total_shares: number;
  metadata: Record<string, any>;
}

export interface GarbledCircuit {
  circuit_id: string;
  gates: GarbledGate[];
  input_wires: Wire[];
  output_wires: Wire[];
  garbling_key: string;
}

export interface GarbledGate {
  gate_id: string;
  gate_type: 'AND' | 'OR' | 'XOR' | 'NOT';
  input_wires: string[];
  output_wire: string;
  truth_table: string[];
}

export interface Wire {
  wire_id: string;
  label_0: string;
  label_1: string;
  value?: boolean;
}

export interface ThresholdSignature {
  signature_id: string;
  message_hash: string;
  partial_signatures: PartialSignature[];
  combined_signature?: string;
  threshold: number;
  status: 'COLLECTING' | 'COMPLETED' | 'FAILED';
}

export interface PartialSignature {
  participant_id: string;
  signature_share: string;
  verification_key: string;
  timestamp: Date;
}

export interface MPCProtocol {
  protocol_id: string;
  protocol_type: string;
  participants: string[];
  parameters: Record<string, any>;
  status: 'SETUP' | 'EXECUTION' | 'VERIFICATION' | 'COMPLETED';
}

export interface MPCComputation {
  computation_id: string;
  function_name: string;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  participants: string[];
  privacy_level: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'COMPUTING' | 'COMPLETED' | 'FAILED';
}

export interface MPCStatistics {
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  failed_sessions: number;
  total_participants: number;
  active_participants: number;
  average_computation_time: number;
  success_rate: number;
  error_rate: number;
  protocols_used: Record<string, number>;
  last_updated: Date;
}

export interface MPCHealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  active_protocols: number;
  participant_connectivity: number;
  average_response_time: number;
  error_rate: number;
  last_check: Date;
  issues: string[];
}

// 错误类型
export class MPCError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'MPCError';
  }
}

export class ShamirError extends MPCError {
  constructor(message: string) {
    super(message, 'SHAMIR_ERROR');
    this.name = 'ShamirError';
  }
}

export class GarbledCircuitError extends MPCError {
  constructor(message: string) {
    super(message, 'GARBLED_CIRCUIT_ERROR');
    this.name = 'GarbledCircuitError';
  }
}

export class ThresholdSignatureError extends MPCError {
  constructor(message: string) {
    super(message, 'THRESHOLD_SIGNATURE_ERROR');
    this.name = 'ThresholdSignatureError';
  }
}

// 接口定义
export interface IMPCSystem {
  initializeSystem(): Promise<void>;
  shutdownSystem(): Promise<void>;
  createSession(protocolType: string, participants: string[]): Promise<string>;
  joinSession(sessionId: string, participantId: string): Promise<void>;
  executeProtocol(sessionId: string, inputs: Record<string, any>): Promise<any>;
  getSessionStatus(sessionId: string): Promise<MPCSession>;
  healthCheck(): Promise<MPCHealthStatus>;
  getStatistics(): Promise<MPCStatistics>;
}

export interface IShamirSecretSharing {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  shareSecret(secret: string, threshold: number, totalShares: number): Promise<SecretShare[]>;
  reconstructSecret(shares: SecretShare[]): Promise<string>;
  verifyShare(share: SecretShare): Promise<boolean>;
  addShare(existingShares: SecretShare[], newShare: SecretShare): Promise<SecretShare[]>;
  removeShare(shares: SecretShare[], shareId: string): Promise<SecretShare[]>;
}

export interface IGarbledCircuits {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  createCircuit(gates: any[], inputs: any[], outputs: any[]): Promise<GarbledCircuit>;
  garbleCircuit(circuit: any): Promise<GarbledCircuit>;
  evaluateCircuit(circuit: GarbledCircuit, inputs: Record<string, boolean>): Promise<Record<string, boolean>>;
  verifyCircuit(circuit: GarbledCircuit): Promise<boolean>;
}

export interface IThresholdSignature {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  setupThreshold(threshold: number, participants: string[]): Promise<void>;
  generatePartialSignature(participantId: string, message: string): Promise<PartialSignature>;
  combineSignatures(partialSignatures: PartialSignature[]): Promise<string>;
  verifyThresholdSignature(signature: string, message: string): Promise<boolean>;
  verifyPartialSignature(partialSig: PartialSignature, message: string): Promise<boolean>;
}

export interface IMPCCoordinator {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  registerParticipant(participant: MPCParticipant): Promise<void>;
  unregisterParticipant(participantId: string): Promise<void>;
  coordinateProtocol(protocolType: string, participants: string[], parameters: any): Promise<string>;
  broadcastMessage(sessionId: string, message: any): Promise<void>;
  collectResponses(sessionId: string, expectedCount: number): Promise<any[]>;
  getParticipantStatus(participantId: string): Promise<MPCParticipant>;
}