import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 哈希算法枚举
 */
export enum HashAlgorithm {
  SHA256 = 'sha2-256',
  BLAKE3 = 'blake3',
  KECCAK256 = 'keccak-256'
}

/**
 * 压缩类型枚举
 */
export enum CompressionType {
  NONE = 'none',
  GZIP = 'gzip',
  BROTLI = 'brotli',
  LZ4 = 'lz4'
}

/**
 * CID接口
 */
export interface CID {
  version: number;
  codec: string;
  multihash: Multihash;
  toString(): string;
}

/**
 * 多重哈希接口
 */
export interface Multihash {
  algorithm: HashAlgorithm;
  digest: Uint8Array;
  length: number;
}

/**
 * 内容元数据接口
 */
export interface ContentMetadata {
  size: number;
  mimeType?: string;
  encoding?: string;
  compression?: CompressionType;
  encryption?: EncryptionInfo;
  tags?: string[];
  ttl?: number;
}

/**
 * 加密信息接口
 */
export interface EncryptionInfo {
  algorithm: string;
  keyId: string;
  iv: Uint8Array;
}

/**
 * 存储内容接口
 */
export interface StoredContent {
  cid: CID;
  data: Uint8Array;
  metadata: ContentMetadata;
  timestamp: number;
}

/**
 * 搜索查询接口
 */
export interface SearchQuery {
  tags?: string[];
  mimeType?: string;
  sizeRange?: [number, number];
  timeRange?: [number, number];
  limit?: number;
  offset?: number;
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  cid: CID;
  metadata: ContentMetadata;
  score: number;
}

/**
 * CAS统计信息接口
 */
export interface CASStats {
  totalItems: number;
  totalSize: number;
  cacheHitRate: number;
  averageLatency: number;
  errorRate: number;
}

/**
 * 健康状态接口
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
}

/**
 * 缓存条目接口
 */
interface CacheEntry {
  value: StoredContent;
  size: number;
  accessTime: number;
  hitCount: number;
}

/**
 * CAS配置接口
 */
export interface CASConfig {
  storage: {
    backend: 'filesystem' | 'memory' | 'hybrid';
    basePath?: string;
    replication?: number;
  };
  hashAlgorithm: HashAlgorithm;
  compression: {
    enabled: boolean;
    algorithm: CompressionType;
    threshold: number;
    level: number;
  };
  cache: {
    maxSize: number;
    maxMemory: number;
    ttl: number;
  };
  performance: {
    batchSize: number;
    concurrency: number;
    timeout: number;
  };
}

/**
 * CAS客户端接口
 */
export interface ICASClient {
  // 基础存储操作
  store(data: Uint8Array, metadata?: ContentMetadata): Promise<CID>;
  retrieve(cid: CID): Promise<Uint8Array>;
  exists(cid: CID): Promise<boolean>;
  delete(cid: CID): Promise<void>;
  
  // 批量操作
  storeBatch(items: Array<{data: Uint8Array, metadata?: ContentMetadata}>): Promise<CID[]>;
  retrieveBatch(cids: CID[]): Promise<Map<CID, Uint8Array>>;
  
  // 流式操作
  storeStream(stream: ReadableStream, metadata?: ContentMetadata): Promise<CID>;
  retrieveStream(cid: CID): Promise<ReadableStream>;
  
  // 元数据操作
  getMetadata(cid: CID): Promise<ContentMetadata>;
  updateMetadata(cid: CID, metadata: ContentMetadata): Promise<void>;
  
  // 搜索和查询
  search(query: SearchQuery): Promise<SearchResult[]>;
  listByTag(tag: string): Promise<CID[]>;
  
  // 缓存管理
  pin(cid: CID): Promise<void>;
  unpin(cid: CID): Promise<void>;
  gc(): Promise<void>;
  
  // 统计和监控
  getStats(): Promise<CASStats>;
  getHealth(): Promise<HealthStatus>;
}

/**
 * 简单CID实现
 */
class SimpleCID implements CID {
  constructor(
    public version: number,
    public codec: string,
    public multihash: Multihash
  ) {}

  toString(): string {
    const hashHex = Buffer.from(this.multihash.digest).toString('hex');
    return `${this.version}-${this.codec}-${this.multihash.algorithm}-${hashHex}`;
  }

  static parse(cidStr: string): CID {
    const parts = cidStr.split('-');
    if (parts.length !== 4) {
      throw new Error('Invalid CID format');
    }

    return new SimpleCID(
      parseInt(parts[0]),
      parts[1],
      {
        algorithm: parts[2] as HashAlgorithm,
        digest: Buffer.from(parts[3], 'hex'),
        length: Buffer.from(parts[3], 'hex').length
      }
    );
  }
}

