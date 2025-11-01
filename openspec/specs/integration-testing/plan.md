# 链下撮合引擎集成测试计划

## 概述
本文档定义了验证节点端链下撮合引擎的完整集成测试计划，涵盖微批处理、验证层并行化、消息总线系统、内容可寻址存储和挑战机制的端到端测试。

## 测试目标

### 功能目标
1. **端到端流程验证**：从订单接收到批次确认的完整流程
2. **性能指标达成**：50-100ms微批处理、2秒挑战窗口
3. **可靠性保证**：故障恢复、数据一致性、系统稳定性
4. **安全性验证**：挑战机制、争议解决、恶意行为防护

### 质量目标
- 功能覆盖率：≥95%
- 性能达标率：≥99%
- 故障恢复率：≥99.9%
- 安全测试通过率：100%

## 测试环境

### 硬件环境
```yaml
测试集群配置:
  节点数量: 5个验证节点 + 1个协调节点
  CPU: 8核心 3.0GHz
  内存: 32GB DDR4
  存储: 1TB NVMe SSD
  网络: 10Gbps以太网
  
负载生成器:
  CPU: 16核心 3.5GHz
  内存: 64GB DDR4
  网络: 10Gbps以太网
```

### 软件环境
```yaml
操作系统: Ubuntu 22.04 LTS
容器运行时: Docker 24.0+
编排工具: Kubernetes 1.28+
监控工具: Prometheus + Grafana
日志收集: ELK Stack
消息队列: NATS 2.10+, Kafka 3.5+
存储后端: IPFS 0.23+
```

## 测试场景

### 场景1：基础功能测试

#### 1.1 微批处理基础流程
```typescript
describe('微批处理基础流程', () => {
  test('单批次处理', async () => {
    // 准备测试数据
    const orders = generateTestOrders(100);
    
    // 提交订单到入口
    await orderGateway.submitOrders(orders);
    
    // 等待微批处理
    const batchCommit = await waitForBatchCommit(100); // 100ms超时
    
    // 验证批次内容
    expect(batchCommit.orderCount).toBe(100);
    expect(batchCommit.merkleRoot).toBeDefined();
    expect(batchCommit.cid).toBeDefined();
    
    // 验证处理时间
    expect(batchCommit.processingTime).toBeLessThan(100);
  });
  
  test('多批次并发处理', async () => {
    const batchCount = 10;
    const ordersPerBatch = 50;
    
    // 并发提交多个批次
    const promises = Array.from({ length: batchCount }, async (_, i) => {
      const orders = generateTestOrders(ordersPerBatch, i * ordersPerBatch);
      return orderGateway.submitOrders(orders);
    });
    
    await Promise.all(promises);
    
    // 验证所有批次都被处理
    const commits = await waitForBatchCommits(batchCount, 1000);
    expect(commits).toHaveLength(batchCount);
    
    // 验证批次间无冲突
    const allCIDs = commits.map(c => c.cid);
    expect(new Set(allCIDs).size).toBe(batchCount);
  });
});
```

#### 1.2 验证层并行化测试
```typescript
describe('验证层并行化', () => {
  test('并发下载验证', async () => {
    // 创建大批次数据
    const largeBatch = generateLargeBatch(1000);
    const batchCommit = await processBatch(largeBatch);
    
    // 启动多个验证节点并发下载
    const validators = await startValidatorNodes(3);
    
    const downloadPromises = validators.map(validator => 
      validator.downloadAndVerify(batchCommit.cid)
    );
    
    const results = await Promise.all(downloadPromises);
    
    // 验证所有节点都成功下载和验证
    results.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.downloadTime).toBeLessThan(500);
    });
  });
  
  test('分层验证系统', async () => {
    const batchCommit = await createTestBatchCommit();
    
    // L0层：基础验证
    const l0Result = await validator.verifyL0(batchCommit);
    expect(l0Result.valid).toBe(true);
    expect(l0Result.layer).toBe('L0');
    
    // L1层：业务逻辑验证
    const l1Result = await validator.verifyL1(batchCommit, l0Result);
    expect(l1Result.valid).toBe(true);
    expect(l1Result.layer).toBe('L1');
    
    // L2层：状态一致性验证
    const l2Result = await validator.verifyL2(batchCommit, l1Result);
    expect(l2Result.valid).toBe(true);
    expect(l2Result.layer).toBe('L2');
    
    // L3层：最终确认
    const l3Result = await validator.verifyL3(batchCommit, l2Result);
    expect(l3Result.valid).toBe(true);
    expect(l3Result.layer).toBe('L3');
  });
});
```

