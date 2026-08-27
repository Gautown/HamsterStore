// GitHub 加速代理节点列表
// 解决国内访问 GitHub 速度慢或无法连接的问题

export interface ProxyNode {
    name: string;
    url: string;            // 代理基础 URL（无尾部斜杠）
    type: 'mirror' | 'proxy';
    priority: number;       // 数字越小优先级越高
    enabled: boolean;
    latency: number;        // 最后测速延迟（ms），0=未测速
    lastCheck: number;      // 最后测速时间戳（ms）
    failures: number;       // 连续失败次数
}

// 预置代理节点（按文档§4.1）
export const DEFAULT_PROXY_NODES: ProxyNode[] = [
    { name: "githubproxy.cc", url: "https://githubproxy.cc", type: "mirror", priority: 1, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "ghfast.top",     url: "https://ghfast.top",     type: "mirror", priority: 2, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "kkgithub.com",   url: "https://kkgithub.com",   type: "mirror", priority: 3, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "gh-proxy.org",   url: "https://gh-proxy.org",   type: "proxy",  priority: 4, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "mirror.ghproxy.com", url: "https://mirror.ghproxy.com", type: "proxy", priority: 5, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "hub.fastgit.xyz", url: "https://hub.fastgit.xyz", type: "mirror", priority: 6, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
];

// 最大连续失败次数，超过则禁用该节点
export const MAX_FAILURES = 5;

// 测速超时（ms）
export const SPEED_TEST_TIMEOUT = 5000;

// 重新测速间隔（ms）— 30 分钟
export const RECHECK_INTERVAL = 30 * 60 * 1000;