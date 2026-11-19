# Windows 构建环境搭建指南（Perry 0.5.1665，无 MSVC / Visual Studio）

> 2026-11-19 本机完整验证：`npm run check`（75 文件）、`npm test`（104 断言）、
> `npm run test:net`（10 断言）、`npm run build:all`（CLI 13.6MB / GUI 18.3MB + .pdb）、
> e2e 下载（ripgrep 15.2.0 经镜像 4MB/s）全部通过。
> 项目已从 0.5.1520 升级到 0.5.1665；1520  legacy 方案见附录 A。

## 0. 1665 相对 1520 的关键变化

| 项 | 0.5.1520 | 0.5.1665 |
|---|---|---|
| npm stdlib 正则入口 | 缺（需源码重建） | **已含**（无需 Rust/源码树） |
| try/catch WinEH (#7354) | 必须 PERRY_RS4GC=0 | **已修复**，默认 statepoint GC |
| 捆绑 .zst 库 | 首次链接自动解压 | **不自动解压**，需手动（§2.4） |
| GC effects sidecar | 无 | runtime 旁需 perry_runtime.lib.gc-effects |
| class 方法 $pshape (#14982) | 无此问题 | **Windows COFF 编译拒绝** → 对象字面量工厂适配 |
| attest commit_sha | 构建目录非 git 时为空 | git 工作树内构建自动写入 |

**#14982 适配规则（新增代码必须遵守）**：不要用 class 封装带 GC roots 的方法
（闭包/网络回调/字符串字段），Windows 上其 $pshape 克隆产生 .def/.scl/.endef
alias 记录落在 .llvm_stackmaps 之后，compact-map rewriter 拒绝整模块。
用工厂函数 + 对象字面量（本项目 GitHubAPIClient/GitHubSearchEngine/ProxyManager/
SelfUpdater 已重构，DownloadManager/repositories 本就是此风格）。
最小复现与开关矩阵见上游 issue；所有编译器开关均无效，只能源码侧适配。

## 1. 目录布局（全部用户级，无需管理员权限）

```
%LOCALAPPDATA%\perry\
  llvm-mingw-20261117-ucrt-x86_64\bin\   clang / lld-link / llvm-lib / clang-cl / mt.exe + DLL
  llvm-22.1.8\bin\                       llvm-mt（GUI manifest）+ LLVM-C.dll
  windows-sdk\                            CRT + Windows SDK（xwin splat 产物）
  libs-1665\                              手动解压的 1665 runtime/stdlib/UI + gc-effects sidecar
  link-shim\                              [legacy 1520] lld-link 副本 + DLL
  perry-source\                           [legacy 1520] PerryTS/perry v0.5.1520 浅克隆
%USERPROFILE%\.cargo\                    [legacy 1520] Rust stable
```

## 2. 安装步骤

### 2.1 LLVM 工具链（llvm-mingw，免安装）

GitHub 直连慢（~43KB/s），用镜像前缀 `https://gh-proxy.org/<原始URL>`
（~347KB/s；4-6 并发 Range 分块再快数倍，校验拼接后总字节数）。

```bash
# 下载 llvm-mingw-20261117-ucrt-x86_64.zip（191MB，mstorsjo/llvm-mingw releases）
# 解压到 %LOCALAPPDATA%\perry\
B=%LOCALAPPDATA%/perry/llvm-mingw-20261117-ucrt-x86_64/bin
cp $B/ld.lld.exe $B/lld-link.exe     # lld 按 argv[0] 分发 flavor
cp $B/clang-23.exe $B/clang-cl.exe   # 必须用真驱动 clang-23.exe（clang.exe 是 wrapper）
```

### 2.2 mt.exe（manifest 工具，GUI 链接必需）

从官方 LLVM-22.1.8-win64.exe 用 7-Zip 解出 `bin/llvm-mt.exe` + `bin/LLVM-C.dll`
（无需运行安装器/UAC），llvm-mt 改名 mt.exe，放到 llvm-mingw/bin 与
node_modules/@perryts/perry-win32-x64/bin（lld-link 的搜索不总走 PATH）。

### 2.3 Windows SDK + CRT（xwin）

```bash
npm install
# xwin.exe：从 Jake-Shadle/xwin releases 下 0.10.0（0.9.0 对 Win11 SDK 26100 报错），
# 放到项目根目录（perry 按 cwd 查找）
export PERRY_LLVM_CLANG=$B/clang.exe PERRY_LLD_LINK=$B/lld-link.exe
perry setup windows --accept-license
```

**坑**：xwin 缓存（cwd/.xwin-cache）与输出（%LOCALAPPDATA%\perry\windows-sdk）
必须同盘（splat 用 rename，跨盘 os error 17）。

### 2.4 解压 1665 捆绑库（新增必需步骤）

1665 不自动解压 npm 包里的 .zst 库。用任意 zstd 工具（如 Python `zstandard`）：

```python
# pip install zstandard
import zstandard as zstd, shutil, os
src = r"node_modules/@perryts/perry-win32-x64/lib"
dst = os.path.expandvars(r"%LOCALAPPDATA%\perry\libs-1665")
os.makedirs(dst, exist_ok=True)
for name in ["perry_runtime.lib.zst", "perry_stdlib.lib.zst", "perry_ui_windows.lib.zst"]:
    with open(os.path.join(src, name), "rb") as f, open(os.path.join(dst, name[:-4]), "wb") as g:
        zstd.ZstdDecompressor().copy_stream(f, g)
shutil.copy(os.path.join(src, "perry_runtime.lib.gc-effects"), dst)  # sidecar 必需
```

升级 perry 版本后需重新解压对应版本的库（勿混用旧版 runtime/stdlib）。

## 3. 日常使用

```bash
npm run check          # 类型检查（无需工具链）
npm run test           # 离线回归：并发 59 + FileDB 26 + 资产选择 19 断言（真实二进制）
npm run test:net       # 网络回归：下载完整性契约（需外网；镜像瞬时抖动可致偶发失败，重跑确认）
npm run build:cli      # dist/HamsterStore.exe + attest（commit_sha 自动写入）
npm run build:gui      # dist/HamsterStore-GUI.exe + .pdb + attest
npm run build:all
```

脚本链：`build.sh` / `test-*.sh` → `llvm-build-env.sh`（1665 环境）。
跨版本升级后先 `npx perry cache clean`（对象缓存避免混用）。

## 4. 环境变量速查（脚本已封装）

| 变量 | 值 | 原因 |
|---|---|---|
| `PERRY_LLVM_CLANG` | llvm-mingw/bin/clang.exe | codegen 汇编步骤 |
| `PERRY_LLD_LINK` | llvm-mingw/bin/lld-link.exe | 链接器 |
| `PERRY_RUNTIME_DIR`/`PERRY_LIB_DIR` | libs-1665 | 1665 不自动解压/不搜索缓存 |
| `PERRY_RS4GC` | 不设置（默认 statepoint） | #7354 已修复；=0 回退 shadow stack 仅调试用 |
| `CC`/`CXX`/`AR`/`LIB`/`INCLUDE` | [legacy 1520] | 源码重建时 cc-rs/cargo 用 |

## 5. 已知限制

- #14982 未修复（open, effort:S）：class 方法模式在 Windows 编译拒绝，遵守 §0 适配规则。
- net 测试依赖真实外网与镜像可用性，偶发失败先重跑再排查。
- `perry doctor` 的 "system linker OK" 是误报（git-bash link.exe）；
  "runtime library not found" 在手动解压 + PERRY_RUNTIME_DIR 路径下可忽略。

## 附录 A：Legacy 0.5.1520 源码重建（仅回退时需要）

1520 的 npm stdlib 缺正则入口（js_regexp_new 等 5 符号），需：
1. Rust stable（rustup，rsproxy.cn 镜像）+ ~/.cargo/config.toml 配 rsproxy sparse registry
2. `git clone --depth 1 --branch v0.5.1520 https://github.com/PerryTS/perry.git` 到 perry-source
3. link-shim：lld-link 副本命名 link.exe + libLLVM-23/libc++/libunwind/libwinpthread DLL
   （rustc 否则找到 git-bash 假 link.exe；副本缺 DLL 报 0xc0000135）
4. `source scripts/perry-source-env.sh`（PERRY_WORKSPACE_ROOT + CC/CXX/AR/LIB/INCLUDE +
   CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER + PERRY_RS4GC=0）
5. 首次构建 cargo 重建 runtime+stdlib（几分钟），之后走缓存
6. GUI 还需手动解压 perry_ui_windows.lib.zst（1520 也不自动解压 UI 库）
