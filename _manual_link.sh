#!/usr/bin/env bash
# 决定性实验：perry 自动链接行漏了 perry_runtime.lib，手工补上验证
set -u
cd /f/GoghStudio/GitHub/github/HamsterStore/hamsterstore
RT="C:/Users/GauTown/AppData/Local/perry/runtime"
RTN=$(cygpath -w "$RT")
LLD="/c/Program Files/LLVM/bin/lld-link.exe"

# 1. 重新生成干净的 .o（--no-link）
export PERRY_RUNTIME_DIR="$RT"
rm -rf node_modules/.cache/perry/objects
PERRY_RS4GC=0 perry compile _re.ts -o _re.exe --no-link >/tmp/nolink.log 2>&1
echo "=== no-link 产物 ==="
grep -iE "Wrote object|\.o" /tmp/nolink.log | head -3
OBJ=$(ls -t node_modules/.cache/perry/objects/host/*.o 2>/dev/null | head -1)
echo "OBJ=$OBJ"
[ -z "$OBJ" ] && { echo "拿不到 .o，终止"; cat /tmp/nolink.log | tail -10; exit 1; }

# 2. 从抓到的 rsp_dump 取系统库清单
SYS="/tmp/rsp_dump.txt"
# 3. 构造 my_rsp：对象 + runtime + stdlib + 系统库
{
  echo "/SUBSYSTEM:CONSOLE"
  echo "/ENTRY:mainCRTStartup"
  echo "/NOLOGO"
  echo "/STACK:67108864"
  echo "/FORCE:MULTIPLE"
  echo "/IGNORE:4006"
  OBJN=$(cygpath -w "$OBJ")
echo "$OBJN"
  echo "/OPT:REF"
  echo "/OPT:ICF"
  # xwin sysroot SDK 搜索路径（perry 源码 library_search.rs:429 的布局）
  echo "/LIBPATH:${RTN}.notset" >/dev/null
  WS="C:/Users/GauTown/AppData/Local/perry/windows-sdk"
  WSN=$(cygpath -w "$WS")
  echo "/LIBPATH:${WSN}\\crt\\lib\\x86_64"
  echo "/LIBPATH:${WSN}\\sdk\\lib\\um\\x86_64"
  echo "/LIBPATH:${WSN}\\sdk\\lib\\ucrt\\x86_64"
  echo "${RTN}\\perry_runtime.lib"
  echo "${RTN}\\perry_stdlib.lib"
  echo "/OUT:_re_manual.exe"
  # 系统库：取 rsp_dump 中所有 *.lib（排除 perry 两个）
  grep -E "^[a-z0-9_]+\.lib$|^winspool|^kernel32" "$SYS" 2>/dev/null
} > /tmp/my_rsp.txt
# 把 my_rsp 拷到 Windows 原生 TEMP，用原生路径喂 lld-link
cp /tmp/my_rsp.txt "$TEMP/my_rsp.txt"
MYRSP=$(cygpath -w "$TEMP/my_rsp.txt")

echo "=== my_rsp 库清单 ==="
grep -E "\.lib$" /tmp/my_rsp.txt
echo "=== 手工 lld-link ==="
"$LLD" @"$MYRSP" 2>&1 | head -15
echo "exit=$?"
ls -la _re_manual.exe 2>/dev/null && echo "=== 运行 ===" && ./_re_manual.exe
