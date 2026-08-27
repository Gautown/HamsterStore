// Window 交互辅助 — Perry v0.5.1220 实际可用 API
// §6.3 开发文档要求：窗口拖拽/缩放/关闭/最小化/最大化
// 实际 Perry v0.5.1220 限制：
//   - Window 接口仅提供 close() 和 setSize()
//   - 无 minimize/maximize/titleBarHidden/drag API
//   - App() 仅支持 windowState 初始状态
// 本文件封装最大可用功能，未来 API 扩展时可补充

import { execSync } from "node:child_process";

// 关闭窗口 — 通过触发 Perry 退出
// Perry App 运行在主线程阻塞模式，关闭窗口即退出 app
export function closeWindow(): void {
    try { process.exit(0); } catch { /* ignore */ }
}

// 最小化窗口 — 通过 PowerShell 调用 Win32 API
export function minimizeWindow(): void {
    try {
        execSync('powershell.exe -NoProfile -Command "Add-Type -TypeDefinition \\"using System; using System.Runtime.InteropServices; public class W { [DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr h, int n); }\\"; $p = Get-Process -Name HamsterStore-GUI -ErrorAction SilentlyContinue; if ($p) { [W]::ShowWindow($p.MainWindowHandle, 6) }"', { stdio: "ignore", timeout: 3000 });
    } catch { /* ignore */ }
}

// 最大化/还原窗口 — 通过 PowerShell 切换
export function maximizeWindow(): void {
    try {
        execSync('powershell.exe -NoProfile -Command "Add-Type -TypeDefinition \\"using System; using System.Runtime.InteropServices; public class W { [DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr h, int n); }\\"; $p = Get-Process -Name HamsterStore-GUI -ErrorAction SilentlyContinue; if ($p) { [W]::ShowWindow($p.MainWindowHandle, 3) }"', { stdio: "ignore", timeout: 3000 });
    } catch { /* ignore */ }
}

// 窗口拖拽 — Perry v0.5.1220 不支持 onMouseDown 窗口拖拽 API
// 预留接口，未来 Perry 支持 mouseDown 时可挂载
export function enableWindowDrag(_widget: any): void {
    // TODO: 等 Perry 支持 onMouseDown/onMouseDrag 后实现
    // 目前系统标题栏仍保留以提供拖拽功能
}