// GitHubSearchEngine — GitHub 公开仓库搜索引擎
// 种子仓库只是入口之一，所有 GitHub 公开软件皆可被扫描收录
// 使用 GitHub Search API 直接查询，按类别分批获取

import { execSync } from "node:child_process";
import { ProxyManager } from "../proxy/ProxyManager";

export interface SearchResult {
    full_name: string;
    description: string;
    stargazers_count: number;
    language: string;
    topics: string[];
    html_url: string;
    homepage: string;
    license: string;
    pushed_at: string;
}

export class GitHubSearchEngine {
    private token: string;
    private userAgent = "HamsterStore/1.0";

    constructor(token: string) {
        this.token = token;
    }

    // 按分类关键词搜索 GitHub 仓库
    searchByCategory(category: string, page: number = 1, perPage: number = 30): SearchResult[] {
        // 构建搜索 query
        const query = this.buildQuery(category);
        const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&page=${page}&per_page=${perPage}`;
        return this.apiCall(url);
    }

    // 按关键词搜索
    searchByKeyword(keyword: string, page: number = 1): SearchResult[] {
        const query = `${keyword} in:name,description language:all archived:false`;
        const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&page=${page}&per_page=30`;
        return this.apiCall(url);
    }

    // 发现 Windows 相关项目
    discoverWindowsSoftware(page: number = 1): SearchResult[] {
        const topics = ["windows-app", "windows-desktop", "win32", "wpf", "uwp", "windows"];
        const query = topics.map(t => `topic:${t}`).join("+");
        const url = `https://api.github.com/search/repositories?q=${query}+archived:false&sort=stars&order=desc&page=${page}&per_page=30`;
        return this.apiCall(url);
    }

    // 发现近期热门项目（按语言过滤）
    discoverTrending(language: string = "", page: number = 1): SearchResult[] {
        let query = "pushed:>2024-01-01 archived:false stars:>=10";
        if (language) query = `${query} language:${language}`;
        const url = `https://api.github.com/search/repositories?q=${query}&sort=updated&order=desc&page=${page}&per_page=30`;
        return this.apiCall(url);
    }

    // 构建分类查询
    private buildQuery(category: string): string {
        const topicMappings: Record<string, string> = {
            "dev-tools":     "topic:dev-tool+topic:ide+topic:compiler+topic:cli-tool+topic:sdk+topic:framework",
            "dev-ops":       "topic:docker+topic:kubernetes+topic:devops+topic:ci-cd+topic:terraform",
            "system-tools":  "topic:system+topic:monitor+topic:file-manager+topic:backup+topic:cleaner",
            "network":       "topic:network+topic:vpn+topic:proxy+topic:dns+topic:http",
            "security":      "topic:security+topic:password-manager+topic:encrypt+topic:privacy+topic:firewall",
            "media":         "topic:video+topic:audio+topic:image+topic:music+topic:ffmpeg+topic:player",
            "office":        "topic:office+topic:document+topic:note+topic:todo+topic:calendar+topic:pdf",
            "communication": "topic:chat+topic:messenger+topic:mail+topic:im+topic:telegram+topic:slack",
            "browser":       "topic:browser+topic:extension+topic:chromium",
            "design":        "topic:design+topic:ui+topic:svg+topic:color+topic:typography",
            "database":      "topic:database+topic:sql+topic:postgres+topic:redis+topic:etl",
            "education":     "topic:education+topic:learning+topic:wiki+topic:book",
            "game":          "topic:game+topic:emulator+topic:chess",
            "utility":       "topic:utility+topic:calculator+topic:converter+topic:clipboard+topic:calendar",
            "ai":            "topic:llm+topic:machine-learning+topic:deep-learning+topic:chatbot+topic:gpt",
        };
        const catQuery = topicMappings[category] || `topic:${category}`;
        return `${catQuery}+archived:false+stars:>=5`;
    }

    // 调用 GitHub API
    private apiCall(url: string): SearchResult[] {
        try {
            const proxy = ProxyManager.getInstance();
            const accelUrl = proxy.accelerateUrl(url);
            const safeUrl = accelUrl.replace(/&/g, "^&").replace(/[*]/g, "^*");
            const headerArgs = "-H User-Agent:Hamster/1.0 -H Accept:application/vnd.github+json";
            if (this.token) {
                const tokenArg = `-H Authorization:token ${this.token}`;
                return this.curlJson(tokenArg, safeUrl);
            }
            return this.curlJson(headerArgs, safeUrl);
        } catch {
            return [];
        }
    }

    private curlJson(headerArgs: string, url: string): SearchResult[] {
        const cmd = `curl -sS -L --ssl-no-revoke --max-time 15 ${headerArgs} "${url}"`;
        try {
            const buf = execSync(cmd, {
                maxBuffer: 10 * 1024 * 1024,
                timeout: 20000,
                stdio: ["pipe", "pipe", "pipe"],
            }) as unknown as Buffer;
            const text = buf.toString("utf8");
            if (!text) return [];
            const data = JSON.parse(text);
            if (data.items) {
                return data.items.map((item: any) => ({
                    full_name: item.full_name,
                    description: item.description || "",
                    stargazers_count: item.stargazers_count || 0,
                    language: item.language || "",
                    topics: item.topics || [],
                    html_url: item.html_url,
                    homepage: item.homepage || "",
                    license: item.license?.spdx_id || "",
                    pushed_at: item.pushed_at || "",
                }));
            }
            return [];
        } catch {
            return [];
        }
    }
}