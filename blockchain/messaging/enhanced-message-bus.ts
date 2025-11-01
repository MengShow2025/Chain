import { EventEmitter } from 'events';
import { casClient } from '../../shared/da/cas-client.js';

/**
 * 消息类型枚举
 */
export enum MessageType {
  ORDER_SUBMITTED = 'order.submitted',
  BATCH_READY = 'batch.ready',
  BATCH_MATCHED = 'batch.matched',
  VALIDATION_REQUEST = 'validation.request',
  VALIDATION_RESULT = 'validation.result',
  CHALLENGE_SUBMITTED = 'challenge.submitted',
  ERROR_OCCURRED = 'error.occurred',
  SYSTEM_HEALTH = 'system.health',
  PERFORMANCE_METRICS = 'performance.metrics'
}

/**
 * 消息优先级枚举
 */
export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

/**
 * 消息总线类型枚举
 */
export enum MessageBusType {
  NATS = 'nats',
  KAFKA = 'kafka',
  RABBITMQ = 'rabbitmq',
  MEMORY = 'memory'
}

/**
 * 消息接口
 */
export interface EnhancedMessage {
  id: string;
  type: MessageType;
  priority: MessagePriority;
  timestamp: number;
  source: string;
  destination?: string;
  payload: any;
  metadata: MessageMetadata;
}

/**
 * 消息元数据接口
 */
export interface MessageMetadata {
  correlationId?: string;
  replyTo?: string;
  ttl?: number;
  retryCount?: number;
  maxRetries?: number;
  persistenceRequired?: boolean;
  daStorageRequired?: boolean;
  daCID?: string;
  originalSize?: number;
  compressed?: boolean;
  routingKey?: string;
  headers?: Record<string, string>;
}

/**
 * 消息处理器接口
 */
export interface MessageHandler {
  (message: EnhancedMessage): Promise<void>;
}

/**
 * 订阅接口
 */
export interface Subscription {
  id: string;
  topic: string;
  handler: MessageHandler;
  config: SubscriptionConfig;
  active: boolean;
}

/**
 * 订阅配置接口
 */
export interface SubscriptionConfig {
  durable?: boolean;
  autoAck?: boolean;
  maxConcurrency?: number;
  retryPolicy?: RetryPolicy;
  filter?: MessageFilter;
}

/**
 * 重试策略接口
 */
export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay: number;
}

/**
 * 消息过滤器接口
 */
export interface MessageFilter {
  messageType?: MessageType;
  priority?: MessagePriority;
  source?: string;
  customFilter?: (message: EnhancedMessage) => boolean;
}

/**
 * 路由配置接口
 */
export interface RouteConfig {
  messageType: MessageType;
  priority: MessagePriority;
  targetBus: MessageBusType;
  topic: string;
  weight: number;
  enabled: boolean;
}

/**
 * 消息总线统计信息接口
 */
export interface MessageBusMetrics {
  totalMessages: number;
  messagesPerSecond: number;
  activeSubscriptions: number;
  queueDepth: number;
  processingLatency: number;
  errorRate: number;
  throughput: number;
  memoryUsage: number;
}

/**
 * 健康状态接口
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastError?: string;
  errorCount: number;
  connections: Record<string, boolean>;
}

/**
 * 消息总线接口
 */
export interface IMessageBus {
  // 基础消息操作
  publish(topic: string, message: EnhancedMessage): Promise<void>;
  subscribe(topic: string, handler: MessageHandler, config?: SubscriptionConfig): Promise<Subscription>;
  unsubscribe(subscription: Subscription): Promise<void>;
  
  // 请求-响应模式
  request(topic: string, message: EnhancedMessage, timeout?: number): Promise<EnhancedMessage>;
  reply(originalMessage: EnhancedMessage, response: EnhancedMessage): Promise<void>;
  
  // 批量操作
  publishBatch(topic: string, messages: EnhancedMessage[]): Promise<void>;
  
  // 监控和统计
  getMetrics(): Promise<MessageBusMetrics>;
  getHealth(): Promise<HealthStatus>;
  
  // 生命周期管理
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * 负载均衡器
 */
class LoadBalancer {
  private roundRobinIndex = 0;

