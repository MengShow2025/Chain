# TitanChain 开发文档 - 最终版

## 1. 项目概述

TitanChain是一个高性能区块链项目，采用现代化的技术栈和模块化架构设计。项目包含区块链核心、API服务、前端界面、安全系统等多个模块，支持高并发交易处理和企业级安全防护。

### 1.1 技术栈

- **前端**: React 18 + TypeScript + TailwindCSS + Vite
- **后端**: Node.js + Express + TypeScript
- **区块链**: 自研TitanChain核心引擎
- **数据库**: PostgreSQL + Redis
- **安全**: MPC + TEE + 量子抗性密码学
- **工具**: ESLint + Jest + Docker

### 1.2 项目特点

- **高性能**: 目标20万TPS，当前测试5万TPS
- **低延迟**: 目标<100ms，当前平均3秒
- **安全可靠**: 多层次安全防护体系
- **模块化**: 清晰的模块划分和接口设计
- **可扩展**: 支持水平扩展和功能扩展

## 2. 项目结构

```
TitanChain/
├── api/                          # API服务层
│   ├── app.ts                   # Express应用配置
│   ├── server.ts                # 服务器启动文件
│   ├── blockchain/              # 区块链API
│   ├── explorer/                # 浏览器API
│   ├── gateway/                 # API网关
│   ├── matching/                # 撮合引擎API
│   ├── routes/                  # 路由定义
│   ├── security/                # 安全API
│   ├── transactions/            # 交易API
│   ├── validators/              # 验证节点API
│   └── wallet/                  # 钱包API
├── blockchain/                   # 区块链核心层
│   ├── consensus/               # 共识机制
│   ├── contracts/               # 智能合约
│   ├── core/                    # 核心组件
│   ├── evm/                     # EVM执行引擎
│   ├── gas/                     # Gas机制
│   ├── matching/                # 撮合引擎
│   ├── messaging/               # 消息系统
│   ├── monitoring/              # 监控系统
│   ├── optimization/            # 性能优化
│   ├── performance/             # 性能处理
│   ├── rewards/                 # 奖励系统
│   ├── sharding/                # 分片机制
│   ├── validation/              # 验证系统
│   └── validators/              # 验证节点
├── shared/                       # 共享模块
│   ├── constants/               # 常量定义
│   ├── da/                      # 数据可用性
│   ├── security/                # 安全模块
│   ├── types/                   # 类型定义
│   └── utils/                   # 工具函数
├── src/                         # 前端源码
│   ├── components/              # React组件
│   ├── hooks/                   # React Hooks
│   ├── pages/                   # 页面组件
│   ├── utils/                   # 前端工具
│   └── App.tsx                  # 主应用组件
├── tests/                       # 测试文件
│   ├── integration/             # 集成测试
│   └── performance/             # 性能测试
├── package.json                 # 项目配置
├── tsconfig.json               # TypeScript配置
├── vite.config.ts              # Vite配置
├── docker-compose.yml          # Docker编排
└── README.md                   # 项目说明
```

## 3. 开发环境配置

### 3.1 环境要求

- **Node.js**: v18.0.0 或更高版本
- **npm**: v8.0.0 或更高版本
- **Docker**: v20.0.0 或更高版本
- **PostgreSQL**: v14.0 或更高版本
- **Redis**: v6.0 或更高版本

### 3.2 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/your-org/titanchain.git
cd titanchain
```

2. **安装依赖**
```bash
npm install
```

3. **环境配置**
```bash
cp .env.example .env
# 编辑.env文件，配置数据库连接等参数
```

4. **数据库初始化**
```bash
# 启动PostgreSQL和Redis
docker-compose up -d postgres redis

# 运行数据库迁移
npm run db:migrate
```

5. **启动开发服务**
```bash
# 启动前端开发服务
npm run client:dev

# 启动API服务
npm run server:dev

# 启动区块链节点
npm run blockchain:dev

# 或者一键启动所有服务
npm run dev:full
```

### 3.3 开发工具配置

**VSCode配置** (`.vscode/settings.json`)
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.ts": "typescript",
    "*.tsx": "typescriptreact"
  }
}
```

**ESLint配置** (`eslint.config.js`)
```javascript
import js from '@eslint/js';
import typescript from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
];
```

## 4. 核心模块说明

### 4.1 区块链核心模块

