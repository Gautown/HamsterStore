// ProxyManager — 代理管理器
// 代理池维护、自动测速、故障转移、镜像加速 URL 生成

import { execSync } from "node:child_process";
import { DEFAULT_PROXY_NODES, MAX_FAILURES, SPEED_TEST_TIMEOUT, RECHECK_INTERVAL, type ProxyNode } from "./proxies";

export class ProxyManager {
    private static instance: ProxyManager;
    private nodes: ProxyNode[];
    private bestNode: ProxyNode | null = null;
    private initialized = false;

    private constructor() {
        // 从配置文件加载或使用默认节点
        this.nodes = [...DEFAULT_PROXY_NODES];
    }

    static getInstance(): ProxyManager {
        if (!ProxyManager.instance) {
            ProxyManager.instance = new ProxyManager();
        }
        return ProxyManager.instance;
    }

    // 初始化代理管理器（自动选择最优节点）
    async init(): Promise<void> {
        if (this.initialized) return;
        console.log("[ProxyManager] Initializing proxy pool...");
        this.initialized = true;
        // 同步测速选出最佳节点
        this.speedTestAll();
        if (this.bestNode) {
            console.log(`[ProxyManager] Best node: ${this.bestNode.name} (${this.bestNode.latency}ms)`);
        } else {
            console.log("[ProxyManager] No available proxy node, using direct connection");
        }
    }

    // 获取当前最佳代理节点
    getBestNode(): ProxyNode | null {
        if (this.bestNode && this.bestNode.failures < MAX_FAILURES) {
            return this.bestNode;
        }
        // 选择延迟最低、enabled 的节点
        const available = this.nodes
            .filter(n => n.enabled && n.failures < MAX_FAILURES)
            .sort((a, b) => a.latency - b.latency);
        return available[0] || null;
    }

    // 获取所有节点（按优先级排序）
    getAllNodes(): ProxyNode[] {
        return [...this.nodes].sort((a, b) => a.priority - b.priority);
    }

    // 对所有节点测速
    speedTestAll(): void {
        for (const node of this.nodes) {
            if (!node.enabled) continue;
            const latency = this.speedTest(node);
            node.latency = latency;
            node.lastCheck = Date.now();
            if (latency === 0) {
                node.failures++;
                if (node.failures >= MAX_FAILURES) {
                    node.enabled = false;
                    console.log(`[ProxyManager] Node ${node.name} disabled (too many failures)`);
                }
            } else {
                node.failures = 0;
            }
        }
        this.updateBest();
    }

    // 单节点测速（curl HEAD 请求）
    private speedTest(node: ProxyNode): number {
        const start = Date.now();
        try {
            const cmd = `curl -sS -o /dev/null -w "%{http_code}" --max-time ${Math.floor(SPEED_TEST_TIMEOUT / 1000)} -I ${node.url}`;
            const stdout = execSync(cmd, {
                timeout: SPEED_TEST_TIMEOUT + 2000,
                stdio: ["pipe", "pipe", "pipe"],
            }) as unknown as Buffer;
            const code = stdout.toString("utf8").trim();
            const latency = Date.now() - start;
            // 2xx/3xx 视为成功
            if (code.startsWith("2") || code.startsWith("3")) {
                console.log(`[ProxyManager] ${node.name}: ${code} ${latency}ms`);
                return latency;
            }
            console.log(`[ProxyManager] ${node.name}: HTTP ${code} (failed)`);
            return 0;
        } catch {
            const latency = Date.now() - start;
            console.log(`[ProxyManager] ${node.name}: unreachable (${latency}ms)`);
            return 0;
        }
    }

    // 更新最佳节点
    private updateBest(): void {
        const best = this.nodes
            .filter(n => n.enabled && n.latency > 0 && n.failures < MAX_FAILURES)
            .sort((a, b) => a.latency - b.latency)[0];
        this.bestNode = best || null;
    }

    // 将 GitHub 下载 URL 转换为加速链接
    accelerateUrl(originalUrl: string): string {
        if (!originalUrl.includes("github.com") && !originalUrl.includes("raw.githubusercontent.com")) {
            return originalUrl;
        }
        const node = this.getBestNode();
        if (!node) return originalUrl;
        // 各镜像站 URL 拼接规则
        if (node.type === "mirror") {
            // 镜像站：替换域名为镜像域名
            return originalUrl
                .replace("https://github.com", node.url)
                .replace("https://raw.githubusercontent.com", `${node.url}/raw`);
        }
        // 代理站：前缀代理
        return `${node.url}/${originalUrl}`;
    }

    // 标记节点失败（故障转移）
    markFailed(nodeName: string): void {
        const node = this.nodes.find(n => n.name === nodeName);
        if (!node) return;
        node.failures++;
        if (node.failures >= MAX_FAILURES) {
            node.enabled = false;
            console.log(`[ProxyManager] Node ${nodeName} disabled (failures=${node.failures})`);
            this.updateBest();
        }
    }

    // 启用/禁用节点
    setEnabled(nodeName: string, enabled: boolean): void {
        const node = this.nodes.find(n => n.name === nodeName);
        if (node) {
            node.enabled = enabled;
            if (enabled) node.failures = 0;
        }
    }

    // 添加自定义节点
    addNode(node: Omit<ProxyNode, "latency" | "lastCheck" | "failures">): void {
        this.nodes.push({
            ...node,
            latency: 0,
            lastCheck: 0,
            failures: 0,
        });
    }

    // 状态摘要（供 UI 显示）
    getStatus(): { connected: boolean; nodeName: string; latency: number } {
        const best = this.getBestNode();
        return {
            connected: best !== null,
            nodeName: best?.name || "direct",
            latency: best?.latency || 0,
        };
    }
}