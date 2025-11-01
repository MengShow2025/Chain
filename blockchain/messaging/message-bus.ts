import { EventEmitter } from 'events';

/**
 * 消息接口
 */
export interface Message {
  id: string;
  type: string;
  topic: string;
  payload: any;
  timestamp: number;
  priority: MessagePriority;
  metadata?: MessageMetadata;
}

/**
 * 消息元数据
 */
export interface MessageMetadata {
  source: string;
  correlationId?: string;
  replyTo?: string;
  ttl?: number;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * 消息优先级
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * 消息处理器接口
 */
export interface MessageHandler {
  handle(message: Message): Promise<void>;
}

/**
 * 订阅配置
 */
export interface SubscriptionConfig {
  topic: string;
  handler: MessageHandler;
  filter?: MessageFilter;
  options?: SubscriptionOptions;
}

/**
 * 消息过滤器
 */
export interface MessageFilter {
  messageType?: string;
  priority?: MessagePriority;
  source?: string;
  customFilter?: (message: Message) => boolean;
}

/**
 * 订阅选项
 */
export interface SubscriptionOptions {
  durable?: boolean;
  autoAck?: boolean;
  maxConcurrency?: number;
  retryPolicy?: RetryPolicy;
}

/**
 * 重试策略
 */
export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay: number;
}

/**
 * 流处理器接口
 */
export interface StreamProcessor {
  process(messages: Message[]): Promise<Message[]>;
}

/**
 * 消息总线统计信息
 */
export interface MessageBusStats {
  totalMessages: number;
  messagesPerSecond: number;
  activeSubscriptions: number;
  queueDepth: number;
  processingLatency: number;
  errorRate: number;
}

/**
 * 消息总线类
 */
export class MessageBus extends EventEmitter {
  private subscriptions: Map<string, Set<SubscriptionConfig>>;
  private messageQueue: Map<MessagePriority, Message[]>;
  private streamProcessors: Map<string, StreamProcessor>;
  private stats: MessageBusStats;
  private isProcessing: boolean;
  private processingInterval: NodeJS.Timeout | null;
  private deadLetterQueue: Message[];
  
  constructor() {
    super();
    this.subscriptions = new Map();
    this.messageQueue = new Map();
    this.streamProcessors = new Map();
    this.deadLetterQueue = [];
    this.isProcessing = false;
    this.processingInterval = null;
    
    // 初始化优先级队列
    Object.values(MessagePriority).forEach(priority => {
      if (typeof priority === 'number') {
        this.messageQueue.set(priority, []);
      }
    });
    
    // 初始化统计信息
    this.stats = {
      totalMessages: 0,
      messagesPerSecond: 0,
      activeSubscriptions: 0,
      queueDepth: 0,
      processingLatency: 0,
      errorRate: 0
    };
    
    console.log('MessageBus initialized');
    this.startProcessing();
  }

  /**
   * 发布消息
   */
  async publish(topic: string, payload: any, options?: {
    type?: string;
    priority?: MessagePriority;
    metadata?: MessageMetadata;
  }): Promise<string> {
    const message: Message = {
      id: this.generateMessageId(),
      type: options?.type || 'default',
      topic,
      payload,
      timestamp: Date.now(),
      priority: options?.priority || MessagePriority.NORMAL,
      metadata: options?.metadata
    };
    
    // 添加到优先级队列
    const queue = this.messageQueue.get(message.priority)!;
    queue.push(message);
    
    // 更新统计信息
    this.stats.totalMessages++;
    this.updateQueueDepth();
    
    // 触发消息发布事件
    this.emit('message:published', message);
    
    console.log(`Message published: ${message.id} to topic ${topic}`);
    return message.id;
  }

  /**
   * 订阅主题
   */
  subscribe(config: SubscriptionConfig): string {
    const subscriptionId = this.generateSubscriptionId();
    
    if (!this.subscriptions.has(config.topic)) {
      this.subscriptions.set(config.topic, new Set());
    }
    
    const topicSubscriptions = this.subscriptions.get(config.topic)!;
    topicSubscriptions.add(config);
    
    // 更新统计信息
    this.stats.activeSubscriptions++;
    
    // 触发订阅事件
    this.emit('subscription:added', { subscriptionId, config });
    
    console.log(`Subscription added: ${subscriptionId} for topic ${config.topic}`);
    return subscriptionId;
  }

