# GitHub推送快速指南

## 🚀 一键推送

### 方法1：完整推送（推荐首次使用）
```bash
# 给脚本执行权限
chmod +x push-to-github.sh

# 运行完整推送脚本
./push-to-github.sh
```

### 方法2：快速推送（后续更新）
```bash
# 给脚本执行权限
chmod +x quick-push.sh

# 快速推送更改
./quick-push.sh
```

## 📋 手动推送步骤

### 1. 添加更改
```bash
git add .
```

### 2. 提交更改
```bash
git commit -m "更新TitanChain项目"
```

### 3. 推送到GitHub
```bash
git push origin main
```

## 🔧 首次推送前的准备

### 创建GitHub仓库
1. 访问 https://github.com/new
2. 仓库名：`TitanChain`
3. 保持默认设置（不要初始化README）
4. 复制仓库URL

### 添加远程仓库
```bash
git remote add origin https://github.com/你的用户名/TitanChain.git
```

## ✅ 推送验证

推送成功后：
- 访问 `https://github.com/你的用户名/TitanChain`
- 检查文件是否完整上传
- 验证提交历史

## 📞 遇到问题？

查看详细指南：`GITHUB_PUSH_GUIDE.md`

或运行：
```bash
# 检查Git状态
git status

# 查看远程仓库
git remote -v

# 查看提交历史
git log --oneline -5
```