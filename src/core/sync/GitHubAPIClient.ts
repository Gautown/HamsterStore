// GitHubAPIClient v3 — GitHub REST API v3 客户端（netFetch 回调式）
// v3 变更（Perry 0.5.1665 适配，上游 #14982）：
//   class → 对象字面量工厂。class 方法的 $pshape 克隆在 Windows COFF 上产生
//   .def/.scl/.endef alias 符号记录，落在 .llvm_stackmaps 之后，compact-map
//   rewriter 不识别 → 整模块拒绝编译（GC roots 会静默丢失，perry 拒绝产出）。
//   对象字面量方法不触发该路径（与 DownloadManager/repositories 同款风格，
//   最小复现验证：class 版必挂、工厂版通过）。API 面保持不变：
//     new GitHubAPIClient(token)  →  createGitHubAPIClient(token)
//     GitHubAPIClient.urlHash / normalizeUrl / parseOwnerRepo 静态助手保留。
// v2 基础：execSync 全部弃用（真实二进制实测：引号/& 参数必挂），
// 统一走 netFetch.netGetJson（spawn 数组 + 文件轮询），加速经 ProxyManager。

import type { Asset, Release } from "../../types";
import { ProxyManager } from "../proxy/ProxyManager";
import { netGetJson, netGetText } from "../net/netFetch";
import type { NetOptions } from "../net/netFetch";

export interface RepoInfo {
    name: string;
    full_name: string;
    owner: string;
    description: string;
    stargazers_count: number;
    forks_count: number;
    language: string;
    topics: string[];
    html_url: string;
    homepage: string;
    license: { name: string; spdx_id: string } | null;
    default_branch: string;
    latest_release: Release | null;
}

const UA = "HamsterStore/1.0.0";

export function createGitHubAPIClient(token?: string) {
    let _token = token || process.env.GITHUB_TOKEN || "";
    const apiBase = "https://api.github.com";

    function headers(): Record<string, string> {
        const h: Record<string, string> = {
            "User-Agent": UA,
            "Accept": "application/vnd.github+json",
        };
        if (_token) h["Authorization"] = "Bearer " + _token;
        return h;
    }

    function opts(timeoutMs?: number): NetOptions {
        return { headers: headers(), timeoutMs };
    }

    // 经 ProxyManager 加速
    function accelerated(url: string): string {
        return ProxyManager.getInstance().accelerateUrl(url);
    }

    function normalizeRepoInfo(data: any): RepoInfo {
        return {
            name: data.name || "",
            full_name: data.full_name || "",
            owner: data.owner ? data.owner.login : (data.full_name || "").split("/")[0] || "",
            description: data.description || "",
            stargazers_count: data.stargazers_count || 0,
            forks_count: data.forks_count || 0,
            language: data.language || "",
            topics: data.topics || [],
            html_url: data.html_url || "",
            homepage: data.homepage || "",
            license: data.license ? { name: data.license.name, spdx_id: data.license.spdx_id } : null,
            default_branch: data.default_branch || "main",
            latest_release: null,
        };
    }

    function normalizeRelease(data: any): Release {
        return {
            tag_name: data.tag_name || "",
            name: data.name || "",
            body: data.body || "",
            published_at: data.published_at || "",
            assets: (data.assets || []).map((a: any): Asset => ({
                name: a.name || "",
                size: a.size || 0,
                url: a.url || "",
                browser_download_url: a.browser_download_url || "",
            })),
        };
    }

    return {
        setToken(t: string): void { _token = t; },
        hasToken(): boolean { return _token.length > 0; },

        // 仓库信息
        getRepoInfo(owner: string, repo: string, onDone: (info: RepoInfo | null) => void): void {
            const url = accelerated(`${apiBase}/repos/${owner}/${repo}`);
            netGetJson(url, opts(), (data) => {
                if (!data || !data.full_name) { onDone(null); return; }
                onDone(normalizeRepoInfo(data));
            });
        },

        // 最新 Release
        getLatestRelease(owner: string, repo: string, onDone: (rel: Release | null) => void): void {
            const url = accelerated(`${apiBase}/repos/${owner}/${repo}/releases/latest`);
            netGetJson(url, opts(), (data) => {
                if (!data || data.message) { onDone(null); return; }
                onDone(normalizeRelease(data));
            });
        },

        // 所有 Releases
        getReleases(owner: string, repo: string, perPage: number, onDone: (rels: Release[]) => void): void {
            const url = accelerated(`${apiBase}/repos/${owner}/${repo}/releases?per_page=${perPage}`);
            netGetJson(url, opts(), (data) => {
                if (!Array.isArray(data)) { onDone([]); return; }
                onDone(data.map((rel: any) => normalizeRelease(rel)).filter(Boolean));
            });
        },

        // README（raw 文本）
        getReadme(owner: string, repo: string, onDone: (text: string) => void): void {
            // raw 直取（fast 秒级）
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`;
            const accel = ProxyManager.getInstance().accelerateUrl(rawUrl);
            netGetText(accel, opts(20000), (ok, body) => {
                if (ok && body) { onDone(body); return; }
                // 回退：API readme 接口（base64）
                const apiUrl = accelerated(`${apiBase}/repos/${owner}/${repo}/readme`);
                netGetJson(apiUrl, opts(20000), (data) => {
                    if (data && data.content) {
                        try {
                            onDone(Buffer.from(data.content, "base64").toString("utf8"));
                            return;
                        } catch {}
                    }
                    onDone("");
                });
            });
        },

        // 搜索仓库
        searchRepositories(query: string, perPage: number, onDone: (items: any[]) => void): void {
            const url = accelerated(`${apiBase}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`);
            netGetJson(url, opts(20000), (data) => {
                onDone(data && Array.isArray(data.items) ? data.items : []);
            });
        },

        // 速率限制
        checkRateLimit(onDone: (r: { remaining: number; limit: number } | null) => void): void {
            const url = accelerated(`${apiBase}/rate_limit`);
            netGetJson(url, opts(), (data) => {
                if (!data || !data.resources || !data.resources.core) { onDone(null); return; }
                onDone({ remaining: data.resources.core.remaining, limit: data.resources.core.limit });
            });
        },
    };
}

export type GitHubAPIClientInstance = ReturnType<typeof createGitHubAPIClient>;

// 静态助手（原 class static 方法，调用点不变）
export const GitHubAPIClient = {
    // 规范化 GitHub URL 为去重键
    normalizeUrl(url: string): string {
        let s = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const m = s.match(/github\.com\/([^\/]+)\/([^\/\)#?]+)/);
        if (m) return `github.com/${m[1]}/${m[2]}`.toLowerCase();
        return s.toLowerCase();
    },

    urlHash(url: string): string {
        let hash = 0;
        const s = GitHubAPIClient.normalizeUrl(url);
        for (let i = 0; i < s.length; i++) {
            const ch = s.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    },

    parseOwnerRepo(url: string): { owner: string; repo: string } | null {
        const m = url.match(/github\.com\/([^\/]+)\/([^\/\)#?]+)/);
        if (!m) return null;
        return { owner: m[1], repo: m[2] };
    },
};
