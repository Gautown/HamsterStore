#!/usr/bin/env bash
# Perry 0.5.1520 Windows 构建环境 — LLVM + xwin sysroot，不依赖 MSVC / Visual Studio
# 用法： source scripts/llvm-build-env.sh   然后执行 perry compile / npm run build:*
#
# 工具链布局（完整安装步骤见 docs/BUILD.md）：
#   $LOCALAPPDATA/perry/llvm-mingw-<ver>/bin   clang / lld-link / llvm-lib（llvm-mingw ucrt x86_64）
#   $LOCALAPPDATA/perry/windows-sdk            CRT + Windows SDK（perry setup windows，经 xwin 0.10）
#   $LOCALAPPDATA/perry/libs-flat              perry_runtime.lib + perry_stdlib.lib（npm 包 .zst 解压展平）
#
# 关键实测点（0.5.1520，2026-11-19 本机验证）：
#   1. PERRY_RS4GC=0 — 含 try/catch 的模块在 Windows lowered 成 WinEH funclet，
#      RS4GC statepoint pass 直接 access violation（上游 #7354），必须关闭。
#   2. PERRY_RUNTIME_DIR / PERRY_LIB_DIR 必须显式指定 — perry 自动解压的缓存目录
#      （libs/<hash>/）不在链接器搜索路径里，二次编译会报 "Could not find perry_runtime.lib"。
#   3. lld-link.exe / clang-cl.exe 由 ld.lld.exe / clang.exe 复制改名而来
#      （lld/clang 按 argv[0] 分发 flavor，llvm-mingw 包只带 ld.lld 名字）。
#   4. xwin.exe 需放在编译工作目录（perry 按 cwd 查找）；xwin 缓存目录与输出目录
#      必须同盘，否则 splat 阶段 rename 跨盘失败（os error 17）。
#   5. GitHub 直连下载慢时用镜像前缀：https://gh-proxy.org/<原始URL>（实测 347KB/s vs 43KB/s）。
#
# 历史方案（已废弃）：旧版本此脚本用 PERRY_WORKSPACE_ROOT 指向 perry 源码树重建
# runtime（补正则入口 js_regexp_new 等）。0.5.1520 的 npm 包自带完整 runtime/stdlib
# （.zst 压缩，首次链接自动解压），无需源码树；正则限制见 DedupEngine.tokenize 注释。

PERRY_TOOLS="${PERRY_TOOLS:-${LOCALAPPDATA//\\//}/perry}"
LLVM_BIN="${LLVM_BIN:-$PERRY_TOOLS/llvm-mingw-20261117-ucrt-x86_64/bin}"

export PATH="$LLVM_BIN:$PERRY_TOOLS/llvm-22.1.8/bin:$PATH"
export PERRY_LLVM_CLANG="$LLVM_BIN/clang.exe"
export PERRY_LLD_LINK="$LLVM_BIN/lld-link.exe"
export PERRY_RUNTIME_DIR="$PERRY_TOOLS/libs-flat"
export PERRY_LIB_DIR="$PERRY_TOOLS/libs-flat"
export PERRY_RS4GC=0

echo "[perry-env] LLVM_BIN=$LLVM_BIN"
echo "[perry-env] PERRY_RS4GC=0  PERRY_RUNTIME_DIR=$PERRY_RUNTIME_DIR"
