// GitHubCrawler — 爬虫引擎
// API 限流时降级使用：从 GitHub 镜像站获取页面 HTML，解析提取信息

import { execSync } from "node:child_process";
import { ProxyPool } from "./ProxyPool";
import { RateLimiter } from "./RateLimiter";
import { HTMLParser } from "./HTMLParser";
import type { Release } from "../../types";

export class GitHubCrawler {
    private proxyPool: ProxyPool;
    private rateLimiter: RateLimiter;
    private htmlParser: HTMLParser;
    private readonly userAgent = "HamsterStore/1.0.0";

    constructor() {
        this.proxyPool = new ProxyPool();
        this.rateLimiter = new RateLimiter(3000);  // 3 秒间隔
        this.htmlParser = new HTMLParser();
    }

    // 获取最新 Release（爬虫方式）
    fetchLatestRelease(owner: string, repo: string): Release | null {
        const url = `https://github.com/${owner}/${repo}/releases/latest`;
        const html = this.fetchPage(url);
        if (!html) return null;
        return this.htmlParser.parseReleasePage(html, owner, repo);
    }

    // 获取仓库主页（含 README 内容）
    fetchReadme(owner: string, repo: string, branch: string = "main"): string {
        // 优先 raw.githubusercontent.com
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
        const raw = this.fetchPage(rawUrl);
        if (raw && raw.length > 100) return raw;
        // 回退：尝试 master 分支
        if (branch !== "master") {
            const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`;
            const masterRaw = this.fetchPage(masterUrl);
            if (masterRaw && masterRaw.length > 100) return masterRaw;
        }
        // 最差回退：从仓库页面 HTML 提取 README
        const pageUrl = `https://github.com/${owner}/${repo}`;
        const html = this.fetchPage(pageUrl);
        if (!html) return "";
        const m = html.match(/class="[^"]*markdown-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
    }

    // 从 GitHub 页面提取仓库列表（用于 awesome-list 或 trending）
    fetchGithubReposFromPage(url: string): { owner: string; repo: string; url: string; name: string }[] {
        const html = this.fetchPage(url);
        if (!html) return [];
        return this.htmlParser.extractGithubRepos(html);
    }

    // 通用页面抓取（带速率限制 + 代理池）
    fetchPage(url: string): string {
        this.rateLimiter.waitSync();

        // 先用原始 URL
        let html = this.curlPage(url);
        if (html && html.length > 100) return html;

        // 失败：使用镜像
        const mirroredUrl = this.proxyPool.mirrorUrl(url);
        if (mirroredUrl !== url) {
            html = this.curlPage(mirroredUrl);
            if (html && html.length > 100) return html;
        }

        return "";
    }

    private curlPage(url: string): string {
        // URL 用单引号包裹，shell 不会解释特殊字符
        // --connect-timeout 5 + --max-time 10 → 最差 10s 返回
        const cmd = `curl -sS -L --ssl-no-revoke --connect-timeout 5 --max-time 10 -H "User-Agent: ${this.userAgent}" -H "Accept: text/html,application/json,*/*" '${url}'`;
        try {
            const stdout = execSync(cmd, {
                maxBuffer: 10 * 1024 * 1024,
                timeout: 12000,
                stdio: ["pipe", "pipe", "pipe"],
            }) as unknown as Buffer;
            return stdout.toString("utf8");
        } catch {
            return "";
        }
    }

    // 速率 setter
    setRateInterval(ms: number): void {
        this.rateLimiter.setInterval(ms);
    }

    // 代理池重置
    resetProxy(): void {
        this.proxyPool.reset();
    }

    // 速率统计
    getRateStats(): { pendingCount: number; interval: number } {
        const s = this.rateLimiter.getStats();
        return { pendingCount: s.pendingCount, interval: s.minInterval };
    }
}