/**
 * LRU缓存实现
 */
class LRUCache {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];

  constructor(
    private maxSize: number,
    private maxMemory: number
  ) {}

  set(key: string, value: StoredContent): void {
    const size = this.calculateSize(value);
    
    // 检查内存限制
    while (this.getCurrentMemoryUsage() + size > this.maxMemory && this.cache.size > 0) {
      this.evictLRU();
    }
    
    // 检查数量限制
    while (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    const entry: CacheEntry = {
      value,
      size,
      accessTime: Date.now(),
      hitCount: 0
    };
    
    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  get(key: string): StoredContent | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    
    entry.accessTime = Date.now();
    entry.hitCount++;
    this.updateAccessOrder(key);
    
    return entry.value;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    const lruKey = this.accessOrder.shift()!;
    this.cache.delete(lruKey);
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private getCurrentMemoryUsage(): number {
    return Array.from(this.cache.values()).reduce((total, entry) => total + entry.size, 0);
  }

  private calculateSize(content: StoredContent): number {
    return content.data.length + JSON.stringify(content.metadata).length + 100;
  }

  getStats() {
    const totalHits = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.hitCount, 0);
    return {
      size: this.cache.size,
      memoryUsage: this.getCurrentMemoryUsage(),
      hitRate: totalHits > 0 ? totalHits / (totalHits + this.cache.size) : 0
    };
  }
}

/**
 * 增强版CAS客户端实现
 */
export class EnhancedCASClient extends EventEmitter implements ICASClient {
  private cache: LRUCache;
  private storage: Map<string, StoredContent> = new Map();
  private stats = {
    totalStores: 0,
    totalRetrieves: 0,
    totalErrors: 0,
    totalLatency: 0,
    startTime: Date.now()
  };

  constructor(private config: CASConfig) {
    super();
    this.cache = new LRUCache(config.cache.maxSize, config.cache.maxMemory);
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    if (this.config.storage.backend === 'filesystem' && this.config.storage.basePath) {
      try {
        await fs.mkdir(this.config.storage.basePath, { recursive: true });
      } catch (error) {
        console.warn('Failed to create storage directory:', error);
      }
    }
  }

  async store(data: Uint8Array, metadata?: ContentMetadata): Promise<CID> {
    const startTime = Date.now();
    
    try {
      // 1. 计算CID
      const hash = await this.computeHash(data);
      const cid = new SimpleCID(1, 'raw', hash);
      
      // 2. 检查是否已存在
      if (await this.exists(cid)) {
        return cid;
      }
      
      // 3. 处理数据（压缩等）
      let processedData = data;
      const finalMetadata: ContentMetadata = {
        size: data.length,
        ...metadata
      };
      
      if (this.config.compression.enabled && data.length > this.config.compression.threshold) {
        processedData = await this.compressData(data);
        if (processedData.length < data.length * 0.9) {
          finalMetadata.compression = this.config.compression.algorithm;
        } else {
          processedData = data; // 压缩效果不好，使用原始数据
        }
      }
      
      // 4. 创建存储内容
      const storedContent: StoredContent = {
        cid,
        data: processedData,
        metadata: finalMetadata,
        timestamp: Date.now()
      };
      
      // 5. 存储到后端
      await this.storeToBackend(cid, storedContent);
      
      // 6. 更新缓存
      this.cache.set(cid.toString(), storedContent);
      
      // 7. 更新统计
      this.stats.totalStores++;
      this.stats.totalLatency += Date.now() - startTime;
      
      this.emit('stored', { cid, size: data.length });
      
      return cid;
    } catch (error) {
      this.stats.totalErrors++;
      this.emit('error', { operation: 'store', error });
      throw error;
    }
  }

  async retrieve(cid: CID): Promise<Uint8Array> {
    const startTime = Date.now();
    
    try {
      // 1. 检查缓存
      const cached = this.cache.get(cid.toString());
      if (cached) {
        this.emit('cache_hit', { cid });
        return await this.processRetrievedData(cached);
      }
      
      // 2. 从存储后端获取
      const storedContent = await this.retrieveFromBackend(cid);
      if (!storedContent) {
        throw new Error(`Content not found: ${cid.toString()}`);
      }
      
      // 3. 验证完整性
      await this.verifyIntegrity(cid, storedContent);
      
      // 4. 处理数据
      const data = await this.processRetrievedData(storedContent);
      
      // 5. 更新缓存
      this.cache.set(cid.toString(), storedContent);
      
      // 6. 更新统计
      this.stats.totalRetrieves++;
      this.stats.totalLatency += Date.now() - startTime;
      
      this.emit('retrieved', { cid, size: data.length });
      
      return data;
    } catch (error) {
      this.stats.totalErrors++;
      this.emit('error', { operation: 'retrieve', error });
      throw error;
    }
  }

