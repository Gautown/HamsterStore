// HamsterProxy — 本地 HTTP/HTTPS 代理服务器（简单版）
// 实现 FastGithub 类似的功能：拦截 GitHub 请求，路由到最优代理节点
// 使用 spawn curl 方式，避免 Perry execSync 问题

import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ProxyManager } from "./ProxyManager";
import type { ProxyNode } from "./proxies";

// 代理端口
const PROXY_PORT = 38457;

// GitHub 相关域名
const GITHUB_DOMAINS = [
    "github.com",
    "api.github.com",
    "raw.githubusercontent.com",
    "objects.githubusercontent.com",
    "user-images.githubusercontent.com",
    "avatars.githubusercontent.com",
    "github.githubassets.com",
    "collector.github.com",
    "github.io",
];

export interface ProxyServerStatus {
    running: boolean;
    port: number;
    mode: "mirror" | "proxy" | "mixed";
    latency: number;
    currentNode: string;
}

/**
 * 通过 spawn curl 获取远程内容（绕过 Perry execSync 限制）
 */
function fetchViaCurl(url: string, options: {
    headers?: Record<string, string>;
    maxTime?: number;
    timeoutMs?: number;
} = {}): Promise<{ success: boolean; body?: string; statusCode?: number; error?: string }> {
    return new Promise((resolve) => {
        const timeoutMs = options.timeoutMs || 15000;
        const maxTime = options.maxTime || 10000;
        const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const outputFile = join(process.env.TEMP || "/tmp", `proxy_${requestId}.json`);

        const args: string[] = [
            "-sS", "-L", "--ssl-no-revoke",
            "--connect-timeout", String(Math.ceil(maxTime / 1000)),
            "--max-time", String(Math.ceil(maxTime / 1000)),
            "-w", "\n%{http_code}",
        ];

        if (options.headers) {
            for (const [k, v] of Object.entries(options.headers)) {
                args.push("-H", `${k}: ${v}`);
            }
        }

        // cmd.exe 转义
        const safeUrl = url.replace(/&/g, "^&").replace(/\*/g, "^*");
        args.push(safeUrl);

        const proc = spawn("curl", args, {
            stdio: ["ignore", "pipe", "pipe"],
            timeout: timeoutMs,
        });

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString("utf8");
        });

        proc.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString("utf8");
        });

        proc.on("close", (code: number | null) => {
            // 分离状态码和正文
            const lines = stdout.split("\n");
            const lastLine = lines[lines.length - 1] || "0";
            const statusCode = parseInt(lastLine, 10) || 0;
            const body = lines.slice(0, -1).join("\n");

            resolve({
                success: code === 0 && statusCode >= 200 && statusCode < 300,
                body: body.trim(),
                statusCode,
                error: code !== 0 ? `exit ${code}` : (stderr.trim() || undefined),
            });

            // 清理
            try { unlinkSync(outputFile); } catch {}
        });

        // 超时处理
        setTimeout(() => {
            if (!proc.killed) {
                proc.kill();
                resolve({ success: false, error: "timeout" });
            }
        }, timeoutMs);
    });
}

export class HamsterProxy {
    private static instance: HamsterProxy;
    private running = false;
    private status: ProxyServerStatus = {
        running: false,
        port: PROXY_PORT,
        mode: "mixed",
        latency: 0,
        currentNode: "direct",
    };
    // 请求队列
    private requestQueue: Array<{
        url: string;
        method: string;
        headers: Record<string, string>;
        resolve: (result: any) => void;
    }> = [];

    private constructor() {}

    static getInstance(): HamsterProxy {
        if (!HamsterProxy.instance) {
            HamsterProxy.instance = new HamsterProxy();
        }
        return HamsterProxy.instance;
    }

    /**
     * 启动代理（实际是初始化代理管理器）
     */
    start(): boolean {
        if (this.running) {
            return true;
        }

        try {
            const pm = ProxyManager.getInstance();
            pm.init().then(() => {
                this.running = true;
                this.updateStatus();
                console.log(`[HamsterProxy] Started (mode: ${this.status.mode})`);
            }).catch(err => {
                console.error("[HamsterProxy] Init failed:", err.message);
                this.running = false;
            });
            return true;
        } catch (e: any) {
            console.error("[HamsterProxy] Failed to start:", e.message);
            return false;
        }
    }

    /**
     * 停止代理
     */
    stop(): void {
        this.running = false;
        this.status.running = false;
        console.log("[HamsterProxy] Stopped");
    }

    /**
     * 获取状态
     */
    getStatus(): ProxyServerStatus {
        return { ...this.status };
    }

    /**
     * 加速 URL
     */
    accelerateUrl(url: string): string {
        const pm = ProxyManager.getInstance();
        return pm.accelerateUrl(url);
    }

    /**
     * 判断是否是 GitHub 域名
     */
    isGitHubDomain(url: string): boolean {
        if (!url) return false;
        let hostname = url;
        if (url.includes("://")) {
            try {
                hostname = new URL(url).hostname;
            } catch {
                return false;
            }
        }
        return GITHUB_DOMAINS.some(domain => hostname.endsWith(domain));
    }

    /**
     * 执行代理请求
     */
    async fetch(url: string, options: {
        method?: string;
        headers?: Record<string, string>;
    } = {}): Promise<{ success: boolean; body?: string; statusCode?: number; error?: string }> {
        const pm = ProxyManager.getInstance();
        const acceleratedUrl = this.accelerateUrl(url);
        const node = pm.getBestNode();

        console.log(`[HamsterProxy] ${options.method || "GET"} ${url} -> ${acceleratedUrl}`);

        // 使用 spawn curl 获取
        return fetchViaCurl(acceleratedUrl, {
            headers: options.headers,
            maxTime: 15000,
            timeoutMs: 20000,
        });
    }

    /**
     * 更新状态
     */
    private updateStatus(): void {
        const pm = ProxyManager.getInstance();
        const node = pm.getBestNode();
        this.status = {
            running: this.running,
            port: PROXY_PORT,
            mode: node?.type || "mixed",
            latency: node?.latency || 0,
            currentNode: node?.name || "direct",
        };
    }
}

// 导出便捷函数
export const hamsterProxy = HamsterProxy.getInstance();
