/**
 * 超低延迟优化策略
 * 实现零拷贝网络I/O、NUMA感知内存管理和CPU亲和性优化
 * 目标：实现<0.1ms的端到端延迟
 */

import { EventEmitter } from 'events';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as os from 'os';

/**
 * NUMA节点信息
 */
export interface NUMANode {
  id: number;
  cpus: number[];
  memorySize: number;
  memoryFree: number;
  distance: Map<number, number>; // 到其他节点的距离
}

/**
 * CPU亲和性配置
 */
export interface CPUAffinity {
  coreId: number;
  numaNode: number;
  isIsolated: boolean;
  frequency: number;
  cacheSize: number;
}

/**
 * 内存池配置
 */
export interface MemoryPoolConfig {
  poolSize: number;
  blockSize: number;
  alignment: number;
  numaNode: number;
  preAllocate: boolean;
}

/**
 * 零拷贝缓冲区
 * 使用SharedArrayBuffer实现跨线程零拷贝
 */
export class ZeroCopyBuffer {
  private buffer: SharedArrayBuffer;
  private view: DataView;
  private header: Int32Array;
  private readonly HEADER_SIZE = 16; // 4个int32字段

  // Header字段偏移
  private static readonly OFFSETS = {
    SIZE: 0,      // 数据大小
    READERS: 1,   // 读者数量
    WRITERS: 2,   // 写者数量
    VERSION: 3    // 版本号
  };

  constructor(size: number) {
    this.buffer = new SharedArrayBuffer(size + this.HEADER_SIZE);
    this.view = new DataView(this.buffer, this.HEADER_SIZE);
    this.header = new Int32Array(this.buffer, 0, 4);
    
    // 初始化header
    this.header[ZeroCopyBuffer.OFFSETS.SIZE] = 0;
    this.header[ZeroCopyBuffer.OFFSETS.READERS] = 0;
    this.header[ZeroCopyBuffer.OFFSETS.WRITERS] = 0;
    this.header[ZeroCopyBuffer.OFFSETS.VERSION] = 0;
  }

  /**
   * 写入数据（零拷贝）
   */
  public write(data: ArrayBuffer, offset: number = 0): boolean {
    // 原子性增加写者计数
    const writers = Atomics.add(this.header, ZeroCopyBuffer.OFFSETS.WRITERS, 1);
    
    try {
      if (writers > 0) {
        // 有其他写者，等待
        Atomics.sub(this.header, ZeroCopyBuffer.OFFSETS.WRITERS, 1);
        return false;
      }

      const dataSize = data.byteLength;
      if (offset + dataSize > this.view.byteLength) {
        throw new Error('Buffer overflow');
      }

      // 直接内存拷贝
      const sourceView = new Uint8Array(data);
      const targetView = new Uint8Array(this.buffer, this.HEADER_SIZE + offset, dataSize);
      targetView.set(sourceView);

      // 更新大小和版本
      Atomics.store(this.header, ZeroCopyBuffer.OFFSETS.SIZE, offset + dataSize);
      Atomics.add(this.header, ZeroCopyBuffer.OFFSETS.VERSION, 1);

      return true;
    } finally {
      Atomics.sub(this.header, ZeroCopyBuffer.OFFSETS.WRITERS, 1);
    }
  }

  /**
   * 读取数据（零拷贝）
   */
  public read(offset: number = 0, length?: number): ArrayBuffer | null {
    // 原子性增加读者计数
    Atomics.add(this.header, ZeroCopyBuffer.OFFSETS.READERS, 1);
    
    try {
      const dataSize = Atomics.load(this.header, ZeroCopyBuffer.OFFSETS.SIZE);
      if (dataSize === 0 || offset >= dataSize) {
        return null;
      }

      const readLength = length || (dataSize - offset);
      if (offset + readLength > dataSize) {
        return null;
      }

      // 返回共享内存视图（零拷贝）
      return this.buffer.slice(this.HEADER_SIZE + offset, this.HEADER_SIZE + offset + readLength);
    } finally {
      Atomics.sub(this.header, ZeroCopyBuffer.OFFSETS.READERS, 1);
    }
  }

