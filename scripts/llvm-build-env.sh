#!/usr/bin/env bash
# LLVM 工具链定位（不含 Perry 运行时版本选择）— 主环境与 1665 CLI 实验环境共用
# 用法： source scripts/llvm-build-env.sh
#
# 工具链布局（完整安装步骤见 docs/BUILD.md）：
#   $LOCALAPPDATA/perry/llvm-mingw-<ver>/bin   clang / lld-link / llvm-lib / mt.exe
#   $LOCALAPPDATA/perry/llvm-22.1.8/bin        llvm-mt（GUI 链接 manifest 用）+ LLVM-C.dll
#   $LOCALAPPDATA/perry/windows-sdk            CRT + Windows SDK（perry setup windows，经 xwin 0.10）
#   $LOCALAPPDATA/perry/libs-1665              1665 CLI-only 实验库（见 docs/BUILD.md 附录 B）
#
# Perry 运行时库不在此文件设置：
#   - 主构建（GUI + CLI）→ scripts/perry-source-env.sh（0.5.1520 源码重建，唯一 GUI 可用组合）
#   - 1665：perry_ui_windows.lib 内嵌重复 runtime → GUI 启动即崩（docs/PERRY_COMPLIANCE.md），仅 CLI 实验
#
# 关键实测点（2026-11-19/20 本机验证）：
#   1. 上游 #14982（1665）：class 方法 $pshape COFF alias 触发 compact-map rewriter 拒绝 →
#      GitHubAPIClient/GitHubSearchEngine/ProxyManager/SelfUpdater 已重构为对象字面量工厂。
#      1520 无此限制，但新代码仍建议工厂函数 + 对象字面量（未来兼容）。
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

echo "[llvm-env] LLVM_BIN=$LLVM_BIN"
