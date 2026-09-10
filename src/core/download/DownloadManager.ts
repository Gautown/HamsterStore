// DownloadManager v4 — curl spawn + 进度跟踪 + 并发队列
// perry v0.5.1220: http.get 未实现，用 curl spawn 替代
// curl --progress-bar 输出进度到 stdout，我们通过监听 stdout 解析百分比

import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DownloadRepository } from "../../data";
import { ProxyManager } from "../proxy/ProxyManager";

export interface DownloadTaskState {
    id: number;
    packageId: number;
    url: string;
    name: string;
    status: "waiting" | "downloading" | "done" | "failed";
    progress: number;          // 0-100
    totalBytes: number;        // content-length, -1 = unknown
    downloadedBytes: number;
    detail: string;
}

const MAX_CONCURRENT = 3;

const activeDownloads = new Map<number, DownloadTaskState>();
const downloadQueue: Array<{
    packageId: number;
    url: string;
    name: string;
}> = [];

function downloadDir(): string {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || process.env.USERPROFILE || ".";
    const dir = join(base, "HamsterStore", "downloads");
    mkdirSync(dir, { recursive: true });
    return dir;
}

function makeFilename(name: string, url: string): string {
    const urlPath = url.split("/").pop() || name;
    const safe = urlPath.replace(/[<>:"|?*()\[\]]/g, "_");
    return safe.length > 200 ? safe.substring(0, 200) : safe;
}

function processQueue(): void {
    while (activeDownloads.size < MAX_CONCURRENT && downloadQueue.length > 0) {
        const next = downloadQueue.shift()!;
        startDownloadInternal(next.packageId, next.url, next.name);
    }
}

function startDownloadInternal(packageId: number, url: string, name: string, attemptViaProxy: boolean = true): void {
    const task = DownloadRepository.getById(packageId) as any;
    const taskId = task ? task.id : packageId;
    const destFile = join(downloadDir(), makeFilename(name, url));

    // 需求核心：downloads 走代理加速；失败时标记节点并直连重试一次
    let effectiveUrl = url;
    if (attemptViaProxy) {
        effectiveUrl = ProxyManager.getInstance().accelerateDownload(url);
    }

    const st: DownloadTaskState = {
        id: taskId,
        packageId,
        url,
        name,
        status: "downloading",
        progress: 0,
        totalBytes: -1,
        downloadedBytes: 0,
        detail: attemptViaProxy && effectiveUrl !== url ? "加速下载中..." : "准备中...",
    };
    activeDownloads.set(taskId, st);
    DownloadRepository.updateStatus(taskId, "downloading", 0);

    // curl --progress-bar --parallel 输出格式:  XX.X%  xxxKb/yyyKb  ...
    // 我们只解析百分比（第一个数字）
    const child = spawn("curl", [
        "-sSL", "--retry", "2", "--retry-delay", "5",
        "--max-time", "300",
        "-o", destFile,
        "--progress-bar",
        effectiveUrl,
    ], { stdio: ["ignore", "pipe", "pipe"] });

    let totalBytes = 0;

    child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        // --progress-bar 输出类似:  45.2K  1.2M  3.74M  4.15M 100%  8.91MB/s    0
        // 最后一列（含 % 的）是百分比
        const parts = text.trim().split(/\s+/);
        for (const part of parts) {
            if (part.includes("%")) {
                const pct = parseFloat(part);
                if (!isNaN(pct)) {
                    st.progress = Math.round(pct);
                    st.detail = "下载中 " + st.progress + "%";
                    DownloadRepository.updateStatus(taskId, "downloading", st.progress);
                }
            }
            // 解析速度/大小信息
            if (part.match(/^\d+\.\d+[KMG]B?\/s$/)) {
                st.detail = "下载中 " + st.progress + "% — " + part;
            }
        }
    });

    child.stderr.on("data", (chunk: Buffer) => {
        // curl 错误信息
        const text = chunk.toString().trim();
        if (text.includes("percent") || text.includes("%")) {
            const m = text.match(/([\d.]+)%/);
            if (m) {
                st.progress = Math.round(parseFloat(m[1]));
                DownloadRepository.updateStatus(taskId, "downloading", st.progress);
            }
        }
    });

    child.on("close", (code: number | null) => {
        const ok = code === 0 && existsSync(destFile);
        if (ok) {
            st.progress = 100;
            st.status = "done";
            st.detail = destFile;
            DownloadRepository.markDone(taskId);
            activeDownloads.delete(taskId);
            processQueue();
            return;
        }
        // 故障转移：代理 URL 下载失败 → 标记节点失败，直连重试一次
        if (attemptViaProxy && effectiveUrl !== url) {
            console.log(`[Download] Proxy URL failed (exit=${code}), falling back to direct connection`);
            const pm = ProxyManager.getInstance();
            const best = pm.getBestNode();
            if (best) pm.markFailed(best.name);
            activeDownloads.delete(taskId);
            // 同一槽位直接直连重试（attemptViaProxy=false）
            startDownloadInternal(packageId, url, name, false);
            return;
        }
        st.status = "failed";
        st.detail = "Download failed (exit=" + code + ")";
        DownloadRepository.markFailed(taskId);
        activeDownloads.delete(taskId);
        processQueue();
    });

    child.on("error", (err: Error) => {
        st.status = "failed";
        st.detail = "Spawn error: " + err.message;
        DownloadRepository.markFailed(taskId);
        activeDownloads.delete(taskId);
        processQueue();
    });
}

export const DownloadManager = {
    startDownload(packageId: number, url: string, name: string): DownloadTaskState {
        if (!url) throw new Error("No download URL");

        const task = DownloadRepository.create({ url, package_id: packageId, status: "waiting" });

        if (activeDownloads.has(task.id)) {
            return activeDownloads.get(task.id)!;
        }

        downloadQueue.push({ packageId, url, name });
        processQueue();

        const st: DownloadTaskState = {
            id: task.id,
            packageId,
            url,
            name,
            status: "waiting",
            progress: 0,
            totalBytes: 0,
            downloadedBytes: 0,
            detail: "排队中...",
        };
        return st;
    },

    getActive(): DownloadTaskState[] {
        return Array.from(activeDownloads.values());
    },

    getQueued(): Array<{ packageId: number; url: string; name: string }> {
        return downloadQueue.slice();
    },

    getState(taskId: number): DownloadTaskState | undefined {
        return activeDownloads.get(taskId);
    },

    clearCompleted(): void {
        for (const [id, st] of activeDownloads) {
            if (st.status === "done" || st.status === "failed") {
                activeDownloads.delete(id);
            }
        }
    },

    clearAll(): void {
        activeDownloads.clear();
        downloadQueue.splice(0);
    },

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

    openDownload(url: string): void {
        DownloadManager.openInBrowser(url);
    },
};