  async exists(cid: CID): Promise<boolean> {
    // 检查缓存
    if (this.cache.has(cid.toString())) {
      return true;
    }
    
    // 检查存储后端
    return this.storage.has(cid.toString()) || await this.existsInFileSystem(cid);
  }

  async delete(cid: CID): Promise<void> {
    const cidStr = cid.toString();
    
    // 从缓存删除
    this.cache.delete(cidStr);
    
    // 从存储删除
    this.storage.delete(cidStr);
    
    // 从文件系统删除
    if (this.config.storage.backend === 'filesystem') {
      await this.deleteFromFileSystem(cid);
    }
    
    this.emit('deleted', { cid });
  }

  async storeBatch(items: Array<{data: Uint8Array, metadata?: ContentMetadata}>): Promise<CID[]> {
    const results: CID[] = [];
    const batchSize = this.config.performance.batchSize;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(item => this.store(item.data, item.metadata));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  async retrieveBatch(cids: CID[]): Promise<Map<CID, Uint8Array>> {
    const results = new Map<CID, Uint8Array>();
    const batchSize = this.config.performance.batchSize;
    
    for (let i = 0; i < cids.length; i += batchSize) {
      const batch = cids.slice(i, i + batchSize);
      const batchPromises = batch.map(async cid => {
        try {
          const data = await this.retrieve(cid);
          return { cid, data };
        } catch (error) {
          return { cid, error };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        if ('data' in result) {
          results.set(result.cid, result.data);
        }
      }
    }
    
    return results;
  }

  async storeStream(stream: ReadableStream, metadata?: ContentMetadata): Promise<CID> {
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    
    const data = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    
    return this.store(data, metadata);
  }

  async retrieveStream(cid: CID): Promise<ReadableStream> {
    const data = await this.retrieve(cid);
    
    return new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      }
    });
  }

  async getMetadata(cid: CID): Promise<ContentMetadata> {
    const cached = this.cache.get(cid.toString());
    if (cached) {
      return cached.metadata;
    }
    
    const storedContent = await this.retrieveFromBackend(cid);
    if (!storedContent) {
      throw new Error(`Content not found: ${cid.toString()}`);
    }
    
    return storedContent.metadata;
  }

  async updateMetadata(cid: CID, metadata: ContentMetadata): Promise<void> {
    const storedContent = await this.retrieveFromBackend(cid);
    if (!storedContent) {
      throw new Error(`Content not found: ${cid.toString()}`);
    }
    
    storedContent.metadata = { ...storedContent.metadata, ...metadata };
    await this.storeToBackend(cid, storedContent);
    
    // 更新缓存
    if (this.cache.has(cid.toString())) {
      this.cache.set(cid.toString(), storedContent);
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // 简单的搜索实现
    for (const [cidStr, content] of this.storage) {
      let score = 0;
      
      // 标签匹配
      if (query.tags && content.metadata.tags) {
        const matchingTags = query.tags.filter(tag => content.metadata.tags!.includes(tag));
        score += matchingTags.length / query.tags.length;
      }
      
      // MIME类型匹配
      if (query.mimeType && content.metadata.mimeType === query.mimeType) {
        score += 0.5;
      }
      
      // 大小范围匹配
      if (query.sizeRange) {
        const [min, max] = query.sizeRange;
        if (content.metadata.size >= min && content.metadata.size <= max) {
          score += 0.3;
        }
      }
      
      // 时间范围匹配
      if (query.timeRange) {
        const [start, end] = query.timeRange;
        if (content.timestamp >= start && content.timestamp <= end) {
          score += 0.2;
        }
      }
      
      if (score > 0) {
        results.push({
          cid: content.cid,
          metadata: content.metadata,
          score
        });
      }
    }
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    
    // 应用限制
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return results.slice(offset, offset + limit);
  }

  async listByTag(tag: string): Promise<CID[]> {
    const results: CID[] = [];
    
    for (const [, content] of this.storage) {
      if (content.metadata.tags && content.metadata.tags.includes(tag)) {
        results.push(content.cid);
      }
    }
    
    return results;
  }

  async pin(cid: CID): Promise<void> {
    // 简单实现：确保内容在缓存中
    if (!this.cache.has(cid.toString())) {
      await this.retrieve(cid);
    }
    this.emit('pinned', { cid });
  }

  async unpin(cid: CID): Promise<void> {
    // 简单实现：从缓存中移除
    this.cache.delete(cid.toString());
    this.emit('unpinned', { cid });
  }

  async gc(): Promise<void> {
    // 垃圾回收：清理过期内容
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [cidStr, content] of this.storage) {
      if (content.metadata.ttl && now - content.timestamp > content.metadata.ttl) {
        toDelete.push(cidStr);
      }
    }
    
    for (const cidStr of toDelete) {
      const cid = SimpleCID.parse(cidStr);
      await this.delete(cid);
    }
    
    this.emit('gc_completed', { deletedCount: toDelete.length });
  }

