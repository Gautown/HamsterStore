#!/usr/bin/env bash
# 编译并运行 netFetch 网络回归测试（需外网；单独运行，不进 npm test）
# 用法：npm run test:net
set -e
cd "$(dirname "$0")/.."
source scripts/perry-source-env.sh
mkdir -p dist
npx perry compile src/tests/net.test.ts -o dist/net-test.exe
./dist/net-test.exe
