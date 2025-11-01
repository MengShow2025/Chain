# 消息总线系统技术规范

## 概述
消息总线系统是链下撮合引擎的通信基础设施，负责在入口服务、撮合引擎和验证层之间提供高性能、可靠的消息传递服务，并集成内容可寻址存储（DA）。

## 架构设计

### 整体架构
```
入口服务 → 消息总线 → 撮合引擎 → 消息总线 → 验证层 → DA存储
    ↓         ↓          ↓         ↓          ↓        ↓
  订单流   路由分发    批次处理   结果发布   验证确认  持久化
```

### 支持的消息系统

#### 1. NATS (推荐用于微批处理)
- **优势**：超低延迟、轻量级、高性能
- **适用场景**：实时订单流、微批处理通知
- **性能**：延迟<1ms，吞吐量>1M msg/s

#### 2. Kafka (推荐用于审计日志)
- **优势**：高吞吐量、持久化、分区扩展
- **适用场景**：审计日志、历史数据、批量处理
- **性能**：吞吐量>100K msg/s，持久化存储

#### 3. RabbitMQ (推荐用于错误处理)
- **优势**：可靠性、复杂路由、事务支持
- **适用场景**：错误处理、重试机制、复杂工作流
- **性能**：吞吐量>50K msg/s，高可靠性

## 功能需求

### 核心功能
1. **多协议支持**：统一接口支持NATS、Kafka、RabbitMQ
2. **智能路由**：基于消息类型和优先级的智能路由
3. **负载均衡**：消费者负载均衡和故障转移
4. **消息持久化**：关键消息的持久化存储
5. **DA集成**：与内容可寻址存储无缝集成

### 性能要求
- 消息延迟：≤5ms (NATS), ≤50ms (Kafka), ≤100ms (RabbitMQ)
- 吞吐量：≥500K msg/s (总体)
- 可用性：≥99.9%
- 消息丢失率：≤0.001%

## 技术设计

### 数据结构

```typescript
interface Message {
  id: string;
  type: MessageType;
  priority: MessagePriority;
  timestamp: number;
  source: string;
  destination: string;
  payload: any;
  metadata: MessageMetadata;
}

interface MessageMetadata {
  correlationId?: string;
  replyTo?: string;
  ttl?: number;
  retryCount?: number;
  persistenceRequired?: boolean;
  daStorageRequired?: boolean;
}

enum MessageType {
  ORDER_SUBMITTED = 'order.submitted',
  BATCH_READY = 'batch.ready',
  BATCH_MATCHED = 'batch.matched',
  VALIDATION_REQUEST = 'validation.request',
  VALIDATION_RESULT = 'validation.result',
  CHALLENGE_SUBMITTED = 'challenge.submitted',
  ERROR_OCCURRED = 'error.occurred'
}

enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}
```

### 统一消息总线接口

```typescript
interface IMessageBus {
  // 基础消息操作
  publish(topic: string, message: Message): Promise<void>;
  subscribe(topic: string, handler: MessageHandler): Promise<Subscription>;
  unsubscribe(subscription: Subscription): Promise<void>;
  
  // 请求-响应模式
  request(topic: string, message: Message, timeout?: number): Promise<Message>;
  reply(originalMessage: Message, response: Message): Promise<void>;
  
  // 批量操作
  publishBatch(topic: string, messages: Message[]): Promise<void>;
  
  // 配置和管理
  createTopic(topic: string, config: TopicConfig): Promise<void>;
  deleteTopic(topic: string): Promise<void>;
  getTopicInfo(topic: string): Promise<TopicInfo>;
  
  // 监控和统计
  getMetrics(): Promise<MessageBusMetrics>;
  getHealth(): Promise<HealthStatus>;
}

interface MessageHandler {
  (message: Message): Promise<void>;
}

interface Subscription {
  id: string;
  topic: string;
  handler: MessageHandler;
  config: SubscriptionConfig;
}
```

### NATS适配器实现