  select<T>(items: T[], strategy: 'round-robin' | 'random' | 'weighted' = 'round-robin'): T {
    if (items.length === 0) {
      throw new Error('No items available for load balancing');
    }

    switch (strategy) {
      case 'round-robin':
        const item = items[this.roundRobinIndex % items.length];
        this.roundRobinIndex++;
        return item;
      
      case 'random':
        return items[Math.floor(Math.random() * items.length)];
      
      default:
        return items[0];
    }
  }
}

/**
 * 消息路由器
 */
class MessageRouter {
  private routes: Map<string, RouteConfig[]> = new Map();
  private loadBalancer = new LoadBalancer();
  private routeMetrics: Map<string, { success: number; failure: number }> = new Map();

  addRoute(route: RouteConfig): void {
    const key = `${route.messageType}:${route.priority}`;
    if (!this.routes.has(key)) {
      this.routes.set(key, []);
    }
    this.routes.get(key)!.push(route);
  }

  selectRoute(message: EnhancedMessage): RouteConfig {
    const key = `${message.type}:${message.priority}`;
    const routes = this.routes.get(key) || [];
    
    // 过滤启用的路由
    const enabledRoutes = routes.filter(r => r.enabled);
    
    if (enabledRoutes.length === 0) {
      return this.getDefaultRoute(message);
    }

    // 基于权重选择路由
    return this.loadBalancer.select(enabledRoutes, 'weighted');
  }

  private getDefaultRoute(message: EnhancedMessage): RouteConfig {
    return {
      messageType: message.type,
      priority: message.priority,
      targetBus: MessageBusType.MEMORY,
      topic: 'default',
      weight: 1,
      enabled: true
    };
  }

  updateRouteMetrics(route: RouteConfig, success: boolean): void {
    const key = `${route.messageType}:${route.priority}:${route.targetBus}`;
    if (!this.routeMetrics.has(key)) {
      this.routeMetrics.set(key, { success: 0, failure: 0 });
    }
    
    const metrics = this.routeMetrics.get(key)!;
    if (success) {
      metrics.success++;
    } else {
      metrics.failure++;
    }
  }

  getRouteMetrics(): Map<string, { success: number; failure: number }> {
    return new Map(this.routeMetrics);
  }
}

/**
 * DA集成消息总线适配器
 */
class DAIntegratedAdapter {
  constructor(private casClient: typeof casClient) {}

  async processOutgoingMessage(message: EnhancedMessage): Promise<EnhancedMessage> {
    if (!message.metadata.daStorageRequired) {
      return message;
    }

    try {
      // 存储大型载荷到DA
      const payloadJson = JSON.stringify(message.payload);
      const payloadSize = payloadJson.length;
      
      if (payloadSize > 1024) { // 1KB阈值
        const payloadData = new TextEncoder().encode(payloadJson);
        const cid = await this.casClient.store(payloadData, {
          mimeType: 'application/json',
          tags: ['message-payload', message.type],
          ttl: message.metadata.ttl
        });
        
        return {
          ...message,
          payload: { cid: cid.toString() },
          metadata: {
            ...message.metadata,
            daCID: cid.toString(),
            originalSize: payloadSize,
            compressed: true
          }
        };
      }
    } catch (error) {
      console.error('DA storage failed:', error);
      // 继续使用原始消息
    }

    return message;
  }

  async processIncomingMessage(message: EnhancedMessage): Promise<EnhancedMessage> {
    if (!message.metadata.compressed || !message.metadata.daCID) {
      return message;
    }

    try {
      // 从DA恢复原始载荷
      const { SimpleCID } = await import('../../shared/da/cas-client.js');
      const cid = SimpleCID.parse(message.metadata.daCID);
      const payloadData = await this.casClient.retrieve(cid);
      const payloadJson = new TextDecoder().decode(payloadData);
      const originalPayload = JSON.parse(payloadJson);
      
      return {
        ...message,
        payload: originalPayload,
        metadata: {
          ...message.metadata,
          compressed: false
        }
      };
    } catch (error) {
      console.error('DA retrieval failed:', error);
      throw new Error(`Failed to retrieve message payload from DA: ${error}`);
    }
  }
}

/**
 * 内存消息总线实现（用于开发和测试）
 */
class MemoryMessageBus extends EventEmitter implements IMessageBus {
  private subscriptions: Map<string, Set<Subscription>> = new Map();
  private messageQueue: Map<string, EnhancedMessage[]> = new Map();
  private metrics: MessageBusMetrics;
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private errorCount = 0;
  private lastError?: string;

