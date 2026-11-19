# Crash 可复现工作流 (Crash Reproducibility)

> 背景: 2026-08-10 的 `HamsterStore-GUI.exe` 崩溃为
> `EXCEPTION_STACK_OVERFLOW (0xC00000FD)`,故障点位于 `user32.dll` 消息派发阶段。
> 当时的 mini-dump **没有栈内存**,且从未生成 `.pdb`(`*.pdb` 被 gitignore),
> 崩溃的 `.exe` 随后被 08-17 构建覆盖 —— 导致该崩溃**无法从产物中复现或调试**。

为避免重蹈覆辙,本项目从 2026-08-28 起强制以下构建约束。

## 构建约束 (已写入 package.json / scripts/build.sh)

```bash
npm run build:cli   # bash scripts/build.sh cli（源码重建环境，见 docs/BUILD.md）
npm run build:gui   # bash scripts/build.sh gui
                    #   --target windows --min-windows-version 10
                    #   --debug-symbols --emit-attest
```

两个构建都带:

- `--debug-symbols`:Windows 下向 lld-link 传入 `/DEBUG`,**必然生成 `HamsterStore-GUI.pdb`**。
  这是 08-10 缺失、导致崩溃不可调试的关键产物。
- `--emit-attest`:在 `.exe` 旁生成 `<name>.exe.attest.json`,固含
  `sha256` + `perry_version` + `built_at_unix`,用于把崩溃 dump 精确对应回源码。

## 每次发布/调试时的产物

`dist/` 现在应同时包含:

```
HamsterStore.exe
HamsterStore.attest.json
HamsterStore-GUI.exe
HamsterStore-GUI.pdb        <- 崩溃调试必需
HamsterStore-GUI.exe.attest.json
```

`.pdb` 与 `.exe` 通过内部 GUID+age 配对;attest 的 `sha256` 必须与出问题的 `.exe`
字节一致,否则符号对不上。

## 收到崩溃 dump 后的排查步骤

1. 从 `*.exe.attest.json` 读出 `sha256` + `perry_version` + `built_at_unix`。
2. 在本地按同版本 perry 重新 `npm run build:gui`(同一份 `src`),会生成
   同 GUID 的 `HamsterStore-GUI.pdb`(前提是 `src` 与该构建时一致)。
3. 用 WinDbg / `cdb` 打开 dump + 同目录 `.pdb`,即可把
   `perry-runtime` 与用户函数栈符号化到 `file:line`。
4. 若 `commit_sha` 为空(构建目录本身不是 git 仓库时 perry 不填),
   需人工对照 `built_at_unix` 与提交历史确定源码版本。

## 已知待解事项

- 08-10 崩溃根因仍未确认,但 **2026-11-19 复现调查:启动期崩溃在当前工具链下未复现**
  (见下节)。交互期(点击导航触发 rebuildBody)尚未验证。
- `commit_sha` 当前为空:因构建副本 `PerryTS/HamsterStore` 不是 git 仓库。
  建议将其设为真正的 git 工作树,或在 CI 中于 git 仓库内构建,
  以便 attest 自动写入 commit。

## 2026-11-19 复现调查（Perry 0.5.1520 + PERRY_RS4GC=0）

工作台：`src/gui/_repro.ts`（等价 bc80286 的 v2 完整接线：initDatabase +
buildMainBody + App），配套恢复 `src/ui/`（22 文件，修复 7 处相对路径）与
`src/core/{install,process,update}`（UI 组件依赖，此前随孤儿清理移除）。

```bash
source scripts/perry-source-env.sh
npx perry compile src/gui/_repro.ts -o dist/HamsterStore-UIRepro.exe \
  --target windows --min-windows-version 10 --debug-symbols --emit-attest
./dist/HamsterStore-UIRepro.exe
```

结果（真实运行 + 桌面截图取证）：

1. **编译通过**：完整 Bento UI 在 0.5.1520 无 API 漂移，15.1MB + .pdb。
2. **启动崩溃未复现**：首页完整构建（145 包/15 源/3 下载记录），App() 进入
   消息循环后稳定运行 90s+，无 0xC00000FD。08-10 的启动期栈溢出疑似
   0.5.1220 时代运行时问题，或需特定交互触发。
3. **渲染正常**：9 页导航、统计卡、精选/分类面板、代理状态栏均显示真实数据。
4. **交互性未验证**：perry/ui 自绘控件不暴露 UIA 元素（AX 树仅原生标题栏 +
   搜索 Edit），自动化点击（背景/前台多组坐标）未观察到页面切换；窗口后被
   最小化，恢复需用户授权未完成。**需人工点击导航确认 rebuildBody 路径**，
   这是复活 UI 前的最后一道验证。

结论：UI 复活的技术阻塞（不可复现的崩溃）已大幅降低——启动路径干净。
待人工交互验证通过后，把 `_repro.ts` 的接线替换 `gui/main.ts` 即可复活；
注意 DownloadManager v5 的 getState/getQueued/clearCompleted 是 stub，
下载管理页需先补齐这些 API 才有真实状态。

**2026-11-19 晚些时候：项目升级 Perry 0.5.1665**（#14982 适配：4 个 class 重构为
对象字面量工厂）。_repro 完整 Bento UI 在 1665 默认 statepoint GC 下编译通过，
attest 的 commit_sha 现在自动写入（git 工作树内构建）。114 断言 + e2e 下载全绿。
