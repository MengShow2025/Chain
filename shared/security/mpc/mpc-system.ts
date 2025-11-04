/**
 * TitanChain MPC System Core Implementation / TitanChain MPC系统核心实现
 * 
 * Unified management of multi-party secure computation protocols, including Shamir secret sharing, garbled circuits, threshold signatures, etc.
 * 统一管理多方安全计算协议，包括Shamir秘密共享、混淆电路、门限签名等
 */

import { EventEmitter } from 'events';
import {
  IMPCSystem,
  MPCSession,
  MPCParticipant,
  MPCStatistics,
  MPCHealthStatus,
  MPCError,
  MPCProtocol,
  MPCComputation
} from './index';
import { ShamirSecretSharing } from './shamir-secret-sharing';
import { GarbledCircuits } from './garbled-circuits';
import { ThresholdSignature } from './threshold-signature';
import { MPCCoordinator } from './mpc-coordinator';

export class MPCSystem extends EventEmitter implements IMPCSystem {
  private isInitialized: boolean = false;
  private sessions: Map<string, MPCSession> = new Map();
  private participants: Map<string, MPCParticipant> = new Map();
  private protocols: Map<string, MPCProtocol> = new Map();
  private computations: Map<string, MPCComputation> = new Map();
  
  // Protocol implementations / 协议实现
  private shamirSecretSharing: ShamirSecretSharing;
  private garbledCircuits: GarbledCircuits;
  private thresholdSignature: ThresholdSignature;
  private coordinator: MPCCoordinator;
  
  // Statistics information / 统计信息
  private statistics: MPCStatistics = {
    total_sessions: 0,
    active_sessions: 0,
    completed_sessions: 0,
    failed_sessions: 0,
    total_participants: 0,
    active_participants: 0,
    average_computation_time: 0,
    success_rate: 0,
    error_rate: 0,
    protocols_used: {},
    last_updated: new Date()
  };

  constructor() {
    super();
    this.shamirSecretSharing = new ShamirSecretSharing();
    this.garbledCircuits = new GarbledCircuits();
    this.thresholdSignature = new ThresholdSignature();
    this.coordinator = new MPCCoordinator();
  }

