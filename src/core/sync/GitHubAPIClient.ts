// GitHubAPIClient — GitHub REST API v3 客户端
// API 优先策略：带 Token 的 API 调用，限流时由同步引擎降级到爬虫
// 注意：perry fetch 是 stub，必须用 execSync("curl") 实现 HTTP 客户端

import { execSync } from "node:child_process";
import type { Asset, Release } from "../../types";
import { ProxyManager } from "../proxy/ProxyManager";

// GitHub API 仓库信息
export interface RepoInfo {
    name: string;
    full_name: string;       // owner/repo
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

export class GitHubAPIClient {
    private token: string;
    private readonly apiBase = "https://api.github.com";
    private readonly userAgent = "HamsterStore/1.0.0";

    constructor(token?: string) {
        this.token = token || process.env.GITHUB_TOKEN || "";
    }

    setToken(token: string): void {
        this.token = token;
    }

    hasToken(): boolean {
        return this.token.length > 0;
    }

    // curl 获取 JSON（处理 cmd.exe 转义陷阱）
    private curlJson(url: string): { ok: boolean; data: any; status: number; bytes: number } {
        // 加速：有代理配置时走加速
        const proxy = ProxyManager.getInstance();
        const accelUrl = proxy.accelerateUrl(url);
        // cmd.exe 转义：& → ^&
        const safeUrl = accelUrl.replace(/&/g, "^&").replace(/\*/g, "^*");
        const headerArgs: string[] = [
            "-H", `"User-Agent: ${this.userAgent}"`,
            "-H", '"Accept: application/vnd.github+json"',
        ];
        if (this.token) {
            headerArgs.push("-H", `"Authorization: Bearer ${this.token}"`);
        }
        const cmd = `curl -sS -w "\\n%{http_code}" --max-time 15 ${headerArgs.join(" ")} ${safeUrl}`;
        try {
            const stdout = execSync(cmd, {
                maxBuffer: 10 * 1024 * 1024,
                timeout: 20000,
                stdio: ["pipe", "pipe", "pipe"],
            }) as unknown as Buffer;
            const text = stdout.toString("utf8").trim();
            // 分离 JSON body 和 status code（最后一个换行后是状态码）
            const lastNl = text.lastIndexOf("\n");
            if (lastNl < 0) {
                return { ok: false, data: null, status: 0, bytes: text.length };
            }
            const statusStr = text.substring(lastNl + 1).trim();
            const body = text.substring(0, lastNl);
            const status = parseInt(statusStr, 10) || 0;
            const bytes = body.length;
            if (status >= 200 && status < 300) {
                try {
                    return { ok: true, data: JSON.parse(body), status, bytes };
                } catch {
                    return { ok: false, data: null, status, bytes };
                }
            }
            return { ok: false, data: null, status, bytes };
        } catch {
            return { ok: false, data: null, status: 0, bytes: 0 };
        }
    }

    // 获取仓库信息
    getRepoInfo(owner: string, repo: string): RepoInfo | null {
        const url = `${this.apiBase}/repos/${owner}/${repo}`;
        const r = this.curlJson(url);
        if (!r.ok || !r.data) return null;
        // rate limit 检查（响应 < 300 bytes 且无 full_name = rate limit JSON）
        if (r.bytes < 300 && !r.data.full_name) {
            console.log(`[GitHubAPI] Rate limit response (${r.bytes} bytes) for ${owner}/${repo}`);
            return null;
        }
        return this.normalizeRepoInfo(r.data);
    }

    // 获取最新 Release
    getLatestRelease(owner: string, repo: string): Release | null {
        const url = `${this.apiBase}/repos/${owner}/${repo}/releases/latest`;
        const r = this.curlJson(url);
        if (!r.ok || !r.data) return null;
        if (r.data.message && r.data.message.includes("Not Found")) return null;
        return this.normalizeRelease(r.data);
    }