  /**
   * 取消订阅
   */
  unsubscribe(topic: string, handler: MessageHandler): boolean {
    const topicSubscriptions = this.subscriptions.get(topic);
    if (!topicSubscriptions) {
      return false;
    }
    
    for (const config of topicSubscriptions) {
      if (config.handler === handler) {
        topicSubscriptions.delete(config);
        this.stats.activeSubscriptions--;
        
        // 如果没有更多订阅，删除主题
        if (topicSubscriptions.size === 0) {
          this.subscriptions.delete(topic);
        }
        
        this.emit('subscription:removed', { topic, handler });
        console.log(`Subscription removed for topic ${topic}`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * 注册流处理器
   */
  registerStreamProcessor(name: string, processor: StreamProcessor): void {
    this.streamProcessors.set(name, processor);
    console.log(`Stream processor registered: ${name}`);
  }

  /**
   * 处理流数据
   */
  async processStream(processorName: string, messages: Message[]): Promise<Message[]> {
    const processor = this.streamProcessors.get(processorName);
    if (!processor) {
      throw new Error(`Stream processor not found: ${processorName}`);
    }
    
    const startTime = Date.now();
    
    try {
      const result = await processor.process(messages);
      
      // 更新处理延迟统计
      const processingTime = Date.now() - startTime;
      this.updateProcessingLatency(processingTime);
      
      console.log(`Stream processed: ${messages.length} messages in ${processingTime}ms`);
      return result;
      
    } catch (error) {
      console.error(`Stream processing error:`, error);
      this.stats.errorRate++;
      throw error;
    }
  }

  /**
   * 开始消息处理
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    this.processingInterval = setInterval(async () => {
      await this.processMessages();
    }, 10); // 每10ms处理一次
    
    console.log('Message processing started');
  }

  /**
   * 停止消息处理
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    this.isProcessing = false;
    console.log('Message processing stopped');
  }

  /**
   * 处理消息队列
   */
  private async processMessages(): Promise<void> {
    // 按优先级处理消息（从高到低）
    const priorities = [
      MessagePriority.CRITICAL,
      MessagePriority.HIGH,
      MessagePriority.NORMAL,
      MessagePriority.LOW
    ];
    
    for (const priority of priorities) {
      const queue = this.messageQueue.get(priority)!;
      
      if (queue.length > 0) {
        const message = queue.shift()!;
        await this.deliverMessage(message);
        
        // 更新队列深度
        this.updateQueueDepth();
        
        // 只处理一条消息，然后检查更高优先级的消息
        break;
      }
    }
  }

  /**
   * 投递消息给订阅者
   */
  private async deliverMessage(message: Message): Promise<void> {
    const topicSubscriptions = this.subscriptions.get(message.topic);
    if (!topicSubscriptions || topicSubscriptions.size === 0) {
      console.log(`No subscribers for topic: ${message.topic}`);
      return;
    }
    
    const deliveryPromises: Promise<void>[] = [];
    
    for (const config of topicSubscriptions) {
      // 应用消息过滤器
      if (config.filter && !this.applyFilter(message, config.filter)) {
        continue;
      }
      
      // 异步投递消息
      const deliveryPromise = this.deliverToHandler(message, config);
      deliveryPromises.push(deliveryPromise);
    }
    
    // 等待所有投递完成
    await Promise.allSettled(deliveryPromises);
  }

  /**
   * 投递消息给特定处理器
   */
  private async deliverToHandler(message: Message, config: SubscriptionConfig): Promise<void> {
    const startTime = Date.now();
    
    try {
      await config.handler.handle(message);
      
      // 更新处理延迟统计
      const processingTime = Date.now() - startTime;
      this.updateProcessingLatency(processingTime);
      
      // 触发消息处理成功事件
      this.emit('message:processed', { message, config, processingTime });
      
    } catch (error) {
      console.error(`Message handling error for ${message.id}:`, error);
      
      // 更新错误率统计
      this.stats.errorRate++;
      
      // 重试逻辑
      await this.handleMessageError(message, config, error);
      
      // 触发消息处理失败事件
      this.emit('message:failed', { message, config, error });
    }
  }

  /**
   * 处理消息错误
   */
  private async handleMessageError(message: Message, config: SubscriptionConfig, error: any): Promise<void> {
    const retryPolicy = config.options?.retryPolicy;
    if (!retryPolicy) {
      // 没有重试策略，直接发送到死信队列
      this.sendToDeadLetterQueue(message, error);
      return;
    }
    
    const currentRetries = message.metadata?.retryCount || 0;
    
    if (currentRetries >= retryPolicy.maxRetries) {
      // 超过最大重试次数，发送到死信队列
      this.sendToDeadLetterQueue(message, error);
      return;
    }
    
    // 计算重试延迟
    const delay = this.calculateRetryDelay(retryPolicy, currentRetries);
    
    // 更新重试计数
    if (!message.metadata) {
      message.metadata = {};
    }
    message.metadata.retryCount = currentRetries + 1;
    
    // 延迟后重新入队
    setTimeout(() => {
      const queue = this.messageQueue.get(message.priority)!;
      queue.push(message);
      console.log(`Message ${message.id} scheduled for retry ${message.metadata!.retryCount}/${retryPolicy.maxRetries}`);
    }, delay);
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(retryPolicy: RetryPolicy, retryCount: number): number {
    let delay: number;
    
    switch (retryPolicy.backoffStrategy) {
      case 'linear':
        delay = retryPolicy.initialDelay * (retryCount + 1);
        break;
      case 'exponential':
        delay = retryPolicy.initialDelay * Math.pow(2, retryCount);
        break;
      case 'fixed':
      default:
        delay = retryPolicy.initialDelay;
        break;
    }
    
    return Math.min(delay, retryPolicy.maxDelay);
  }

  /**
   * 发送到死信队列
   */
  private sendToDeadLetterQueue(message: Message, error: any): void {
    this.deadLetterQueue.push({
      ...message,
      metadata: {
        ...message.metadata,
        error: error.message || 'Unknown error',
        deadLetterTimestamp: Date.now()
      }
    });
    
    console.log(`Message ${message.id} sent to dead letter queue`);
    this.emit('message:dead_letter', { message, error });
  }

  /**
   * 应用消息过滤器
   */
  private applyFilter(message: Message, filter: MessageFilter): boolean {
    if (filter.messageType && message.type !== filter.messageType) {
      return false;
    }
    
    if (filter.priority !== undefined && message.priority !== filter.priority) {
      return false;
    }
    
    if (filter.source && message.metadata?.source !== filter.source) {
      return false;
    }
    
    if (filter.customFilter && !filter.customFilter(message)) {
      return false;
    }
    
    return true;
  }

  /**
   * 更新队列深度统计
   */
  private updateQueueDepth(): void {
    let totalDepth = 0;
    for (const queue of this.messageQueue.values()) {
      totalDepth += queue.length;
    }
    this.stats.queueDepth = totalDepth;
  }

  /**
   * 更新处理延迟统计
   */
  private updateProcessingLatency(latency: number): void {
    // 使用指数移动平均计算延迟
    const alpha = 0.1;
    this.stats.processingLatency = this.stats.processingLatency * (1 - alpha) + latency * alpha;
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成订阅ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取统计信息
   */
  getStats(): MessageBusStats {
    // 计算每秒消息数
    const now = Date.now();
    const timeWindow = 1000; // 1秒
    this.stats.messagesPerSecond = this.stats.totalMessages / (timeWindow / 1000);
    
    return { ...this.stats };
  }

  /**
   * 获取死信队列
   */
  getDeadLetterQueue(): Message[] {
    return [...this.deadLetterQueue];
  }

  /**
   * 清理死信队列
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
    console.log('Dead letter queue cleared');
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { [priority: string]: number } {
    const status: { [priority: string]: number } = {};
    
    for (const [priority, queue] of this.messageQueue) {
      const priorityName = MessagePriority[priority];
      status[priorityName] = queue.length;
    }
    
    return status;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.stopProcessing();
    this.subscriptions.clear();
    this.messageQueue.clear();
    this.streamProcessors.clear();
    this.deadLetterQueue.length = 0;
    this.removeAllListeners();
    
    console.log('MessageBus cleaned up');
  }
}

/**
 * 简单消息处理器实现
 */
export class SimpleMessageHandler implements MessageHandler {
  private name: string;
  private processingTime: number;
  
  constructor(name: string, processingTime: number = 10) {
    this.name = name;
    this.processingTime = processingTime;
  }
  
  async handle(message: Message): Promise<void> {
    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, this.processingTime));
    
    console.log(`[${this.name}] Processed message ${message.id}: ${message.type}`);
  }
}

/**
 * 批处理流处理器
 */
export class BatchStreamProcessor implements StreamProcessor {
  private batchSize: number;
  
  constructor(batchSize: number = 10) {
    this.batchSize = batchSize;
  }
  
  async process(messages: Message[]): Promise<Message[]> {
    const batches: Message[][] = [];
    
    // 将消息分批
    for (let i = 0; i < messages.length; i += this.batchSize) {
      batches.push(messages.slice(i, i + this.batchSize));
    }
    
    const processedMessages: Message[] = [];
    
    // 处理每个批次
    for (const batch of batches) {
      const batchResult = await this.processBatch(batch);
      processedMessages.push(...batchResult);
    }
    
    return processedMessages;
  }
  
  private async processBatch(batch: Message[]): Promise<Message[]> {
    // 模拟批处理逻辑
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return batch.map(message => ({
      ...message,
      type: `processed_${message.type}`,
      metadata: {
        ...message.metadata,
        processedAt: Date.now(),
        batchSize: batch.length
      }
    }));
  }
}

/**
 * 消息转换流处理器
 */
export class TransformStreamProcessor implements StreamProcessor {
  private transformer: (message: Message) => Message;
  
  constructor(transformer: (message: Message) => Message) {
    this.transformer = transformer;
  }
  
  async process(messages: Message[]): Promise<Message[]> {
    return messages.map(this.transformer);
  }
}