  async initializeSystem(): Promise<void> {
    if (this.isInitialized) {
      throw new MPCError('MPC System is already initialized');
    }

    try {
      console.log('🚀 Initializing TitanChain MPC System...');
      
      // 初始化各个协议组件
      await this.shamirSecretSharing.initialize();
      console.log('✅ Shamir Secret Sharing initialized');
      
      await this.garbledCircuits.initialize();
      console.log('✅ Garbled Circuits initialized');
      
      await this.thresholdSignature.initialize();
      console.log('✅ Threshold Signature initialized');
      
      await this.coordinator.initialize();
      console.log('✅ MPC Coordinator initialized');
      
      // 设置事件监听
      this.setupEventListeners();
      
      // 启动系统监控
      this.startSystemMonitoring();
      
      this.isInitialized = true;
      console.log('🎉 MPC System initialization completed');
      
      this.emit('system_initialized', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { status: 'initialized' }
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize MPC System:', error);
      throw new MPCError(`Failed to initialize MPC System: ${error.message}`);
    }
  }

  async shutdownSystem(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 Shutting down MPC System...');
      
      // 关闭所有活跃会话
      const activeSessions = Array.from(this.sessions.values())
        .filter(session => session.status === 'ACTIVE' || session.status === 'INITIALIZING');
      
      for (const session of activeSessions) {
        await this.terminateSession(session.session_id);
      }
      
      // 关闭协议组件
      await this.coordinator.shutdown();
      console.log('✅ MPC Coordinator shutdown completed');
      
      await this.thresholdSignature.shutdown();
      console.log('✅ Threshold Signature shutdown completed');
      
      await this.garbledCircuits.shutdown();
      console.log('✅ Garbled Circuits shutdown completed');
      
      await this.shamirSecretSharing.shutdown();
      console.log('✅ Shamir Secret Sharing shutdown completed');
      
      // 清理资源
      this.sessions.clear();
      this.participants.clear();
      this.protocols.clear();
      this.computations.clear();
      
      this.isInitialized = false;
      console.log('✅ MPC System shutdown completed');
      
      this.emit('system_shutdown', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { status: 'shutdown' }
      });
      
    } catch (error) {
      console.error('❌ Error during MPC System shutdown:', error);
      throw new MPCError(`Failed to shutdown MPC System: ${error.message}`);
    }
  }

  async createSession(protocolType: string, participants: string[]): Promise<string> {
    if (!this.isInitialized) {
      throw new MPCError('MPC System is not initialized');
    }

    const sessionId = this.generateSessionId();
    
    try {
      // 验证参与者
      const validParticipants: MPCParticipant[] = [];
      for (const participantId of participants) {
        const participant = this.participants.get(participantId);
        if (!participant) {
          throw new MPCError(`Participant not found: ${participantId}`);
        }
        if (participant.status !== 'ACTIVE') {
          throw new MPCError(`Participant not active: ${participantId}`);
        }
        validParticipants.push(participant);
      }

      // 创建会话
      const session: MPCSession = {
        session_id: sessionId,
        protocol_type: protocolType as any,
        participants: validParticipants,
        status: 'INITIALIZING',
        created_at: new Date()
      };

      this.sessions.set(sessionId, session);
      this.statistics.total_sessions++;
      this.statistics.active_sessions++;
      
      // 更新协议使用统计
      if (!this.statistics.protocols_used[protocolType]) {
        this.statistics.protocols_used[protocolType] = 0;
      }
      this.statistics.protocols_used[protocolType]++;
      
      console.log(`🔄 Created MPC session: ${sessionId} (${protocolType})`);
      
      this.emit('session_created', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { session_id: sessionId, protocol_type: protocolType, participants }
      });
      
      return sessionId;
      
    } catch (error) {
      console.error(`❌ Failed to create session: ${error.message}`);
      throw new MPCError(`Failed to create session: ${error.message}`);
    }
  }

  async joinSession(sessionId: string, participantId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new MPCError(`Session not found: ${sessionId}`);
    }

    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new MPCError(`Participant not found: ${participantId}`);
    }

    // 检查参与者是否已在会话中
    const isAlreadyInSession = session.participants.some(p => p.participant_id === participantId);
    if (isAlreadyInSession) {
      throw new MPCError(`Participant already in session: ${participantId}`);
    }

    session.participants.push(participant);
    console.log(`👥 Participant ${participantId} joined session ${sessionId}`);
    
    this.emit('participant_joined', {
      event_id: this.generateEventId(),
      timestamp: new Date(),
      data: { session_id: sessionId, participant_id: participantId }
    });
  }

  async executeProtocol(sessionId: string, inputs: Record<string, any>): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new MPCError(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'INITIALIZING' && session.status !== 'ACTIVE') {
      throw new MPCError(`Session not ready for execution: ${session.status}`);
    }

    const startTime = Date.now();
    
    try {
      session.status = 'ACTIVE';
      let result: any;

      switch (session.protocol_type) {
        case 'SECRET_SHARING':
          result = await this.executeShamirProtocol(sessionId, inputs);
          break;
        case 'GARBLED_CIRCUIT':
          result = await this.executeGarbledCircuitProtocol(sessionId, inputs);
          break;
        case 'THRESHOLD_SIGNATURE':
          result = await this.executeThresholdSignatureProtocol(sessionId, inputs);
          break;
        default:
          throw new MPCError(`Unsupported protocol type: ${session.protocol_type}`);
      }

      session.status = 'COMPLETED';
      session.completed_at = new Date();
      session.result = result;
      
      // 更新统计信息
      const executionTime = Date.now() - startTime;
      this.updateAverageComputationTime(executionTime);
      this.statistics.active_sessions--;
      this.statistics.completed_sessions++;
      this.updateSuccessRate();
      
      console.log(`✅ Protocol execution completed: ${sessionId} (${executionTime}ms)`);
      
      this.emit('protocol_completed', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { session_id: sessionId, execution_time: executionTime, result }
      });
      
      return result;
      
    } catch (error) {
      session.status = 'FAILED';
      this.statistics.active_sessions--;
      this.statistics.failed_sessions++;
      this.updateSuccessRate();
      
      console.error(`❌ Protocol execution failed: ${sessionId}`, error);
      
      this.emit('protocol_failed', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { session_id: sessionId, error: error.message }
      });
      
      throw new MPCError(`Protocol execution failed: ${error.message}`);
    }
  }

  async getSessionStatus(sessionId: string): Promise<MPCSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new MPCError(`Session not found: ${sessionId}`);
    }
    return { ...session };
  }

  async healthCheck(): Promise<MPCHealthStatus> {
    const activeProtocols = Array.from(this.sessions.values())
      .filter(session => session.status === 'ACTIVE').length;
    
    const activeParticipants = Array.from(this.participants.values())
      .filter(participant => participant.status === 'ACTIVE').length;
    
    const participantConnectivity = this.participants.size > 0 
      ? (activeParticipants / this.participants.size) * 100 
      : 100;
    
    const issues: string[] = [];
    
    // 检查系统健康状态
    if (participantConnectivity < 80) {
      issues.push('Low participant connectivity');
    }
    
    if (this.statistics.error_rate > 0.1) {
      issues.push('High error rate detected');
    }
    
    if (activeProtocols > 100) {
      issues.push('High protocol load');
    }
    
    const status = issues.length === 0 ? 'HEALTHY' : 
                  issues.length <= 2 ? 'DEGRADED' : 'UNHEALTHY';
    
    return {
      status,
      active_protocols: activeProtocols,
      participant_connectivity: participantConnectivity,
      average_response_time: this.statistics.average_computation_time,
      error_rate: this.statistics.error_rate || 0,
      last_check: new Date(),
      issues
    };
  }

  async getStatistics(): Promise<MPCStatistics> {
    this.statistics.last_updated = new Date();
    this.statistics.active_participants = Array.from(this.participants.values())
      .filter(p => p.status === 'ACTIVE').length;
    
    return { ...this.statistics };
  }

  // 注册参与者
  async registerParticipant(participant: MPCParticipant): Promise<void> {
    if (this.participants.has(participant.participant_id)) {
      throw new MPCError(`Participant already registered: ${participant.participant_id}`);
    }

    this.participants.set(participant.participant_id, participant);
    this.statistics.total_participants++;
    
    console.log(`👤 Participant registered: ${participant.participant_id}`);
    
    this.emit('participant_registered', {
      event_id: this.generateEventId(),
      timestamp: new Date(),
      data: { participant_id: participant.participant_id }
    });
  }

  // 注销参与者
  async unregisterParticipant(participantId: string): Promise<void> {
    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new MPCError(`Participant not found: ${participantId}`);
    }

    // 检查参与者是否在活跃会话中
    const activeSessionsWithParticipant = Array.from(this.sessions.values())
      .filter(session => 
        (session.status === 'ACTIVE' || session.status === 'INITIALIZING') &&
        session.participants.some(p => p.participant_id === participantId)
      );

    if (activeSessionsWithParticipant.length > 0) {
      throw new MPCError(`Cannot unregister participant with active sessions: ${participantId}`);
    }

    this.participants.delete(participantId);
    console.log(`👤 Participant unregistered: ${participantId}`);
    
    this.emit('participant_unregistered', {
      event_id: this.generateEventId(),
      timestamp: new Date(),
      data: { participant_id: participantId }
    });
  }

  // 私有方法
  private async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && (session.status === 'ACTIVE' || session.status === 'INITIALIZING')) {
      session.status = 'FAILED';
      this.statistics.active_sessions--;
      this.statistics.failed_sessions++;
      console.log(`🔄 Session terminated: ${sessionId}`);
    }
  }

  private async executeShamirProtocol(sessionId: string, inputs: Record<string, any>): Promise<any> {
    const { secret, threshold, totalShares } = inputs;
    
    if (inputs.operation === 'share') {
      return await this.shamirSecretSharing.shareSecret(secret, threshold, totalShares);
    } else if (inputs.operation === 'reconstruct') {
      return await this.shamirSecretSharing.reconstructSecret(inputs.shares);
    } else {
      throw new MPCError(`Unknown Shamir operation: ${inputs.operation}`);
    }
  }

  private async executeGarbledCircuitProtocol(sessionId: string, inputs: Record<string, any>): Promise<any> {
    const { circuit, circuitInputs } = inputs;
    
    if (inputs.operation === 'create') {
      return await this.garbledCircuits.createCircuit(inputs.gates, inputs.inputs, inputs.outputs);
    } else if (inputs.operation === 'evaluate') {
      return await this.garbledCircuits.evaluateCircuit(circuit, circuitInputs);
    } else {
      throw new MPCError(`Unknown Garbled Circuit operation: ${inputs.operation}`);
    }
  }

  private async executeThresholdSignatureProtocol(sessionId: string, inputs: Record<string, any>): Promise<any> {
    const { message, threshold, participants } = inputs;
    
    if (inputs.operation === 'setup') {
      return await this.thresholdSignature.setupThreshold(threshold, participants);
    } else if (inputs.operation === 'sign') {
      const partialSignatures = [];
      for (const participantId of participants) {
        const partialSig = await this.thresholdSignature.generatePartialSignature(participantId, message);
        partialSignatures.push(partialSig);
      }
      return await this.thresholdSignature.combineSignatures(partialSignatures);
    } else {
      throw new MPCError(`Unknown Threshold Signature operation: ${inputs.operation}`);
    }
  }

  private setupEventListeners(): void {
    // 监听协议组件事件
    this.shamirSecretSharing.on('secret_shared', (data) => {
      this.emit('secret_shared', data);
    });
    
    this.garbledCircuits.on('circuit_evaluated', (data) => {
      this.emit('circuit_evaluated', data);
    });
    
    this.thresholdSignature.on('signature_generated', (data) => {
      this.emit('signature_generated', data);
    });
  }

  private startSystemMonitoring(): void {
    // 定期更新参与者状态
    setInterval(async () => {
      try {
        await this.updateParticipantStatus();
      } catch (error) {
        console.error('Error updating participant status:', error);
      }
    }, 30000); // 每30秒检查一次
    
    // 定期清理过期会话
    setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        console.error('Error cleaning up sessions:', error);
      }
    }, 300000); // 每5分钟清理一次
  }

  private async updateParticipantStatus(): Promise<void> {
    const now = new Date();
    const timeoutThreshold = 5 * 60 * 1000; // 5分钟超时
    
    for (const [participantId, participant] of this.participants) {
      const timeSinceLastSeen = now.getTime() - participant.last_seen.getTime();
      if (timeSinceLastSeen > timeoutThreshold && participant.status === 'ACTIVE') {
        participant.status = 'OFFLINE';
        console.log(`⚠️ Participant marked as offline: ${participantId}`);
      }
    }
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expirationThreshold = 24 * 60 * 60 * 1000; // 24小时
    
    for (const [sessionId, session] of this.sessions) {
      const sessionAge = now.getTime() - session.created_at.getTime();
      if (sessionAge > expirationThreshold && 
          (session.status === 'COMPLETED' || session.status === 'FAILED')) {
        this.sessions.delete(sessionId);
        console.log(`🗑️ Expired session cleaned up: ${sessionId}`);
      }
    }
  }

  private updateAverageComputationTime(newTime: number): void {
    const totalCompleted = this.statistics.completed_sessions;
    if (totalCompleted === 1) {
      this.statistics.average_computation_time = newTime;
    } else {
      this.statistics.average_computation_time = 
        (this.statistics.average_computation_time * (totalCompleted - 1) + newTime) / totalCompleted;
    }
  }

  private updateSuccessRate(): void {
    const total = this.statistics.completed_sessions + this.statistics.failed_sessions;
    if (total > 0) {
      this.statistics.success_rate = this.statistics.completed_sessions / total;
    }
  }

  private generateEventId(): string {
    return 'mpc_event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  private generateSessionId(): string {
    return 'mpc_session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }
}