// responsive — 响应式布局内核（Perry 0.5.1520）
// 1. perry/ui 0.5.1520 没有窗口 resize 事件，也没有查询窗口尺寸的 API。
// 2. 辅助 PowerShell 进程每 300ms 调 Win32 GetClientRect 读客户区，
//    写入临时文件；TS 侧用 setInterval 读取（JS 定时器在 App 起来后才会触发）。
// 3. 尺寸变化后只“隐藏旧布局 + 追加新布局”，绝不销毁已创建的 Win32 控件：
//    0.5.1520 Windows 下 widgetClearChildren / prepare().get() 均会 AV（实测）。
// 4. spawn 不能带 detached:true —— 该后端会在下一轮立即回收 detached 子进程。
import { widgetSetHidden, widgetAddChild, type Widget } from "perry/ui";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ViewportInfo {
    width: number;
    height: number;
}

export interface LayoutSpec {
    columns: number;          // 首页统计卡一行几张
    midColumns: number;       // 精选推荐/分类浏览
    previewColumns: number;   // 软件预览卡
    categoryColumns: number;  // 分类浏览器按钮
    sidebar: number;          // 侧栏宽度 px（compact 时 56-64）
    compact: boolean;         // 窄屏：侧栏图标化、标题栏省略应用名
    gap: number;              // 卡片间距
    pagePad: number;          // 页面内边距
    wrapWidth: number;        // 文本折行宽度上限
}