  async getStats(): Promise<CASStats> {
    const cacheStats = this.cache.getStats();
    const totalOperations = this.stats.totalStores + this.stats.totalRetrieves;
    
    return {
      totalItems: this.storage.size,
      totalSize: Array.from(this.storage.values()).reduce((sum, content) => sum + content.metadata.size, 0),
      cacheHitRate: cacheStats.hitRate,
      averageLatency: totalOperations > 0 ? this.stats.totalLatency / totalOperations : 0,
      errorRate: totalOperations > 0 ? this.stats.totalErrors / totalOperations : 0
    };
  }

  async getHealth(): Promise<HealthStatus> {
    const stats = await this.getStats();
    const uptime = Date.now() - this.stats.startTime;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (stats.errorRate > 0.1) {
      status = 'unhealthy';
    } else if (stats.errorRate > 0.05 || stats.averageLatency > 1000) {
      status = 'degraded';
    }
    
    return {
      status,
      uptime,
      memoryUsage: process.memoryUsage().heapUsed,
      diskUsage: 0, // TODO: 实现磁盘使用量检查
      networkLatency: 0 // TODO: 实现网络延迟检查
    };
  }

  // 私有方法

  private async computeHash(data: Uint8Array): Promise<Multihash> {
    let digest: Uint8Array;
    
    switch (this.config.hashAlgorithm) {
      case HashAlgorithm.SHA256:
        digest = crypto.createHash('sha256').update(data).digest();
        break;
      case HashAlgorithm.KECCAK256:
        digest = crypto.createHash('sha3-256').update(data).digest();
        break;
      default:
        digest = crypto.createHash('sha256').update(data).digest();
    }
    
    return {
      algorithm: this.config.hashAlgorithm,
      digest,
      length: digest.length
    };
  }

  private async compressData(data: Uint8Array): Promise<Uint8Array> {
    // 简单实现：返回原始数据（实际应该实现压缩）
    return data;
  }

  private async processRetrievedData(storedContent: StoredContent): Promise<Uint8Array> {
    let data = storedContent.data;
    
    // 解压缩
    if (storedContent.metadata.compression && storedContent.metadata.compression !== CompressionType.NONE) {
      data = await this.decompressData(data, storedContent.metadata.compression);
    }
    
    return data;
  }

  private async decompressData(data: Uint8Array, compression: CompressionType): Promise<Uint8Array> {
    // 简单实现：返回原始数据（实际应该实现解压缩）
    return data;
  }

  private async verifyIntegrity(expectedCID: CID, storedContent: StoredContent): Promise<void> {
    const originalData = await this.processRetrievedData(storedContent);
    const computedHash = await this.computeHash(originalData);
    const computedCID = new SimpleCID(1, 'raw', computedHash);
    
    if (expectedCID.toString() !== computedCID.toString()) {
      throw new Error(`Content integrity verification failed: expected ${expectedCID.toString()}, got ${computedCID.toString()}`);
    }
  }

  private async storeToBackend(cid: CID, content: StoredContent): Promise<void> {
    const cidStr = cid.toString();
    
    // 存储到内存
    this.storage.set(cidStr, content);
    
    // 存储到文件系统（如果配置）
    if (this.config.storage.backend === 'filesystem' || this.config.storage.backend === 'hybrid') {
      await this.storeToFileSystem(cid, content);
    }
  }

  private async retrieveFromBackend(cid: CID): Promise<StoredContent | null> {
    const cidStr = cid.toString();
    
    // 从内存获取
    let content = this.storage.get(cidStr);
    if (content) {
      return content;
    }
    
    // 从文件系统获取
    if (this.config.storage.backend === 'filesystem' || this.config.storage.backend === 'hybrid') {
      content = await this.retrieveFromFileSystem(cid);
      if (content) {
        this.storage.set(cidStr, content); // 缓存到内存
        return content;
      }
    }
    
    return null;
  }

