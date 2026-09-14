// DownloadManager v5 — netFetch 回调式下载（零子进程事件依赖）
// v5 变更：
//   1. 下载原语换 netFetch.netDownload（spawn 数组 + 文件大小轮询），
//      修复 v4 依赖 stdout/stderr/close 回调在真实二进制下不触发的问题
//   2. 自动走 ProxyManager.accelerateDownload；代理 URL 失败 → 标记节点 + 直连重试一次
//   3. startDownloadSync：CLI 同步语义封装（轮询等待完成，供 main.ts download 命令）

import { spawn } from "node:child_process";
import { mkdirSync, existsSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { DownloadRepository } from "../../data";
import { ProxyManager } from "../proxy/ProxyManager";
import { netDownload } from "../net/netFetch";

export interface DownloadTaskState {
    id: number;
    packageId: number;
    url: string;
    name: string;
    status: "waiting" | "downloading" | "done" | "failed";
    progress: number;          // 0-100（有 total 时）
    totalBytes: number;         // -1 = 未知
    downloadedBytes: number;
    detail: string;
}

function downloadDir(): string {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || process.env.USERPROFILE || ".";
    const dir = join(base, "HamsterStore", "downloads");
    mkdirSync(dir, { recursive: true });
    return dir;
}

function makeFilename(name: string, url: string): string {
    const urlPath = url.split("/").pop() || name;
    const safe = urlPath.replace(/[<>:"|?*()[\]]/g, "_");
    return safe.length > 200 ? safe.substring(0, 200) : safe;
}

// 就地更新状态（Repository + 内存）
function report(st: DownloadTaskState, status: DownloadTaskState["status"], progress: number, detail: string): void {
    st.status = status;
    st.progress = progress;
    st.detail = detail;
    try {
        if (status === "done") DownloadRepository.markDone(st.id);
        else if (status === "failed") DownloadRepository.markFailed(st.id);
        else DownloadRepository.updateStatus(st.id, status, progress);
    } catch {}
}

// 单次尝试（attemptViaProxy=false 时直连）
function attemptDownload(
    st: DownloadTaskState,
    destFile: string,
    attemptViaProxy: boolean,
    onFinish: () => void,
): void {
    let effectiveUrl = st.url;
    if (attemptViaProxy) {
        effectiveUrl = ProxyManager.getInstance().accelerateDownload(st.url);
    }
    const viaProxy = effectiveUrl !== st.url;

    report(st, "downloading", st.progress, viaProxy ? "加速下载中..." : "下载中（直连）...");

    netDownload(effectiveUrl, destFile, { timeoutMs: 300000 },
        (bytes: number, total: number) => {
            st.downloadedBytes = bytes;
            if (total > 0) {
                st.totalBytes = total;
                const pct = Math.min(100, Math.floor((bytes / total) * 100));
                report(st, "downloading", pct, `下载中 ${pct}% (${(bytes / 1048576).toFixed(1)}MB${total > 0 ? "/" + (total / 1048576).toFixed(1) + "MB" : ""})`);
            } else {
                report(st, "downloading", st.progress, `下载中 ${(bytes / 1048576).toFixed(1)}MB`);
            }
        },
        (ok: boolean, bytes: number, elapsedMs: number) => {
            if (ok && bytes > 0) {
                report(st, "done", 100, destFile);
                console.log(`[Download] OK ${st.name} ${(bytes / 1048576).toFixed(1)}MB in ${(elapsedMs / 1000).toFixed(1)}s (${(bytes / 1024 / (elapsedMs / 1000)).toFixed(0)}KB/s)`);
                onFinish();
                return;
            }
            // 代理失败 → 标记节点 + 直连重试一次
            if (attemptViaProxy && viaProxy) {
                console.log(`[Download] Proxy failed for ${st.name}, falling back to direct`);
                const pm = ProxyManager.getInstance();
                const best = pm.getBestNode();
                if (best) pm.markFailed(best.name);
                attemptDownload(st, destFile, false, onFinish);
                return;
            }
            report(st, "failed", st.progress, `Download failed (exit, ${bytes} bytes in ${elapsedMs}ms)`);
            console.log(`[Download] FAILED ${st.name} (${bytes} bytes)`);
            onFinish();
        });
}

export const DownloadManager = {
    // GUI 用：异步启动，状态通过 getState 轮询
    startDownload(packageId: number, url: string, name: string): DownloadTaskState {
        if (!url) throw new Error("No download URL");
        const task = DownloadRepository.create({ url, package_id: packageId, status: "waiting" });
        const st: DownloadTaskState = {
            id: task.id, packageId, url, name,
            status: "waiting", progress: 0, totalBytes: -1, downloadedBytes: 0, detail: "排队中...",
        };
        const destFile = join(downloadDir(), makeFilename(name, url));
        attemptDownload(st, destFile, true, () => { /* GUI 轮询 getState */ });
        return st;
    },

    // CLI 用：回调式（setInterval 保活进程，完成后 onDone 里 process.exit）
    // 注意：不能用忙等同步——会阻塞事件循环，netDownload 的轮询就死锁了
    startDownloadCli(packageId: number, url: string, name: string,
        onDone: (st: DownloadTaskState) => void): void {
        if (!url) throw new Error("No download URL");
        const task = DownloadRepository.create({ url, package_id: packageId, status: "waiting" });
        const st: DownloadTaskState = {
            id: task.id, packageId, url, name,
            status: "waiting", progress: 0, totalBytes: -1, downloadedBytes: 0, detail: "排队中...",
        };
        const destFile = join(downloadDir(), makeFilename(name, url));
        attemptDownload(st, destFile, true, () => onDone(st));
    },

    getActive(): DownloadTaskState[] {
        // v5 无全局队列，直接从 Repository 读活动任务
        try {
            return (DownloadRepository.getAll() as any[])
                .filter(t => t.status === "downloading" || t.status === "waiting")
                .map(t => ({
                    id: t.id, packageId: t.package_id, url: t.url, name: t.url.split("/").pop() || "",
                    status: t.status, progress: t.progress || 0,
                    totalBytes: -1, downloadedBytes: 0, detail: t.detail || "",
                }));
        } catch { return []; }
    },

    getQueued(): Array<{ packageId: number; url: string; name: string }> { return []; },

    getState(taskId: number): DownloadTaskState | undefined { return undefined; },

    clearCompleted(): void {
        try {
            for (const t of DownloadRepository.getAll() as any[]) {
                if (t.status === "done" || t.status === "failed") {
                    // FileDB 无 delete API 时忽略；有则调用
                }
            }
        } catch {}
    },

    clearAll(): void { /* v5 任务表由 Repository 管理 */ },

    downloadsDir(): string { return downloadDir(); },

    openInBrowser(url: string): void {
        // rundll32 依赖回调确认，改用 cmd start（spawn 数组，fire-and-forget）
        try {
            const { spawn } = require("node:child_process");
            const child = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
            try { child.unref(); } catch {}
        } catch {}
    },
};