const FALLBACK_WORK = { width: 1920, height: 1080 };
const PS_EXE = join(process.env.SystemRoot || "C:/Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const VIEWPORT_FILE = "hamsterstore_viewport.txt";
const WORKAREA_FILE = "hamsterstore_workarea.txt";

let viewport: ViewportInfo = { width: 1280, height: 800 };
let watcherStarted: boolean = false;
let watcherChild: any = null;

function tmp(name: string): string {
    const dir = process.env.TEMP || process.env.TMP || ".";
    return join(dir, name);
}

export function getViewport(): ViewportInfo {
    return viewport;
}

export function setViewport(width: number, height: number): void {
    viewport = { width, height };
}

// 断点：以"窗口客户区宽度"为准，窄屏收敛列数、压缩侧栏与留白
export function specFor(width: number): LayoutSpec {
    if (width >= 1680) {
        return { columns: 5, midColumns: 2, previewColumns: 4, categoryColumns: 6, sidebar: 224, compact: false, gap: 16, pagePad: 24, wrapWidth: 760 };
    }

    if (width >= 1440) {
        return { columns: 5, midColumns: 2, previewColumns: 4, categoryColumns: 5, sidebar: 208, compact: false, gap: 16, pagePad: 20, wrapWidth: 700 };
    }

    if (width >= 1000) {
        return { columns: 3, midColumns: 2, previewColumns: 3, categoryColumns: 3, sidebar: 176, compact: false, gap: 12, pagePad: 16, wrapWidth: 560 };
    }

    if (width >= 840) {
        return { columns: 2, midColumns: 2, previewColumns: 2, categoryColumns: 3, sidebar: 164, compact: false, gap: 10, pagePad: 12, wrapWidth: 480 };
    }

    if (width >= 720) {
        return { columns: 2, midColumns: 1, previewColumns: 2, categoryColumns: 2, sidebar: 64, compact: true, gap: 8, pagePad: 10, wrapWidth: 420 };
    }

    if (width >= 600) {
        return { columns: 2, midColumns: 1, previewColumns: 2, categoryColumns: 2, sidebar: 56, compact: true, gap: 8, pagePad: 8, wrapWidth: 340 };
    }

    return { columns: 1, midColumns: 1, previewColumns: 1, categoryColumns: 1, sidebar: 52, compact: true, gap: 8, pagePad: 8, wrapWidth: 300 };
}

export function getSpec(): LayoutSpec {
    return specFor(viewport.width);
}

export function contentWidth(): number {
    const s = getSpec();
    // 预留滚动条 + 窗口边框安全余量
    return Math.max(240, viewport.width - s.sidebar - s.pagePad * 2 - 32);
}

// 标题栏 / 状态栏固定高度（与各组件渲染一致）
export const TITLEBAR_H = 56;
export const STATUSBAR_H = 26;

// App(width,height) 是外框尺寸；Windows 边框+标题栏约 16x39 逻辑像素。
// 启动时先用估算值，installResponsive 首次轮询拿到真实客户区后校准。
export const FRAME_W = 16;
export const FRAME_H = 39;

export function mainRowHeight(): number {
    return Math.max(320, viewport.height - TITLEBAR_H - STATUSBAR_H);
}

// 栅格卡片宽度：n 列等宽 + (n-1) 个间距，铺满内容区
export function gridCardWidth(columns: number, gap?: number): number {
    const s = getSpec();
    const cols = Math.max(1, columns);
    const g = gap === undefined ? s.gap : gap;
    return Math.max(140, Math.floor((contentWidth() - g * (cols - 1)) / cols));
}

// 启动前同步探测工作区（PowerShell + WinForms，无 C# 编译，通常 <400ms）
export function detectWorkArea(): { width: number; height: number } {
    const out = tmp(WORKAREA_FILE);
    const ps1 = tmp("hamsterstore_workarea.ps1");
    const lines: string[] = [];
    lines.push("Add-Type -AssemblyName System.Windows.Forms");
    lines.push("$wa = [System.Windows.Forms.SystemInformation]::WorkingArea");
    lines.push("try { Remove-Item -LiteralPath '" + out + "' -Force -ErrorAction SilentlyContinue } catch {}");
    lines.push("[System.IO.File]::WriteAllText('" + out + "', \"$($wa.Width) $($wa.Height)\")");
    try {
        writeFileSync(ps1, lines.join("\n"));
        const syncRes: any = spawnSync(PS_EXE, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", ps1], { encoding: "utf8", timeout: 2500 });
        console.log("[Responsive] workarea probe status=" + (syncRes ? syncRes.status : "?"));
    } catch {
        return FALLBACK_WORK;
    }

    const started = Date.now();
    while (Date.now() - started < 1500) {
        try {
            if (existsSync(out)) {
                const text = readFileSync(out, "utf8").trim();
                const parts = text.split(" ");
                const w = parseInt(parts[0], 10) || 0;
                const h = parseInt(parts[1], 10) || 0;
                if (w > 560 && h > 360) return { width: w, height: h };
            }
        } catch {}
    }
    return FALLBACK_WORK;
}

// 启动窗口尺寸（工作区 86%，上限 1500x940，下限 900x600）
// 测试钩子：HAMSTER_WIN_W / HAMSTER_WIN_H 覆盖（适配任意分辨率巡检）
export function initialWindowSize(work: { width: number; height: number }): { width: number; height: number } {
    const envW = parseInt(process.env.HAMSTER_WIN_W || "", 10);
    const envH = parseInt(process.env.HAMSTER_WIN_H || "", 10);
    if (envW > 480 && envH > 320) {
        return { width: Math.min(envW, work.width), height: Math.min(envH, work.height) };
    }
    const width = Math.min(1500, Math.max(900, Math.round(work.width * 0.86)));
    const height = Math.min(940, Math.max(600, Math.round(work.height * 0.86)));
    return { width, height };
}

export function installResponsive(root: Widget, build: () => Widget, onChange?: () => void): void {
    if (watcherStarted) return;
    watcherStarted = true;

    const out = tmp(VIEWPORT_FILE);
    const ps1 = tmp("hamsterstore_viewport.ps1");
    const pid = process.pid;

    const code: string[] = [];
    code.push('$ErrorActionPreference = "SilentlyContinue"');
    code.push('Add-Type -TypeDefinition @\'');
    code.push("using System;");
    code.push("using System.Runtime.InteropServices;");
    code.push("public class HSWin {");
    code.push('    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }');
    code.push('    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);');
    code.push('    public static string Size(IntPtr h) { RECT r; if (!GetClientRect(h, out r)) return ""; int w = r.Right - r.Left; int ht = r.Bottom - r.Top; return w + " " + ht; }');
    code.push("}");
    code.push("'@");
    code.push("$target = " + pid);
    code.push("$o = '" + out + "'");
    code.push("$last = ''");
    code.push("while ($true) {");
    code.push("    $g = Get-Process -Id $target -ErrorAction SilentlyContinue");
    code.push("    if ($null -eq $g) { break }");
    code.push("    $h = $g.MainWindowHandle");
    code.push("    if ($h -ne 0) {");
    code.push("        $t = [HSWin]::Size($h)");
    code.push('        if ($t -ne "" -and $t -ne $last) { [System.IO.File]::WriteAllText($o, $t); $last = $t }');
    code.push("    }");
    code.push("    Start-Sleep -Milliseconds 300");
    code.push("}");
    let watcherSpawned = false;
    const startWatcher = (): void => {
        if (watcherSpawned) return;
        watcherSpawned = true;
        try {
            writeFileSync(ps1, code.join("\n"));
            watcherChild = spawn(PS_EXE, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", ps1], { stdio: "ignore" });
            console.log("[Responsive] viewport watcher started pid=" + (watcherChild && watcherChild.pid));
            // 保留模块级引用，避免 ChildProcess 被 GC 后子进程被回收
        } catch (e: any) {
            console.log("[Responsive] watcher spawn failed", e && e.message);
        }
    };

    // 只隐藏旧布局、追加新布局，绝不销毁控件：0.5.1520 Windows 上 destroy 会 AV
    const bodies: Widget[] = [];
    const apply = (): void => {
        console.log("[Responsive] layout", viewport.width + "x" + viewport.height);
        try {
            for (let i = 0; i < bodies.length; i++) widgetSetHidden(bodies[i], 1);
            const next = build();
            widgetAddChild(root, next);
            bodies.push(next);
        } catch {}
        if (onChange) {
            try { onChange(); } catch {}
        }
    };
    (globalThis as any).__hamsterStoreRender = apply;

    // 初始尺寸由 gui/main.ts 先行 setViewport（外框减 FRAME_W/H 估算）；
    // 首次拿到真实客户区时无条件校准一次，之后按阈值（12/8）跟踪。
    let lastW = viewport.width;
    let lastH = viewport.height;
    let settled = false;
    let pollTicks = 0;
    const poll = (): void => {
        // 启动 3.5s 后再拉起 watcher：过早 spawn 会被 App 初始化阶段回收
        pollTicks++;
        if (pollTicks > 3) startWatcher();
        let text = "";
        try {
            if (existsSync(out)) text = readFileSync(out, "utf8").trim();
        } catch {}
        if (!text) return;
        const parts = text.split(" ");
        const w = parseInt(parts[0], 10);
        const h = parseInt(parts[1], 10);
        if (!(w > 200) || !(h > 150)) return;
        if (!settled) {
            settled = true;
            if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) {
                lastW = w;
                lastH = h;
                return;
            }
            lastW = w;
            lastH = h;
            viewport = { width: w, height: h };
            apply();
            return;
        }
        // threshold 12/8: ignore drag jitter, still rebuild on size change
        if (Math.abs(w - lastW) < 12 && Math.abs(h - lastH) < 8) return;
        lastW = w;
        lastH = h;
        viewport = { width: w, height: h };
        apply();
    };
    // 先用估算尺寸建首屏；JS 定时器在 Perry 的 App 循环启动后可靠运行
    apply();
    setInterval(poll, 450);
}
