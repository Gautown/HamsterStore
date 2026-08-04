# 🐹 HamsterStore 仓鼠软库 v1.0.0

Windows 开源软件发现与下载工具 — WinUI 3 暖沙风格

## 快速开始

### 1. 启动后端（CLI 数据服务）
```bash
# 安装依赖
npm install

# 启动 CLI 爬虫 + API 服务
npx tsx start_cli.ts
```

### 2. 启动前端（GUI 仓库浏览）
```bash
# 直接双击 exe
dist/HamsterStore.exe

# 或命令行启动
./dist/HamsterStore.exe
```

## 系统要求
- Windows 10/11 (x64)
- Node.js ≥18 (运行 CLI 数据服务)
- npm / tsx

## 特征
- 📦 从 10 个种子仓库自动收集 Windows 开源软件
- 🎨 WinUI 3 暖沙色界面: 侧栏分类 + 卡片列表
- 📊 真实数据: stars / forks / release 版本
- 📥 一键下载: 默认浏览器打开发布页
- 🔍 全文搜索
- ⚡ GitHub API 加速: DNS 解析 + IP 直连

## 开发
```bash
# 安装依赖
npm install

# 编译 GUI (需要 perry winget)
perry compile src/gui/main.ts -o dist/HamsterStore.exe

# 清理数据库并重新爬取
npx tsx clear_db.ts && npx tsx start_cli.ts
```

## 架构
```
HamsterStore.exe (perry 编译 GUI)
  └── CLI (npx tsx): 种子仓库 → SQLite → REST API
       ├── src/api/       : HTTP 服务
       ├── src/db/        : SQLite 存储
       ├── src/cli/       : 加速器 (curl/FastGithub)
       └── src/gui/       : 主窗口 + 面板
```

## 许可
MIT