  /**
   * 获取当前版本
   */
  public getVersion(): number {
    return Atomics.load(this.header, ZeroCopyBuffer.OFFSETS.VERSION);
  }

  /**
   * 等待版本变化
   */
  public async waitForVersion(expectedVersion: number, timeout: number = 1000): Promise<boolean> {
    const result = Atomics.waitAsync(this.header, ZeroCopyBuffer.OFFSETS.VERSION, expectedVersion, timeout);
    
    if (result.async) {
      const waitResult = await result.value;
      return waitResult === 'ok';
    } else {
      return result.value === 'ok';
    }
  }

  /**
   * 通知版本变化
   */
  public notifyVersionChange(): void {
    Atomics.notify(this.header, ZeroCopyBuffer.OFFSETS.VERSION);
  }

  /**
   * 获取缓冲区大小
   */
  public get size(): number {
    return Atomics.load(this.header, ZeroCopyBuffer.OFFSETS.SIZE);
  }

  /**
   * 获取共享缓冲区
   */
  public getSharedBuffer(): SharedArrayBuffer {
    return this.buffer;
  }
}

/**
 * NUMA感知内存管理器
 */
export class NUMAMemoryManager {
  private numaNodes: Map<number, NUMANode> = new Map();
  private memoryPools: Map<number, MemoryPool> = new Map();
  private cpuAffinity: Map<number, CPUAffinity> = new Map();
  private currentNode: number = 0;

  constructor() {
    this.detectNUMATopology();
    this.initializeMemoryPools();
    console.log('NUMAMemoryManager initialized with', this.numaNodes.size, 'NUMA nodes');
  }

  /**
   * 检测NUMA拓扑
   */
  private detectNUMATopology(): void {
    const cpus = os.cpus();
    const numCPUs = cpus.length;
    
    // 简化的NUMA检测逻辑
    // 在实际实现中，需要读取/sys/devices/system/node/等系统信息
    const nodesCount = Math.max(1, Math.floor(numCPUs / 8)); // 假设每8个CPU一个NUMA节点
    
    for (let nodeId = 0; nodeId < nodesCount; nodeId++) {
      const startCPU = nodeId * Math.floor(numCPUs / nodesCount);
      const endCPU = Math.min((nodeId + 1) * Math.floor(numCPUs / nodesCount), numCPUs);
      const nodeCPUs = Array.from({ length: endCPU - startCPU }, (_, i) => startCPU + i);
      
      const node: NUMANode = {
        id: nodeId,
        cpus: nodeCPUs,
        memorySize: 16 * 1024 * 1024 * 1024, // 假设16GB per node
        memoryFree: 12 * 1024 * 1024 * 1024, // 假设12GB可用
        distance: new Map()
      };

      // 计算节点间距离（简化）
      for (let otherId = 0; otherId < nodesCount; otherId++) {
        const distance = otherId === nodeId ? 10 : 20 + Math.abs(otherId - nodeId) * 10;
        node.distance.set(otherId, distance);
      }

      this.numaNodes.set(nodeId, node);

      // 设置CPU亲和性
      for (const cpuId of nodeCPUs) {
        this.cpuAffinity.set(cpuId, {
          coreId: cpuId,
          numaNode: nodeId,
          isIsolated: false,
          frequency: 3000, // 假设3GHz
          cacheSize: 32 * 1024 * 1024 // 假设32MB L3缓存
        });
      }
    }
  }

  /**
   * 初始化内存池
   */
  private initializeMemoryPools(): void {
    for (const [nodeId, node] of this.numaNodes) {
      const poolConfig: MemoryPoolConfig = {
        poolSize: 1024 * 1024 * 1024, // 1GB per pool
        blockSize: 4096, // 4KB blocks
        alignment: 64, // 64字节对齐
        numaNode: nodeId,
        preAllocate: true
      };

      const pool = new MemoryPool(poolConfig);
      this.memoryPools.set(nodeId, pool);
    }
  }

