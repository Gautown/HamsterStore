# HamsterStore - 仓鼠软库

跨平台开源软件仓库管理工具。基于 Perry 框架 (TypeScript 编译为原生二进制), Bento UI 设计风格, 主题色 #2563EB.

## 技术栈

- **Perry v0.5.1220** — TypeScript to native compiler (LLVM + Clang + LLD)
- **FileDB** — 纯 TS JSON 持久化 (~/.hamsterstore/filedb/*.json), 绕过 better-sqlite3 stub
- **Perry UI** — 声明式原生 UI (SwiftUI 风格), VBox/HStack/Button/Text 工厂函数
- **CategoryEngine** — 17 类标准分类 + 关键词推断
- **ListParser** — 7 种子仓库 Markdown 解析器 (Awesome-index/Stackia/HolyShell/Ziyouvip/Ttionya/Ossdate/Generic)
- **DedupEngine** — 精确 URL Hash + Jaccard 模糊去重
- **ProxyManager + ProxyPool** — GitHub 镜像加速链

## 项目结构

```
src/
  main.ts               # CLI 入口 (7 命令)
  gui/main.ts           # GUI 入口
  ui/
    app.ts              # 主窗口构建 (buildMainBody)
    components/         # 12 Bento UI 组件
    styles/theme.ts     # 主题常量 COLORS/RADIUS/SPACING/FONT/SHADOW
  core/
    sync/               # SourceSyncer + GitHubAPIClient + seedRepos
    crawler/            # GitHubCrawler + ProxyPool + ListCrawler
    discovery/          # GitHubSearchEngine (公开搜索)
    categorization/     # CategoryEngine (17 类)
    parser/             # ListParser + 7 子解析器
    dedup/              # DedupEngine
    download/           # DownloadManager (curl 非阻塞)
    install/            # InstallManager (exe/msi/zip)
    update/             # SelfUpdater
    proxy/              # ProxyManager + 代理节点
  data/
    FileDB.ts           # JSON 文件持久化
    Database.ts         # 入口初始化
    models/             # 7 数据模型
    repositories/       # 6 Repository CRUD
```

## CLI 命令

```bash
hamsterstore sync                # 同步种子仓库 + 搜索补充
hamsterstore discover            # 仅 GitHub 公开搜索发现
hamsterstore search <关键词>      # 本地搜索 -> GitHub 在线搜索
hamsterstore info <ID>           # 查看软件详情
hamsterstore list                # 显示仓库 + 软件包列表
hamsterstore categories          # 分类统计
hamsterstore help                # 帮助

# 选项: --token <PAT>  (无 token 时采用爬虫方案)
```

## 构建

```bash
npm install                    # 安装依赖
npm run check                  # perry check
npm run types                  # 生成 .perry/types/ API stubs
npm run build:cli              # dist/HamsterStore.exe (~12.8 MB)
npm run build:gui              # dist/HamsterStore-GUI.exe (~12.9 MB)
npm run build:all              # 双编译
npm run clean                  # 清空 dist
```

## GUI 导航 (8 页面)

| 页面 | 说明 |
|------|------|
| 首页 | Bento Grid: 统计卡 + 热门 + 更新提醒 + 精选 + 分类 + 搜索 + 软件预览 |
| 软件库 | 软件卡片列表 (支持 category + sourceId 双过滤) |
| 精选推荐 | 种子仓库按钮, 点击按来源过滤软件 |
| 分类浏览 | CategoryEngine 17 个分类按钮 |
| 下载管理 | 进行中 + 历史记录 (DownloadManager 状态) |
| 已安装 | 安装记录列表 + 启动/卸载按钮 |
| 更新中心 | 软件包更新 + 应用自身更新 (SelfUpdater) |
| 设置 | GitHub Token + 加速器开关 + 版本信息 |

## 数据流向

```
种子仓库 (6 repo) ─┐
                   │
GitHub Search     ─┼─> SourceSyncer ─> ListParser (7 解析器)
                   │                      │
                   │                      v
                   └──────────────> CategoryEngine (17 类)
                                          │
                                          v
                                    DedupEngine (精确 + 模糊)
                                          │
                                          v
                                    FileDB JSON (~/.hamsterstore/filedb/)
                                          │
                                          v
                              GUI (PackageList/Detail) + CLI (list/info)
```

## Perry 适配要点

- **perry v0.5.1220 `prepare().run(...params)` 截断**：最多 7 个参数, 超出丢弃. 解决:`extra_json` 字段聚合
- **预编译 better-sqlite3 stub**：`prepare()` 返回 undefined. 解决: FileDB 纯 TS JSON 替代
- **`setTimeout` 回调非 UI 线程 SIGSEGV**：解决: 自旋 sleep 同步等待
- **emoji 在字符串中**：替换为 ASCII 标识
- **subsystem=windows 无 cmd 指令窗口**

## License

MIT