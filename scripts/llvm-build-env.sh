# LLVM-only 构建环境（不依赖 Visual Studio / MSVC）
# 用法： source scripts/llvm-build-env.sh  然后执行 perry compile / npm run build:*
#
# 为什么需要这些变量（0.5.1520 实测）：
#   1. Perry 的正则运行时入口（js_regexp_new / js_string_match / js_string_replace_regex）
#      不在 npm 预编译库里，必须用 PERRY_WORKSPACE_ROOT 指向 perry 源码树重建 runtime。
#   2. 重建 runtime 时 perry 需要 cargo 链接宿主工具链，但它把链接器指向
#      ~/AppData/Local/perry/link-shim/link.exe —— 该文件必须由用户放置（用 lld-link 代替 MSVC）。
#   3. cargo 链接时需要 Windows SDK 系统库路径（LIB），cc-rs 编译 C 依赖时需要
#      头文件路径（INCLUDE）与 C 编译器（CC/CXX → clang-cl），归档器 AR → llvm-lib。

PERRY_SRC="${PERRY_SRC:-F:/GoghStudio/GitHub/perry-source}"
WS_BASE="${WS_BASE:-$HOME/AppData/Local/perry}"
WS="$(cygpath -w "$WS_BASE/windows-sdk" 2>/dev/null || echo "$WS_BASE/windows-sdk")"
LV="C:\\Program Files\\LLVM\\bin"

# 让 perry 从源码树重建 runtime/stdlib（否则回退到缺正则入口的预编译库）
export PERRY_WORKSPACE_ROOT="$PERRY_SRC"

# 系统库搜索路径：um（kernel32/ws2_32/dbghelp…）+ ucrt + crt
export LIB="$WS\\sdk\\lib\\um\\x86_64;$WS\\sdk\\lib\\ucrt\\x86_64;$WS\\crt\\lib\\x86_64"

# C/C++ 头文件搜索路径（cc-rs 编译 libmimalloc-sys 等 C 依赖用）
export INCLUDE="$WS\\crt\\include;$WS\\sdk\\include\\ucrt;$WS\\sdk\\include\\shared;$WS\\sdk\\include\\um;$WS\\sdk\\include\\winrt"

# 用 LLVM 的 clang-cl 冒充 cl.exe，llvm-lib 冒充 lib.exe（杜绝 MSVC）
export CC="$LV\\clang-cl.exe"
export CXX="$LV\\clang-cl.exe"
export AR="$LV\\llvm-lib.exe"
export CC_x86_64_pc_windows_msvc="$LV\\clang-cl.exe"
export CXX_x86_64_pc_windows_msvc="$LV\\clang-cl.exe"

echo "[llvm-build-env] PERRY_WORKSPACE_ROOT=$PERRY_WORKSPACE_ROOT"
echo "[llvm-build-env] CC=clang-cl  AR=llvm-lib  LIB/INCLUDE=xwin sysroot"