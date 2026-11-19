#!/usr/bin/env bash
# 统一构建入口（源码重建环境，含正则运行时）
# 用法：npm run build:cli / build:gui / build:all  或  bash scripts/build.sh cli|gui|all
set -e
cd "$(dirname "$0")/.."
source scripts/llvm-build-env.sh
mkdir -p dist
case "${1:-all}" in
  cli)
    npx perry compile src/main.ts -o dist/HamsterStore.exe --emit-attest
    ;;
  gui)
    npx perry compile src/gui/main.ts -o dist/HamsterStore-GUI.exe \
      --target windows --min-windows-version 10 --debug-symbols --emit-attest
    ;;
  all)
    bash scripts/build.sh cli
    bash scripts/build.sh gui
    ;;
  *)
    echo "usage: bash scripts/build.sh cli|gui|all"
    exit 1
    ;;
esac