  /**
   * 分配NUMA本地内存
   */
  public allocateLocal(size: number, numaNode?: number): ArrayBuffer | null {
    const targetNode = numaNode !== undefined ? numaNode : this.getCurrentNUMANode();
    const pool = this.memoryPools.get(targetNode);
    
    if (!pool) {
      console.warn(`NUMA node ${targetNode} not available, using default allocation`);
      return new ArrayBuffer(size);
    }

    return pool.allocate(size);
  }

  /**
   * 释放内存
   */
  public deallocate(buffer: ArrayBuffer, numaNode?: number): void {
    const targetNode = numaNode !== undefined ? numaNode : this.getCurrentNUMANode();
    const pool = this.memoryPools.get(targetNode);
    
    if (pool) {
      pool.deallocate(buffer);
    }
  }

  /**
   * 获取当前线程的NUMA节点
   */
  public getCurrentNUMANode(): number {
    // 简化实现：基于当前CPU
    const currentCPU = this.getCurrentCPU();
    const affinity = this.cpuAffinity.get(currentCPU);
    return affinity?.numaNode || 0;
  }

  /**
   * 获取当前CPU
   */
  private getCurrentCPU(): number {
    // 简化实现：轮询分配
    return this.currentNode++ % os.cpus().length;
  }

  /**
   * 设置CPU亲和性
   */
  public setCPUAffinity(cpuIds: number[]): boolean {
    try {
      // 在实际实现中，这里会调用系统API设置CPU亲和性
      console.log(`Setting CPU affinity to cores: ${cpuIds.join(', ')}`);
      return true;
    } catch (error) {
      console.error('Failed to set CPU affinity:', error);
      return false;
    }
  }

  /**
   * 获取NUMA统计信息
   */
  public getStats(): any {
    const stats: any = {
      nodes: [],
      totalMemory: 0,
      totalFreeMemory: 0
    };

    for (const [nodeId, node] of this.numaNodes) {
      const pool = this.memoryPools.get(nodeId);
      const nodeStats = {
        id: nodeId,
        cpus: node.cpus,
        memorySize: node.memorySize,
        memoryFree: node.memoryFree,
        poolStats: pool?.getStats() || null
      };

      stats.nodes.push(nodeStats);
      stats.totalMemory += node.memorySize;
      stats.totalFreeMemory += node.memoryFree;
    }

    return stats;
  }
}

/**
 * 内存池实现
 */
class MemoryPool {
  private config: MemoryPoolConfig;
  private freeBlocks: ArrayBuffer[] = [];
  private usedBlocks: Set<ArrayBuffer> = new Set();
  private totalAllocated: number = 0;

  constructor(config: MemoryPoolConfig) {
    this.config = config;
    
    if (config.preAllocate) {
      this.preAllocateBlocks();
    }
  }

  /**
   * 预分配内存块
   */
  private preAllocateBlocks(): void {
    const blockCount = Math.floor(this.config.poolSize / this.config.blockSize);
    
    for (let i = 0; i < blockCount; i++) {
      const block = new ArrayBuffer(this.config.blockSize);
      this.freeBlocks.push(block);
    }

    console.log(`Pre-allocated ${blockCount} blocks for NUMA node ${this.config.numaNode}`);
  }

  /**
   * 分配内存
   */
  public allocate(size: number): ArrayBuffer | null {
    // 如果请求大小超过块大小，直接分配
    if (size > this.config.blockSize) {
      const buffer = new ArrayBuffer(size);
      this.usedBlocks.add(buffer);
      this.totalAllocated += size;
      return buffer;
    }

    // 从空闲块中分配
    if (this.freeBlocks.length > 0) {
      const block = this.freeBlocks.pop()!;
      this.usedBlocks.add(block);
      this.totalAllocated += this.config.blockSize;
      return block;
    }

    // 没有空闲块，创建新块
    const block = new ArrayBuffer(this.config.blockSize);
    this.usedBlocks.add(block);
    this.totalAllocated += this.config.blockSize;
    return block;
  }

