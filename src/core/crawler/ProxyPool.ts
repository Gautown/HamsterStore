// ProxyPool — 爬虫代理池
// 不同于 ProxyManager（加速访问），这是爬虫降级时使用的镜像站

import { execSync } from "node:child_process";

export interface ProxyPoolNode {
    name: string;
    url: string;
    enabled: boolean;
    failures: number;
}

// GitHub 页面镜像站
export const GITHUB_MIRRORS: ProxyPoolNode[] = [
    { name: "kkgithub.com",      url: "https://kkgithub.com",      enabled: true, failures: 0 },
    { name: "hub.fastgit.xyz",   url: "https://hub.fastgit.xyz",   enabled: true, failures: 0 },
    { name: "github.com.cnpmjs.org", url: "https://github.com.cnpmjs.org", enabled: true, failures: 0 },
    { name: "github.com (direct)", url: "https://github.com",      enabled: true, failures: 0 },
];

const MAX_FAILURES = 5;

export class ProxyPool {
    private nodes: ProxyPoolNode[];
    private currentIndex: number = 0;

    constructor() {
        this.nodes = [...GITHUB_MIRRORS];
    }

    // 获取下一个可用节点（轮询）
    nextNode(): ProxyPoolNode | null {
        const available = this.nodes.filter(n => n.enabled && n.failures < MAX_FAILURES);
        if (available.length === 0) return null;
        const node = available[this.currentIndex % available.length];
        this.currentIndex++;
        return node;
    }

    // 镜像 URL 转换（github.com → 镜像域名）
    mirrorUrl(originalUrl: string): string {
        const node = this.nextNode();
        if (!node || node.name === "github.com (direct)") return originalUrl;
        return originalUrl.replace("https://github.com", node.url);
    }

    // 标记节点失败
    markFailed(nodeName: string): void {
        const node = this.nodes.find(n => n.name === nodeName);
        if (!node) return;
        node.failures++;
        if (node.failures >= MAX_FAILURES) {
            node.enabled = false;
        }
    }

    // 重置所有失败计数
    reset(): void {
        for (const node of this.nodes) {
            node.failures = 0;
            node.enabled = true;
        }
    }

    // 获取节点列表
    getNodes(): ProxyPoolNode[] {
        return [...this.nodes];
    }
}