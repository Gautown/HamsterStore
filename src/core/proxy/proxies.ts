// GitHub 加速代理节点列表
// 解决国内访问 GitHub 速度慢或无法连接的问题

export interface ProxyNode {
    name: string;
    url: string;            // 代理基础 URL（无尾部斜杠）
    type: 'mirror' | 'proxy';
    mode: 'replace' | 'prefix';  // 加速语义：replace=替换域名镜像站 / prefix=前缀代理
    api: boolean;           // 能否前缀代理 api.github.com（实测：仅 gh-proxy.org 支持；
                            //  ghfast.top/ghproxy.net 对 API 返回 "Invalid input."，只能代理文件）
    priority: number;       // 数字越小优先级越高
    enabled: boolean;
    latency: number;        // 最后测速延迟（ms），0=未测速
    lastCheck: number;      // 最后测速时间戳（ms）
    failures: number;       // 连续失败次数
}

// 预置代理节点（按文档§4.1）
// replace 类：镜像站直接替换 github.com 域名（kkgithub/githubproxy）
// prefix 类：代理站把完整原始 URL 拼在后面（ghfast.top/gh-proxy）
// api 能力为 2026-11-19 实测：API 请求必须路由到 api:true 节点，否则解析必挂
export const DEFAULT_PROXY_NODES: ProxyNode[] = [
    { name: "gh-proxy.org",   url: "https://gh-proxy.org",   type: "proxy",  mode: "prefix",  api: true,  priority: 1, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "githubproxy.cc", url: "https://githubproxy.cc", type: "mirror", mode: "replace", api: false, priority: 2, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "ghproxy.net",    url: "https://ghproxy.net",    type: "proxy",  mode: "prefix",  api: false, priority: 3, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "ghfast.top",     url: "https://ghfast.top",     type: "mirror", mode: "prefix",  api: false, priority: 4, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "kkgithub.com",   url: "https://kkgithub.com",   type: "mirror", mode: "replace", api: false, priority: 5, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "mirror.ghproxy.com", url: "https://mirror.ghproxy.com", type: "proxy", mode: "prefix", api: false, priority: 6, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
    { name: "hub.fastgit.xyz", url: "https://hub.fastgit.xyz", type: "mirror", mode: "replace", api: false, priority: 7, enabled: true, latency: 0, lastCheck: 0, failures: 0 },
];

// 最大连续失败次数，超过则禁用该节点
export const MAX_FAILURES = 5;

// 测速超时（ms）
export const SPEED_TEST_TIMEOUT = 5000;

// 重新测速间隔（ms）— 30 分钟
export const RECHECK_INTERVAL = 30 * 60 * 1000;
