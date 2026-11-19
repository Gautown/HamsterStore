# Windows 构建环境搭建指南（Perry 0.5.1520，无 MSVC / Visual Studio）

> 2026-11-19 在本机完整验证：`npm run test`（59/59 通过）、`npm run build:cli`、
> `npm run build:gui`（含 .pdb）全部成功。本文记录每一步与每个坑。

## 0. 为什么需要这套环境

- `perry check` 只做类型检查，**不需要**任何工具链；但 `perry compile` 需要
  LLVM（clang/lld-link）+ Windows SDK/CRT + Perry runtime/stdlib 静态库。
- **npm 包预编译的 stdlib 缺正则运行时入口**（`js_regexp_new` / `js_regexp_test` /
  `js_string_match` / `js_string_match_value` / `js_string_replace_regex`）。
  凡用正则字面量的模块（FileDB / ProxyManager / netFetch / GitHubAPIClient…）
  链接必挂 `undefined symbol`。解法：`PERRY_WORKSPACE_ROOT` 指向 perry 源码树，
  让 perry 用 cargo 按项目 imports 重建 runtime+stdlib（正则入口在 feature-gated
  ext crate 里，重建后自动包含）。
- 0.5.1665 的 npm stdlib 已补齐正则，但其 compact-map rewriter 对含 GC stackmap
  的模块（GitHubSearchEngine / ProxyManager / GitHubAPIClient）报
  "could not parse" 拒绝编译（RS4GC 开关与 clang 22/23 均无效）——**不要升级**，
  留在 0.5.1520 + 源码重建。
- 含 `try/catch` 的模块在 Windows lowered 成 WinEH funclet，与 RS4GC statepoint
  pass 不兼容（上游 #7354）→ 全程 `PERRY_RS4GC=0`。

## 1. 目录布局（全部用户级，无需管理员权限）

```
%LOCALAPPDATA%\perry\
  llvm-mingw-20261117-ucrt-x86_64\bin\   clang / lld-link / llvm-lib / clang-cl / mt.exe
  llvm-22.1.8\bin\                       clang-22.1.8 + LLVM-C.dll + mt.exe（llvm-mt）
  windows-sdk\                           CRT + Windows SDK（xwin splat 产物）
  perry-source\                          PerryTS/perry v0.5.1520 浅克隆
  libs-flat\                             npm 包解压的 perry_runtime.lib + perry_stdlib.lib（测试用）
  libs-ui\                               解压的 perry_ui_windows.lib（GUI 链接用）
  link-shim\                             link.exe = lld-link 副本 + 依赖 DLL
  .xwin-cache\                           xwin 下载缓存（必须与 windows-sdk 同盘！）
%USERPROFILE%\.cargo\                    Rust stable（rustup）
```

## 2. 安装步骤

### 2.1 LLVM 工具链（llvm-mingw，免安装）

GitHub 直连慢（实测 ~43KB/s），用镜像前缀 `https://gh-proxy.org/<原始URL>`
（实测 ~347KB/s；4 并发分块 Range 下载可再快 4 倍）。

```bash
# 下载 llvm-mingw-20261117-ucrt-x86_64.zip（191MB，mstorsjo/llvm-mingw releases）
# 解压到 %LOCALAPPDATA%\perry\
B=%LOCALAPPDATA%/perry/llvm-mingw-20261117-ucrt-x86_64/bin
cp $B/ld.lld.exe $B/lld-link.exe     # lld 按 argv[0] 分发 flavor
cp $B/clang-23.exe $B/clang-cl.exe   # 必须用真驱动 clang-23.exe！
                                     # clang.exe 是 target-wrapper，改名不进 cl 模式
```

### 2.2 mt.exe（manifest 工具，GUI 链接必需）

lld-link 链接 GUI 时调 `mt.exe` 嵌入 manifest。llvm-mingw 不带；从官方
LLVM-22.1.8-win64.exe 安装包用 7-Zip 解出 `bin/llvm-mt.exe`（无需运行安装器/UAC）：

```bash
7z x LLVM-22.1.8-win64.exe bin/llvm-mt.exe bin/LLVM-C.dll -o%LOCALAPPDATA%/perry/llvm-22.1.8
cp .../llvm-mt.exe .../mt.exe
# mt.exe 依赖 LLVM-C.dll：把 mt.exe+LLVM-C.dll 放进 llvm-mingw/bin 和
# node_modules/@perryts/perry-win32-x64/bin（lld-link 的搜索不总走 PATH）
```

### 2.3 Windows SDK + CRT（xwin）