  private async storeToFileSystem(cid: CID, content: StoredContent): Promise<void> {
    if (!this.config.storage.basePath) return;
    
    const filePath = this.getFilePath(cid);
    const dir = path.dirname(filePath);
    
    try {
      await fs.mkdir(dir, { recursive: true });
      const serialized = JSON.stringify({
        cid: cid.toString(),
        data: Array.from(content.data),
        metadata: content.metadata,
        timestamp: content.timestamp
      });
      await fs.writeFile(filePath, serialized);
    } catch (error) {
      console.warn('Failed to store to filesystem:', error);
    }
  }

  private async retrieveFromFileSystem(cid: CID): Promise<StoredContent | null> {
    if (!this.config.storage.basePath) return null;
    
    const filePath = this.getFilePath(cid);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);
      return {
        cid: SimpleCID.parse(parsed.cid),
        data: new Uint8Array(parsed.data),
        metadata: parsed.metadata,
        timestamp: parsed.timestamp
      };
    } catch (error) {
      return null;
    }
  }

  private async existsInFileSystem(cid: CID): Promise<boolean> {
    if (!this.config.storage.basePath) return false;
    
    const filePath = this.getFilePath(cid);
    
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async deleteFromFileSystem(cid: CID): Promise<void> {
    if (!this.config.storage.basePath) return;
    
    const filePath = this.getFilePath(cid);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn('Failed to delete from filesystem:', error);
    }
  }

  private getFilePath(cid: CID): string {
    const cidStr = cid.toString();
    const prefix = cidStr.slice(0, 2);
    const suffix = cidStr.slice(2, 4);
    return path.join(this.config.storage.basePath!, prefix, suffix, cidStr);
  }
}

// 默认配置
const defaultConfig: CASConfig = {
  storage: {
    backend: 'hybrid',
    basePath: './data/cas',
    replication: 1
  },
  hashAlgorithm: HashAlgorithm.SHA256,
  compression: {
    enabled: true,
    algorithm: CompressionType.LZ4,
    threshold: 1024,
    level: 1
  },
  cache: {
    maxSize: 10000,
    maxMemory: 100 * 1024 * 1024, // 100MB
    ttl: 3600000 // 1小时
  },
  performance: {
    batchSize: 100,
    concurrency: 10,
    timeout: 30000
  }
};

// 创建默认实例
export const casClient = new EnhancedCASClient(defaultConfig);

// 向后兼容的类型和方法
export type BatchData = {
  orders?: any[];
  matches?: any[];
  balanceDiffs?: any[];
  auditLog?: any[];
};

// 向后兼容的内部存储
const legacyStorage = new Map<string, BatchData>();

// 向后兼容的简单接口
export const simpleCasClient = {

  async put(cid: string, data: BatchData): Promise<void> {
    // 对于向后兼容，我们直接存储到内部映射
    legacyStorage.set(cid, data);
    
    // 同时也存储到新的CAS系统（如果CID格式正确）
    try {
      if (cid.includes('-') && cid.split('-').length >= 4) {
        const serialized = new TextEncoder().encode(JSON.stringify(data));
        const cidObj = SimpleCID.parse(cid);
        await casClient.store(serialized, { 
          mimeType: 'application/json',
          tags: ['batch-data', 'legacy']
        });
      }
    } catch (error) {
      // 忽略CID解析错误，继续使用内部存储
      console.debug('Legacy CID format, using internal storage:', cid);
    }
  },

  async get(cid: string): Promise<BatchData | undefined> {
    // 首先尝试从内部存储获取
    const internalData = legacyStorage.get(cid);
    if (internalData) {
      return internalData;
    }

    // 然后尝试从新的CAS系统获取
    try {
      if (cid.includes('-') && cid.split('-').length >= 4) {
        const cidObj = SimpleCID.parse(cid);
        const data = await casClient.retrieve(cidObj);
        const json = new TextDecoder().decode(data);
        return JSON.parse(json);
      }
    } catch (error) {
      console.debug('Failed to retrieve from CAS, trying internal storage:', error);
    }
    
    return undefined;
  },

  async has(cid: string): Promise<boolean> {
    // 检查内部存储
    if (legacyStorage.has(cid)) {
      return true;
    }

    // 检查新的CAS系统
    try {
      if (cid.includes('-') && cid.split('-').length >= 4) {
        const cidObj = SimpleCID.parse(cid);
        return await casClient.exists(cidObj);
      }
    } catch (error) {
      console.debug('Failed to check CAS existence:', error);
    }
    
    return false;
  }
};

export { SimpleCID };
export type { CID, Multihash, StoredContent, ContentMetadata };