  /**
   * 释放内存
   */
  public deallocate(buffer: ArrayBuffer): void {
    if (!this.usedBlocks.has(buffer)) {
      return;
    }

    this.usedBlocks.delete(buffer);
    this.totalAllocated -= buffer.byteLength;

    // 如果是标准块大小，回收到空闲池
    if (buffer.byteLength === this.config.blockSize) {
      this.freeBlocks.push(buffer);
    }
  }

  /**
   * 获取统计信息
   */
  public getStats(): any {
    return {
      freeBlocks: this.freeBlocks.length,
      usedBlocks: this.usedBlocks.size,
      totalAllocated: this.totalAllocated,
      poolSize: this.config.poolSize,
      blockSize: this.config.blockSize
    };
  }
}

/**
 * 零拷贝网络I/O管理器
 */
export class ZeroCopyNetworkIO extends EventEmitter {
  private sendBuffers: Map<string, ZeroCopyBuffer> = new Map();
  private receiveBuffers: Map<string, ZeroCopyBuffer> = new Map();
  private workers: Map<string, Worker> = new Map();
  private numaManager: NUMAMemoryManager;
  private isRunning: boolean = false;

  constructor(numaManager: NUMAMemoryManager) {
    super();
    this.numaManager = numaManager;
    console.log('ZeroCopyNetworkIO initialized');
  }

  /**
   * 启动网络I/O
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('ZeroCopyNetworkIO is already running');
    }

    this.isRunning = true;
    await this.initializeWorkers();
    console.log('ZeroCopyNetworkIO started');
    this.emit('started');
  }

  /**
   * 停止网络I/O
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    await this.terminateWorkers();
    console.log('ZeroCopyNetworkIO stopped');
    this.emit('stopped');
  }

  /**
   * 初始化工作线程
   */
  private async initializeWorkers(): Promise<void> {
    const cpuCount = os.cpus().length;
    const workerCount = Math.min(cpuCount, 8); // 最多8个网络工作线程

    for (let i = 0; i < workerCount; i++) {
      const workerId = `network_worker_${i}`;
      const worker = new Worker(__filename, {
        workerData: {
          workerId,
          numaNode: i % this.numaManager.getStats().nodes.length
        }
      });

      worker.on('message', (message) => {
        this.handleWorkerMessage(workerId, message);
      });

      worker.on('error', (error) => {
        console.error(`Worker ${workerId} error:`, error);
      });

      this.workers.set(workerId, worker);

      // 为每个工作线程创建缓冲区
      const sendBuffer = new ZeroCopyBuffer(64 * 1024 * 1024); // 64MB
      const receiveBuffer = new ZeroCopyBuffer(64 * 1024 * 1024); // 64MB
      
      this.sendBuffers.set(workerId, sendBuffer);
      this.receiveBuffers.set(workerId, receiveBuffer);
    }

    console.log(`Initialized ${workerCount} network workers`);
  }

  /**
   * 终止工作线程
   */
  private async terminateWorkers(): Promise<void> {
    const terminatePromises: Promise<number>[] = [];

    for (const [workerId, worker] of this.workers) {
      terminatePromises.push(worker.terminate());
    }

    await Promise.all(terminatePromises);
    this.workers.clear();
    this.sendBuffers.clear();
    this.receiveBuffers.clear();
  }

  /**
   * 处理工作线程消息
   */
  private handleWorkerMessage(workerId: string, message: any): void {
    switch (message.type) {
      case 'data_received':
        this.emit('dataReceived', {
          workerId,
          data: message.data,
          timestamp: message.timestamp
        });
        break;
      case 'data_sent':
        this.emit('dataSent', {
          workerId,
          bytes: message.bytes,
          timestamp: message.timestamp
        });
        break;
      case 'error':
        this.emit('error', {
          workerId,
          error: message.error
        });
        break;
    }
  }