### 场景2：性能压力测试

#### 2.1 高并发订单处理
```typescript
describe('高并发性能测试', () => {
  test('峰值吞吐量测试', async () => {
    const testDuration = 60000; // 60秒
    const targetTPS = 10000; // 目标每秒10000笔交易
    
    const loadGenerator = new LoadGenerator({
      duration: testDuration,
      targetTPS,
      orderPattern: 'random'
    });
    
    // 启动负载生成
    const metrics = await loadGenerator.run();
    
    // 验证性能指标
    expect(metrics.actualTPS).toBeGreaterThan(targetTPS * 0.95);
    expect(metrics.averageLatency).toBeLessThan(100);
    expect(metrics.p99Latency).toBeLessThan(200);
    expect(metrics.errorRate).toBeLessThan(0.01);
  });
  
  test('批次处理延迟测试', async () => {
    const batchSizes = [10, 50, 100, 500, 1000];
    const results = [];
    
    for (const size of batchSizes) {
      const orders = generateTestOrders(size);
      const startTime = Date.now();
      
      await orderGateway.submitOrders(orders);
      const batchCommit = await waitForBatchCommit(1000);
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      results.push({ batchSize: size, latency });
      
      // 验证延迟在可接受范围内
      expect(latency).toBeLessThan(100);
    }
    
    // 分析延迟趋势
    console.log('批次处理延迟分析:', results);
  });
});
```

#### 2.2 消息总线性能测试
```typescript
describe('消息总线性能', () => {
  test('NATS高频消息测试', async () => {
    const messageCount = 100000;
    const messageBus = new NATSAdapter(natsConfig);
    
    const startTime = Date.now();
    
    // 发送消息
    const publishPromises = Array.from({ length: messageCount }, (_, i) => 
      messageBus.publish('test.topic', createTestMessage(i))
    );
    
    await Promise.all(publishPromises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    const throughput = messageCount / (duration / 1000);
    
    // 验证吞吐量
    expect(throughput).toBeGreaterThan(500000); // 50万消息/秒
  });
  
  test('消息路由性能', async () => {
    const router = new MessageRouter(messageBuses);
    const messageCount = 10000;
    
    const messages = Array.from({ length: messageCount }, (_, i) => 
      createTestMessage(i, MessagePriority.NORMAL)
    );
    
    const startTime = Date.now();
    
    await Promise.all(messages.map(msg => router.route(msg)));
    
    const endTime = Date.now();
    const routingLatency = (endTime - startTime) / messageCount;
    
    // 验证路由延迟
    expect(routingLatency).toBeLessThan(1); // 平均1ms以内
  });
});
```

### 场景3：故障恢复测试

#### 3.1 节点故障恢复
```typescript
describe('故障恢复测试', () => {
  test('验证节点故障恢复', async () => {
    // 启动5个验证节点
    const validators = await startValidatorCluster(5);
    
    // 正常处理一些批次
    await processNormalBatches(10);
    
    // 随机停止2个节点
    const failedNodes = validators.slice(0, 2);
    await Promise.all(failedNodes.map(node => node.stop()));
    
    // 继续处理批次，验证系统仍能正常工作
    const batchCommit = await processTestBatch();
    expect(batchCommit).toBeDefined();
    
    // 重启故障节点
    await Promise.all(failedNodes.map(node => node.restart()));
    
    // 验证节点能够同步状态
    await waitForNodeSync(failedNodes, 30000);
    
    // 验证所有节点状态一致
    const states = await Promise.all(validators.map(v => v.getState()));
    const firstState = states[0];
    states.forEach(state => {
      expect(state.lastBatchId).toBe(firstState.lastBatchId);
      expect(state.merkleRoot).toBe(firstState.merkleRoot);
    });
  });
  
  test('消息总线故障切换', async () => {
    const messageBus = new HybridMessageBus({
      primary: 'nats',
      fallback: ['kafka', 'rabbitmq']
    });
    
    // 正常发送消息
    await messageBus.publish('test.topic', createTestMessage());
    
    // 模拟NATS故障
    await simulateNATSFailure();
    
    // 验证自动切换到Kafka
    const message = createTestMessage();
    await messageBus.publish('test.topic', message);
    
    // 验证消息通过Kafka发送
    const receivedMessage = await waitForMessage('test.topic', 5000);
    expect(receivedMessage.id).toBe(message.id);
    
    // 恢复NATS
    await restoreNATS();
    
    // 验证切换回NATS
    await waitForPrimaryRestore(10000);
    expect(messageBus.getCurrentBackend()).toBe('nats');
  });
});
```

