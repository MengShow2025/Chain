# TitanChain GitHub 同步和版本控制指南

## 📋 目录
1. [GitHub仓库创建和初始化](#1-github仓库创建和初始化)
2. [项目文件准备](#2-项目文件准备)
3. [分支管理策略](#3-分支管理策略)
4. [自动化CI/CD配置](#4-自动化cicd配置)
5. [协作开发配置](#5-协作开发配置)
6. [安全最佳实践](#6-安全最佳实践)

---

## 1. GitHub仓库创建和初始化

### 1.1 在GitHub上创建新仓库

#### 步骤1：登录GitHub并创建仓库
1. 访问 [GitHub](https://github.com) 并登录
2. 点击右上角的 "+" 按钮，选择 "New repository"
3. 填写仓库信息：
   - **Repository name**: `TitanChain`
   - **Description**: `A high-performance blockchain platform with zero gas fees and PoS consensus`
   - **Visibility**: 选择 Public 或 Private
   - **不要**勾选 "Initialize this repository with a README"（因为本地已有项目）

#### 步骤2：本地Git仓库初始化

```bash
# 进入项目目录
cd /Volumes/Samsung\ SSD\ 990/桌面文件/vip/TitanChain

# 检查是否已经是Git仓库
git status

# 如果不是Git仓库，初始化
git init

# 添加远程仓库（替换为您的GitHub用户名）
git remote add origin https://github.com/YOUR_USERNAME/TitanChain.git

# 验证远程仓库配置
git remote -v
```

### 1.2 首次推送设置

```bash
# 添加所有文件到暂存区
git add .

# 创建初始提交
git commit -m "🎉 Initial commit: TitanChain blockchain platform

- Complete blockchain core implementation
- Frontend React application with multi-language support
- Backend API with Express.js
- Comprehensive testing suite
- Documentation and deployment guides"

# 设置主分支名称
git branch -M main

# 首次推送到GitHub
git push -u origin main
```

---

## 2. 项目文件准备

### 2.1 .gitignore 文件配置

创建或更新 `.gitignore` 文件：

```gitignore
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Production builds
dist/
build/
.next/
out/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Blockchain specific
blockchain/data/
blockchain/logs/
blockchain/keystore/
*.key
*.pem
wallet.dat

# Database
*.db
*.sqlite
*.sqlite3

# Cache
.cache/
.parcel-cache/
.eslintcache

# Temporary folders
tmp/
temp/

# Lock files (keep pnpm-lock.yaml for consistency)
package-lock.json
yarn.lock

# Test results
test-results/
coverage/
```

### 2.2 敏感信息处理

#### 创建 `.env.example` 文件：

```bash
# 创建环境变量模板
cat > .env.example << 'EOF'
# 数据库配置
DATABASE_URL=postgresql://username:password@localhost:5432/titanchain
REDIS_URL=redis://localhost:6379

# 区块链配置
BLOCKCHAIN_NETWORK=testnet
GENESIS_BLOCK_HASH=your_genesis_hash_here
VALIDATOR_PRIVATE_KEY=your_validator_private_key_here

# API配置
API_PORT=3001
API_SECRET_KEY=your_secret_key_here
JWT_SECRET=your_jwt_secret_here

# 前端配置
VITE_API_BASE_URL=http://localhost:3001
VITE_BLOCKCHAIN_RPC_URL=http://localhost:8545

# 外部服务
INFURA_PROJECT_ID=your_infura_project_id
ALCHEMY_API_KEY=your_alchemy_api_key
EOF
```

#### 安全检查脚本：

```bash
# 创建安全检查脚本
cat > scripts/security-check.sh << 'EOF'
#!/bin/bash

echo "🔍 检查敏感信息..."

# 检查是否有私钥泄露
if grep -r "private.*key" --include="*.ts" --include="*.js" --include="*.json" . | grep -v node_modules | grep -v ".example"; then
    echo "⚠️  警告：发现可能的私钥泄露"
    exit 1
fi

# 检查是否有密码硬编码
if grep -r "password.*=" --include="*.ts" --include="*.js" . | grep -v node_modules | grep -v ".example"; then
    echo "⚠️  警告：发现可能的密码硬编码"
    exit 1
fi

echo "✅ 安全检查通过"
EOF

chmod +x scripts/security-check.sh
```

### 2.3 README.md 文件完善

```markdown
# TitanChain 🚀

> A high-performance blockchain platform with zero gas fees and Proof-of-Stake consensus

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue)](https://www.typescriptlang.org/)

## ✨ 特性

- 🚀 **零Gas费用**: 创新的零Gas费用机制
- ⚡ **高性能**: 支持高TPS的区块链处理
- 🔒 **PoS共识**: 安全高效的权益证明机制
- 🌐 **多语言支持**: 支持6种语言的国际化界面
- 📱 **响应式设计**: 完美适配桌面和移动设备
- 🔧 **开发者友好**: 完整的API和SDK支持

## 🏗️ 技术架构

- **前端**: React 18 + TypeScript + Tailwind CSS
- **后端**: Node.js + Express + TypeScript
- **数据库**: PostgreSQL + Redis
- **区块链**: 自研PoS共识算法
- **部署**: Docker + Vercel

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- PostgreSQL >= 13
- Redis >= 6.0
- Git

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/YOUR_USERNAME/TitanChain.git
   cd TitanChain
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **环境配置**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填入您的配置
   ```

4. **启动开发服务器**
   ```bash
   # 启动前端
   pnpm run client:dev
   
   # 启动后端
   pnpm run server:dev
   ```

5. **访问应用**
   - 前端: http://localhost:5173
   - 后端API: http://localhost:3001

## 📖 文档

- [部署教程](/.trae/documents/TitanChain完整部署教程.md)
- [技术架构文档](/.trae/documents/TitanChain_技术架构文档.md)
- [产品需求文档](/.trae/documents/TitanChain_PRD.md)

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细信息。

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👥 团队

- **项目负责人**: [Your Name](https://github.com/YOUR_USERNAME)

## 🙏 致谢

感谢所有为TitanChain项目做出贡献的开发者们！

---

⭐ 如果这个项目对您有帮助，请给我们一个星标！
```

### 2.4 许可证添加

```bash
# 创建MIT许可证文件
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2024 TitanChain

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

---

## 3. 分支管理策略

### 3.1 Git Flow 工作流程

#### 主要分支设置：

```bash
# 创建并切换到develop分支
git checkout -b develop
git push -u origin develop

# 创建功能分支示例
git checkout -b feature/wallet-integration develop
git checkout -b feature/consensus-optimization develop

# 创建发布分支
git checkout -b release/v1.0.0 develop

# 创建热修复分支
git checkout -b hotfix/critical-bug main
```

#### 分支命名规范：

- `main`: 生产环境分支
- `develop`: 开发环境分支
- `feature/功能名称`: 功能开发分支
- `release/版本号`: 发布准备分支
- `hotfix/修复描述`: 紧急修复分支

### 3.2 分支保护规则

在GitHub仓库设置中配置分支保护：

1. 进入仓库 → Settings → Branches
2. 添加规则保护 `main` 分支：
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators

### 3.3 提交信息规范

使用 Conventional Commits 规范：

```bash
# 功能添加
git commit -m "feat: add wallet connection functionality"

# 错误修复
git commit -m "fix: resolve MetaMask connection issue"

# 文档更新
git commit -m "docs: update deployment guide"

# 样式修改
git commit -m "style: improve responsive design"

# 重构代码
git commit -m "refactor: optimize consensus algorithm"

# 性能优化
git commit -m "perf: improve transaction processing speed"

# 测试添加
git commit -m "test: add unit tests for validator module"
```

---

## 4. 自动化CI/CD配置

### 4.1 GitHub Actions 工作流

创建 `.github/workflows/ci.yml`：

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: titanchain_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'pnpm'

    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8

    - name: Install dependencies
      run: pnpm install

    - name: Run security check
      run: ./scripts/security-check.sh

    - name: Run linting
      run: pnpm run lint

    - name: Run type checking
      run: pnpm run type-check

    - name: Run tests
      run: pnpm run test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/titanchain_test
        REDIS_URL: redis://localhost:6379

    - name: Build frontend
      run: pnpm run build:client

    - name: Build backend
      run: pnpm run build:server

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Deploy to production
      run: |
        echo "🚀 Deploying to production..."
        # 添加您的部署脚本
```

### 4.2 代码质量检查

创建 `.github/workflows/code-quality.yml`：

```yaml
name: Code Quality

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  quality:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'pnpm'

    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8

    - name: Install dependencies
      run: pnpm install

    - name: Run ESLint
      run: pnpm run lint:check

    - name: Run Prettier
      run: pnpm run format:check

    - name: Run TypeScript compiler
      run: pnpm run type-check

    - name: Security audit
      run: pnpm audit

    - name: Check bundle size
      run: pnpm run build:analyze
```

---

## 5. 协作开发配置

### 5.1 Issue 模板

创建 `.github/ISSUE_TEMPLATE/bug_report.md`：

```markdown
---
name: Bug Report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

## 🐛 Bug Description
A clear and concise description of what the bug is.

## 🔄 Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## ✅ Expected Behavior
A clear and concise description of what you expected to happen.

## 📱 Environment
- OS: [e.g. macOS, Windows, Linux]
- Browser: [e.g. Chrome, Firefox, Safari]
- Node.js version: [e.g. 18.17.0]
- Project version: [e.g. 1.0.0]

## 📸 Screenshots
If applicable, add screenshots to help explain your problem.

## 📝 Additional Context
Add any other context about the problem here.
```

创建 `.github/ISSUE_TEMPLATE/feature_request.md`：

```markdown
---
name: Feature Request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

## 🚀 Feature Description
A clear and concise description of what you want to happen.

## 💡 Motivation
Why is this feature needed? What problem does it solve?

## 📋 Detailed Design
Describe the solution you'd like in detail.

## 🔄 Alternatives Considered
A clear and concise description of any alternative solutions or features you've considered.

## 📝 Additional Context
Add any other context or screenshots about the feature request here.
```

### 5.2 Pull Request 模板

创建 `.github/pull_request_template.md`：

```markdown
## 📋 Description
Brief description of the changes in this PR.

## 🔗 Related Issues
Fixes #(issue number)

## 🧪 Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## ✅ Testing
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] I have tested this change in a browser

## 📝 Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings

## 📸 Screenshots (if applicable)
Add screenshots to help explain your changes.
```

### 5.3 贡献指南

创建 `CONTRIBUTING.md`：

```markdown
# 贡献指南

感谢您对TitanChain项目的关注！我们欢迎所有形式的贡献。

## 🚀 快速开始

1. Fork 本仓库
2. 克隆您的fork: `git clone https://github.com/YOUR_USERNAME/TitanChain.git`
3. 创建特性分支: `git checkout -b feature/amazing-feature`
4. 安装依赖: `pnpm install`
5. 进行更改并测试
6. 提交更改: `git commit -m 'feat: add amazing feature'`
7. 推送到分支: `git push origin feature/amazing-feature`
8. 创建Pull Request

## 📋 开发规范

### 代码风格
- 使用ESLint和Prettier进行代码格式化
- 遵循TypeScript最佳实践
- 保持代码简洁和可读性

### 提交信息
使用Conventional Commits规范：
- `feat:` 新功能
- `fix:` 错误修复
- `docs:` 文档更新
- `style:` 代码格式修改
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动

### 测试要求
- 为新功能添加单元测试
- 确保所有测试通过
- 保持测试覆盖率在80%以上

## 🐛 报告Bug

使用GitHub Issues报告bug，请包含：
- 详细的bug描述
- 重现步骤
- 预期行为
- 实际行为
- 环境信息

## 💡 功能建议

我们欢迎功能建议！请通过GitHub Issues提交，包含：
- 功能描述
- 使用场景
- 实现建议

## 📞 联系我们

如有疑问，请通过以下方式联系：
- GitHub Issues
- Email: [your-email@example.com]

再次感谢您的贡献！🙏
```

---

## 6. 安全最佳实践

### 6.1 GitHub Secrets 配置

在GitHub仓库中配置敏感信息：

1. 进入仓库 → Settings → Secrets and variables → Actions
2. 添加以下secrets：

```
DATABASE_URL=postgresql://username:password@host:port/database
REDIS_URL=redis://host:port
API_SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
PRIVATE_KEY=your-private-key
INFURA_PROJECT_ID=your-infura-id
ALCHEMY_API_KEY=your-alchemy-key
```

### 6.2 依赖安全扫描

创建 `.github/workflows/security.yml`：

```yaml
name: Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 0 * * 0'  # 每周日运行

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

    - name: Run npm audit
      run: |
        npm audit --audit-level high
        
    - name: Check for secrets
      uses: trufflesecurity/trufflehog@main
      with:
        path: ./
        base: main
        head: HEAD
```

### 6.3 访问控制设置

#### 团队权限管理：

1. **Admin**: 项目负责人
   - 完全访问权限
   - 可以修改仓库设置
   - 可以管理团队成员

2. **Maintainer**: 核心开发者
   - 可以合并PR
   - 可以管理Issues和Projects
   - 不能修改仓库设置

3. **Developer**: 普通开发者
   - 可以创建分支和PR
   - 可以参与代码审查
   - 不能直接推送到主分支

### 6.4 安全检查清单

创建安全检查脚本 `scripts/security-checklist.sh`：

```bash
#!/bin/bash

echo "🔒 TitanChain 安全检查清单"
echo "=========================="

# 检查环境变量文件
echo "1. 检查敏感文件..."
if [ -f ".env" ]; then
    echo "⚠️  .env文件存在，确保已添加到.gitignore"
else
    echo "✅ 未发现.env文件"
fi

# 检查私钥文件
echo "2. 检查私钥文件..."
find . -name "*.key" -o -name "*.pem" | grep -v node_modules
if [ $? -eq 0 ]; then
    echo "⚠️  发现私钥文件，请确保已加密或添加到.gitignore"
else
    echo "✅ 未发现私钥文件"
fi

# 检查硬编码密码
echo "3. 检查硬编码密码..."
if grep -r "password.*=" --include="*.ts" --include="*.js" . | grep -v node_modules | grep -v ".example"; then
    echo "⚠️  发现可能的硬编码密码"
else
    echo "✅ 未发现硬编码密码"
fi

# 检查依赖漏洞
echo "4. 检查依赖漏洞..."
pnpm audit --audit-level high

echo "=========================="
echo "🔒 安全检查完成"
```

---

## 🚀 完整同步流程

### 一键同步脚本

创建 `scripts/sync-to-github.sh`：

```bash
#!/bin/bash

echo "🚀 开始同步TitanChain到GitHub..."

# 1. 安全检查
echo "1. 执行安全检查..."
./scripts/security-check.sh
if [ $? -ne 0 ]; then
    echo "❌ 安全检查失败，请修复后重试"
    exit 1
fi

# 2. 代码质量检查
echo "2. 执行代码质量检查..."
pnpm run lint
pnpm run type-check
if [ $? -ne 0 ]; then
    echo "❌ 代码质量检查失败，请修复后重试"
    exit 1
fi

# 3. 运行测试
echo "3. 运行测试..."
pnpm run test
if [ $? -ne 0 ]; then
    echo "❌ 测试失败，请修复后重试"
    exit 1
fi

# 4. 构建项目
echo "4. 构建项目..."
pnpm run build
if [ $? -ne 0 ]; then
    echo "❌ 构建失败，请修复后重试"
    exit 1
fi

# 5. 提交和推送
echo "5. 提交和推送到GitHub..."
git add .
git status

read -p "请输入提交信息: " commit_message
git commit -m "$commit_message"

git push origin $(git branch --show-current)

echo "✅ 同步完成！"
echo "🌐 查看仓库: https://github.com/YOUR_USERNAME/TitanChain"
```

### 使用方法

```bash
# 给脚本执行权限
chmod +x scripts/sync-to-github.sh

# 执行同步
./scripts/sync-to-github.sh
```

---

## 📞 支持和帮助

如果在同步过程中遇到问题，请：

1. 检查网络连接
2. 确认GitHub凭据正确
3. 查看GitHub仓库权限设置
4. 参考GitHub官方文档

---

**🎉 恭喜！您已成功将TitanChain项目同步到GitHub！**

现在您可以：
- 📝 管理代码版本
- 🤝 协作开发
- 🚀 自动化部署
- 🔒 保护代码安全

记住定期推送代码更新，保持仓库同步！