  constructor() {
    super();
    this.metrics = {
      totalMessages: 0,
      messagesPerSecond: 0,
      activeSubscriptions: 0,
      queueDepth: 0,
      processingLatency: 0,
      errorRate: 0,
      throughput: 0,
      memoryUsage: 0
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.processingInterval = setInterval(() => {
      this.processQueues();
      this.updateMetrics();
    }, 10);
    
    console.log('MemoryMessageBus started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    console.log('MemoryMessageBus stopped');
  }

  async publish(topic: string, message: EnhancedMessage): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Message bus is not running');
    }

    // 添加到队列
    if (!this.messageQueue.has(topic)) {
      this.messageQueue.set(topic, []);
    }
    
    this.messageQueue.get(topic)!.push(message);
    this.metrics.totalMessages++;
    
    this.emit('messagePublished', { topic, message });
  }

  async subscribe(topic: string, handler: MessageHandler, config?: SubscriptionConfig): Promise<Subscription> {
    const subscription: Subscription = {
      id: this.generateId(),
      topic,
      handler,
      config: config || {},
      active: true
    };

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    
    this.subscriptions.get(topic)!.add(subscription);
    this.metrics.activeSubscriptions++;
    
    this.emit('subscriptionAdded', subscription);
    return subscription;
  }

  async unsubscribe(subscription: Subscription): Promise<void> {
    const topicSubscriptions = this.subscriptions.get(subscription.topic);
    if (topicSubscriptions) {
      topicSubscriptions.delete(subscription);
      this.metrics.activeSubscriptions--;
      
      if (topicSubscriptions.size === 0) {
        this.subscriptions.delete(subscription.topic);
      }
    }
    
    this.emit('subscriptionRemoved', subscription);
  }