```typescript
class NATSAdapter implements IMessageBus {
  private client: NatsConnection;
  private subscriptions: Map<string, Subscription> = new Map();
  
  constructor(private config: NATSConfig) {}
  
  async connect(): Promise<void> {
    this.client = await connect({
      servers: this.config.servers,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      reconnectTimeWait: this.config.reconnectTimeWait
    });
  }
  
  async publish(topic: string, message: Message): Promise<void> {
    const data = this.serializeMessage(message);
    
    if (message.metadata.persistenceRequired) {
      // 使用JetStream进行持久化
      await this.client.jetstream().publish(topic, data);
    } else {
      // 使用核心NATS进行快速发布
      this.client.publish(topic, data);
    }
  }
  
  async subscribe(topic: string, handler: MessageHandler): Promise<Subscription> {
    const subscription: Subscription = {
      id: generateId(),
      topic,
      handler,
      config: this.getDefaultSubscriptionConfig()
    };
    
    const natsSubscription = this.client.subscribe(topic, {
      callback: async (err, msg) => {
        if (err) {
          console.error('NATS subscription error:', err);
          return;
        }
        
        try {
          const message = this.deserializeMessage(msg.data);
          await handler(message);
          msg.respond(); // 确认消息处理
        } catch (error) {
          console.error('Message handler error:', error);
          // 可以实现重试逻辑
        }
      }
    });
    
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }
  
  async request(topic: string, message: Message, timeout = 5000): Promise<Message> {
    const data = this.serializeMessage(message);
    const response = await this.client.request(topic, data, { timeout });
    return this.deserializeMessage(response.data);
  }
}
```

### Kafka适配器实现

```typescript
class KafkaAdapter implements IMessageBus {
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;
  
  constructor(private config: KafkaConfig) {
    const kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers
    });
    
    this.producer = kafka.producer();
    this.consumer = kafka.consumer({ groupId: config.groupId });
    this.admin = kafka.admin();
  }
  
  async publish(topic: string, message: Message): Promise<void> {
    const kafkaMessage = {
      key: message.id,
      value: JSON.stringify(message),
      timestamp: message.timestamp.toString(),
      headers: {
        type: message.type,
        priority: message.priority.toString()
      }
    };
    
    await this.producer.send({
      topic,
      messages: [kafkaMessage]
    });
    
    // 如果需要DA存储
    if (message.metadata.daStorageRequired) {
      await this.storeInDA(message);
    }
  }
  
  async subscribe(topic: string, handler: MessageHandler): Promise<Subscription> {
    await this.consumer.subscribe({ topic });
    
    const subscription: Subscription = {
      id: generateId(),
      topic,
      handler,
      config: this.getDefaultSubscriptionConfig()
    };
    
    this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const parsedMessage = JSON.parse(message.value.toString());
          await handler(parsedMessage);
        } catch (error) {
          console.error('Kafka message handler error:', error);
          // 实现死信队列逻辑
          await this.sendToDeadLetterQueue(topic, message, error);
        }
      }
    });
    
    return subscription;
  }
  
  private async storeInDA(message: Message): Promise<string> {
    const casClient = new CASClient(this.config.daConfig);
    const cid = await casClient.store(JSON.stringify(message));
    
    // 更新消息元数据
    message.metadata.daCID = cid;
    
    return cid;
  }
}
```

### 智能路由系统

```typescript
class MessageRouter {
  private routes: Map<string, RouteConfig> = new Map();
  private loadBalancer: LoadBalancer;
  
  constructor(private messageBuses: Map<string, IMessageBus>) {
    this.loadBalancer = new LoadBalancer();
  }
  
  async route(message: Message): Promise<void> {
    const route = this.selectRoute(message);
    const messageBus = this.selectMessageBus(route, message);
    
    try {
      await messageBus.publish(route.topic, message);
      this.updateRouteMetrics(route, true);
    } catch (error) {
      this.updateRouteMetrics(route, false);
      await this.handleRoutingError(message, error);
    }
  }
  
  private selectRoute(message: Message): RouteConfig {
    // 基于消息类型选择路由
    const routeKey = `${message.type}:${message.priority}`;
    return this.routes.get(routeKey) || this.getDefaultRoute();
  }
  
  private selectMessageBus(route: RouteConfig, message: Message): IMessageBus {
    // 基于消息特性选择最适合的消息总线
    if (message.priority === MessagePriority.URGENT) {
      return this.messageBuses.get('nats'); // 最低延迟
    } else if (message.metadata.persistenceRequired) {
      return this.messageBuses.get('kafka'); // 持久化
    } else if (message.metadata.retryCount > 0) {
      return this.messageBuses.get('rabbitmq'); // 可靠性
    }
    
    // 默认负载均衡选择
    return this.loadBalancer.select(Array.from(this.messageBuses.values()));
  }
}
```