    // 获取所有 Releases（分页）
    getReleases(owner: string, repo: string, perPage: number = 30): Release[] {
        const url = `${this.apiBase}/repos/${owner}/${repo}/releases?per_page=${perPage}&sort=published_at`;
        const r = this.curlJson(url);
        if (!r.ok || !Array.isArray(r.data)) return [];
        return r.data.map((rel: any) => this.normalizeRelease(rel)).filter(Boolean);
    }

    // 获取 README 内容（raw 文本）
    getReadme(owner: string, repo: string, branch?: string): string {
        const ref = branch || "main";
        const url = `${this.apiBase}/repos/${owner}/${repo}/readme?ref=${ref}`;
        const r = this.curlJson(url);
        if (!r.ok || !r.data || !r.data.download_url) return "";
        // download_url 指向 raw.githubusercontent.com
        return this.curlRaw(r.data.download_url);
    }

    // 直接获取 raw 文本
    private curlRaw(url: string): string {
        // cmd.exe 转义
        const safeUrl = url.replace(/&/g, "^&").replace(/\*/g, "^*");
        const cmd = `curl -sS --max-time 15 -H "User-Agent: ${this.userAgent}" ${safeUrl}`;
        try {
            const stdout = execSync(cmd, {
                maxBuffer: 10 * 1024 * 1024,
                timeout: 20000,
                stdio: ["pipe", "pipe", "pipe"],
            }) as unknown as Buffer;
            return stdout.toString("utf8");
        } catch {
            return "";
        }
    }

    // 标准化 RepoInfo
    private normalizeRepoInfo(data: any): RepoInfo {
        return {
            name: data.name || "",
            full_name: data.full_name || "",
            owner: data.owner?.login || (data.full_name || "").split("/")[0] || "",
            description: data.description || "",
            stargazers_count: data.stargazers_count || 0,
            forks_count: data.forks_count || 0,
            language: data.language || "",
            topics: data.topics || [],
            html_url: data.html_url || "",
            homepage: data.homepage || "",
            license: data.license ? { name: data.license.name, spdx_id: data.license.spdx_id } : null,
            default_branch: data.default_branch || "main",
            latest_release: null,  // 单独调用 getLatestRelease 获取
        };
    }

    // 标准化 Release
    private normalizeRelease(data: any): Release {
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

    // 检查 API 速率限制（是否被限流）
    checkRateLimit(): { remaining: number; reset_at: string; limit: number } | null {
        const url = `${this.apiBase}/rate_limit`;
        const r = this.curlJson(url);
        if (!r.ok || !r.data?.resources?.core) return null;
        return {
            remaining: r.data.resources.core.remaining,
            reset_at: r.data.resources.core.reset || "",
            limit: r.data.resources.core.limit,
        };
    }

    // 规范化 GitHub URL 为去重键
    // 输入 https://github.com/owner/repo 或 https://github.com/owner/repo/anything → github.com/owner/repo
    static normalizeUrl(url: string): string {
        let s = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
        // 提取 github.com/owner/repo
        const m = s.match(/github\.com\/([^\/]+)\/([^\/\)#?]+)/);
        if (m) {
            return `github.com/${m[1]}/${m[2]}`.toLowerCase();
        }
        return s.toLowerCase();
    }

    // 计算 URL 哈希（用于精确去重）— node:crypto 在 perry 中是 stub
    static urlHash(url: string): string {
        // Simple string hash fallback
        let hash = 0;
        const s = GitHubAPIClient.normalizeUrl(url);
        for (let i = 0; i < s.length; i++) {
            const ch = s.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    // 从 URL 提取 owner/repo
    static parseOwnerRepo(url: string): { owner: string; repo: string } | null {
        const m = url.match(/github\.com\/([^\/]+)\/([^\/\)#?]+)/);
        if (!m) return null;
        return { owner: m[1], repo: m[2] };
    }
}