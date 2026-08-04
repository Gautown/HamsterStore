@echo off
title HamsterStore - 仓鼠软库
echo ============================================
echo   HamsterStore v1.0.0 - WinUI 3
echo ============================================
echo.

:: 检查 Node.js 是否安装
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js，请安装 Node.js ≥18
    echo 下载: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 npm 是否安装
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 npm
    pause
    exit /b 1
)

echo [1/3] 安装依赖（首次运行较慢）...
call npm install --silent

echo [2/3] 启动 CLI 后端服务...
start "HamsterStore-CLI" npx tsx start_cli.ts

echo [3/3] 等待 API 就绪...
timeout /t 3 /nobreak >nul

echo 启动 GUI...
start "" HamsterStore.exe
echo ============================================
echo   已启动！关闭此窗口不影响程序运行
echo ============================================
pause