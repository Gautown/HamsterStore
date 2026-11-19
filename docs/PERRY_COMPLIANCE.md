# Perry 0.5.1665 全量代码合规审计（2026-11-19）

范围：`src/` 全部 73 个 TS 文件（含 UI 工作台与测试）。
方法：① 入口覆盖图（7 入口）+ 未覆盖文件逐个 `--no-link` codegen；
② 危险模式静态审计；③ 114 断言 + e2e 运行时验证。

## 结论

**73/73 模块通过 1665 codegen；104 离线断言 + 10 网络断言全绿；
CLI/GUI/完整 Bento UI repro 三入口构建通过；e2e 下载验证通过。**
审计发现并修复 9 类问题（其中 2 个是潜伏的功能性 bug）。

## 发现与修复

| # | 问题 | 位置 | 修复 |
|---|---|---|---|
| 1 | #14982：class 方法 $pshape COFF alias → 模块拒绝编译 | GitHubAPIClient/GitHubSearchEngine/ProxyManager/SelfUpdater | 对象字面量工厂（上一提交） |
| 2 | execSync 拼字符串 ×8（引号/&/重定向在 Perry 必挂） | InstallManager | spawn 数组 / cmd /c 内部 shell + marker 文件轮询；install/isRunning 改回调式 |
| 3 | **markUninstalled(packageId) 标错行**（潜伏 bug） | InstallManager.uninstall | 改传 inst.id |
| 4 | execSync 捕获 stdout ×2（不可靠） | ProcessManager | cmd /c 重定向到文件 + 轮询；回调式 |
| 5 | execSync start 启动软件（引号必挂） | InstalledList 启动按钮 | spawn cmd start 数组 |
| 6 | stdout.on("data") 事件回调（真实二进制不触发）+ 死代码 | ui/components/GitHubSearchEngine.ts | 删除（core/discovery 版为正规实现） |
| 7 | execSync powershell 引号必挂 + 死代码（暂缓交付实验） | ui/utils/window.ts | 删除（git 历史可取回） |
| 8 | **BentoTitleBar 引用未导出的 runSearch → 编译失败** | ui/app.ts | 导出 runSearch |
| 9 | 函数内 dynamic require() ×3 | core/ui DownloadManager | 顶层 import |

## 保留的 class（10 个，全部编译验证通过）

FileDB、DedupEngine、DedupCleaner、ThreadPool、TaskQueue、Channel、
AtomicCounter、RateLimiter、HamsterProxy、SourceSyncer（+测试 Scorer）。
当前不触发 #14982（方法体形状未产生同 body alias），但上游修复前存在风险。

## 新增代码合规清单

- [ ] 不用 class 封装带 GC roots 的方法（闭包/网络回调/字符串字段）→ 工厂 + 对象字面量
- [ ] 不用 execSync 拼命令字符串 → spawn 数组；需要 shell 语义时 cmd /c 单参数传入
- [ ] 不依赖子进程 stdout/stderr/close 事件 → 输出重定向到文件 + setInterval 轮询
- [ ] 不用 Promise/async/await（Perry 编译目标不支持）→ 回调式
- [ ] 不在非 UI 线程 setTimeout 里碰 UI；不忙等（饿死事件循环）
- [ ] prepare().run() 参数 ≤7（超出截断），多字段用 extra_json 聚合
- [ ] 网络一律走 netFetch（curl -f + 完整性校验）；API 经 api:true 镜像节点
- [ ] 字符串避免 emoji（Perry 历史坑）

## 环境性说明

- `npm run test:net` 紧跟编译后首次运行偶发 3 项失败（镜像对短时重复请求限流），
  直接重跑即 10/10；属环境抖动，非代码回归。
- 跨 perry 版本升级先 `npx perry cache clean`；升级后重新解压对应版本捆绑库。
- 1665 类型 stub 已用 `npm run types` 重新生成。
