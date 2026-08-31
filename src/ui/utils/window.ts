// Window 交互辅助 — Perry v0.5.1220 实测结论（重要）
//   - widgetSetOnMouseDown(widget, cb)  存在且可用；绑到 HStack 容器可靠命中
//   - bloomViewGetNativeHandle(widget)  返回真实 HWND（运行时窗口已存在时有效）
//   - App() 无 titleBarHidden 选项；App() 阻塞，后续同步代码不执行
//   - 【硬限制】Perry 运行时无法调用 Win32：
//       · execSync('powershell...') 会阻塞 perry 单线程事件循环，PowerShell 子进程被饿死（ETIMEDOUT）
//       · spawn('powershell.exe') 在 perry 子进程环境里根本无法启动 powershell 进程（PATH 不含 / 沙箱拦截）
//       · 因此 makeFrameless / sendSysCommand（依赖 PowerShell 发 SendMessage/SetWindowLong）当前全部静默失效
//   - 唯一能去系统标题栏的 perry 原生方式是 App({ windowState:"fullscreen" })（见 gui/main.ts）
//   - 关闭按钮用 process.exit(0)（不依赖 Win32），可正常工作
// 本文件的 makeFrameless / sendSysCommand 代码正确，待 perry 升级支持运行时 Win32 FFI 或修复
// 子进程环境后即可启用；当前 GUI 采用 fullscreen + 自定义栏 UI + 关闭按钮的方案。

import { type Widget, bloomViewGetNativeHandle, widgetSetOnMouseDown } from "perry/ui";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 取某 widget 对应的真实 HWND（运行时调用，窗口已存在）
function hwndOf(widget: Widget): number {
    try {
        return bloomViewGetNativeHandle(widget);
    } catch {
        return 0;
    }
}

// 执行一段 PowerShell（写临时 .ps1 文件，避开内联引号地狱）。
// perry 子进程环境的 PATH 不含 powershell.exe，必须用全路径。
// execSync 能启动 powershell（有完整 env），仅在事件已让出的上下文（onMouseDown）使用，
// 避免在 onFrame/事件循环内阻塞导致 ETIMEDOUT 死锁。
const POWERSHELL = "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
function ps(script: string): void {
    try {
        const tmp = join(tmpdir(), "hs-" + Date.now() + "-" + Math.floor(Math.random() * 1e6) + ".ps1");
        writeFileSync(tmp, script, "utf8");
        execSync('"' + POWERSHELL + '" -NoProfile -ExecutionPolicy Bypass -File "' + tmp + '"', { timeout: 8000 });
    } catch { /* ignore */ }
}

// 删除系统标题栏样式所需的 C# 类型定义（含正确双引号，写入文件后安全）
const WIN32_TYPE =
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W { [DllImport(\"user32.dll\")] public static extern int SendMessage(IntPtr h, int m, int w, int l); [DllImport(\"user32.dll\")] public static extern int GetWindowLong(IntPtr h, int i); [DllImport(\"user32.dll\")] public static extern int SetWindowLong(IntPtr h, int i, int s); [DllImport(\"user32.dll\")] public static extern bool SetWindowPos(IntPtr h, int hp, int x, int y, int w, int h2, int f); }';";

// 向窗口发送 WM_SYSCOMMAND(SC_*) —— 用 widget 的 HWND（已实机验证可用）
export function sendSysCommand(widget: Widget, sc: number): void {
    const hwnd = hwndOf(widget);
    if (!hwnd) return;
    ps(WIN32_TYPE + "\n$h=" + hwnd + "; [W]::SendMessage($h, 0x0112, " + sc + ", 0) | Out-Null;");
}

// 拖动：SendMessage(WM_SYSCOMMAND, SC_MOVE|2) — 交由系统拖动。
// 首次拖拽时顺便去系统标题栏（onMouseDown 上下文已让出事件循环，execSync 不饿死）。
let framelessDone = false;
export function enableFramelessDrag(widget: Widget): void {
    try {
        widgetSetOnMouseDown(widget, () => {
            if (!framelessDone) { framelessDone = true; makeFrameless(widget); }
            sendSysCommand(widget, 0xF012); // SC_MOVE | 2
        });
    } catch { /* ignore */ }
}

// 缩放热区方向：1=左 2=右 3=上 4=左上 5=右上 6=下 7=左下 8=右下
export function enableResizeHotspot(widget: Widget, dir: number): void {
    try {
        widgetSetOnMouseDown(widget, () => {
            sendSysCommand(widget, 0xF000 + dir); // SC_SIZE | dir
        });
    } catch { /* ignore */ }
}

// 去除系统标题栏（frameless）：移除 WS_CAPTION / WS_THICKFRAME 样式。
// 传入已挂载到窗口的 body widget，取其 HWND。需在窗口挂载后（onFrame 首帧）调用。
export function makeFrameless(widget: Widget): void {
    const hwnd = hwndOf(widget);
    if (!hwnd) return;
    ps(WIN32_TYPE + "\n$s=[W]::GetWindowLong(" + hwnd + ", -16); " +
        "$s = $s -band (-bnot 0x00C00000) -band (-bnot 0x00040000); " +
        "[W]::SetWindowLong(" + hwnd + ", -16, $s) | Out-Null; " +
        "[W]::SetWindowPos(" + hwnd + ", 0, 0, 0, 0, 0, 0x27) | Out-Null;");
}

export function closeWindow(): void {
    try { process.exit(0); } catch { /* ignore */ }
}

export function minimizeWindow(widget: Widget): void {
    sendSysCommand(widget, 0xF020); // SC_MINIMIZE
}

export function maximizeWindow(widget: Widget): void {
    sendSysCommand(widget, 0xF030); // SC_MAXIMIZE
}