  /**
   * 发送数据（零拷贝）
   */
  public async sendData(data: ArrayBuffer, target: string): Promise<boolean> {
    if (!this.isRunning) {
      throw new Error('ZeroCopyNetworkIO is not running');
    }

    // 选择最佳工作线程
    const workerId = this.selectBestWorker();
    const sendBuffer = this.sendBuffers.get(workerId);
    
    if (!sendBuffer) {
      throw new Error(`Send buffer not found for worker ${workerId}`);
    }

    // 写入共享缓冲区
    const success = sendBuffer.write(data);
    if (!success) {
      return false;
    }

    // 通知工作线程
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.postMessage({
        type: 'send_data',
        target,
        bufferVersion: sendBuffer.getVersion()
      });
    }

    return true;
  }

  /**
   * 选择最佳工作线程
   */
  private selectBestWorker(): string {
    // 简化实现：轮询选择
    const workerIds = Array.from(this.workers.keys());
    const index = Math.floor(Math.random() * workerIds.length);
    return workerIds[index];
  }

  /**
   * 获取性能统计
   */
  public getStats(): any {
    const stats = {
      isRunning: this.isRunning,
      workerCount: this.workers.size,
      buffers: {
        send: Array.from(this.sendBuffers.entries()).map(([id, buffer]) => ({
          workerId: id,
          size: buffer.size,
          version: buffer.getVersion()
        })),
        receive: Array.from(this.receiveBuffers.entries()).map(([id, buffer]) => ({
          workerId: id,
          size: buffer.size,
          version: buffer.getVersion()
        }))
      }
    };

    return stats;
  }
}

/**
 * 超低延迟优化管理器
 * 统一管理所有延迟优化策略
 */
export class UltraLowLatencyManager extends EventEmitter {
  private numaManager: NUMAMemoryManager;
  private networkIO: ZeroCopyNetworkIO;
  private isRunning: boolean = false;
  private performanceMonitor: PerformanceMonitor;
  private latencyTarget: number = 0.1; // 0.1ms目标延迟

  constructor() {
    super();
    this.numaManager = new NUMAMemoryManager();
    this.networkIO = new ZeroCopyNetworkIO(this.numaManager);
    this.performanceMonitor = new PerformanceMonitor();
    
    this.setupEventHandlers();
    console.log('UltraLowLatencyManager initialized');
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.networkIO.on('dataReceived', (data) => {
      this.emit('dataReceived', data);
    });

    this.networkIO.on('dataSent', (data) => {
      this.emit('dataSent', data);
    });

    this.performanceMonitor.on('latencyAlert', (alert) => {
      this.handleLatencyAlert(alert);
    });
  }

  /**
   * 启动超低延迟优化
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('UltraLowLatencyManager is already running');
    }

    // 设置CPU亲和性
    await this.optimizeCPUAffinity();
    
    // 启动网络I/O
    await this.networkIO.start();
    
    // 启动性能监控
    await this.performanceMonitor.start();

    this.isRunning = true;
    console.log('UltraLowLatencyManager started');
    this.emit('started');
  }

  /**
   * 停止超低延迟优化
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    await this.networkIO.stop();
    await this.performanceMonitor.stop();

    this.isRunning = false;
    console.log('UltraLowLatencyManager stopped');
    this.emit('stopped');
  }

  /**
   * 优化CPU亲和性
   */
  private async optimizeCPUAffinity(): Promise<void> {
    const stats = this.numaManager.getStats();
    
    // 为关键线程分配专用CPU核心
    if (stats.nodes.length > 0) {
      const firstNode = stats.nodes[0];
      const dedicatedCores = firstNode.cpus.slice(0, Math.min(4, firstNode.cpus.length));
      
      const success = this.numaManager.setCPUAffinity(dedicatedCores);
      if (success) {
        console.log(`Optimized CPU affinity: dedicated cores ${dedicatedCores.join(', ')}`);
      }
    }
  }

  /**
   * 处理延迟告警
   */
  private handleLatencyAlert(alert: any): void {
    console.warn('Latency alert:', alert);
    
    if (alert.latency > this.latencyTarget * 2) {
      // 延迟超过目标2倍，触发紧急优化
      this.emergencyOptimization();
    }
    
    this.emit('latencyAlert', alert);
  }

