// HamsterProxy — 网络加速器封装
// 借鉴 FastGithub 思路：通过 ProxyManager 的镜像/代理节点加速 GitHub 搜索和 downloads
// 底层复用 ProxyManager v2（非阻塞测速 + 节点缓存 + 故障转移）
// 纯封装层，不做本地代理服务器（Perry 单线程事件循环 + spawn 回调不可靠，
// 本地 HTTP 代理监听在 v0.5.1220 下无法实现，URL 级加速是当前稳定路径）

import { ProxyManager } from "./ProxyManager";
import type { ProxyNode } from "./proxies";

// GitHub 相关域名（加速目标）
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
    mode: "mirror" | "proxy" | "mixed" | "direct";
    latency: number;
    currentNode: string;
}

export class HamsterProxy {
    private static instance: HamsterProxy;
    private started = false;

    private constructor() {}

    static getInstance(): HamsterProxy {
        if (!HamsterProxy.instance) {
            HamsterProxy.instance = new HamsterProxy();
        }
        return HamsterProxy.instance;
    }

    /**
     * 启动加速器（非阻塞：初始化测速在后台进行）
     */
    start(): boolean {
        if (this.started) return true;
        try {
            ProxyManager.getInstance().init();
            this.started = true;
            console.log("[HamsterProxy] Started (accelerator active, speed test in background)");
            return true;
        } catch (e: any) {
            console.error("[HamsterProxy] Failed to start:", e.message);
            return false;
        }
    }

    stop(): void {
        this.started = false;
        console.log("[HamsterProxy] Stopped");
    }

    /**
     * 获取状态（状态栏显示用）
     */
    getStatus(): ProxyServerStatus {
        const pm = ProxyManager.getInstance();
        const st = pm.getStatus();
        const node: ProxyNode | null = pm.getBestNode();
        return {
            running: this.started && pm.isProxyEnabled(),
            port: 0,
            mode: node ? (node.mode === "prefix" ? "proxy" : "mirror") : "direct",
            latency: st.latency,
            currentNode: st.nodeName,
        };
    }

    /**
     * 加速 URL（搜索/API 调用用）
     */
    accelerateUrl(url: string): string {
        return ProxyManager.getInstance().accelerateUrl(url);
    }

    /**
     * 加速下载链接（releases 下载用，优先 prefix 节点）
     */
    accelerateDownload(url: string): string {
        return ProxyManager.getInstance().accelerateDownload(url);
    }

    /**
     * 判断是否 GitHub 域名
     */
    isGitHubDomain(url: string): boolean {
        if (!url) return false;
        let hostname = url;
        if (url.includes("://")) {
            const m = url.match(/^https?:\/\/([^\/]+)/);
            if (m) hostname = m[1];
        }
        const host = hostname.split(":")[0].toLowerCase();
        return GITHUB_DOMAINS.some(domain => host === domain || host.endsWith("." + domain));
    }

    /**
     * 重新测速
     */
    retest(): void {
        ProxyManager.getInstance().retest();
    }
}

// 便捷单例
export const hamsterProxy = HamsterProxy.getInstance();
