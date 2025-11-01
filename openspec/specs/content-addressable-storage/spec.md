# 内容可寻址存储（DA）技术规范

## 概述
内容可寻址存储（Content Addressable Storage, CAS）是链下撮合引擎的数据持久化层，提供基于内容哈希的去中心化存储服务，确保数据完整性、可验证性和高可用性。

## 架构设计

### 整体架构
```
应用层 → CAS客户端 → 存储网络 → 分布式节点
   ↓        ↓         ↓         ↓
 数据请求  哈希计算   路由分发   副本存储
```

### 核心组件

#### 1. CAS客户端
- **功能**：数据上传、下载、验证
- **接口**：统一的存储API
- **优化**：本地缓存、批量操作

#### 2. 哈希计算引擎
- **算法**：SHA-256、Blake3（可配置）
- **性能**：并行计算、硬件加速
- **验证**：内容完整性校验

#### 3. 存储网络
- **协议**：IPFS、Arweave、自定义协议
- **路由**：DHT路由、就近访问
- **冗余**：多副本存储

#### 4. 元数据管理
- **索引**：CID到位置的映射
- **缓存**：热点数据缓存
- **清理**：过期数据清理

## 功能需求

### 核心功能
1. **内容存储**：基于内容哈希的唯一标识存储
2. **内容检索**：通过CID快速检索内容
3. **完整性验证**：自动验证内容完整性
4. **版本管理**：支持内容版本控制
5. **访问控制**：基于权限的访问控制

### 性能要求
- 存储延迟：≤100ms (小文件), ≤1s (大文件)
- 检索延迟：≤50ms (缓存命中), ≤200ms (网络检索)
- 吞吐量：≥10MB/s (单节点)
- 可用性：≥99.9%
- 数据持久性：≥99.999%

## 技术设计

### 数据结构

```typescript
interface CID {
  version: number;
  codec: string;
  multihash: Multihash;
}

interface Multihash {
  algorithm: HashAlgorithm;
  digest: Uint8Array;
  length: number;
}

interface StoredContent {
  cid: CID;
  data: Uint8Array;
  metadata: ContentMetadata;
  timestamp: number;
}

interface ContentMetadata {
  size: number;
  mimeType?: string;
  encoding?: string;
  compression?: CompressionType;
  encryption?: EncryptionInfo;
  tags?: string[];
  ttl?: number;
}

enum HashAlgorithm {
  SHA256 = 'sha2-256',
  BLAKE3 = 'blake3',
  KECCAK256 = 'keccak-256'
}

enum CompressionType {
  NONE = 'none',
  GZIP = 'gzip',
  BROTLI = 'brotli',
  LZ4 = 'lz4'
}
```

### CAS客户端接口

```typescript
interface ICASClient {
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

interface SearchQuery {
  tags?: string[];
  mimeType?: string;
  sizeRange?: [number, number];
  timeRange?: [number, number];
  limit?: number;
  offset?: number;
}

interface SearchResult {
  cid: CID;
  metadata: ContentMetadata;
  score: number;
}
```

### 核心实现

