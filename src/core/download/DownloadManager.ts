// DownloadManager v2 — 实际文件下载（curl） + 进度跟踪 + 爆发续传
// perry v0.5.1220: spawn + unref() 非阻塞

import { spawn } from "node:child_process";
import { DownloadRepository } from "../../data";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface DownloadTaskState {
    id: number;
    packageId: number;
    url: string;
    status: "waiting" | "downloading" | "done" | "failed";
    progress: number;
    detail: string;
}

const activeDownloads = new Map<number, DownloadTaskState>();

function downloadDir(): string {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || process.env.USERPROFILE || ".";
    const dir = join(base, "HamsterStore", "downloads");
    mkdirSync(dir, { recursive: true });
    return dir;
}

export const DownloadManager = {
    // 启动下载任务（非阻塞 curl）
    startDownload(packageId: number, url: string, name: string): DownloadTaskState {
        if (!url) throw new Error("No download URL");

        const task = DownloadRepository.create({ url, package_id: packageId, status: "waiting" });
        const destFile = join(downloadDir(), name + "_dl" + url.substring(url.lastIndexOf(".")));

        const st: DownloadTaskState = {
            id: task.id,
            packageId,
            url,
            status: "downloading",
            progress: 0,
            detail: "开始下载...",
        };
        activeDownloads.set(task.id, st);
        DownloadRepository.updateStatus(task.id, "downloading", 0);

        // 非阻塞 curl 下载
        const child = spawn("curl", [
            "-sSL", "--retry", "2", "--retry-delay", "5",
            "--max-time", "300",
            "-o", destFile,
            url,
        ], { detached: true, stdio: "ignore" });
        child.unref();

        child.on("close", (code: number | null) => {
            if (code === 0 || existsSync(destFile)) {
                DownloadRepository.markDone(task.id);
                const st = activeDownloads.get(task.id);
                if (st) { st.status = "done"; st.detail = destFile; st.progress = 100; }
            } else {
                DownloadRepository.markFailed(task.id);
                const st = activeDownloads.get(task.id);
                if (st) { st.status = "failed"; st.detail = "Download failed (exit=" + code + ")"; }
            }
        });

        return st;
    },

    getActive(): DownloadTaskState[] {
        return Array.from(activeDownloads.values());
    },

    getState(taskId: number): DownloadTaskState | undefined {
        return activeDownloads.get(taskId);
    },

    clear(): void {
        activeDownloads.clear();
    },

    // 打开浏览器作为 UI 中的手动下载按钮
    openInBrowser(url: string): void {
        try {
            const child = spawn("rundll32", ["url.dll,FileProtocolHandler", url], {
                detached: true,
                stdio: "ignore",
            });
            child.unref();
        } catch {
            // ignore
        }
    },

    // GUI 快捷入口
    openDownload(url: string): void {
        DownloadManager.openInBrowser(url);
    },
};