#!/usr/bin/env bash
# 编译并运行 ReleaseResolver 资产选择测试（真实原生二进制；模块链含正则 → 源码重建环境）
# 用法：npm run test:release
set -e
cd "$(dirname "$0")/.."
source scripts/llvm-build-env.sh
mkdir -p dist
npx perry compile src/tests/release.test.ts -o dist/release-test.exe
./dist/release-test.exe