```typescript
class CASClient implements ICASClient {
  private storage: IStorageBackend;
  private hasher: IHasher;
  private cache: ICache;
  private compressor: ICompressor;
  private encryptor?: IEncryptor;
  
  constructor(private config: CASConfig) {
    this.storage = this.createStorageBackend(config.storage);
    this.hasher = new MultiHasher(config.hashAlgorithm);
    this.cache = new LRUCache(config.cache);
    this.compressor = new MultiCompressor();
    
    if (config.encryption?.enabled) {
      this.encryptor = new AESEncryptor(config.encryption);
    }
  }
  
  async store(data: Uint8Array, metadata?: ContentMetadata): Promise<CID> {
    // 1. 预处理数据
    let processedData = data;
    const finalMetadata: ContentMetadata = {
      size: data.length,
      ...metadata
    };
    
    // 2. 压缩（如果启用）
    if (this.config.compression.enabled && data.length > this.config.compression.threshold) {
      const compressed = await this.compressor.compress(data, this.config.compression.algorithm);
      if (compressed.length < data.length * 0.9) { // 只有压缩效果好才使用
        processedData = compressed;
        finalMetadata.compression = this.config.compression.algorithm;
      }
    }
    
    // 3. 加密（如果启用）
    if (this.encryptor) {
      const encrypted = await this.encryptor.encrypt(processedData);
      processedData = encrypted.data;
      finalMetadata.encryption = encrypted.info;
    }
    
    // 4. 计算CID
    const hash = await this.hasher.hash(data); // 注意：基于原始数据计算哈希
    const cid = this.createCID(hash);
    
    // 5. 检查是否已存在
    if (await this.exists(cid)) {
      return cid;
    }
    
    // 6. 存储到后端
    const storedContent: StoredContent = {
      cid,
      data: processedData,
      metadata: finalMetadata,
      timestamp: Date.now()
    };
    
    await this.storage.put(cid, storedContent);
    
    // 7. 更新缓存
    this.cache.set(cid.toString(), storedContent);
    
    // 8. 更新统计
    this.updateStats('store', data.length);
    
    return cid;
  }
  
  async retrieve(cid: CID): Promise<Uint8Array> {
    // 1. 检查缓存
    const cached = this.cache.get(cid.toString());
    if (cached) {
      return this.processRetrievedData(cached);
    }
    
    // 2. 从存储后端获取
    const storedContent = await this.storage.get(cid);
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
    this.updateStats('retrieve', data.length);
    
    return data;
  }
  
  private async processRetrievedData(storedContent: StoredContent): Promise<Uint8Array> {
    let data = storedContent.data;
    
    // 1. 解密
    if (storedContent.metadata.encryption && this.encryptor) {
      data = await this.encryptor.decrypt(data, storedContent.metadata.encryption);
    }
    
    // 2. 解压缩
    if (storedContent.metadata.compression && storedContent.metadata.compression !== CompressionType.NONE) {
      data = await this.compressor.decompress(data, storedContent.metadata.compression);
    }
    
    return data;
  }
  
  private async verifyIntegrity(expectedCID: CID, storedContent: StoredContent): Promise<void> {
    // 重新计算原始数据的哈希
    const originalData = await this.processRetrievedData(storedContent);
    const computedHash = await this.hasher.hash(originalData);
    const computedCID = this.createCID(computedHash);
    
    if (!this.cidEquals(expectedCID, computedCID)) {
      throw new Error(`Content integrity verification failed: expected ${expectedCID.toString()}, got ${computedCID.toString()}`);
    }
  }
  
  async storeBatch(items: Array<{data: Uint8Array, metadata?: ContentMetadata}>): Promise<CID[]> {
    const results: CID[] = [];
    const batchOperations: Array<{cid: CID, content: StoredContent}> = [];
    
    // 1. 并行处理所有项目
    const processPromises = items.map(async (item, index) => {
      const cid = await this.preprocessForBatch(item.data, item.metadata);
      return { index, cid, item };
    });
    
    const processed = await Promise.all(processPromises);
    
    // 2. 准备批量存储
    for (const { index, cid, item } of processed) {
      if (!(await this.exists(cid))) {
        const storedContent = await this.createStoredContent(cid, item.data, item.metadata);
        batchOperations.push({ cid, content: storedContent });
      }
      results[index] = cid;
    }
    
    // 3. 批量存储
    if (batchOperations.length > 0) {
      await this.storage.putBatch(batchOperations.map(op => [op.cid, op.content]));
      
      // 4. 更新缓存
      for (const { cid, content } of batchOperations) {
        this.cache.set(cid.toString(), content);
      }
    }
    
    return results;
  }
}
```

### 存储后端适配器

