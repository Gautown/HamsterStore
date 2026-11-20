# Perry 合规审计与版本矩阵（2026-11-20，锁 0.5.1520）

范围：`src/` 全部 73 个 TS 文件（含 UI 工作台与测试）。
方法：① 7 入口覆盖图 + 未覆盖文件逐个 `--no-link` codegen；② 危险模式静态扫描；
③ 104 离线断言 + 10 网络断言；④ GUI 实机渲染与长稳（14min+）。

## 结论

**73/73 模块通过 0.5.1520 codegen；104 离线 + 10 网络断言全绿；CLI（13.7MB）/
GUI（15.0MB + 5.6MB .pdb）双构建通过；完整 Bento UI 实机渲染 145 包、15 源、
后台镜像测速并稳定运行 14 分钟以上。**
审计修复 9 类问题（其中 2 个潜伏功能 bug）。**工具链锁定 0.5.1520**——原因见下节。

## 版本矩阵（GUI 启动冒烟，真实二进制）

|Perry 版本|库来源|纯 `Text`|`VStack` 容器|结论|
|---|---|---|---|---|
|0.5.1520|源码工作区重建（runtime/stdlib/UI 同批）|存活|存活|**采用**|
|0.5.1664|官方 npm 包|崩溃（seed）|崩溃（seed）|阻断|
|0.5.1665|官方 npm 包|崩溃（seed）|崩溃（seed）|阻断|
|0.5.1665|npm + 剪枝 16 个内嵌 runtime 成员|存活|崩溃（空跳板）|不可用|

- **1664/1665 根因**：`perry_ui_windows.lib` 由独立 cargo 构建，内嵌第二份
  `perry_runtime`（`perry_runtime-ca03e9df...-cgu.NN`，16 成员；runtime/stdlib 为
  `e05f032d...`）。链接参数 `/FORCE:MULTIPLE` + `/IGNORE:4006` 吞掉重复符号，
  exe 的 `.perryat` 段头出现两个 `ATOM_START`；`seed_static_atoms` 视整段为
  `ATOM_START+8` 起的 24 字节步长数组 → 偏移 8 字节 → hashbrown 常量被当指针 →
  用户代码前 ACCESS_VIOLATION（实测 `seed_static_atoms+197`）。
- **剪枝为何不可发布**：删掉 16 个成员后，7 个泛型实例（`RawVec<i32|bool|
  (String,f64)>::grow_one`、`RawTable<(String,String)|(usize,())>::reserve_rehash`、
  `Arc<[u8]>::drop_slow`、`perry_stub_warn`）无定义；`/FORCE:UNRESOLVED` 生成
  image_base−1GB 的空跳板。纯 `Text` 不触达这些路径，任何容器/布局控件触达即崩。
- **1520 为何可用**：perry 按 `PERRY_WORKSPACE_ROOT` 用同一次 cargo 解析重建
  runtime+stdlib，UI 库同工作区产出 → 单一 `.perryat` 标记。代价：npm stdlib 缺
  正则入口，首次重建数分钟（之后缓存）；必须 `PERRY_RS4GC=0`（#7354）。

## 发现与修复

| # | 问题 | 位置 | 修复 |
|---|---|---|---|
| 1 | #14982：class 方法 $pshape COFF alias → 模块被拒（1665+） | GitHubAPIClient/GitHubSearchEngine/ProxyManager/SelfUpdater | 对象字面量工厂（1520 兼容，前置规避） |
| 2 | execSync 拼字符串 ×8（引号/&/重定向在 Perry 必挂） | InstallManager | spawn 数组 / cmd /c + marker 轮询；install/isRunning 回调式 |
| 3 | **markUninstalled(packageId) 标错行**（潜伏 bug） | InstallManager.uninstall | 改传 inst.id |
| 4 | execSync 捕获 stdout ×2（不可靠） | ProcessManager | cmd /c 重定向到文件 + 轮询；回调式 |
| 5 | execSync start 启动软件（引号必挂） | InstalledList 启动按钮 | spawn cmd start 数组 |
| 6 | stdout.on("data") 回调（真实二进制不触发）+ 死代码 | ui/components/GitHubSearchEngine.ts | 删除（core/discovery 版为正规实现） |
| 7 | execSync powershell 引号必崩 + 死代码（暂缓交付实验） | ui/utils/window.ts | 删除（git 历史可取回） |
| 8 | **BentoTitleBar 引用未导出的 runSearch → 编译失败** | ui/app.ts | 导出 runSearch |
| 9 | 函数内 dynamic require() ×3 | core/ui DownloadManager | 顶层 import |

## 保留的 class（10 个，1520 编译验证）

FileDB、DedupEngine、DedupCleaner、ThreadPool、TaskQueue、Channel、
AtomicCounter、RateLimiter、HamsterProxy、SourceSyncer（+测试 Scorer）。
1520 无 #14982 限制；1665+ 前需评估（方法体形状未产生同 body alias 即安全）。

## 新增代码合规清单

- [ ] 不用 class 封装带 GC roots 的方法（闭包/网络回调/字符串字段）→ 工厂 + 对象字面量
- [ ] 不用 execSync 拼命令字符串 → spawn 数组；要 shell 语义用 cmd /c 单参数传入
- [ ] 不依赖子进程 stdout/stderr/close 事件 → 输出重定向到文件 + setInterval 轮询
- [ ] 不用 Promise/async/await（Perry 编译目标不支持）→ 回调式
- [ ] 不在非 UI 线程 setTimeout 里碰 UI；不忙等（饿死事件循环）
- [ ] prepare().run() 参数 ≤7（超出截断），多字段用 extra_json 聚合
- [ ] 网络一律走 netFetch（curl -f + 完整性校验）；API 经 api:true 镜像节点
- [ ] 字符串避免 emoji（Perry 历史坑）
- [ ] 升级 Perry 前跑 `timeout 8 dist/HamsterStore-GUI.exe` + 9 导航点击 + 搜索/下载

## 环境性说明

- `npm run test:net` 紧跟编译后首跑偶发失败（镜像对短时重复请求限流），重跑即绿；
  属环境抖动，非代码回归。
- 跨 perry 版本升级先 `npx perry cache clean`；升级后重新解压对应版本捆绑库。
- 1520 类型 stub 用 `npm run types` 重新生成。
