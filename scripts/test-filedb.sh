#!/usr/bin/env bash
# 编译并运行 FileDB 回归测试（真实原生二进制；FileDB 用正则 → 需源码重建环境）
# 用法：npm run test:filedb
set -e
cd "$(dirname "$0")/.."
source scripts/perry-source-env.sh
mkdir -p dist
npx perry compile src/tests/filedb.test.ts -o dist/filedb-test.exe
./dist/filedb-test.exe