```bash
npm install                              # 装 perry 0.5.1520（lockfile 锁定）
# xwin.exe：npm 包不带。从 Jake-Shadle/xwin releases 下 0.10.0（0.9.0 对
# Win11 SDK 26100 报 "unable to find x86_64 headers"）。放到项目根目录（perry 按 cwd 找）。
export PERRY_LLVM_CLANG=$B/clang.exe PERRY_LLD_LINK=$B/lld-link.exe
perry setup windows --accept-license     # 下载 ~700MB / 解压 ~1.5GB
```

**坑**：xwin 缓存默认在 cwd/.xwin-cache，splat 用 rename 移动文件——缓存与输出
（%LOCALAPPDATA%\perry\windows-sdk）**必须同盘**，否则 os error 17。在 C 盘目录
下运行 setup，或先把 .xwin-cache 移到 C 盘。

### 2.4 Rust + Perry 源码（正则运行时重建）

```bash
# rustup（国内用 rsproxy 镜像，static.rust-lang.org 直连很慢）
RUSTUP_DIST_SERVER=https://rsproxy.cn RUSTUP_UPDATE_ROOT=https://rsproxy.cn/rustup \
  rustup-init.exe -y --profile minimal --default-toolchain stable
# ~/.cargo/config.toml 配 rsproxy sparse registry（见该文件）

git clone --depth 1 --branch v0.5.1520 \
  https://gh-proxy.org/https://github.com/PerryTS/perry.git \
  %LOCALAPPDATA%/perry/perry-source

# link-shim：cargo/rustc 的 MSVC 链接器
mkdir %LOCALAPPDATA%/perry/link-shim
cp $B/lld-link.exe %LOCALAPPDATA%/perry/link-shim/link.exe
cp $B/libLLVM-23.dll $B/libc++.dll $B/libunwind.dll $B/libwinpthread-1.dll \
   %LOCALAPPDATA%/perry/link-shim/    # 副本离开原目录会 0xc0000135 (DLL not found)
```

**坑**：不设 `CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER` 的话，rustc 会在 PATH
里找到 git-bash 的 `/usr/bin/link.exe`（coreutils 硬链接工具）并报 "extra operand"。
脚本里已显式指向 link-shim。

### 2.5 GUI 库与测试库（.zst 手动解压）

perry 首次链接会自动解压 npm 包的 runtime/stdlib 到 `libs/<hash>/`，但**该缓存
目录不在后续编译的搜索路径里**（perry bug）→ 展平到 libs-flat/ 并用
`PERRY_RUNTIME_DIR`/`PERRY_LIB_DIR` 显式指定。`perry_ui_windows.lib.zst` 则完全
不会自动解压 → 手动解压到 libs-ui/（Python `zstandard` 或任何 zstd 工具）。

## 3. 日常使用

```bash
npm run check          # 类型检查（无需工具链）
npm run test           # 并发测试：编译真实二进制并运行（59 断言）
npm run build:cli      # dist/HamsterStore.exe + attest
npm run build:gui      # dist/HamsterStore-GUI.exe + .pdb + attest
npm run build:all
```

脚本链：`build.sh` → `perry-source-env.sh` → `llvm-build-env.sh`。
首次构建 cargo 重建 runtime+stdlib 约几分钟；之后走缓存，秒级。

## 4. 环境变量速查（脚本已封装，此处供排查）

| 变量 | 值 | 原因 |
|---|---|---|
| `PERRY_RS4GC` | `0` | try/catch WinEH funclet 与 statepoint pass 不兼容（#7354） |
| `PERRY_WORKSPACE_ROOT` | perry-source（Windows 路径） | 触发 cargo 重建，补正则入口 |
| `PERRY_LLVM_CLANG` | llvm-mingw/bin/clang.exe | codegen 汇编步骤 |
| `PERRY_LLD_LINK` | llvm-mingw/bin/lld-link.exe | 链接器 |
| `PERRY_RUNTIME_DIR`/`PERRY_LIB_DIR` | libs-flat（测试）/ libs-ui（GUI） | 解压缓存不在搜索路径 |
| `CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER` | link-shim/link.exe | 避开 git-bash 假 link.exe |
| `CC`/`CXX`/`AR` | clang-cl / llvm-lib | cc-rs 编译 mimalloc 等 C 依赖 |
| `LIB`/`INCLUDE` | xwin sysroot 路径 | cargo 链接系统库 |

## 5. 已知限制

- `PERRY_RS4GC=0` 关闭精确 GC stackmap 重写（保守扫描回退）。含 try/catch 的
  模块在 #7354 修复前别无选择；作者此前的手工链接脚本同样用 RS4GC=0。
- 0.5.1665 不可用（compact-map rewriter 拒绝 3 个核心模块），升级前先在
  隔离目录验证 `perry compile src/main.ts`。
- `perry doctor` 的 "system linker OK" 是误报（找到的是 git-bash link.exe）；
  "runtime library not found" 在源码重建路径下可忽略。
