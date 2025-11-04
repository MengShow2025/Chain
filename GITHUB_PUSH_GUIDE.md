# TitanChain GitHub 仓库创建和推送指南

## 🎯 概述
本指南将帮助您将TitanChain项目推送到GitHub，包括仓库创建、初始化和推送流程。

## 📋 前置条件

### 必需条件
- 已安装Git
- GitHub账号
- Node.js环境（已安装）

### 检查Git配置
```bash
# 检查Git是否已配置
git config --global user.name
git config --global user.email

# 如果未配置，请设置
git config --global user.name "您的用户名"
git config --global user.email "您的邮箱@example.com"
```

## 🚀 快速开始（自动推送）

### 方法1：使用推送脚本（推荐）
```bash
# 给脚本执行权限
chmod +x push-to-github.sh

# 运行推送脚本
./push-to-github.sh
```

脚本会自动：
- ✅ 检查Git配置
- ✅ 初始化Git仓库（如需要）
- ✅ 添加远程仓库
- ✅ 提交更改
- ✅ 推送到GitHub

## 📖 手动推送步骤

### 步骤1：在GitHub创建新仓库
1. 访问 [GitHub](https://github.com)
2. 点击右上角的 "+" → "New repository"
3. 填写仓库信息：
   - Repository name: `TitanChain`
   - Description: `下一代区块链平台 - 高性能、可扩展的区块链解决方案`
   - 选择 Public（公开）或 Private（私有）
   - **不要** 初始化 README（保持未勾选）
   - **不要** 添加 .gitignore（保持未勾选）
   - **不要** 添加许可证（保持未勾选）
4. 点击 "Create repository"
5. 复制仓库URL（格式：`https://github.com/您的用户名/TitanChain.git`）

### 步骤2：初始化本地Git仓库
```bash
# 如果项目目录还不是Git仓库
git init

# 添加所有文件到暂存区
git add .

# 提交初始版本
git commit -m "初始提交：TitanChain区块链平台"
```

### 步骤3：添加远程仓库
```bash
# 添加远程仓库（替换为您的实际URL）
git remote add origin https://github.com/您的用户名/TitanChain.git

# 验证远程仓库
git remote -v
```

### 步骤4：推送到GitHub
```bash
# 推送到主分支
git push -u origin main

# 如果主分支是master
git push -u origin master
```

## 🔧 常见问题解决

### 问题1：推送被拒绝
```bash
# 错误信息：! [rejected]        main -> main (fetch first)
# 解决方案：先拉取远程更改
git pull origin main --rebase
git push origin main
```

### 问题2：身份验证失败
```bash
# 使用个人访问令牌（推荐）
# 1. 在GitHub设置中创建Personal Access Token
# 2. 使用令牌代替密码
# 或使用SSH密钥
```

### 问题3：大文件推送失败
```bash
# 检查大文件
find . -size +100M

# 如果存在大文件，考虑使用Git LFS
git lfs track "*.largefile"
git add .gitattributes
```

## 📁 项目结构说明

推送成功后，您的GitHub仓库将包含：

```
TitanChain/
├── api/                    # API服务器代码
├── blockchain/            # 区块链核心模块
├── src/                   # 前端React应用
├── network/               # P2P网络模块
├── mpc/                   # 多方计算系统
├── tests/                 # 测试文件
├── scripts/               # 部署和工具脚本
├── shared/                # 共享类型和工具
├── docs/                  # 文档
├── .github/               # GitHub工作流（可选）
├── package.json           # 项目配置
├── README.md              # 项目说明
└── LICENSE                # 许可证文件
```

## 🎯 推送后建议

### 1. 设置分支保护（推荐）
在GitHub仓库设置中：
- 启用分支保护规则
- 要求Pull Request审查
- 启用状态检查

### 2. 添加协作者
- 进入Settings → Manage access
- 邀请团队成员
- 设置适当的权限级别

### 3. 配置GitHub Pages（可选）
- 启用GitHub Pages用于文档展示
- 设置自定义域名（如需要）

### 4. 添加Issue模板
创建 `.github/ISSUE_TEMPLATE/` 目录，添加：
- Bug报告模板
- 功能请求模板
- 问题模板

## 🔍 验证推送结果

### 检查推送状态
```bash
# 查看远程分支
git ls-remote origin

# 查看本地分支状态
git status

# 查看提交历史
git log --oneline -10
```

### 在GitHub上验证
1. 访问您的仓库URL
2. 检查文件是否完整
3. 验证提交历史
4. 测试代码浏览功能

## 🚀 后续步骤

推送成功后，您可以：

1. **分享项目**：将仓库链接分享给团队成员
2. **启用CI/CD**：设置GitHub Actions工作流
3. **添加文档**：完善Wiki和文档
4. **管理Issues**：使用GitHub Issues跟踪任务
5. **协作开发**：使用Pull Request进行代码审查

## 📞 获取帮助

如果遇到问题：
- 查看GitHub帮助文档
- 使用 `git help` 命令
- 检查网络连接
- 验证GitHub凭据

---

**恭喜！** 🎉 您已成功将TitanChain项目推送到GitHub，现在可以开始协作开发了！