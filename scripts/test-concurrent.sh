#!/usr/bin/env bash
# 编译并运行并发基础设施测试（真实原生二进制，非 tsx 模拟）
# 用法：npm run test:concurrent  或  bash scripts/test-concurrent.sh
set -e
cd "$(dirname "$0")/.."
source scripts/llvm-build-env.sh
mkdir -p dist
npx perry compile src/tests/concurrent.test.ts -o dist/concurrent-test.exe
./dist/concurrent-test.exe