```typescript
interface IStorageBackend {
  put(cid: CID, content: StoredContent): Promise<void>;
  get(cid: CID): Promise<StoredContent | null>;
  delete(cid: CID): Promise<void>;
  exists(cid: CID): Promise<boolean>;
  putBatch(items: Array<[CID, StoredContent]>): Promise<void>;
  getBatch(cids: CID[]): Promise<Map<CID, StoredContent>>;
  list(prefix?: string, limit?: number): Promise<CID[]>;
  getStats(): Promise<StorageStats>;
}

// IPFS适配器
class IPFSStorageBackend implements IStorageBackend {
  private ipfs: IPFS;
  
  constructor(private config: IPFSConfig) {
    this.ipfs = create(config);
  }
  
  async put(cid: CID, content: StoredContent): Promise<void> {
    const serialized = this.serialize(content);
    await this.ipfs.add(serialized, { cidVersion: 1 });
  }
  
  async get(cid: CID): Promise<StoredContent | null> {
    try {
      const chunks = [];
      for await (const chunk of this.ipfs.cat(cid.toString())) {
        chunks.push(chunk);
      }
      const data = new Uint8Array(Buffer.concat(chunks));
      return this.deserialize(data);
    } catch (error) {
      if (error.code === 'ERR_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }
  
  private serialize(content: StoredContent): Uint8Array {
    return new TextEncoder().encode(JSON.stringify({
      cid: content.cid.toString(),
      data: Array.from(content.data),
      metadata: content.metadata,
      timestamp: content.timestamp
    }));
  }
  
  private deserialize(data: Uint8Array): StoredContent {
    const json = JSON.parse(new TextDecoder().decode(data));
    return {
      cid: CID.parse(json.cid),
      data: new Uint8Array(json.data),
      metadata: json.metadata,
      timestamp: json.timestamp
    };
  }
}

// 本地文件系统适配器
class FileSystemStorageBackend implements IStorageBackend {
  constructor(private basePath: string) {}
  
  async put(cid: CID, content: StoredContent): Promise<void> {
    const filePath = this.getFilePath(cid);
    await fs.ensureDir(path.dirname(filePath));
    
    const serialized = this.serialize(content);
    await fs.writeFile(filePath, serialized);
  }
  
  async get(cid: CID): Promise<StoredContent | null> {
    const filePath = this.getFilePath(cid);
    
    try {
      const data = await fs.readFile(filePath);
      return this.deserialize(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
  
  private getFilePath(cid: CID): string {
    const cidStr = cid.toString();
    // 使用前缀分片避免单个目录文件过多
    const prefix = cidStr.slice(0, 2);
    const suffix = cidStr.slice(2, 4);
    return path.join(this.basePath, prefix, suffix, cidStr);
  }
}
```

### 缓存系统

```typescript
class LRUCache implements ICache {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];
  
  constructor(private maxSize: number, private maxMemory: number) {}
  
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
    return content.data.length + JSON.stringify(content.metadata).length + 100; // 估算开销
  }
}
```

## 配置管理

### 配置结构

```typescript
interface CASConfig {
  storage: StorageConfig;
  hashAlgorithm: HashAlgorithm;
  compression: CompressionConfig;
  encryption?: EncryptionConfig;
  cache: CacheConfig;
  performance: PerformanceConfig;
}

interface StorageConfig {
  backend: 'ipfs' | 'filesystem' | 'hybrid';
  ipfs?: IPFSConfig;
  filesystem?: FileSystemConfig;
  replication: number;
}

interface CompressionConfig {
  enabled: boolean;
  algorithm: CompressionType;
  threshold: number; // 最小压缩文件大小
  level: number; // 压缩级别
}

interface CacheConfig {
  maxSize: number; // 最大缓存项数
  maxMemory: number; // 最大内存使用量（字节）
  ttl: number; // 缓存过期时间（毫秒）
}
```

### 配置示例

```json
{
  "cas": {
    "storage": {
      "backend": "hybrid",
      "ipfs": {
        "api": "/ip4/127.0.0.1/tcp/5001",
        "gateway": "http://127.0.0.1:8080"
      },
      "filesystem": {
        "basePath": "./data/cas"
      },
      "replication": 3
    },
    
    "hashAlgorithm": "blake3",
    
    "compression": {
      "enabled": true,
      "algorithm": "lz4",
      "threshold": 1024,
      "level": 1
    },
    
    "cache": {
      "maxSize": 10000,
      "maxMemory": 1073741824,
      "ttl": 3600000
    },
    
    "performance": {
      "batchSize": 100,
      "concurrency": 10,
      "timeout": 30000
    }
  }
}
```

## 监控和告警

### 关键指标
- 存储和检索延迟
- 缓存命中率
- 存储空间使用率
- 数据完整性验证成功率
- 网络传输速度

### 告警规则
- 存储延迟超过阈值
- 缓存命中率过低
- 存储空间不足
- 数据完整性验证失败
- 网络连接异常

## 测试策略

### 单元测试
- CID生成和验证
- 数据压缩和加密
- 缓存逻辑测试
- 存储后端适配器测试

### 集成测试
- 端到端存储和检索
- 多后端协同测试
- 故障恢复测试
- 数据一致性测试

### 性能测试
- 大文件存储性能
- 高并发访问测试
- 缓存性能测试
- 网络延迟测试