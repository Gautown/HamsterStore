#!/usr/bin/env bash
# Perry 0.5.1665 Windows 构建环境 — LLVM + xwin sysroot，不依赖 MSVC / Visual Studio
# 用法： source scripts/llvm-build-env.sh   然后执行 perry compile / npm run build:* / npm test
#
# 工具链布局（完整安装步骤见 docs/BUILD.md）：
#   $LOCALAPPDATA/perry/llvm-mingw-<ver>/bin   clang / lld-link / llvm-lib / mt.exe
#   $LOCALAPPDATA/perry/llvm-22.1.8/bin        llvm-mt（GUI 链接 manifest 用）+ LLVM-C.dll
#   $LOCALAPPDATA/perry/windows-sdk            CRT + Windows SDK（perry setup windows，经 xwin 0.10）
#   $LOCALAPPDATA/perry/libs-1665              1665 npm 包 .zst 手动解压：runtime/stdlib/UI + gc-effects sidecar
#
# 关键实测点（0.5.1665，2026-11-19 本机验证）：
#   1. 默认 GC（statepoint）即可 — #7354（try/catch WinEH funclet）已修复，不再需要 PERRY_RS4GC=0。
#   2. 1665 不再自动解压 npm 捆绑 .zst 库 → 必须手动解压到 libs-1665 并显式指定
#      PERRY_RUNTIME_DIR / PERRY_LIB_DIR（含 perry_runtime.lib.gc-effects sidecar）。
#   3. npm stdlib 已含正则入口（js_regexp_new 等）→ 不再需要 1520 时代的源码重建
#      （legacy 方案保留在 scripts/perry-source-env.sh，仅回退 1520 时用）。
#   4. 上游 #14982：class 方法 $pshape COFF alias 触发 compact-map rewriter 拒绝 →
#      GitHubAPIClient/GitHubSearchEngine/ProxyManager/SelfUpdater 已重构为对象字面量工厂。
#      新增代码避免用 class 封装带 GC roots 的方法（用工厂函数 + 对象字面量）。
#   5. lld-link.exe / clang-cl.exe 由 ld.lld.exe / clang-23.exe 复制改名而来
#      （lld/clang 按 argv[0] 分发 flavor；clang.exe 是 wrapper，改名不进 cl 模式）。
#   6. xwin.exe 需放在编译工作目录（perry 按 cwd 查找）；xwin 缓存与输出必须同盘。
#   7. GitHub 直连下载慢时用镜像前缀：https://gh-proxy.org/<原始URL>。
#      镜像能力：gh-proxy.org 代理 API+文件；ghfast.top/ghproxy.net 仅文件。

PERRY_TOOLS="${PERRY_TOOLS:-${LOCALAPPDATA//\\//}/perry}"
LLVM_BIN="${LLVM_BIN:-$PERRY_TOOLS/llvm-mingw-20261117-ucrt-x86_64/bin}"

export PATH="$LLVM_BIN:$PERRY_TOOLS/llvm-22.1.8/bin:$PATH"
export PERRY_LLVM_CLANG="$LLVM_BIN/clang.exe"
export PERRY_LLD_LINK="$LLVM_BIN/lld-link.exe"
export PERRY_RUNTIME_DIR="$PERRY_TOOLS/libs-1665"
export PERRY_LIB_DIR="$PERRY_TOOLS/libs-1665"

echo "[perry-env] LLVM_BIN=$LLVM_BIN"
echo "[perry-env] PERRY_RUNTIME_DIR=$PERRY_RUNTIME_DIR (perry 0.5.1665, 默认 statepoint GC)"