#### 3.2 数据一致性测试
```typescript
describe('数据一致性', () => {
  test('分区网络恢复', async () => {
    const cluster = await startValidatorCluster(5);
    
    // 创建网络分区：3个节点一组，2个节点一组
    const partition1 = cluster.slice(0, 3);
    const partition2 = cluster.slice(3, 5);
    
    await createNetworkPartition(partition1, partition2);
    
    // 在分区期间处理不同的批次
    const batch1 = await partition1[0].processBatch(generateTestOrders(100));
    const batch2 = await partition2[0].processBatch(generateTestOrders(100));
    
    // 恢复网络连接
    await healNetworkPartition();
    
    // 等待分区恢复和状态同步
    await waitForPartitionHealing(30000);
    
    // 验证最终一致性
    const finalStates = await Promise.all(cluster.map(node => node.getState()));
    const consensusState = finalStates[0];
    
    finalStates.forEach(state => {
      expect(state.lastBatchId).toBe(consensusState.lastBatchId);
      expect(state.merkleRoot).toBe(consensusState.merkleRoot);
    });
  });
});
```

### 场景4：安全性测试

#### 4.1 挑战机制测试
```typescript
describe('挑战机制安全测试', () => {
  test('恶意计算挑战', async () => {
    // 创建恶意验证节点，故意产生错误结果
    const maliciousValidator = new MaliciousValidator({
      errorType: 'computation',
      errorRate: 1.0 // 100%错误率
    });
    
    const honestValidator = new HonestValidator();
    
    // 恶意节点处理批次
    const maliciousBatch = await maliciousValidator.processBatch(generateTestOrders(100));
    
    // 诚实节点检测到错误并发起挑战
    const challenge = await honestValidator.challengeBatch(maliciousBatch);
    
    // 验证挑战窗口正确开启
    expect(challenge.windowDeadline - challenge.timestamp).toBe(2000);
    
    // 等待挑战解决
    const resolution = await waitForChallengeResolution(challenge.id, 30000);
    
    // 验证挑战成功
    expect(resolution.result).toBe(ResolutionResult.CHALLENGE_VALID);
    expect(resolution.penalties).toHaveLength(1);
    expect(resolution.penalties[0].nodeId).toBe(maliciousValidator.id);
    expect(resolution.rewards).toHaveLength(1);
    expect(resolution.rewards[0].nodeId).toBe(honestValidator.id);
  });
  
  test('数据可用性挑战', async () => {
    // 创建不提供数据的恶意节点
    const maliciousValidator = new MaliciousValidator({
      errorType: 'data_unavailability',
      hideData: true
    });
    
    // 恶意节点声称处理了批次但不提供数据
    const batchCommit = await maliciousValidator.createFakeBatchCommit();
    
    // 诚实节点尝试验证但无法获取数据
    const honestValidator = new HonestValidator();
    const challenge = await honestValidator.challengeDataAvailability(batchCommit);
    
    // 验证挑战解决
    const resolution = await waitForChallengeResolution(challenge.id, 30000);
    expect(resolution.result).toBe(ResolutionResult.CHALLENGE_VALID);
  });
  
  test('虚假挑战惩罚', async () => {
    // 创建发起虚假挑战的恶意节点
    const maliciousChallenger = new MaliciousValidator({
      errorType: 'false_challenge'
    });
    
    const honestValidator = new HonestValidator();
    
    // 诚实节点正确处理批次
    const validBatch = await honestValidator.processBatch(generateTestOrders(100));
    
    // 恶意节点发起虚假挑战
    const falseChallenge = await maliciousChallenger.createFalseChallenge(validBatch);
    
    // 等待挑战解决
    const resolution = await waitForChallengeResolution(falseChallenge.id, 30000);
    
    // 验证虚假挑战被识别并惩罚
    expect(resolution.result).toBe(ResolutionResult.CHALLENGE_INVALID);
    expect(resolution.penalties[0].nodeId).toBe(maliciousChallenger.id);
    expect(resolution.penalties[0].type).toBe(PenaltyType.FALSE_CHALLENGE);
  });
});
```

