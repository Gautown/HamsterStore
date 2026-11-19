#!/usr/bin/env bash
# Perry 0.5.1520 源码重建环境 — 在 llvm-build-env.sh 基础上启用 PERRY_WORKSPACE_ROOT
# 用途：npm 预编译 stdlib 缺正则运行时入口（js_regexp_new / js_regexp_test /
#       js_string_match / js_string_match_value / js_string_replace_regex），
#       凡用正则字面量的模块（FileDB/ProxyManager/netFetch/GitHubAPIClient…）链接必挂。
#       指向 perry 源码树后，perry 会按项目 imports 用 cargo 重建 runtime+stdlib（含正则）。
# 用法： source scripts/perry-source-env.sh && npx perry compile src/main.ts -o dist/HamsterStore.exe
#
# 前置（见 docs/BUILD.md）：
#   - Rust stable（rustup，rsproxy.cn 镜像）
#   - perry 源码：git clone --depth 1 --branch v0.5.1520 https://github.com/PerryTS/perry.git
#     到 $LOCALAPPDATA/perry/perry-source（GitHub 慢可加 https://gh-proxy.org/ 前缀）
#   - link-shim：$LOCALAPPDATA/perry/link-shim/link.exe = lld-link.exe 的副本
#     （perry 把 cargo 链接器指向这里，代替 MSVC link.exe）
#   - xwin sysroot：$LOCALAPPDATA/perry/windows-sdk（perry setup windows）

source "$(dirname "${BASH_SOURCE[0]}")/llvm-build-env.sh"

PERRY_TOOLS="${PERRY_TOOLS:-${LOCALAPPDATA//\\//}/perry}"
PERRY_SRC="${PERRY_SRC:-$PERRY_TOOLS/perry-source}"
WS_WIN="$USERPROFILE\\AppData\\Local\\perry\\windows-sdk"
LV_WIN="$USERPROFILE\\AppData\\Local\\perry\\llvm-mingw-20261117-ucrt-x86_64\\bin"

export PERRY_WORKSPACE_ROOT="${PERRY_SRC//\//\\}"
export PATH="$HOME/.cargo/bin:$PATH"

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
