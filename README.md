# TitanChain - 下一代区块链平台

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/your-username/TitanChain)
[![Test Coverage](https://img.shields.io/badge/coverage-75%25-yellow.svg)](https://github.com/your-username/TitanChain)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

TitanChain是一个高性能、可扩展的区块链平台，集成了智能分片、多方计算(MPC)和先进的共识机制。

## 🚀 核心特性

- **高性能区块链核心** - 基于TypeScript构建的现代化区块链引擎
- **智能分片技术** - 动态分片提升网络吞吐量
- **多方计算(MPC)** - 保护隐私的分布式计算
- **P2P网络** - 去中心化的节点通信网络
- **RESTful API** - 完整的API接口和文档
- **API网关** - 负载均衡和服务路由
- **实时监控** - 系统健康检查和性能监控

## 📊 系统状态

**当前测试通过率：75% (6/8)**

### ✅ 已完成模块
- TypeScript编译检查
- 区块链节点启动
- API服务器 (端口3001)
- P2P网络 (端口4003)
- API网关 (端口8889)
- 系统接口测试

### ⚠️ 开发中模块
- 智能分片功能
- MPC系统

## 🛠️ 技术栈

- **后端**: TypeScript, Node.js
- **区块链**: 自研区块链引擎
- **网络**: P2P通信协议
- **API**: Express.js, Swagger文档
- **数据库**: 内存存储 + 持久化
- **测试**: Jest, 集成测试

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- TypeScript >= 4.9.0

### 安装依赖

```bash
npm install
```

### 编译项目

```bash
npm run build
```

### 启动服务

#### 1. 启动API服务器
```bash
npx tsx api/server.ts
```
服务地址: http://localhost:3001

#### 2. 启动API网关
```bash
npx tsx start-gateway.ts
```
网关地址: http://localhost:8889

#### 3. 启动P2P网络
```bash
npx tsx test-p2p-quick.ts
```
P2P端口: 4003

## 📚 API文档

启动API服务器后，访问以下地址查看完整的API文档：

- **Swagger UI**: http://localhost:3001/api/docs
- **API健康检查**: http://localhost:3001/health
- **网关健康检查**: http://localhost:8889/health

## 🔧 开发指南

### 项目结构

```
TitanChain/
├── api/                    # API服务器
│   ├── server.ts          # 主服务器文件
│   └── gateway/           # API网关
├── blockchain/            # 区块链核心
│   ├── core/             # 核心模块
│   └── network/          # P2P网络
├── mpc/                  # 多方计算系统
├── tests/                # 测试文件
└── docs/                 # 文档
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行系统集成测试
npx tsx test-system-integration.ts

# 运行API测试
npx tsx test-api-gateway.ts
```

### 开发模式

```bash
# 监听文件变化并自动重启
npm run dev
```

## 🌐 部署

### 开发环境部署

1. 克隆项目
2. 安装依赖: `npm install`
3. 编译项目: `npm run build`
4. 启动服务: 按照快速开始指南启动各个服务

### 生产环境部署

详细的生产环境部署指南请参考：
- [生产环境部署指南](PRODUCTION.md)
- [部署检查清单](DEPLOYMENT_CHECKLIST.md)

## 📈 监控和维护

### 健康检查端点

- API服务器: `GET /health`
- API网关: `GET /health`
- 系统统计: `GET /stats`

### 日志监控

所有服务都提供详细的日志输出，包括：
- 请求/响应日志
- 错误日志
- 性能指标
- 系统状态

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系我们

- 项目主页: [GitHub Repository](https://github.com/your-username/TitanChain)
- 问题反馈: [Issues](https://github.com/your-username/TitanChain/issues)
- 文档: [Wiki](https://github.com/your-username/TitanChain/wiki)

## 🎯 路线图

### 短期目标 (1-2个月)
- [ ] 完成智能分片功能实现
- [ ] 完成MPC系统开发
- [ ] 优化P2P网络性能
- [ ] 增强API网关功能

### 中期目标 (3-6个月)
- [ ] 实现跨链互操作性
- [ ] 添加智能合约支持
- [ ] 实现去中心化治理
- [ ] 性能优化和扩容

### 长期目标 (6-12个月)
- [ ] 主网上线
- [ ] 生态系统建设
- [ ] 企业级功能
- [ ] 全球化部署

---

**TitanChain** - 构建未来的区块链基础设施 🚀