**TitanChain主链** (`blockchain/core/blockchain.ts`)
```typescript
/**
 * TitanChain主链核心 / TitanChain Core Blockchain
 * 高性能PoS共识机制和EVM兼容执行环境
 * High-performance PoS consensus and EVM-compatible execution environment
 */
export class TitanChain {
  private consensusEngine: PoSConsensus;
  private validatorManager: ValidatorManager;
  private evmEngine: EVMExecutor;
  private transactionPool: TransactionPool;
  private blockValidator: BlockValidator;
  private zeroGasEngine: ZeroGasEngine;
  private performanceProcessor: HighPerformanceProcessor;

  constructor(config: BlockchainConfig) {
    // 初始化各个组件 / Initialize components
    this.consensusEngine = new PoSConsensus(config.consensus);
    this.validatorManager = new ValidatorManager(config.validators);
    this.evmEngine = new EVMExecutor(config.evm);
    // ...
  }

  /**
   * 启动区块链节点 / Start blockchain node
   */
  async start(): Promise<void> {
    await this.consensusEngine.start();
    await this.validatorManager.start();
    await this.evmEngine.start();
    // ...
  }
}
```

**混合双区块处理器** (`blockchain/core/dual-block-processor.ts`)
```typescript
/**
 * 混合双区块处理器 / Hybrid Dual-Block Processor
 * 支持快速区块(1秒)和批量区块(5秒)的混合处理
 * Supports hybrid processing of fast blocks (1s) and batch blocks (5s)
 */
export class DualBlockProcessor {
  private fastBlockProcessor: FastBlockProcessor;
  private batchBlockProcessor: BatchBlockProcessor;
  private transactionRouter: TransactionRouter;

  /**
   * 处理交易 / Process transaction
   * 根据交易复杂度选择处理链路
   * Route transaction based on complexity
   */
  async processTransaction(tx: Transaction): Promise<ProcessResult> {
    const complexity = this.analyzeComplexity(tx);
    
    if (complexity === 'simple') {
      return this.fastBlockProcessor.process(tx);
    } else {
      return this.batchBlockProcessor.process(tx);
    }
  }
}
```

### 4.2 保证金交易模块

**保证金交易引擎** (`api/routes/margin.ts`)
```typescript
/**
 * 保证金交易API路由 / Margin Trading API Routes
 * 提供杠杆交易、持仓管理、风险控制等功能
 * Provides leverage trading, position management, risk control
 */
import { MarginTradingEngine } from '../services/margin-trading-engine.js';
import { RiskManager } from '../services/risk-manager.js';
import { VIPManager } from '../services/vip-manager.js';

const router = express.Router();

/**
 * 创建杠杆订单 / Create leverage order
 */
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const { tradingPair, side, quantity, leverage, orderType } = req.body;
    const userAddress = req.user.address;

    // 检查VIP等级和杠杆限制 / Check VIP level and leverage limits
    const vipLevel = await VIPManager.getVIPLevel(userAddress);
    const maxLeverage = VIPManager.getMaxLeverage(vipLevel);
    
    if (leverage > maxLeverage) {
      return res.status(400).json({ error: 'Leverage exceeds limit' });
    }

    // 风险检查 / Risk check
    const riskCheck = await RiskManager.checkRisk(userAddress, {
      tradingPair, side, quantity, leverage
    });
    
    if (!riskCheck.passed) {
      return res.status(400).json({ error: riskCheck.reason });
    }

    // 创建订单 / Create order
    const order = await MarginTradingEngine.createOrder({
      user: userAddress,
      tradingPair,
      side,
      quantity,
      leverage,
      orderType
    });

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4.3 安全防护模块

**MPC多方计算系统** (`shared/security/mpc/mpc-system.ts`)
```typescript
/**
 * TitanChain MPC系统核心实现 / TitanChain MPC System Core Implementation
 * 统一管理多方安全计算协议 / Unified management of multi-party secure computation protocols
 */
export class MPCSystem extends EventEmitter implements IMPCSystem {
  private shamirSSS: ShamirSecretSharing;
  private garbledCircuits: GarbledCircuits;
  private thresholdSig: ThresholdSignature;
  private coordinator: MPCCoordinator;

  constructor(config: MPCConfig) {
    super();
    this.shamirSSS = new ShamirSecretSharing(config.shamir);
    this.garbledCircuits = new GarbledCircuits(config.garbled);
    this.thresholdSig = new ThresholdSignature(config.threshold);
    this.coordinator = new MPCCoordinator(config.coordinator);
  }

