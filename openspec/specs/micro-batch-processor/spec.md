# 微批处理器技术规范

## 概述
微批处理器是链下撮合引擎的核心组件，负责在50-100ms的时间窗口内聚合订单，为后续的撮合处理提供批次数据。

## 功能需求

### 核心功能
1. **时间窗口聚合**：在配置的时间窗口内收集订单
2. **智能批次管理**：根据订单量和系统负载动态调整批次大小
3. **优先级处理**：支持订单优先级，确保高优先级订单优先处理
4. **故障恢复**：支持系统故障后的状态恢复

### 性能要求
- 批次处理延迟：50-100ms
- 最大批次大小：10,000订单/批次
- 内存使用：≤512MB
- CPU使用率：≤30%

## 技术设计

### 数据结构

```typescript
interface MicroBatch {
  id: string;
  timestamp: number;
  orders: Order[];
  status: BatchStatus;
  metadata: BatchMetadata;
}

interface BatchMetadata {
  windowStart: number;
  windowEnd: number;
  orderCount: number;
  totalVolume: bigint;
  priority: BatchPriority;
}

enum BatchStatus {
  COLLECTING = 'collecting',
  READY = 'ready',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

enum BatchPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}
```

### 核心算法

#### 时间窗口算法
```typescript
class TimeWindowManager {
  private windowSize: number = 75; // 默认75ms
  private currentWindow: TimeWindow;
  
  startNewWindow(): TimeWindow {
    const now = Date.now();
    return {
      id: generateWindowId(),
      startTime: now,
      endTime: now + this.windowSize,
      orders: []
    };
  }
  
  shouldCloseWindow(window: TimeWindow): boolean {
    return Date.now() >= window.endTime || 
           window.orders.length >= this.maxBatchSize;
  }
}
```

#### 动态批次调整
```typescript
class DynamicBatchSizer {
  private baseSize: number = 1000;
  private maxSize: number = 10000;
  private loadFactor: number = 1.0;
  
  calculateOptimalSize(currentLoad: number, avgProcessingTime: number): number {
    const adjustedSize = this.baseSize * this.loadFactor;
    
    // 根据系统负载调整
    if (currentLoad > 0.8) {
      return Math.max(adjustedSize * 0.7, 100);
    } else if (currentLoad < 0.3) {
      return Math.min(adjustedSize * 1.3, this.maxSize);
    }
    
    return Math.min(adjustedSize, this.maxSize);
  }
}
```

### 接口定义

```typescript
interface IMicroBatchProcessor {
  // 核心处理方法
  addOrder(order: Order): Promise<void>;
  processBatch(batch: MicroBatch): Promise<BatchResult>;
  
  // 配置管理
  updateConfig(config: BatchProcessorConfig): void;
  getConfig(): BatchProcessorConfig;
  
  // 状态查询
  getCurrentBatch(): MicroBatch | null;
  getBatchHistory(limit: number): MicroBatch[];
  getMetrics(): BatchProcessorMetrics;
  
  // 生命周期管理
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

interface BatchProcessorConfig {
  windowSizeMs: number;
  maxBatchSize: number;
  maxMemoryMB: number;
  priorityEnabled: boolean;
  persistenceEnabled: boolean;
}

interface BatchProcessorMetrics {
  totalBatches: number;
  avgBatchSize: number;
  avgProcessingTime: number;
  successRate: number;
  memoryUsage: number;
  cpuUsage: number;
}
```

## 实现细节

### 内存管理
- 使用环形缓冲区存储批次数据
- 实现LRU缓存清理机制
- 监控内存使用，防止内存泄漏

### 并发控制
- 使用读写锁保护批次数据
- 实现无锁队列优化性能
- 支持多线程并发处理

### 持久化策略
- 关键状态持久化到磁盘
- 支持WAL（Write-Ahead Logging）
- 快速故障恢复机制

### 监控和告警
- 实时性能指标收集
- 异常情况自动告警
- 详细的操作日志记录

## 集成要求

### 与消息总线集成
```typescript
interface MessageBusIntegration {
  publishBatch(batch: MicroBatch): Promise<void>;
  subscribeToBatchResults(callback: BatchResultCallback): void;
}
```

### 与撮合引擎集成
```typescript
interface MatchingEngineIntegration {
  submitBatchForMatching(batch: MicroBatch): Promise<MatchingResult>;
  receiveBatchResult(result: BatchResult): Promise<void>;
}
```

## 测试要求

### 单元测试
- 时间窗口管理测试
- 批次大小调整测试
- 优先级处理测试
- 故障恢复测试

### 性能测试
- 高频订单处理测试
- 内存使用压力测试
- 并发处理能力测试
- 长时间运行稳定性测试

### 集成测试
- 与消息总线集成测试
- 与撮合引擎集成测试
- 端到端流程测试

## 部署配置

### 环境变量
```bash
MICRO_BATCH_WINDOW_SIZE=75
MICRO_BATCH_MAX_SIZE=10000
MICRO_BATCH_MAX_MEMORY=512
MICRO_BATCH_PRIORITY_ENABLED=true
MICRO_BATCH_PERSISTENCE_ENABLED=true
```

### 配置文件示例
```json
{
  "microBatchProcessor": {
    "windowSizeMs": 75,
    "maxBatchSize": 10000,
    "maxMemoryMB": 512,
    "priorityEnabled": true,
    "persistenceEnabled": true,
    "monitoring": {
      "metricsInterval": 1000,
      "alertThresholds": {
        "memoryUsage": 0.8,
        "cpuUsage": 0.7,
        "errorRate": 0.01
      }
    }
  }
}
```

## 运维指南

### 监控指标
- 批次处理延迟
- 批次大小分布
- 内存和CPU使用率
- 错误率和成功率

### 故障排查
- 检查系统资源使用情况
- 分析批次处理日志
- 验证配置参数正确性
- 检查与其他组件的连接状态

### 性能调优
- 根据负载调整窗口大小
- 优化内存分配策略
- 调整并发处理参数
- 监控和优化GC性能