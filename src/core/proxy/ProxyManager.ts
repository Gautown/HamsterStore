// ProxyManager v4 — 代理管理器（回调式测速，无 execSync/shell 依赖）
// v4 变更（Perry 0.5.1665 适配，上游 #14982）：class → 模块级状态 + 对象字面量。
//   class 方法的 $pshape 克隆在 Windows COFF 上产生 compact-map rewriter 无法解析
//   的 alias 符号记录 → 整模块拒绝编译。对象字面量不触发（最小复现验证）。
//   getInstance() 门面保留，全部调用点零改动；私有字段 → 模块级 let。
// v3 基础：
//   1. 测速原语 netFetch.netProbe（spawn 数组 + setInterval 轮询）
//   2. 预算制测速：整体 10s，单节点 4s；预算耗尽即止
//   3. 缓存 30 分钟复用；API 请求强制路由 api:true 节点（ghfast.top 等只代理文件）

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

// ── 模块级状态（原 class 私有字段）──
let nodes: ProxyNode[] = DEFAULT_PROXY_NODES.map(n => ({ ...n }));
let bestNode: ProxyNode | null = null;
let measuring = false;
let disabled = false;
let cacheLoaded = false;

function updateBest(): void {
    const best = nodes
        .filter(n => n.enabled && n.latency > 0 && n.failures < MAX_FAILURES)
        .sort((a, b) => a.latency - b.latency)[0];
    bestNode = best || null;
}

// === 缓存（结构兼容 v2，直接覆盖旧文件） ===
function loadCache(): void {
    try {
        if (!existsSync(CACHE_FILE)) return;
        const cache: ProxyCache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
        if (Date.now() - cache.timestamp > RECHECK_INTERVAL) return;
        for (const c of cache.nodes) {
            const n = nodes.find(x => x.name === c.name);
            if (n) {
                n.latency = c.latency;
                n.failures = c.failures;
                n.enabled = c.enabled;
                n.lastCheck = cache.timestamp;
            }
        }
        const best = cache.best ? nodes.find(n => n.name === cache.best) : null;
        if (best && best.latency > 0) bestNode = best;
        if (bestNode) {
            console.log(`[ProxyManager] Cache hit: best=${bestNode.name} (${bestNode.latency}ms)`);
        }
    } catch {}
}

function saveCache(): void {
    try {
        const cache: ProxyCache = {
            timestamp: Date.now(),
            nodes: nodes.map(n => ({ name: n.name, latency: n.latency, failures: n.failures, enabled: n.enabled })),
            best: bestNode ? bestNode.name : null,
        };
        writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
    } catch {}
}

function getBestNode(): ProxyNode | null {
    if (bestNode && bestNode.failures < MAX_FAILURES && bestNode.latency > 0) {
        return bestNode;
    }
    const available = nodes
        .filter(n => n.enabled && n.failures < MAX_FAILURES && n.latency > 0)
        .sort((a, b) => a.latency - b.latency);
    return available[0] || null;
}