  /**
   * 创建MPC会话 / Create MPC session
   */
  async createSession(participants: MPCParticipant[], protocol: MPCProtocol): Promise<MPCSession> {
    const sessionId = this.generateSessionId();
    const session = await this.coordinator.createSession({
      id: sessionId,
      participants,
      protocol,
      createdAt: Date.now()
    });

    this.emit('sessionCreated', session);
    return session;
  }
}
```

## 5. API接口文档

### 5.1 认证机制

所有API请求需要在Header中包含认证信息：

```http
Authorization: Bearer <JWT_TOKEN>
X-API-Key: <API_KEY>
Content-Type: application/json
```

### 5.2 响应格式

统一的API响应格式：

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
  requestId: string;
}
```

### 5.3 核心API接口

**区块链数据API**

```http
# 获取网络统计
GET /api/v1/network/stats

# 获取区块信息
GET /api/v1/blocks/:blockNumber

# 获取交易信息
GET /api/v1/transactions/:txHash

# 获取地址信息
GET /api/v1/addresses/:address
```

**保证金交易API**

```http
# 获取保证金账户
GET /api/v1/margin/account

# 创建杠杆订单
POST /api/v1/margin/orders

# 获取持仓列表
GET /api/v1/margin/positions

# 平仓操作
POST /api/v1/margin/positions/:id/close
```

**VIP系统API**

```http
# 获取VIP信息
GET /api/v1/vip/info

# 升级VIP等级
POST /api/v1/vip/upgrade

# 获取VIP权益
GET /api/v1/vip/benefits
```

## 6. 测试体系

### 6.1 测试分类

- **单元测试**: 测试单个函数和类的功能
- **集成测试**: 测试模块间的交互
- **性能测试**: 测试系统性能指标
- **安全测试**: 测试安全防护能力
- **端到端测试**: 测试完整业务流程

### 6.2 测试命令

```bash
# 运行所有测试
npm run test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行性能测试
npm run test:performance

# 运行安全测试
npm run test:security

# 生成测试覆盖率报告
npm run test:coverage
```

### 6.3 测试示例

**单元测试示例** (`tests/unit/blockchain.test.ts`)
```typescript
import { TitanChain } from '../../blockchain/core/blockchain';
import { BlockchainConfig } from '../../shared/types/blockchain';

describe('TitanChain', () => {
  let blockchain: TitanChain;
  let config: BlockchainConfig;

  beforeEach(() => {
    config = {
      consensus: { /* ... */ },
      validators: { /* ... */ },
      evm: { /* ... */ }
    };
    blockchain = new TitanChain(config);
  });

  test('should initialize correctly', () => {
    expect(blockchain).toBeDefined();
    expect(blockchain.getStatus()).toBe('initialized');
  });

  test('should process transactions', async () => {
    await blockchain.start();
    
    const tx = createTestTransaction();
    const result = await blockchain.processTransaction(tx);
    
    expect(result.success).toBe(true);
    expect(result.txHash).toBeDefined();
  });
});
```

**性能测试示例** (`tests/performance/tps-test.ts`)
```typescript
/**
 * TPS性能测试 / TPS Performance Test
 * 验证系统TPS和延迟指标 / Verify system TPS and latency metrics
 */
import { TitanChain } from '../../blockchain/core/blockchain';
import { PerformanceMonitor } from '../../shared/utils/performance-monitor';

describe('TPS Performance Test', () => {
  test('should achieve target TPS', async () => {
    const blockchain = new TitanChain(testConfig);
    const monitor = new PerformanceMonitor();
    
    await blockchain.start();
    monitor.start();

    // 发送大量交易 / Send massive transactions
    const transactions = generateTestTransactions(10000);
    const startTime = Date.now();
    
    for (const tx of transactions) {
      await blockchain.processTransaction(tx);
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const tps = transactions.length / duration;
    
    expect(tps).toBeGreaterThan(10000); // 期望TPS > 10k
    
    const metrics = monitor.getMetrics();
    expect(metrics.averageLatency).toBeLessThan(1000); // 期望延迟 < 1s
  });
});
```

## 7. 代码规范

### 7.1 命名规范

- **文件名**: 使用kebab-case，如`margin-trading-engine.ts`
- **类名**: 使用PascalCase，如`MarginTradingEngine`
- **函数名**: 使用camelCase，如`processTransaction`
- **常量**: 使用UPPER_SNAKE_CASE，如`MAX_LEVERAGE`
- **接口**: 使用PascalCase，前缀I，如`IMarginAccount`