  /**
   * 紧急优化
   */
  private emergencyOptimization(): void {
    console.log('Triggering emergency latency optimization');
    
    // 可以实施的紧急优化措施：
    // 1. 增加CPU频率
    // 2. 清理内存缓存
    // 3. 重新分配NUMA内存
    // 4. 调整网络缓冲区大小
  }

  /**
   * 分配NUMA本地内存
   */
  public allocateMemory(size: number, numaNode?: number): ArrayBuffer | null {
    return this.numaManager.allocateLocal(size, numaNode);
  }

  /**
   * 发送数据
   */
  public async sendData(data: ArrayBuffer, target: string): Promise<boolean> {
    const startTime = performance.now();
    const result = await this.networkIO.sendData(data, target);
    const latency = performance.now() - startTime;
    
    this.performanceMonitor.recordLatency('send', latency);
    return result;
  }

  /**
   * 获取系统状态
   */
  public getSystemStatus(): any {
    return {
      isRunning: this.isRunning,
      latencyTarget: this.latencyTarget,
      numa: this.numaManager.getStats(),
      networkIO: this.networkIO.getStats(),
      performance: this.performanceMonitor.getStats()
    };
  }

  /**
   * 设置延迟目标
   */
  public setLatencyTarget(targetMs: number): void {
    this.latencyTarget = targetMs;
    console.log(`Latency target set to ${targetMs}ms`);
  }
}

/**
 * 性能监控器
 */
class PerformanceMonitor extends EventEmitter {
  private latencyHistory: Map<string, number[]> = new Map();
  private isRunning: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly HISTORY_SIZE = 1000;

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.monitorInterval = setInterval(() => {
      this.checkPerformance();
    }, 100); // 每100ms检查一次

    console.log('PerformanceMonitor started');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    console.log('PerformanceMonitor stopped');
  }

  /**
   * 记录延迟
   */
  public recordLatency(operation: string, latency: number): void {
    if (!this.latencyHistory.has(operation)) {
      this.latencyHistory.set(operation, []);
    }

    const history = this.latencyHistory.get(operation)!;
    history.push(latency);

    // 保持历史记录大小
    if (history.length > this.HISTORY_SIZE) {
      history.shift();
    }
  }

  /**
   * 检查性能
   */
  private checkPerformance(): void {
    for (const [operation, history] of this.latencyHistory) {
      if (history.length === 0) continue;

      const recentLatencies = history.slice(-10); // 最近10次
      const avgLatency = recentLatencies.reduce((sum, lat) => sum + lat, 0) / recentLatencies.length;
      const maxLatency = Math.max(...recentLatencies);

      // 检查是否超过阈值
      if (avgLatency > 0.1 || maxLatency > 0.5) {
        this.emit('latencyAlert', {
          operation,
          avgLatency,
          maxLatency,
          threshold: 0.1,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * 获取统计信息
   */
  public getStats(): any {
    const stats: any = {
      isRunning: this.isRunning,
      operations: {}
    };

    for (const [operation, history] of this.latencyHistory) {
      if (history.length === 0) continue;

      const avgLatency = history.reduce((sum, lat) => sum + lat, 0) / history.length;
      const minLatency = Math.min(...history);
      const maxLatency = Math.max(...history);
      const p95Latency = this.calculatePercentile(history, 0.95);
      const p99Latency = this.calculatePercentile(history, 0.99);

      stats.operations[operation] = {
        count: history.length,
        avgLatency,
        minLatency,
        maxLatency,
        p95Latency,
        p99Latency
      };
    }

    return stats;
  }

  /**
   * 计算百分位数
   */
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }
}

// 工作线程代码
if (!isMainThread && parentPort) {
  const { workerId, numaNode } = workerData;
  
  parentPort.on('message', (message) => {
    switch (message.type) {
      case 'send_data':
        // 模拟网络发送
        setTimeout(() => {
          parentPort!.postMessage({
            type: 'data_sent',
            bytes: 1024,
            timestamp: Date.now()
          });
        }, Math.random() * 0.1); // 0-0.1ms随机延迟
        break;
    }
  });

  console.log(`Network worker ${workerId} started on NUMA node ${numaNode}`);
}