#### 4.2 共谋攻击防护测试
```typescript
describe('共谋攻击防护', () => {
  test('多节点共谋检测', async () => {
    // 创建共谋节点组
    const colludingNodes = await createColludingNodes(3);
    const honestNodes = await createHonestNodes(2);
    
    // 共谋节点尝试通过错误的批次
    const maliciousBatch = await colludingNodes[0].processBatch(generateTestOrders(100));
    
    // 其他共谋节点不发起挑战
    await Promise.all(colludingNodes.slice(1).map(node => 
      node.ignoreChallenge(maliciousBatch)
    ));
    
    // 诚实节点发起挑战
    const challenge = await honestNodes[0].challengeBatch(maliciousBatch);
    
    // 验证挑战成功，共谋被检测
    const resolution = await waitForChallengeResolution(challenge.id, 30000);
    expect(resolution.result).toBe(ResolutionResult.CHALLENGE_VALID);
    
    // 验证共谋节点都受到惩罚
    expect(resolution.penalties.length).toBeGreaterThan(1);
  });
});
```

## 测试执行计划

### 阶段1：单元测试（第1-2周）
- 微批处理器单元测试
- 验证层组件测试
- 消息总线适配器测试
- CAS客户端测试
- 挑战机制组件测试

### 阶段2：集成测试（第3-4周）
- 基础功能集成测试
- 组件间接口测试
- 数据流完整性测试
- 错误处理测试

### 阶段3：系统测试（第5-6周）
- 端到端功能测试
- 性能基准测试
- 负载压力测试
- 稳定性测试

### 阶段4：安全测试（第7-8周）
- 挑战机制安全测试
- 恶意行为模拟测试
- 共谋攻击防护测试
- 经济激励平衡测试

### 阶段5：生产就绪测试（第9-10周）
- 生产环境模拟测试
- 灾难恢复测试
- 运维流程测试
- 监控告警测试

## 测试工具和框架

### 测试框架
```typescript
// Jest + TypeScript测试配置
export const testConfig = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**'
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
};
```

### 性能测试工具
```typescript
// K6性能测试脚本
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(99)<100'],
    http_req_failed: ['rate<0.01']
  }
};

export default function() {
  const payload = JSON.stringify({
    orders: generateTestOrders(10)
  });
  
  const response = http.post('http://localhost:3000/api/orders', payload, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100
  });
}
```

## 成功标准

### 功能标准
- [ ] 所有核心功能正常工作
- [ ] 端到端流程完整无误
- [ ] 错误处理机制有效
- [ ] 数据一致性得到保证

### 性能标准
- [ ] 微批处理延迟 ≤ 100ms
- [ ] 挑战窗口精度 ± 10ms
- [ ] 系统吞吐量 ≥ 10,000 TPS
- [ ] 99%请求延迟 ≤ 200ms

### 可靠性标准
- [ ] 系统可用性 ≥ 99.9%
- [ ] 故障恢复时间 ≤ 30s
- [ ] 数据丢失率 = 0%
- [ ] 节点同步成功率 ≥ 99.9%

### 安全性标准
- [ ] 挑战机制100%有效
- [ ] 恶意行为检测率 ≥ 99%
- [ ] 虚假挑战识别率 ≥ 99%
- [ ] 共谋攻击防护有效

## 风险缓解

### 测试风险
1. **环境不稳定**：准备多套备用环境
2. **数据污染**：每次测试前重置环境
3. **时间延误**：并行执行非依赖测试
4. **资源不足**：提前申请充足的测试资源

### 质量风险
1. **覆盖率不足**：设置强制覆盖率要求
2. **边界条件遗漏**：专门设计边界测试用例
3. **并发问题**：重点测试高并发场景
4. **性能回归**：建立性能基线和监控

通过执行这个全面的集成测试计划，我们将确保链下撮合引擎的质量、性能和安全性达到生产环境的要求。