### 7.2 注释规范

**必须使用英文和中文双语注释**，格式如下：

```typescript
/**
 * 处理保证金交易订单 / Process margin trading order
 * 
 * @param order 订单信息 / Order information
 * @param user 用户地址 / User address
 * @returns 处理结果 / Processing result
 */
async function processMarginOrder(order: MarginOrder, user: string): Promise<ProcessResult> {
  // 验证订单参数 / Validate order parameters
  if (!this.validateOrder(order)) {
    throw new Error('Invalid order parameters / 无效的订单参数');
  }

  // 检查用户余额 / Check user balance
  const balance = await this.getUserBalance(user);
  if (balance < order.marginRequired) {
    throw new Error('Insufficient balance / 余额不足');
  }

  // 执行订单 / Execute order
  return await this.executeOrder(order);
}
```

### 7.3 错误处理

```typescript
// 自定义错误类 / Custom error classes
export class MarginTradingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MarginTradingError';
  }
}

// 错误处理示例 / Error handling example
try {
  const result = await processMarginOrder(order, user);
  return { success: true, data: result };
} catch (error) {
  if (error instanceof MarginTradingError) {
    // 业务错误 / Business error
    return { success: false, error: { code: error.code, message: error.message } };
  } else {
    // 系统错误 / System error
    console.error('Unexpected error:', error);
    return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } };
  }
}
```

### 7.4 类型定义

```typescript
// 使用严格的类型定义 / Use strict type definitions
interface MarginOrder {
  readonly id: string;                    // 订单ID / Order ID
  readonly user: string;                  // 用户地址 / User address
  readonly tradingPair: string;           // 交易对 / Trading pair
  readonly side: 'buy' | 'sell';          // 买卖方向 / Order side
  readonly quantity: bigint;              // 数量 / Quantity
  readonly leverage: number;              // 杠杆倍数 / Leverage
  readonly marginRequired: bigint;        // 所需保证金 / Required margin
  readonly timestamp: number;             // 时间戳 / Timestamp
}

// 使用联合类型和字面量类型 / Use union types and literal types
type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
```

## 8. 部署指南

### 8.1 开发环境部署

```bash
# 克隆项目 / Clone project
git clone https://github.com/your-org/titanchain.git
cd titanchain

# 安装依赖 / Install dependencies
npm install

# 启动开发服务 / Start development services
npm run dev:full
```

### 8.2 生产环境部署

```bash
# 构建项目 / Build project
npm run build:prod

# 启动生产服务 / Start production services
npm run start:prod
```

### 8.3 Docker部署

```bash
# 构建Docker镜像 / Build Docker image
npm run docker:build

# 启动Docker容器 / Start Docker containers
npm run docker:run

# 查看日志 / View logs
npm run docker:logs
```

## 9. 贡献指南

### 9.1 开发流程

1. **Fork项目** 到个人仓库
2. **创建功能分支** `git checkout -b feature/new-feature`
3. **编写代码** 并遵循代码规范
4. **编写测试** 确保测试覆盖率
5. **提交代码** `git commit -m "feat: add new feature"`
6. **推送分支** `git push origin feature/new-feature`
7. **创建PR** 并等待代码审查

### 9.2 提交规范

使用Conventional Commits规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

类型说明：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建工具或辅助工具的变动

### 9.3 代码审查

所有PR需要通过以下检查：
- [ ] 代码符合规范
- [ ] 测试通过
- [ ] 文档更新
- [ ] 性能影响评估
- [ ] 安全性检查

## 10. 常见问题

### 10.1 开发环境问题

**Q: npm install失败**
A: 检查Node.js版本，确保使用v18+，清除npm缓存后重试

**Q: 数据库连接失败**
A: 检查PostgreSQL和Redis是否启动，确认连接配置正确

**Q: 前端页面空白**
A: 检查控制台错误，确认API服务是否正常运行

### 10.2 性能问题

**Q: TPS达不到预期**
A: 检查数据库连接池配置，优化查询语句，考虑增加缓存

**Q: 内存使用过高**
A: 检查是否有内存泄漏，优化大对象的使用，调整垃圾回收参数

### 10.3 安全问题

**Q: 如何确保私钥安全**
A: 使用TEE或MPC技术保护私钥，永远不要在代码中硬编码私钥

**Q: 如何防止重放攻击**
A: 使用nonce机制和时间戳验证，确保每个交易的唯一性