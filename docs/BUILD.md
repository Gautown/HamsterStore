# Windows 构建环境搭建指南（Perry 0.5.1520，无 MSVC / Visual Studio）

> 2026-11-20 本机完整验证：`npm run check`（73 文件）、`npm test`（104 断言）、
> `npm run test:net`（10 断言）、`npm run build:all`（CLI 13.7MB / GUI 15.0MB + 5.6MB .pdb）、
> 完整 Bento UI 实机渲染 145 包并稳定运行 14 分钟（后台镜像测速完成），e2e 下载通过。

## 0. 版本选择：锁 0.5.1520

最新 0.5.1664/1665 的官方 npm GUI 库有打包事故：`perry_ui_windows.lib` 内嵌第二份
`perry_runtime`，链接后 `.perryat` 段出现两个 `ATOM_START` 标记，`seed_static_atoms`
在**任何用户代码之前**崩溃，且任何容器控件（VStack/HStack/Divider/Button）必崩。
证据与探针矩阵见 [PERRY_COMPLIANCE.md](PERRY_COMPLIANCE.md)，上游尚无 1666+ 修复版。
1520 的 runtime/stdlib/UI 出自同一工作区，单一标记，GUI 实机稳定。

|项|0.5.1520（采用）|0.5.1664 / 1665（阻断）|
|---|---|---|
|npm stdlib 正则入口|缺（需源码重建补全）|已含|
|try/catch WinEH (#7354)|必须 `PERRY_RS4GC=0`|已修复，默认 statepoint|
|捆绑 .zst 库|首次链接自动解压（UI 库除外）|不自动解压，需手动|
|GUI 运行时|单 `.perryat` 标记，稳定|双标记，启动即崩|
|class 方法 $pshape (#14982)|无此限制|Windows COFF 编译拒绝|

**#14982 前瞻规则**（1520 不触发，升级前一直有效）：不要用 class 封装带 GC roots
的方法（闭包/网络回调/字符串字段），用工厂函数 + 对象字面量
（GitHubAPIClient/GitHubSearchEngine/ProxyManager/SelfUpdater 已重构）。

## 1. 目录布局（全部用户级，无需管理员权限）

```
%LOCALAPPDATA%\perry\
  llvm-mingw-20261117-ucrt-x86_64\bin\   clang / lld-link / llvm-lib / clang-cl / mt.exe + DLL
  llvm-22.1.8\bin\                      llvm-mt（GUI manifest）+ LLVM-C.dll
  windows-sdk\                          CRT + Windows SDK（xwin splat 产物）
  perry-source\                         PerryTS/perry v0.5.1520 浅克隆（cargo 重建 runtime/stdlib）
  link-shim\                            lld-link 副本 + DLL（代替 MSVC link.exe）
  libs-ui\                              手动解压的 perry_ui_windows.lib
  libs-1665\                            [实验] 1665 CLI-only 库，GUI 不可用（附录 B）
%USERPROFILE%\.cargo\                   Rust stable（rsproxy.cn 镜像）
```

## 2. 安装步骤

### 2.1 LLVM 工具链（llvm-mingw，免安装）

GitHub 直连慢（~43KB/s），用镜像前缀 `https://gh-proxy.org/<原始URL>`（~347KB/s；
4-6 并发 Range 分块再快数倍，校验拼接后总字节数）。

```bash
# 下载 llvm-mingw-20261117-ucrt-x86_64.zip（191MB，mstorsjo/llvm-mingw releases）
# 解压到 %LOCALAPPDATA%\perry\
B=%LOCALAPPDATA%/perry/llvm-mingw-20261117-ucrt-x86_64/bin
cp $B/ld.lld.exe $B/lld-link.exe       # lld 按 argv[0] 分发 flavor
cp $B/clang-23.exe $B/clang-cl.exe     # 必须用真驱动 clang-23.exe（clang.exe 是 wrapper）
```

### 2.2 mt.exe（manifest 工具，GUI 链接必需）

从官方 LLVM-22.1.8-win64.exe 用 7-Zip 解出 `bin/llvm-mt.exe` + `bin/LLVM-C.dll`
（无需跑安装器/UAC），llvm-mt 改名 mt.exe，放到 llvm-mingw/bin 与
node_modules/@perryts/perry-win32-x64/bin（lld-link 搜索不总走 PATH）。

### 2.3 Windows SDK + CRT（xwin）

```bash
npm install
# xwin.exe：Jake-Shadle/xwin releases 0.10.0（0.9.0 对 Win11 SDK 26100 报错），
# 放到项目根目录（perry 按 cwd 查找）
export PERRY_LLVM_CLANG=$B/clang.exe PERRY_LLD_LINK=$B/lld-link.exe
perry setup windows --accept-license
```

**坑**：xwin 缓存（cwd/.xwin-cache）与输出（%LOCALAPPDATA%\perry\windows-sdk）
必须同盘（splat 用 rename，跨盘 os error 17）。

### 2.4 Rust + Perry 0.5.1520 源码树（补正则运行时入口）

1520 的 npm 预编译 stdlib 缺 `js_regexp_new` / `js_regexp_test` /
`js_string_match` / `js_string_match_value` / `js_string_replace_regex`，
凡用正则字面量的模块（FileDB/ProxyManager/netFetch/GitHubAPIClient…）链接必挂。
设 `PERRY_WORKSPACE_ROOT` 后 perry 按项目 imports 用 cargo 重建 runtime+stdlib（含正则）。

```bash
# Rust stable（rustup-init.exe → 2 自定义安装；RUSTUP_DIST_SERVER=https://rsproxy.cn）
# ~/.cargo/config.toml 配 rsproxy sparse registry
git clone --depth 1 --branch v0.5.1520 https://github.com/PerryTS/perry.git \
  %LOCALAPPDATA%/perry/perry-source
# GitHub 慢可加 https://gh-proxy.org/ 前缀
```

### 2.5 link-shim

```bash
mkdir -p %LOCALAPPDATA%/perry/link-shim
cp $B/ld.lld.exe %LOCALAPPDATA%/perry/link-shim/link.exe
# 复制 libLLVM-23.dll / libc++.dll / libunwind.dll / libwinpthread-1.dll 到同目录
```

**坑**：缺 DLL 时 rustc 链接步骤报 `0xc0000135`；不指定 linker 时 rustc 会在
PATH 里找到 git-bash 的 `/usr/bin/link.exe`（coreutils 硬链接工具），报
`link: extra operand`。`perry-source-env.sh` 已设
`CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER` 并把 link-shim 放进 PATH。

### 2.6 UI 库（npm 只发 .zst，perry 不自动解压）

```python
# pip install zstandard
import zstandard as zstd, os
src = r"node_modules/@perryts/perry-win32-x64/lib/perry_ui_windows.lib.zst"
dst = os.path.expandvars(r"%LOCALAPPDATA%\perry\libs-ui\perry_ui_windows.lib")
os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(src, "rb") as f, open(dst, "wb") as g:
    zstd.ZstdDecompressor().copy_stream(f, g)
```

`scripts/perry-source-env.sh` 经 `PERRY_LIB_DIR` 暴露该目录（只有 UI 库，
不遮蔽 cargo 重建的 runtime/stdlib）。

## 3. 日常使用

```bash
source scripts/perry-source-env.sh   # 或直接用 npm scripts（已封装）
npm run check          # 类型检查 73 文件（无需工具链）
npm run test           # 离线回归：并发 59 + FileDB 26 + 资产选择 19 断言（真实二进制）
npm run test:net       # 网络回归：下载完整性契约（需外网；镜像抖动偶发失败，重跑确认）
npm run build:cli      # dist/HamsterStore.exe + attest
npm run build:gui      # dist/HamsterStore-GUI.exe + .pdb + attest（--debug-symbols）
npm run build:all
```

**GUI 必做烟测**（构建后立即执行，防上游回归）：

```bash
timeout 8 ./dist/HamsterStore-GUI.exe; [ $? -eq 124 ] && echo "GUI OK" || echo "GUI CRASHED"
```

脚本链：`build.sh` / `test-*.sh` → `perry-source-env.sh`（1520 主环境）→
`llvm-build-env.sh`（纯 LLVM 定位）。跨版本升级后先 `npx perry cache clean`。

## 4. 环境变量速查（脚本已封装）

|变量|值|原因|
|---|---|---|
|`PERRY_LLVM_CLANG`|llvm-mingw/bin/clang.exe|codegen 汇编步骤|
|`PERRY_LLD_LINK`|llvm-mingw/bin/lld-link.exe|链接器|
|`PERRY_WORKSPACE_ROOT`|%LOCALAPPDATA%/perry/perry-source|触发 cargo 重建 runtime+stdlib（补正则）|
|`PERRY_LIB_DIR`|%LOCALAPPDATA%/perry/libs-ui|提供源建 perry_ui_windows.lib|
|`PERRY_RS4GC`|`0`（1520 必须）|#7354：WinEH funclet 与 statepoint pass 冲突|
|`CC`/`CXX`/`AR`/`LIB`/`INCLUDE`|clang-cl + xwin sysroot|源码重建时 cc-rs/cargo 消费|
|`CARGO_TARGET_..._LINKER`|link-shim/link.exe|防 rustc 误用 git-bash link.exe|

## 5. 已知限制

- **1664/1665 GUI 不可用**（上游打包事故）：GUI 留在 1520，CLI 同版本，单一工具链。
  升级 Perry 前必须过 GUI 烟测 + 9 导航点击 + 搜索/下载触发。
- #14982（1665+）前瞻规则见 §0；1520 编译器不校验，但代码已就绪。
- net 测试依赖真实外网与镜像可用性，偶发失败先重跑再排查。
- `perry doctor` 在 git-bash 下可能误报 system linker OK；
  "runtime library not found" 在 workspace/libs-ui 生效时可忽略。

## 附录 A：1520 源码重建细节（本机已就绪；首次数分钟，之后走缓存）

1. `PERRY_WORKSPACE_ROOT` 指向 perry-source → perry 按 imports 生成
   `target/perry-auto-<hash>/`，cargo 以 `panic=unwind, features=async-runtime`
   重建 perry-runtime-static + perry-stdlib-static（含正则入口）。
2. UI 库不由 perry 自动构建：手动解压 `.zst` 到 `libs-ui/`，`PERRY_LIB_DIR` 暴露。
3. 重建失败排查：`LIB`/`INCLUDE` 是否指向 xwin sysroot、`AR` 是否 llvm-lib、
   link-shim 四个 DLL 是否齐全（缺则 `0xc0000135`）。

## 附录 B：0.5.1665 CLI-only 实验（GUI 被上游打包事故阻断）

1665 的 npm stdlib 已含正则入口、#7354 已修（默认 statepoint GC），**CLI 可用**：

- 手动解压 `perry_runtime.lib.zst` / `perry_stdlib.lib.zst` / `perry_ui_windows.lib.zst`
  到 `libs-1665/`，并把 `perry_runtime.lib.gc-effects` sidecar 放同目录
  （1665 不再自动解压；缺 sidecar 时 codegen 按“全 safepoint”慢速编译）。
- 不设 `PERRY_RS4GC`；`PERRY_RUNTIME_DIR`/`PERRY_LIB_DIR` 指向 `libs-1665`。

**GUI 崩溃证据链**（0.5.1665 官方产物，2026-11-20 本机复现）：

1. `perry_ui_windows.lib` 含 16 个 `perry_runtime-ca03e9dfe259b4d8...cgu.NN.rcgu.o`
   成员（独立 cargo 解析；元数据 hash 与 runtime/stdlib 的 `e05f032d...` 不同）。
   体积 109,223,206B / 11,417 成员，与上游发布一致。
2. Perry 链接参数吞掉重复符号（`/FORCE:MULTIPLE` + `/IGNORE:4006`），exe 含两份
   runtime；`.perryat` 段头出现**两个** `ATOM_START`（llvm-objdump 可见
   `+0x0`、`+0x8` 两个 8 字节标记均为 0，记录从 `+0x10` 开始）。
3. `seed_static_atoms` 把 `.perryat` 当 `ATOM_START+8` 起的 24 字节步长数组 →
   偏移 8 字节 → hashbrown 常量被当指针解引用 → 用户代码前 ACCESS_VIOLATION。
4. 探针矩阵（本机）：纯 `Text` 存活；`VStack(8,[Text,...])` 必崩（1664 连 Text 也崩）。
5. 已知缓解（剪掉 UI 库内 16 个 runtime 成员 + `/FORCE:UNRESOLVED`）能让 Text 存活，
   但 7 个泛型实例（`RawVec<i32|bool|(String,f64)>::grow_one`、
   `RawTable<(String,String)|(usize,())>::reserve_rehash`、`Arc<[u8]>::drop_slow`、
   `perry_stub_warn`）变成 image_base−1GB 的空跳板 → **任何容器控件**仍必崩。
   故不作为产品方案。

**升级门禁**：上游发布 1666+ 并声明 `strip-dedup` 的 bundled-runtime drop 修复
（或 UI 库与 runtime 同批 cargo 构建）后，执行：
1. 解压新库 → `timeout 8 dist/HamsterStore-GUI.exe` 存活；
2. 手工点击 9 个导航页 + 搜索 + 下载触发，无崩溃；
3. `npm run check && npm test && npm run test:net` 全绿；
4. 更新 docs/PERRY_COMPLIANCE.md 的版本矩阵后再提交。
