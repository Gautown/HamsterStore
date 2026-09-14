// netFetch — Perry 运行时统一网络原语（回调 + 文件轮询，零子进程回调依赖）
// 实测依据（spike_net*.ts，Perry v0.5.1220 真实二进制验证）：
//   - execSync 不走 shell：引号变字面量、& 拆参、> 不重定向 → 带任何 header/query 的调用全挂（弃用）
//   - spawn(数组参数, detached, stdio:ignore) + 输出文件 + setInterval 大小轮询：API/下载/header/& 全部可靠
//   - setInterval 回调在真实 GUI 二进制中可正常触发（probe timeout 日志来自它）
// 本模块全部基于以上三条被验证的事实，绝不使用 Promise/async/子进程事件回调。

import { spawn } from "node:child_process";
import { statSync, existsSync, unlinkSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const POLL_MS = 400;          // 轮询间隔
const STABLE_NEEDED = 2;      // 连续 N 次大小不变 = 传输完成（约 0.8s 静止）

function tmpNetDir(): string {
    const dir = join(process.env.TEMP || process.env.TMP || ".", "hamsterstore_net");
    try { mkdirSync(dir, { recursive: true }); } catch {}
    return dir;
}

function cleanup(path: string): void {
    try { if (existsSync(path)) unlinkSync(path); } catch {}
}

function reqId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// 内部：spawn curl（数组）+ 轮询输出文件大小直到稳定，然后回调
// onDone(ok, body, elapsedMs, extra?) — extra 供 HEAD 场景返回 header 文本
function pollFetch(
    args: string[],
    outFile: string,
    totalTimeoutMs: number,
    stableNeeded: number,
    allowEmpty: boolean,
    onDone: (ok: boolean, body: string, elapsedMs: number) => void,
): void {
    const start = Date.now();
    try {
        const child = spawn("curl", args, { detached: true, stdio: "ignore" });
        try { child.unref(); } catch {}
    } catch {
        onDone(false, "", 0);
        return;
    }

    const deadline = start + totalTimeoutMs;
    let lastSize = -1;
    let stable = 0;

    const timer = setInterval(() => {
        let size = 0;
        try { size = existsSync(outFile) ? statSync(outFile).size : 0; } catch {}
        if (size === lastSize) { stable++; } else { stable = 0; }
        lastSize = size;

        if ((stable >= stableNeeded && size > 0) || (stable >= stableNeeded + 3 && size === 0)) {
            clearInterval(timer);
            let body = "";
            try { if (existsSync(outFile)) body = readFileSync(outFile, "utf8"); } catch {}
            const ok = size > 0 || allowEmpty;
            cleanup(outFile);
            onDone(ok, body, Date.now() - start);
            return;
        }
        if (Date.now() >= deadline) {
            clearInterval(timer);
            cleanup(outFile);
            onDone(false, "", Date.now() - start);
        }
    }, POLL_MS);
}

export interface NetOptions {
    headers?: Record<string, string>;
    timeoutMs?: number;   // 默认 15000
}

// GET 文本/JSON body（跟随重定向）
export function netGetText(url: string, opts: NetOptions, onDone: (ok: boolean, body: string, elapsedMs: number) => void): void {
    const dir = tmpNetDir();
    const outFile = join(dir, `get_${reqId()}.body`);
    const timeoutMs = opts.timeoutMs || 15000;
    const args: string[] = ["-sSL",
        "--connect-timeout", String(Math.max(3, Math.floor(timeoutMs / 2000))),
        "--max-time", String(Math.floor(timeoutMs / 1000)),
        "-o", outFile];
    if (opts.headers) {
        for (const k of Object.keys(opts.headers)) {
            args.push("-H", `${k}: ${opts.headers[k]}`);
        }
    }
    args.push(url);
    pollFetch(args, outFile, timeoutMs + 6000, STABLE_NEEDED, false, onDone);
}

// GET JSON（解析失败回调 null）
export function netGetJson(url: string, opts: NetOptions, onDone: (data: any | null, elapsedMs: number) => void): void {
    netGetText(url, opts, (ok, body, elapsedMs) => {
        if (!ok) { onDone(null, elapsedMs); return; }
        try { onDone(JSON.parse(body), elapsedMs); } catch { onDone(null, elapsedMs); }
    });
}

// HEAD 探活：返回延迟 ms（0=不可达）
export function netProbe(url: string, timeoutMs: number, onDone: (latencyMs: number) => void): void {
    const dir = tmpNetDir();
    const outFile = join(dir, `probe_${reqId()}.hdr`);
    const args = ["-sSI",
        "--connect-timeout", String(Math.max(3, Math.floor(timeoutMs / 2000))),
        "--max-time", String(Math.max(4, Math.floor(timeoutMs / 1000))),
        "-o", outFile, url];
    pollFetch(args, outFile, timeoutMs + 4000, STABLE_NEEDED, false, (ok, _body, elapsedMs) => {
        onDone(ok ? elapsedMs : 0);
    });
}

// HEAD 取 Content-Length（失败 -1）
export function netContentSize(url: string, timeoutMs: number, onDone: (bytes: number) => void): void {
    const dir = tmpNetDir();
    const outFile = join(dir, `size_${reqId()}.hdr`);
    const args = ["-sSI",
        "--connect-timeout", String(Math.max(3, Math.floor(timeoutMs / 2000))),
        "--max-time", String(Math.max(4, Math.floor(timeoutMs / 1000))),
        "-o", outFile, url];
    pollFetch(args, outFile, timeoutMs + 4000, STABLE_NEEDED, false, (ok, body) => {
        if (!ok) { onDone(-1); return; }
        const m = body.match(/content-length:\s*(\d+)/i);
        onDone(m ? parseInt(m[1], 10) : -1);
    });
}

// 下载到指定路径。onProgress(bytes, total) 由轮询驱动；onDone(ok, bytes, elapsedMs)。
// 完成判定：文件非空且连续 5 次（2s）无增长。
export function netDownload(
    url: string,
    destPath: string,
    opts: NetOptions,
    onProgress: (bytes: number, total: number) => void,
    onDone: (ok: boolean, bytes: number, elapsedMs: number) => void,
): void {
    const timeoutMs = opts.timeoutMs || 300000;
    // 先取总大小（拿不到就 -1，进度显示已下载字节）
    netContentSize(url, 10000, (total: number) => {
        const args: string[] = ["-sSL", "--retry", "2", "--retry-delay", "3",
            "--connect-timeout", "10", "--max-time", String(Math.floor(timeoutMs / 1000)),
            "-o", destPath];
        if (opts.headers) {
            for (const k of Object.keys(opts.headers)) {
                args.push("-H", `${k}: ${opts.headers[k]}`);
            }
        }
        args.push(url);

        const start = Date.now();
        try {
            const child = spawn("curl", args, { detached: true, stdio: "ignore" });
            try { child.unref(); } catch {}
        } catch {
            onDone(false, 0, 0);
            return;
        }

        const deadline = start + timeoutMs + 15000;
        let lastSize = -1;
        let stable = 0;

        const timer = setInterval(() => {
            let size = 0;
            try { size = existsSync(destPath) ? statSync(destPath).size : 0; } catch {}
            if (size === lastSize) { stable++; } else { stable = 0; }
            lastSize = size;
            onProgress(size, total);

            if (stable >= 5 && size > 0) {
                clearInterval(timer);
                onDone(true, size, Date.now() - start);
                return;
            }
            if (Date.now() >= deadline) {
                clearInterval(timer);
                onDone(size > 0, size, Date.now() - start);
            }
        }, POLL_MS);
    });
}