### DA存储集成

```typescript
class DAIntegratedMessageBus implements IMessageBus {
  private messageBus: IMessageBus;
  private casClient: CASClient;
  
  constructor(messageBus: IMessageBus, casClient: CASClient) {
    this.messageBus = messageBus;
    this.casClient = casClient;
  }
  
  async publish(topic: string, message: Message): Promise<void> {
    // 如果消息需要DA存储
    if (message.metadata.daStorageRequired) {
      // 存储到DA
      const cid = await this.casClient.store(JSON.stringify(message.payload));
      
      // 创建轻量级消息，只包含CID引用
      const lightMessage: Message = {
        ...message,
        payload: { cid },
        metadata: {
          ...message.metadata,
          originalSize: JSON.stringify(message.payload).length,
          compressed: true
        }
      };
      
      await this.messageBus.publish(topic, lightMessage);
    } else {
      await this.messageBus.publish(topic, message);
    }
  }
  
  async subscribe(topic: string, handler: MessageHandler): Promise<Subscription> {
    const wrappedHandler: MessageHandler = async (message: Message) => {
      // 如果消息包含CID引用，从DA恢复原始数据
      if (message.payload.cid && message.metadata.compressed) {
        const originalPayload = await this.casClient.retrieve(message.payload.cid);
        message.payload = JSON.parse(originalPayload);
      }
      
      await handler(message);
    };
    
    return this.messageBus.subscribe(topic, wrappedHandler);
  }
}
```

## 配置管理

### 配置结构

```typescript
interface MessageBusConfig {
  primary: MessageBusType;
  fallback: MessageBusType[];
  
  nats?: NATSConfig;
  kafka?: KafkaConfig;
  rabbitmq?: RabbitMQConfig;
  
  routing: RoutingConfig;
  da: DAConfig;
  monitoring: MonitoringConfig;
}

interface RoutingConfig {
  rules: RouteRule[];
  loadBalancing: LoadBalancingStrategy;
  failover: FailoverConfig;
}

interface RouteRule {
  messageType: MessageType;
  priority: MessagePriority;
  targetBus: MessageBusType;
  topic: string;
  config: TopicConfig;
}
```

### 配置示例

```json
{
  "messageBus": {
    "primary": "nats",
    "fallback": ["kafka", "rabbitmq"],
    
    "nats": {
      "servers": ["nats://localhost:4222"],
      "maxReconnectAttempts": 10,
      "reconnectTimeWait": 2000
    },
    
    "kafka": {
      "brokers": ["localhost:9092"],
      "clientId": "titanchain-matching",
      "groupId": "matching-engine"
    },
    
    "routing": {
      "rules": [
        {
          "messageType": "order.submitted",
          "priority": "urgent",
          "targetBus": "nats",
          "topic": "orders.urgent"
        },
        {
          "messageType": "batch.matched",
          "priority": "normal",
          "targetBus": "kafka",
          "topic": "batches.matched"
        }
      ]
    },
    
    "da": {
      "enabled": true,
      "threshold": 1048576,
      "compression": true
    }
  }
}
```

## 监控和告警

### 关键指标
- 消息吞吐量和延迟
- 消息丢失率和重试率
- 各消息总线的健康状态
- DA存储使用情况

### 告警规则
- 消息延迟超过阈值
- 消息丢失率异常
- 消息总线连接失败
- DA存储空间不足

## 测试策略

### 单元测试
- 各适配器功能测试
- 路由逻辑测试
- DA集成测试
- 错误处理测试

### 集成测试
- 多消息总线协同测试
- 端到端消息流测试
- 故障转移测试
- 性能压力测试

### 性能测试
- 高并发消息处理测试
- 延迟基准测试
- 吞吐量极限测试
- 长时间稳定性测试