/**
 * TitanChain MPC Coordinator Implementation / TitanChain MPC协调器实现
 * 
 * Responsible for coordinating multi-party secure computation protocol execution, managing participant communication,
 * handling message broadcasting and response collection
 * 负责协调多方安全计算协议的执行，管理参与者通信，处理消息广播和响应收集
 */

import { EventEmitter } from 'events';
import {
  IMPCCoordinator,
  MPCParticipant,
  MPCError
} from './index';

export class MPCCoordinator extends EventEmitter implements IMPCCoordinator {
  private isInitialized: boolean = false;
  private participants: Map<string, MPCParticipant> = new Map();
  private activeProtocols: Map<string, ProtocolSession> = new Map();
  private messageQueues: Map<string, MessageQueue> = new Map();
  private responseCollectors: Map<string, ResponseCollector> = new Map();

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new MPCError('MPC Coordinator is already initialized');
    }

    try {
      console.log('🎯 Initializing MPC Coordinator...');
      
      // 初始化网络组件
      this.setupNetworkComponents();
      
      // 启动消息处理器
      this.startMessageProcessor();
      
      // 启动健康检查
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      console.log('✅ MPC Coordinator initialized');
      
      this.emit('initialized', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { status: 'initialized' }
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize MPC Coordinator:', error);
      throw new MPCError(`Failed to initialize coordinator: ${error.message}`);
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 Shutting down MPC Coordinator...');
      
      // 停止所有活跃协议
      for (const [protocolId, session] of this.activeProtocols) {
        await this.terminateProtocol(protocolId);
      }
      
      // 清理资源
      this.participants.clear();
      this.activeProtocols.clear();
      this.messageQueues.clear();
      this.responseCollectors.clear();
      
      this.isInitialized = false;
      console.log('✅ MPC Coordinator shutdown completed');
      
      this.emit('shutdown', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { status: 'shutdown' }
      });
      
    } catch (error) {
      console.error('❌ Error during MPC Coordinator shutdown:', error);
      throw new MPCError(`Failed to shutdown coordinator: ${error.message}`);
    }
  }

  async registerParticipant(participant: MPCParticipant): Promise<void> {
    if (!this.isInitialized) {
      throw new MPCError('MPC Coordinator is not initialized');
    }

    if (this.participants.has(participant.participant_id)) {
      throw new MPCError(`Participant already registered: ${participant.participant_id}`);
    }

    try {
      // 验证参与者信息
      await this.validateParticipant(participant);
      
      // 注册参与者
      this.participants.set(participant.participant_id, {
        ...participant,
        status: 'ACTIVE',
        last_seen: new Date()
      });
      
      // 创建消息队列
      this.messageQueues.set(participant.participant_id, {
        participant_id: participant.participant_id,
        messages: [],
        last_processed: new Date()
      });
      
      console.log(`👤 Participant registered: ${participant.participant_id}`);
      
      this.emit('participant_registered', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          participant_id: participant.participant_id,
          endpoint: participant.endpoint
        }
      });
      
    } catch (error) {
      console.error(`❌ Failed to register participant ${participant.participant_id}:`, error);
      throw new MPCError(`Failed to register participant: ${error.message}`);
    }
  }

  async unregisterParticipant(participantId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new MPCError('MPC Coordinator is not initialized');
    }

    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new MPCError(`Participant not found: ${participantId}`);
    }

    try {
      // 检查参与者是否在活跃协议中
      const activeProtocolsWithParticipant = Array.from(this.activeProtocols.values())
        .filter(session => session.participants.includes(participantId));

      if (activeProtocolsWithParticipant.length > 0) {
        throw new MPCError(`Cannot unregister participant with active protocols: ${participantId}`);
      }

      // 注销参与者
      this.participants.delete(participantId);
      this.messageQueues.delete(participantId);
      
      console.log(`👤 Participant unregistered: ${participantId}`);
      
      this.emit('participant_unregistered', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: { participant_id: participantId }
      });
      
    } catch (error) {
      console.error(`❌ Failed to unregister participant ${participantId}:`, error);
      throw new MPCError(`Failed to unregister participant: ${error.message}`);
    }
  }

  async coordinateProtocol(protocolType: string, participants: string[], parameters: any): Promise<string> {
    if (!this.isInitialized) {
      throw new MPCError('MPC Coordinator is not initialized');
    }

    try {
      console.log(`🎯 Coordinating ${protocolType} protocol with ${participants.length} participants...`);
      
      // 验证参与者
      await this.validateParticipants(participants);
      
      const protocolId = this.generateProtocolId();
      
      // 创建协议会话
      const session: ProtocolSession = {
        protocol_id: protocolId,
        protocol_type: protocolType,
        participants: participants,
        parameters: parameters,
        status: 'INITIALIZING',
        created_at: new Date(),
        messages_sent: 0,
        messages_received: 0
      };
      
      this.activeProtocols.set(protocolId, session);
      
      // 初始化协议
      await this.initializeProtocol(session);
      
      console.log(`✅ Protocol coordination started: ${protocolId}`);
      
      this.emit('protocol_coordinated', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          protocol_id: protocolId,
          protocol_type: protocolType,
          participants: participants.length
        }
      });
      
      return protocolId;
      
    } catch (error) {
      console.error('❌ Failed to coordinate protocol:', error);
      throw new MPCError(`Failed to coordinate protocol: ${error.message}`);
    }
  }

  async broadcastMessage(sessionId: string, message: any): Promise<void> {
    if (!this.isInitialized) {
      throw new MPCError('MPC Coordinator is not initialized');
    }

    const session = this.activeProtocols.get(sessionId);
    if (!session) {
      throw new MPCError(`Protocol session not found: ${sessionId}`);
    }

    try {
      console.log(`📢 Broadcasting message to ${session.participants.length} participants...`);
      
      const broadcastMessage: BroadcastMessage = {
        message_id: this.generateMessageId(),
        session_id: sessionId,
        sender: 'coordinator',
        message_type: 'BROADCAST',
        payload: message,
        timestamp: new Date()
      };
      
      // 发送消息给所有参与者
      const sendPromises = session.participants.map(participantId => 
        this.sendMessageToParticipant(participantId, broadcastMessage)
      );
      
      await Promise.all(sendPromises);
      
      session.messages_sent += session.participants.length;
      
      console.log(`✅ Message broadcasted to ${session.participants.length} participants`);
      
      this.emit('message_broadcasted', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          session_id: sessionId,
          message_id: broadcastMessage.message_id,
          recipients: session.participants.length
        }
      });
      
    } catch (error) {
      console.error(`❌ Failed to broadcast message for session ${sessionId}:`, error);
      throw new MPCError(`Failed to broadcast message: ${error.message}`);
    }
  }

  async collectResponses(sessionId: string, expectedCount: number): Promise<any[]> {
    if (!this.isInitialized) {
      throw new MPCError('MPC Coordinator is not initialized');
    }

    const session = this.activeProtocols.get(sessionId);
    if (!session) {
      throw new MPCError(`Protocol session not found: ${sessionId}`);
    }

    try {
      console.log(`📥 Collecting ${expectedCount} responses for session: ${sessionId}...`);
      
      const collectorId = this.generateCollectorId();
      
      // 创建响应收集器
      const collector: ResponseCollector = {
        collector_id: collectorId,
        session_id: sessionId,
        expected_count: expectedCount,
        collected_responses: [],
        timeout: Date.now() + 30000, // 30秒超时
        status: 'COLLECTING'
      };
      
      this.responseCollectors.set(collectorId, collector);
      
      // 等待响应收集完成
      const responses = await this.waitForResponses(collector);
      
      session.messages_received += responses.length;
      
      console.log(`✅ Collected ${responses.length} responses`);
      
      this.emit('responses_collected', {
        event_id: this.generateEventId(),
        timestamp: new Date(),
        data: {
          session_id: sessionId,
          responses_count: responses.length,
          expected_count: expectedCount
        }
      });
      
      return responses;
      
    } catch (error) {
      console.error(`❌ Failed to collect responses for session ${sessionId}:`, error);
      throw new MPCError(`Failed to collect responses: ${error.message}`);
    }
  }

  async getParticipantStatus(participantId: string): Promise<MPCParticipant> {
    if (!this.isInitialized) {
      throw new MPCError('MPC Coordinator is not initialized');
    }

    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new MPCError(`Participant not found: ${participantId}`);
    }

    // 更新参与者状态
    const updatedParticipant = await this.updateParticipantStatus(participant);
    
    return { ...updatedParticipant };
  }

  async endProtocol(protocolId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new MPCError('MPC Coordinator is not initialized');
    }

    const session = this.activeProtocols.get(protocolId);
    if (!session) {
      throw new MPCError(`Protocol not found: ${protocolId}`);
    }

    try {
      console.log(`🔄 Ending protocol: ${protocolId}...`);
      
      // 更新协议状态为完成
      session.status = 'COMPLETED';
      
      // 发送协议结束消息
      await this.broadcastMessage(protocolId, {
        type: 'PROTOCOL_END',
        data: { protocol_id: protocolId }
      });
      
      // 从活跃协议中移除
      this.activeProtocols.delete(protocolId);
      
      console.log(`✅ Protocol ended successfully: ${protocolId}`);
      
    } catch (error) {
      console.error(`❌ Failed to end protocol ${protocolId}:`, error);
      throw new MPCError(`Failed to end protocol: ${error.message}`);
    }
  }

  // 私有方法
  private setupNetworkComponents(): void {
    // 初始化网络通信组件
    // 在实际实现中，这里会设置WebSocket、HTTP客户端等
  }

  private startMessageProcessor(): void {
    // 启动消息处理器
    setInterval(() => {
      this.processMessageQueues();
    }, 1000); // 每秒处理一次消息队列
  }

  private startHealthMonitoring(): void {
    // 启动健康监控
    setInterval(() => {
      this.checkParticipantHealth();
    }, 10000); // 每10秒检查一次参与者健康状态
  }

  private async validateParticipant(participant: MPCParticipant): Promise<void> {
    // 验证参与者信息
    if (!participant.participant_id || !participant.public_key || !participant.endpoint) {
      throw new MPCError('Invalid participant information');
    }

    // 验证公钥格式
    if (participant.public_key.length < 64) {
      throw new MPCError('Invalid public key format');
    }

    // 验证端点可达性（简化实现）
    if (!participant.endpoint.startsWith('http://') && !participant.endpoint.startsWith('https://')) {
      throw new MPCError('Invalid endpoint format');
    }
  }

  private async validateParticipants(participantIds: string[]): Promise<void> {
    for (const participantId of participantIds) {
      const participant = this.participants.get(participantId);
      if (!participant) {
        throw new MPCError(`Participant not found: ${participantId}`);
      }
      
      if (participant.status !== 'ACTIVE') {
        throw new MPCError(`Participant not active: ${participantId}`);
      }
    }
  }

  private async initializeProtocol(session: ProtocolSession): Promise<void> {
    try {
      // 发送协议初始化消息
      const initMessage = {
        protocol_id: session.protocol_id,
        protocol_type: session.protocol_type,
        parameters: session.parameters,
        participants: session.participants
      };
      
      await this.broadcastMessage(session.protocol_id, {
        type: 'PROTOCOL_INIT',
        data: initMessage
      });
      
      session.status = 'ACTIVE';
      
    } catch (error) {
      session.status = 'FAILED';
      throw error;
    }
  }

  private async terminateProtocol(protocolId: string): Promise<void> {
    const session = this.activeProtocols.get(protocolId);
    if (session) {
      session.status = 'TERMINATED';
      
      // 发送终止消息
      try {
        await this.broadcastMessage(protocolId, {
          type: 'PROTOCOL_TERMINATE',
          data: { protocol_id: protocolId }
        });
      } catch (error) {
        console.warn(`Failed to send termination message for protocol ${protocolId}:`, error);
      }
      
      this.activeProtocols.delete(protocolId);
      console.log(`🔄 Protocol terminated: ${protocolId}`);
    }
  }

  private async sendMessageToParticipant(participantId: string, message: BroadcastMessage): Promise<void> {
    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new MPCError(`Participant not found: ${participantId}`);
    }

    const queue = this.messageQueues.get(participantId);
    if (!queue) {
      throw new MPCError(`Message queue not found for participant: ${participantId}`);
    }

    // 将消息添加到队列（简化实现）
    queue.messages.push(message);
    
    // 在实际实现中，这里会通过网络发送消息
    console.log(`📤 Message queued for participant: ${participantId}`);
  }

  private async waitForResponses(collector: ResponseCollector): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const checkResponses = () => {
        if (collector.collected_responses.length >= collector.expected_count) {
          collector.status = 'COMPLETED';
          resolve(collector.collected_responses);
        } else if (Date.now() > collector.timeout) {
          collector.status = 'TIMEOUT';
          reject(new MPCError('Response collection timeout'));
        } else {
          setTimeout(checkResponses, 100);
        }
      };
      
      checkResponses();
    });
  }

  private processMessageQueues(): void {
    // 处理消息队列（简化实现）
    for (const [participantId, queue] of this.messageQueues) {
      if (queue.messages.length > 0) {
        // 模拟消息处理
        const processedMessages = queue.messages.splice(0, Math.min(5, queue.messages.length));
        queue.last_processed = new Date();
        
        // 在实际实现中，这里会处理收到的响应消息
        for (const message of processedMessages) {
          this.handleReceivedMessage(participantId, message);
        }
      }
    }
  }

  private handleReceivedMessage(participantId: string, message: BroadcastMessage): void {
    // 处理收到的消息
    if (message.message_type === 'RESPONSE') {
      // 查找对应的响应收集器
      for (const collector of this.responseCollectors.values()) {
        if (collector.session_id === message.session_id && collector.status === 'COLLECTING') {
          collector.collected_responses.push({
            participant_id: participantId,
            response: message.payload,
            timestamp: new Date()
          });
          break;
        }
      }
    }
  }

  private checkParticipantHealth(): void {
    const now = new Date();
    const healthTimeout = 60000; // 1分钟超时
    
    for (const [participantId, participant] of this.participants) {
      const timeSinceLastSeen = now.getTime() - participant.last_seen.getTime();
      
      if (timeSinceLastSeen > healthTimeout && participant.status === 'ACTIVE') {
        participant.status = 'OFFLINE';
        console.log(`⚠️ Participant marked as offline: ${participantId}`);
        
        this.emit('participant_offline', {
          event_id: this.generateEventId(),
          timestamp: new Date(),
          data: { participant_id: participantId }
        });
      }
    }
  }

  private async updateParticipantStatus(participant: MPCParticipant): Promise<MPCParticipant> {
    // 更新参与者状态（简化实现）
    const now = new Date();
    const timeSinceLastSeen = now.getTime() - participant.last_seen.getTime();
    
    if (timeSinceLastSeen > 60000) { // 1分钟
      participant.status = 'OFFLINE';
    } else if (timeSinceLastSeen > 30000) { // 30秒
      participant.status = 'INACTIVE';
    } else {
      participant.status = 'ACTIVE';
    }
    
    return participant;
  }

  private generateProtocolId(): string {
    return 'mpc_protocol_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  private generateMessageId(): string {
    return 'mpc_msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  private generateCollectorId(): string {
    return 'mpc_collector_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  private generateEventId(): string {
    return 'mpc_coord_event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }
}

// 辅助接口
interface ProtocolSession {
  protocol_id: string;
  protocol_type: string;
  participants: string[];
  parameters: any;
  status: 'INITIALIZING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'TERMINATED';
  created_at: Date;
  messages_sent: number;
  messages_received: number;
}

interface MessageQueue {
  participant_id: string;
  messages: BroadcastMessage[];
  last_processed: Date;
}

interface BroadcastMessage {
  message_id: string;
  session_id: string;
  sender: string;
  message_type: 'BROADCAST' | 'RESPONSE' | 'CONTROL';
  payload: any;
  timestamp: Date;
}

interface ResponseCollector {
  collector_id: string;
  session_id: string;
  expected_count: number;
  collected_responses: any[];
  timeout: number;
  status: 'COLLECTING' | 'COMPLETED' | 'TIMEOUT';
}