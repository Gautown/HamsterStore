#!/usr/bin/env bash
# 主构建环境 — Perry 0.5.1520（源码重建 runtime + stdlib + UI，单次 cargo 解析）
#
# 为什么锁 0.5.1520 而不是最新 0.5.1665：
#   官方 npm 包 0.5.1664/1665 的 perry_ui_windows.lib 由另一次独立 cargo 构建产出，
#   内嵌了第二份 perry_runtime（元数据 hash 与 runtime/stdlib 的不同）。链接后 exe 的
#   .perryat 段出现两个 ATOM_START 标记 → seed_static_atoms 按 24 字节步长解析错位 →
#   在**任何用户代码之前**空指针崩溃，且任何容器控件（VStack/HStack/Divider/Button）必崩。
#   实测矩阵见 docs/PERRY_COMPLIANCE.md；上游无 1666+ 修复版。
#   0.5.1520 的 runtime/stdlib/UI 由同一工作区构建，单一标记，GUI 稳定（2026-11-20 本机 14min+）。
#
# 1520 的 npm 预编译 stdlib 缺正则运行时入口（js_regexp_new 等），故设
#   PERRY_WORKSPACE_ROOT → perry 自动 cargo 重建 runtime+stdlib（含正则）；
#   PERRY_LIB_DIR=libs-ui 暴露源建 perry_ui_windows.lib（仅该文件，不遮蔽重建产物）。
#
# 前置（见 docs/BUILD.md）：
#   - Rust stable（rustup，rsproxy.cn 镜像）+ cargo 缓存已就绪
#   - perry 源码：git clone --depth 1 --branch v0.5.1520 → $LOCALAPPDATA/perry/perry-source
#   - link-shim：$LOCALAPPDATA/perry/link-shim/link.exe = lld-link.exe 副本（带 DLL）
#   - xwin sysroot：$LOCALAPPDATA/perry/windows-sdk（perry setup windows）

source "$(dirname "${BASH_SOURCE[0]}")/llvm-build-env.sh"

PERRY_TOOLS="${PERRY_TOOLS:-${LOCALAPPDATA//\\//}/perry}"
PERRY_SRC="${PERRY_SRC:-$PERRY_TOOLS/perry-source}"
WS_WIN="$USERPROFILE\\AppData\\Local\\perry\\windows-sdk"
LV_WIN="$USERPROFILE\\AppData\\Local\\perry\\llvm-mingw-20261117-ucrt-x86_64\\bin"

export PERRY_WORKSPACE_ROOT="${PERRY_SRC//\//\\}"
export PATH="$HOME/.cargo/bin:$PATH"

# #7354：WinEH funclet 与 statepoint pass 不兼容（1520 必须关闭 RS4GC；1665 已修复但 GUI 不可用）
export PERRY_RS4GC=0

# cargo/cc-rs/lld-link 消费 Windows 风格路径
export LIB="$WS_WIN\\crt\\lib\\x86_64;$WS_WIN\\sdk\\lib\\um\\x86_64;$WS_WIN\\sdk\\lib\\ucrt\\x86_64"
export INCLUDE="$WS_WIN\\crt\\include;$WS_WIN\\sdk\\include\\ucrt;$WS_WIN\\sdk\\include\\shared;$WS_WIN\\sdk\\include\\um"
export CC="$LV_WIN\\clang-cl.exe"
export CXX="$LV_WIN\\clang-cl.exe"
export AR="$LV_WIN\\llvm-lib.exe"
export CC_x86_64_pc_windows_msvc="$LV_WIN\\clang-cl.exe"
export CXX_x86_64_pc_windows_msvc="$LV_WIN\\clang-cl.exe"

# 源码重建时不要用 npm 预编译库（缺正则），让 perry 用 workspace target 里的重建产物
unset PERRY_RUNTIME_DIR PERRY_LIB_DIR
# 但 perry_ui_windows.lib（GUI 链接用）只以 .zst 形式随 npm 包发布，perry 不会自动解压它：
# 手动解压到 libs-ui/ 并经 PERRY_LIB_DIR 暴露（该目录只有 UI 库，不会遮蔽重建的 runtime/stdlib）
export PERRY_LIB_DIR="$PERRY_TOOLS/libs-ui"

# rustc/cargo 的 MSVC 目标链接器 → link-shim（lld-link 副本）。
# 必须显式指定：否则 rustc 在 PATH 里找到 git-bash 的 /usr/bin/link.exe（coreutils 硬链接工具）
export CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER="$PERRY_TOOLS/link-shim/link.exe"
export PATH="$PERRY_TOOLS/link-shim:$PATH"

echo "[perry-source-env] PERRY_WORKSPACE_ROOT=$PERRY_WORKSPACE_ROOT"
echo "[perry-source-env] CC=clang-cl AR=llvm-lib LIB/INCLUDE=xwin sysroot"
