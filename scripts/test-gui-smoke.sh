#!/usr/bin/env bash
# GUI 启动烟测 — 8s 内不崩溃 = 通过（timeout 退出码 124 表示进程存活被终止）
# 背景：Perry 0.5.1664/1665 官方 npm 的 perry_ui_windows.lib 内嵌重复 runtime，
#       任何 GUI（含纯 Text）在用户代码前崩溃；升级 Perry 后必须先跑本烟测。
# 用法：npm run test:gui
set -e
cd "$(dirname "$0")/.."
source scripts/perry-source-env.sh > /dev/null 2>&1
mkdir -p dist

[ -f dist/HamsterStore-GUI.exe ] || bash scripts/build.sh gui

rc=0
timeout 8 ./dist/HamsterStore-GUI.exe > dist/gui-smoke.log 2>&1 || rc=$?
if [ "$rc" -eq 124 ]; then
  echo "[GUI smoke] OK — 8s 存活（无启动崩溃）"
else
  echo "[GUI smoke] FAILED — exit=$rc"
  tail -20 dist/gui-smoke.log
  exit 1
fi