// 顺序探活（回调链），预算耗尽或跑完即写缓存收尾
function speedTestBackground(): void {
    const queue = nodes.filter(n => n.enabled).map(n => ({ name: n.name }));
    const budgetStart = Date.now();

    const next = (): void => {
        if (queue.length === 0 || Date.now() - budgetStart > PROBE_BUDGET_MS) {
            measuring = false;
            updateBest();
            saveCache();
            const best = getBestNode();
            console.log(`[ProxyManager] Probe done: best=${best ? best.name + " (" + best.latency + "ms)" : "none (direct)"}`);
            return;
        }
        const target = queue.shift()!;
        const node = nodes.find(n => n.name === target.name);
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

// URL 加速语义（v2 修正保留）：
//   replace: github.com 域名替换为镜像域名（api.github.com 不走镜像，回退直连）
//   prefix:  完整原始 URL 拼在代理后（gh-proxy.org 风格）
function accelerateUrl(originalUrl: string): string {
    if (disabled) return originalUrl;
    if (!originalUrl.includes("github.com") &&
        !originalUrl.includes("githubusercontent.com") &&
        !originalUrl.includes("githubassets.com")) {
        return originalUrl;
    }
    // API 请求只能走 api:true 的 prefix 节点（2026-11-19 实测：ghfast.top/ghproxy.net
    // 对 api.github.com 返回 "Invalid input."；此前按测速最快路由导致 release 解析必挂）。
    // 无已测速节点时按 priority 取未测速的 api 节点（直连 api.github.com 在国内基本不通）。
    if (originalUrl.includes("api.github.com")) {
        const apiNodes = nodes.filter(n =>
            n.enabled && n.api && n.mode === "prefix" && n.failures < MAX_FAILURES);
        const measured = apiNodes.filter(n => n.latency > 0).sort((a, b) => a.latency - b.latency);
        const apiNode = measured[0] || apiNodes.sort((a, b) => a.priority - b.priority)[0];
        return apiNode ? `${apiNode.url}/${originalUrl}` : originalUrl;
    }
    const node = getBestNode();
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

const manager = {
    // 后台测速（预算制、回调链）：init() 调用后立即返回，不打断 UI
    init(): void {
        updateBest();
        const needTest = nodes.some(n => n.enabled && n.latency === 0);
        if (needTest && !measuring) {
            measuring = true;
            speedTestBackground();
        }
        const best = getBestNode();
        console.log(best
            ? `[ProxyManager] Ready: best=${best.name} (${best.latency}ms)`
            : "[ProxyManager] No fresh node data yet, background probing (direct meanwhile)");
    },

    getBestNode,
    getAllNodes(): ProxyNode[] {
        return [...nodes].sort((a, b) => a.priority - b.priority);
    },
    accelerateUrl,

    // releases 下载加速：优先 prefix 节点（gh-proxy.org 实测可完整下载）
    accelerateDownload(url: string): string {
        if (disabled) return url;
        const prefixNode = nodes
            .filter(n => n.enabled && n.failures < MAX_FAILURES && n.latency > 0 &&
                (n.mode === "prefix" || n.type === "proxy"))
            .sort((a, b) => a.latency - b.latency)[0];
        if (prefixNode) return `${prefixNode.url}/${url}`;
        return accelerateUrl(url);
    },

    markFailed(nodeName: string): void {
        const node = nodes.find(n => n.name === nodeName);
        if (!node) return;
        node.failures++;
        if (node.failures >= MAX_FAILURES) {
            node.enabled = false;
            console.log(`[ProxyManager] Node ${nodeName} disabled (failures=${node.failures})`);
        }
        updateBest();
    },

    retest(): void {
        for (const n of nodes) { n.latency = 0; n.failures = 0; n.enabled = true; }
        bestNode = null;
        if (!measuring) {
            measuring = true;
            speedTestBackground();
        }
    },

    setProxyEnabled(enabled: boolean): void {
        disabled = !enabled;
        if (enabled) manager.init();
        console.log(`[ProxyManager] Accelerator ${enabled ? "enabled" : "disabled"}`);
    },

    isProxyEnabled(): boolean {
        return !disabled;
    },

    proxyDisabled(): boolean {
        return disabled;
    },

    getStatus(): { connected: boolean; nodeName: string; latency: number; measuring: boolean } {
        const best = getBestNode();
        return {
            connected: best !== null,
            nodeName: best ? best.name : (measuring ? "测速中" : "direct"),
            latency: best ? best.latency : 0,
            measuring,
        };
    },
};

// 门面：保留 ProxyManager.getInstance() 调用形态（懒加载缓存，等价原私有构造）
export const ProxyManager = {
    getInstance() {
        if (!cacheLoaded) {
            cacheLoaded = true;
            loadCache();
        }
        return manager;
    },
};
