// ProxyManager v2 — 代理管理器
// 改进点：
//  1. 正确的 URL 加速语义：mirror=替换域名 / prefix=前缀代理，节点带 mode 字段
//  2. 非阻塞测速：spawn curl 写结果文件 + 轮询，GUI 不再被 23 秒同步 execSync 卡住
//  3. 测速结果缓存到 ~/.hamsterstore/proxy_cache.json，30 分钟内复用不重测

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROXY_NODES, MAX_FAILURES, SPEED_TEST_TIMEOUT, RECHECK_INTERVAL, type ProxyNode } from "./proxies";

function cacheDir(): string {
    const base = process.env.USERPROFILE || process.env.HOME || ".";
    const dir = join(base, ".hamsterstore");
    mkdirSync(dir, { recursive: true });
    return dir;
}

const CACHE_FILE = join(cacheDir(), "proxy_cache.json");
// 轮询间隔/总时长（Perry spawn 回调不可靠，以文件轮询为准）
const POLL_INTERVAL_MS = 500;
const PROBE_POLL_TOTAL_MS = SPEED_TEST_TIMEOUT + 3000;

interface ProxyCache {
    timestamp: number;
    nodes: Array<{ name: string; latency: number; failures: number; enabled: boolean }>;
    best: string | null;
}

// 单节点探测：spawn curl -o /dev/null -w 写状态码到文件，轮询读取
function probeNode(node: ProxyNode, onDone: (latency: number) => void): void {
    const reqId = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    const resultFile = join(cacheDir(), `probe_${reqId}.code`);
    const start = Date.now();

    // 探测 URL：prefix 类测 `${url}/https://github.com` 太重，统一测节点首页
    const probeUrl = node.url;
    const args: string[] = [
        "-sS", "-o", "/dev/null", "-w", "%{http_code}",
        "--connect-timeout", String(Math.floor(SPEED_TEST_TIMEOUT / 1000)),
        "--max-time", String(Math.floor(SPEED_TEST_TIMEOUT / 1000)),
        probeUrl,
    ];

    let settled = false;
    const finish = (latency: number): void => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        onDone(latency);
    };

    let child: any;
    try {
        // stdout → 结果文件（状态码），绕开 spawn 管道回调不可靠问题
        child = spawn("curl", args, {
            stdio: ["ignore", resultFile, "ignore"],
        });
    } catch {
        finish(0);
        return;
    }

    if (child) {
        try { child.unref && child.unref(); } catch {}
    }

    const deadline = Date.now() + PROBE_POLL_TOTAL_MS;
    let lastMs = 0;
    const timer = setInterval(() => {
        let code = "";
        try {
            code = readFileSync(resultFile, "utf8").trim();
        } catch {
            code = "";
        }
        lastMs = Date.now() - start;
        if (code) {
            const ok = code.startsWith("2") || code.startsWith("3");
            console.log(`[ProxyManager] ${node.name}: HTTP ${code} (${lastMs}ms)`);
            finish(ok ? lastMs : 0);
        } else if (Date.now() >= deadline) {
            console.log(`[ProxyManager] ${node.name}: probe timed out (${lastMs}ms)`);
            finish(0);
        }
    }, POLL_INTERVAL_MS);
}

export class ProxyManager {
    private static instance: ProxyManager;
    private nodes: ProxyNode[];
    private bestNode: ProxyNode | null = null;
    private measuring = false;
    private disabled = false;  // 加速器总开关（SettingsPanel 同步调用 setProxyEnabled）

    private constructor() {
        this.nodes = DEFAULT_PROXY_NODES.map(n => ({ ...n }));
        this.loadCache();
    }

    static getInstance(): ProxyManager {
        if (!ProxyManager.instance) {
            ProxyManager.instance = new ProxyManager();
        }
        return ProxyManager.instance;
    }

    // 设置面板切换加速器开关时调用
    setProxyEnabled(enabled: boolean): void {
        this.disabled = !enabled;
        if (enabled) {
            this.init();  // 重新检测/启用
        }
        console.log(`[ProxyManager] Accelerator ${enabled ? "enabled" : "disabled"}`);
    }

    isProxyEnabled(): boolean {
        return !this.disabled;
    }

    // 初始化（非阻塞）：
    // - 有新鲜缓存 → 直接用，立刻返回
    // - 无缓存 → 后台测速，立刻返回（首次为直连，测完更新）
    init(): void {
        this.updateBest();
        const needTest = this.nodes.some(n => n.enabled && n.latency === 0);
        if (needTest && !this.measuring) {
            this.measuring = true;
            this.speedTestBackground();
        }
        const best = this.getBestNode();
        if (best) {
            console.log(`[ProxyManager] Best node: ${best.name} (${best.latency}ms)`);
        } else {
            console.log("[ProxyManager] No available proxy node yet, using direct connection (speed test running in background)");
        }
    }

    // 后台顺序测速（避免并发 spawn 冲突），完成后写缓存
    private speedTestBackground(): void {
        const queue = this.nodes.filter(n => n.enabled);
        const next = (): void => {
            if (queue.length === 0) {
                this.measuring = false;
                this.updateBest();
                this.saveCache();
                return;
            }
            const node = queue.shift()!;
            console.log(`[ProxyManager] Probing ${node.name}...`);
            probeNode(node, (latency: number) => {
                node.lastCheck = Date.now();
                if (latency > 0) {
                    node.latency = latency;
                    node.failures = 0;
                } else {
                    node.failures++;
                    if (node.failures >= MAX_FAILURES) {
                        // 保留 enabled，用高延迟惩罚排序；彻底禁用需要连续失败
                        console.log(`[ProxyManager] ${node.name} failed ${node.failures} times`);
                    }
                }
                next();
            });
        };
        next();
    }