  async request(topic: string, message: EnhancedMessage, timeout = 5000): Promise<EnhancedMessage> {
    return new Promise((resolve, reject) => {
      const correlationId = this.generateId();
      const replyTopic = `reply.${correlationId}`;
      
      // 设置响应监听器
      const responseHandler: MessageHandler = async (response: EnhancedMessage) => {
        if (response.metadata.correlationId === correlationId) {
          await this.unsubscribe(responseSubscription);
          resolve(response);
        }
      };
      
      let responseSubscription: Subscription;
      
      this.subscribe(replyTopic, responseHandler).then(sub => {
        responseSubscription = sub;
      });
      
      // 设置超时
      const timeoutHandle = setTimeout(() => {
        if (responseSubscription) {
          this.unsubscribe(responseSubscription);
        }
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
      
      // 发送请求
      const requestMessage: EnhancedMessage = {
        ...message,
        metadata: {
          ...message.metadata,
          correlationId,
          replyTo: replyTopic
        }
      };
      
      this.publish(topic, requestMessage).catch(error => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }

  async reply(originalMessage: EnhancedMessage, response: EnhancedMessage): Promise<void> {
    if (!originalMessage.metadata.replyTo) {
      throw new Error('Original message does not have replyTo field');
    }
    
    const replyMessage: EnhancedMessage = {
      ...response,
      metadata: {
        ...response.metadata,
        correlationId: originalMessage.metadata.correlationId
      }
    };
    
    await this.publish(originalMessage.metadata.replyTo, replyMessage);
  }

  async publishBatch(topic: string, messages: EnhancedMessage[]): Promise<void> {
    for (const message of messages) {
      await this.publish(topic, message);
    }
  }

  async getMetrics(): Promise<MessageBusMetrics> {
    return { ...this.metrics };
  }

  async getHealth(): Promise<HealthStatus> {
    return {
      status: this.isRunning ? 'healthy' : 'unhealthy',
      uptime: Date.now() - this.startTime,
      lastError: this.lastError,
      errorCount: this.errorCount,
      connections: {
        memory: this.isRunning
      }
    };
  }

  private processQueues(): void {
    for (const [topic, messages] of this.messageQueue.entries()) {
      const subscriptions = this.subscriptions.get(topic);
      if (!subscriptions || subscriptions.size === 0) {
        continue;
      }

      const messagesToProcess = messages.splice(0, 100); // 批量处理
      
      for (const message of messagesToProcess) {
        this.deliverMessage(topic, message, subscriptions);
      }
    }
  }

  private async deliverMessage(topic: string, message: EnhancedMessage, subscriptions: Set<Subscription>): Promise<void> {
    const startTime = Date.now();
    
    for (const subscription of subscriptions) {
      if (!subscription.active) continue;
      
      // 应用消息过滤器
      if (subscription.config.filter && !this.applyFilter(message, subscription.config.filter)) {
        continue;
      }
      
      try {
        await subscription.handler(message);
      } catch (error) {
        this.errorCount++;
        this.lastError = error instanceof Error ? error.message : String(error);
        
        // 实现重试逻辑
        if (subscription.config.retryPolicy) {
          await this.retryMessage(message, subscription, error);
        }
        
        this.emit('messageError', { topic, message, subscription, error });
      }
    }
    
    const processingTime = Date.now() - startTime;
    this.metrics.processingLatency = (this.metrics.processingLatency + processingTime) / 2;
  }

  private applyFilter(message: EnhancedMessage, filter: MessageFilter): boolean {
    if (filter.messageType && message.type !== filter.messageType) {
      return false;
    }
    
    if (filter.priority && message.priority !== filter.priority) {
      return false;
    }
    
    if (filter.source && message.source !== filter.source) {
      return false;
    }
    
    if (filter.customFilter && !filter.customFilter(message)) {
      return false;
    }
    
    return true;
  }

  private async retryMessage(message: EnhancedMessage, subscription: Subscription, error: any): Promise<void> {
    const retryPolicy = subscription.config.retryPolicy!;
    const currentRetryCount = message.metadata.retryCount || 0;
    
    if (currentRetryCount >= retryPolicy.maxRetries) {
      this.emit('messageRetryExhausted', { message, subscription, error });
      return;
    }
    
    // 计算延迟
    let delay = retryPolicy.initialDelay;
    switch (retryPolicy.backoffStrategy) {
      case 'exponential':
        delay = Math.min(retryPolicy.initialDelay * Math.pow(2, currentRetryCount), retryPolicy.maxDelay);
        break;
      case 'linear':
        delay = Math.min(retryPolicy.initialDelay * (currentRetryCount + 1), retryPolicy.maxDelay);
        break;
    }
    
    // 安排重试
    setTimeout(async () => {
      const retryMessage: EnhancedMessage = {
        ...message,
        metadata: {
          ...message.metadata,
          retryCount: currentRetryCount + 1
        }
      };
      
      try {
        await subscription.handler(retryMessage);
      } catch (retryError) {
        await this.retryMessage(retryMessage, subscription, retryError);
      }
    }, delay);
  }

  private updateMetrics(): void {
    this.metrics.queueDepth = Array.from(this.messageQueue.values())
      .reduce((total, queue) => total + queue.length, 0);
    
    this.metrics.errorRate = this.metrics.totalMessages > 0 
      ? this.errorCount / this.metrics.totalMessages 
      : 0;
    
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 增强版消息总线
 */
export class EnhancedMessageBus extends EventEmitter implements IMessageBus {
  private messageBuses: Map<MessageBusType, IMessageBus> = new Map();
  private router: MessageRouter;
  private daAdapter: DAIntegratedAdapter;
  private primaryBus: MessageBusType;
  private fallbackBuses: MessageBusType[];
  private isRunning = false;

  constructor(config: {
    primary: MessageBusType;
    fallback?: MessageBusType[];
    enableDA?: boolean;
  }) {
    super();
    
    this.primaryBus = config.primary;
    this.fallbackBuses = config.fallback || [];
    this.router = new MessageRouter();
    this.daAdapter = new DAIntegratedAdapter(casClient);
    
    // 初始化消息总线
    this.initializeMessageBuses();
    this.setupDefaultRoutes();
    
    console.log('EnhancedMessageBus initialized');
  }

  private initializeMessageBuses(): void {
    // 目前只实现内存消息总线，后续可扩展NATS、Kafka等
    this.messageBuses.set(MessageBusType.MEMORY, new MemoryMessageBus());
  }

  private setupDefaultRoutes(): void {
    // 设置默认路由规则
    const defaultRoutes: RouteConfig[] = [
      {
        messageType: MessageType.ORDER_SUBMITTED,
        priority: MessagePriority.URGENT,
        targetBus: MessageBusType.MEMORY,
        topic: 'orders.urgent',
        weight: 1,
        enabled: true
      },
      {
        messageType: MessageType.BATCH_READY,
        priority: MessagePriority.HIGH,
        targetBus: MessageBusType.MEMORY,
        topic: 'batches.ready',
        weight: 1,
        enabled: true
      },
      {
        messageType: MessageType.VALIDATION_REQUEST,
        priority: MessagePriority.HIGH,
        targetBus: MessageBusType.MEMORY,
        topic: 'validation.requests',
        weight: 1,
        enabled: true
      }
    ];

    defaultRoutes.forEach(route => this.router.addRoute(route));
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    // 启动所有消息总线
    for (const [type, bus] of this.messageBuses) {
      try {
        await bus.start();
        console.log(`${type} message bus started`);
      } catch (error) {
        console.error(`Failed to start ${type} message bus:`, error);
      }
    }
    
    this.isRunning = true;
    this.emit('started');
    console.log('EnhancedMessageBus started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    // 停止所有消息总线
    for (const [type, bus] of this.messageBuses) {
      try {
        await bus.stop();
        console.log(`${type} message bus stopped`);
      } catch (error) {
        console.error(`Failed to stop ${type} message bus:`, error);
      }
    }
    
    this.emit('stopped');
    console.log('EnhancedMessageBus stopped');
  }

  async publish(topic: string, message: EnhancedMessage): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Message bus is not running');
    }

    try {
      // 处理DA存储
      const processedMessage = await this.daAdapter.processOutgoingMessage(message);
      
      // 选择路由
      const route = this.router.selectRoute(processedMessage);
      const targetBus = this.messageBuses.get(route.targetBus);
      
      if (!targetBus) {
        throw new Error(`Target message bus not available: ${route.targetBus}`);
      }
      
      // 发布消息
      await targetBus.publish(route.topic, processedMessage);
      this.router.updateRouteMetrics(route, true);
      
      this.emit('messagePublished', { topic, message: processedMessage, route });
      
    } catch (error) {
      console.error('Message publish failed:', error);
      this.emit('publishError', { topic, message, error });
      throw error;
    }
  }

  async subscribe(topic: string, handler: MessageHandler, config?: SubscriptionConfig): Promise<Subscription> {
    const wrappedHandler: MessageHandler = async (message: EnhancedMessage) => {
      try {
        // 处理DA恢复
        const processedMessage = await this.daAdapter.processIncomingMessage(message);
        await handler(processedMessage);
      } catch (error) {
        console.error('Message handler error:', error);
        this.emit('handlerError', { topic, message, error });
        throw error;
      }
    };

    // 使用主要消息总线进行订阅
    const primaryBus = this.messageBuses.get(this.primaryBus);
    if (!primaryBus) {
      throw new Error(`Primary message bus not available: ${this.primaryBus}`);
    }

    return primaryBus.subscribe(topic, wrappedHandler, config);
  }

  async unsubscribe(subscription: Subscription): Promise<void> {
    const primaryBus = this.messageBuses.get(this.primaryBus);
    if (primaryBus) {
      await primaryBus.unsubscribe(subscription);
    }
  }

  async request(topic: string, message: EnhancedMessage, timeout?: number): Promise<EnhancedMessage> {
    const primaryBus = this.messageBuses.get(this.primaryBus);
    if (!primaryBus) {
      throw new Error(`Primary message bus not available: ${this.primaryBus}`);
    }

    const processedMessage = await this.daAdapter.processOutgoingMessage(message);
    const response = await primaryBus.request(topic, processedMessage, timeout);
    return this.daAdapter.processIncomingMessage(response);
  }

  async reply(originalMessage: EnhancedMessage, response: EnhancedMessage): Promise<void> {
    const primaryBus = this.messageBuses.get(this.primaryBus);
    if (!primaryBus) {
      throw new Error(`Primary message bus not available: ${this.primaryBus}`);
    }

    const processedResponse = await this.daAdapter.processOutgoingMessage(response);
    await primaryBus.reply(originalMessage, processedResponse);
  }

  async publishBatch(topic: string, messages: EnhancedMessage[]): Promise<void> {
    for (const message of messages) {
      await this.publish(topic, message);
    }
  }

  async getMetrics(): Promise<MessageBusMetrics> {
    const primaryBus = this.messageBuses.get(this.primaryBus);
    if (!primaryBus) {
      throw new Error(`Primary message bus not available: ${this.primaryBus}`);
    }

    const baseMetrics = await primaryBus.getMetrics();
    const routeMetrics = this.router.getRouteMetrics();
    
    return {
      ...baseMetrics,
      routeMetrics: Object.fromEntries(routeMetrics)
    } as any;
  }

  async getHealth(): Promise<HealthStatus> {
    const primaryBus = this.messageBuses.get(this.primaryBus);
    if (!primaryBus) {
      return {
        status: 'unhealthy',
        uptime: 0,
        errorCount: 1,
        lastError: `Primary message bus not available: ${this.primaryBus}`,
        connections: {}
      };
    }

    return primaryBus.getHealth();
  }

  /**
   * 添加路由规则
   */
  addRoute(route: RouteConfig): void {
    this.router.addRoute(route);
  }

  /**
   * 获取路由指标
   */
  getRouteMetrics(): Map<string, { success: number; failure: number }> {
    return this.router.getRouteMetrics();
  }
}