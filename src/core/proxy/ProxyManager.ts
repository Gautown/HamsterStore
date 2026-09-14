// ProxyManager v3 — 代理管理器（回调式测速，无 execSync/shell 依赖）
// v3 变更（相对 v2）：
//   1. 测速原语换 netFetch.netProbe（spawn 数组 + setInterval 轮询），
//      修复 v2 spawn(shell:true 拼字符串) 在真实二进制下全超时的致命 bug
//   2. 测速改为预算制：整体预算 8s，单节点超时 4s；预算耗尽即止（不再串行 7×8s）
//   3. probe 结束后清理临时文件；缓存结构不变（30 分钟复用）

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROXY_NODES, MAX_FAILURES, RECHECK_INTERVAL, type ProxyNode } from "./proxies";
import { netProbe } from "../net/netFetch";

function cacheDir(): string {
    const base = process.env.USERPROFILE || process.env.HOME || ".";
    const dir = join(base, ".hamsterstore");
    mkdirSync(dir, { recursive: true });
    return dir;
}

const CACHE_FILE = join(cacheDir(), "proxy_cache.json");
const PROBE_TIMEOUT_MS = 4000;      // 单节点探活预算
const PROBE_BUDGET_MS = 10000;       // 全部节点总预算

interface ProxyCache {
    timestamp: number;
    nodes: Array<{ name: string; latency: number; failures: number; enabled: boolean }>;
    best: string | null;
}

export class ProxyManager {
    private static instance: ProxyManager;
    private nodes: ProxyNode[];
    private bestNode: ProxyNode | null = null;
    private measuring = false;
    private disabled = false;

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

    // 后台测速（预算制、回调链）：init() 调用后立即返回，不打断 UI
    init(): void {
        this.updateBest();
        const needTest = this.nodes.some(n => n.enabled && n.latency === 0);
        if (needTest && !this.measuring) {
            this.measuring = true;
            this.speedTestBackground();
        }
        const best = this.getBestNode();
        console.log(best
            ? `[ProxyManager] Ready: best=${best.name} (${best.latency}ms)`
            : "[ProxyManager] No fresh node data yet, background probing (direct meanwhile)");
    }

    // 顺序探活（回调链），预算耗尽或跑完即写缓存收尾
    private speedTestBackground(): void {
        const queue = this.nodes.filter(n => n.enabled).map(n => ({ name: n.name }));
        const budgetStart = Date.now();

        const next = (): void => {
            if (queue.length === 0 || Date.now() - budgetStart > PROBE_BUDGET_MS) {
                this.measuring = false;
                this.updateBest();
                this.saveCache();
                const best = this.getBestNode();
                console.log(`[ProxyManager] Probe done: best=${best ? best.name + " (" + best.latency + "ms)" : "none (direct)"}`);
                return;
            }
            const target = queue.shift()!;
            const node = this.nodes.find(n => n.name === target.name);
            if (!node) { next(); return; }

            netProbe(node.url, PROBE_TIMEOUT_MS, (latency: number) => {
                node.lastCheck = Date.now();
                if (latency > 0) {
                    node.latency = latency;
                    node.failures = 0;
                    console.log(`[ProxyManager] ${node.name}: OK ${latency}ms`);
                } else {
                    node.failures++;
                    node.latency = 0;
                    console.log(`[ProxyManager] ${node.name}: unreachable`);
                }
                next();
            });
        };
        next();
    }

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

    // URL 加速语义（v2 修正保留）：
    //   replace: github.com 域名替换为镜像域名（api.github.com 不走镜像，回退直连）
    //   prefix:  完整原始 URL 拼在代理后（gh-proxy.org 风格）
    accelerateUrl(originalUrl: string): string {
        if (this.disabled) return originalUrl;
        if (!originalUrl.includes("github.com") &&
            !originalUrl.includes("githubusercontent.com") &&
            !originalUrl.includes("githubassets.com")) {
            return originalUrl;
        }
        const node = this.getBestNode();
        if (!node) return originalUrl;

        if (node.mode === "replace") {
            if (originalUrl.includes("api.github.com")) {
                return originalUrl;  // 镜像站不代理 API
            }
            return originalUrl
                .replace("https://github.com", node.url)
                .replace("https://raw.githubusercontent.com", node.url + "/raw")
                .replace("https://objects.githubusercontent.com", node.url + "/objects");
        }
        return `${node.url}/${originalUrl}`;
    }

    // releases 下载加速：优先 prefix 节点（gh-proxy.org 实测可完整下载）
    accelerateDownload(url: string): string {
        if (this.disabled) return url;
        const prefixNode = this.nodes
            .filter(n => n.enabled && n.failures < MAX_FAILURES && n.latency > 0 &&
                (n.mode === "prefix" || n.type === "proxy"))
            .sort((a, b) => a.latency - b.latency)[0];
        if (prefixNode) return `${prefixNode.url}/${url}`;
        return this.accelerateUrl(url);
    }

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

    retest(): void {
        for (const n of this.nodes) { n.latency = 0; n.failures = 0; n.enabled = true; }
        this.bestNode = null;
        if (!this.measuring) {
            this.measuring = true;
            this.speedTestBackground();
        }
    }

    setProxyEnabled(enabled: boolean): void {
        this.disabled = !enabled;
        if (enabled) this.init();
        console.log(`[ProxyManager] Accelerator ${enabled ? "enabled" : "disabled"}`);
    }

    isProxyEnabled(): boolean {
        return !this.disabled;
    }

    proxyDisabled(): boolean {
        return this.disabled;
    }

    private updateBest(): void {
        const best = this.nodes
            .filter(n => n.enabled && n.latency > 0 && n.failures < MAX_FAILURES)
            .sort((a, b) => a.latency - b.latency)[0];
        this.bestNode = best || null;
    }

    // === 缓存（结构兼容 v2，直接覆盖旧文件） ===
    private loadCache(): void {
        try {
            if (!existsSync(CACHE_FILE)) return;
            const cache: ProxyCache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
            if (Date.now() - cache.timestamp > RECHECK_INTERVAL) return;
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
                console.log(`[ProxyManager] Cache hit: best=${this.bestNode.name} (${this.bestNode.latency}ms)`);
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