    // 获取当前最佳代理节点
    getBestNode(): ProxyNode | null {
        if (this.bestNode && this.bestNode.failures < MAX_FAILURES && this.bestNode.latency > 0) {
            return this.bestNode;
        }
        const available = this.nodes
            .filter(n => n.enabled && n.failures < MAX_FAILURES && n.latency > 0)
            .sort((a, b) => a.latency - b.latency);
        return available[0] || null;
    }

    getAllNodes(): ProxyNode[] {
        return [...this.nodes].sort((a, b) => a.priority - b.priority);
    }

    // 将 URL 转换为加速链接（核心：按节点 mode 选择 replace/prefix 语义）
    accelerateUrl(originalUrl: string): string {
        if (this.proxyDisabled()) return originalUrl;
        // 只加速 GitHub 相关域名
        if (!originalUrl.includes("github.com") &&
            !originalUrl.includes("githubusercontent.com") &&
            !originalUrl.includes("githubassets.com")) {
            return originalUrl;
        }
        const node = this.getBestNode();
        if (!node) return originalUrl;

        if (node.mode === "replace") {
            // 镜像站：替换 github.com 域名为镜像域名
            // 注意：api.github.com 不能走镜像站（镜像不代理 API），回退直连
            if (originalUrl.includes("api.github.com")) {
                return originalUrl;
            }
            return originalUrl
                .replace("https://github.com", node.url)
                .replace("https://raw.githubusercontent.com", node.url + "/raw")
                .replace("https://objects.githubusercontent.com", node.url + "/objects");
        }
        // prefix 类：完整原始 URL 拼在代理后（ghfast.top / gh-proxy 风格）
        return `${node.url}/${originalUrl}`;
    }

    // 加速 release 下载链接（releases 优先用 prefix 节点，下载大文件更稳）
    accelerateDownload(url: string): string {
        if (this.proxyDisabled()) return url;
        const prefixNode = this.nodes
            .filter(n => n.enabled && n.failures < MAX_FAILURES && n.latency > 0 &&
                (n.mode === "prefix" || n.type === "proxy"))
            .sort((a, b) => a.latency - b.latency)[0];
        if (prefixNode) {
            return `${prefixNode.url}/${url}`;
        }
        // 没有可用 prefix 节点时退回通用加速逻辑
        return this.accelerateUrl(url);
    }

    // 标记节点失败（故障转移）
    markFailed(nodeName: string): void {
        const node = this.nodes.find(n => n.name === nodeName);
        if (!node) return;
        node.failures++;
        if (node.failures >= MAX_FAILURES) {
            node.enabled = false;
            console.log(`[ProxyManager] Node ${nodeName} disabled (failures=${node.failures})`);
        }
        this.updateBest();
    }

    // 强制重新测速（设置面板"重新测速"按钮用）
    retest(): void {
        for (const n of this.nodes) { n.latency = 0; n.failures = 0; n.enabled = true; }
        this.bestNode = null;
        if (!this.measuring) {
            this.measuring = true;
            this.speedTestBackground();
        }
    }

    // 加速器是否处于禁用状态
    proxyDisabled(): boolean {
        return this.disabled;
    }

    // 更新最佳节点
    private updateBest(): void {
        const best = this.nodes
            .filter(n => n.enabled && n.latency > 0 && n.failures < MAX_FAILURES)
            .sort((a, b) => a.latency - b.latency)[0];
        this.bestNode = best || null;
    }

    // === 缓存 ===
    private loadCache(): void {
        try {
            if (!existsSync(CACHE_FILE)) return;
            const cache: ProxyCache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
            if (Date.now() - cache.timestamp > RECHECK_INTERVAL) return; // 过期不用
            for (const c of cache.nodes) {
                const n = this.nodes.find(x => x.name === c.name);
                if (n) {
                    n.latency = c.latency;
                    n.failures = c.failures;
                    n.enabled = c.enabled;
                    n.lastCheck = cache.timestamp;
                }
            }
            const best = cache.best ? this.nodes.find(n => n.name === cache.best) : null;
            if (best && best.latency > 0) this.bestNode = best;
            if (this.bestNode) {
                console.log(`[ProxyManager] Loaded cache: best=${this.bestNode.name} (${this.bestNode.latency}ms)`);
            }
        } catch {}
    }

    private saveCache(): void {
        try {
            const cache: ProxyCache = {
                timestamp: Date.now(),
                nodes: this.nodes.map(n => ({ name: n.name, latency: n.latency, failures: n.failures, enabled: n.enabled })),
                best: this.bestNode ? this.bestNode.name : null,
            };
            writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
        } catch {}
    }

    // 状态摘要（供 UI 显示）
    getStatus(): { connected: boolean; nodeName: string; latency: number; measuring: boolean } {
        const best = this.getBestNode();
        return {
            connected: best !== null,
            nodeName: best ? best.name : (this.measuring ? "测速中" : "direct"),
            latency: best ? best.latency : 0,
            measuring: this.measuring,
        };
    }
}
