// GitHubSearchEngine v8 — 真实网络搜索（netFetch 回调式）
// v8 变更：移除"受限版"文件队列桩（从未工作过），改用 GitHubAPIClient.searchRepositories，
// 经 ProxyManager 加速（gh-proxy.org 实测可前缀代理 api.github.com）。

import { GitHubAPIClient } from "../sync/GitHubAPIClient";

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
    private client: GitHubAPIClient;

    constructor(token: string = "") {
        this.client = new GitHubAPIClient(token);
    }

    // 按关键词搜索（回调式）
    searchByKeyword(keyword: string, perPage: number, onDone: (results: SearchResult[]) => void): void {
        this.client.searchRepositories(keyword, perPage, (items) => {
            const results: SearchResult[] = [];
            for (const it of items) {
                results.push({
                    full_name: it.full_name || "",
                    description: it.description || "",
                    stargazers_count: it.stargazers_count || 0,
                    language: it.language || "",
                    topics: it.topics || [],
                    html_url: it.html_url || "",
                    homepage: it.homepage || "",
                    license: it.license ? (it.license.spdx_id || it.license.name || "") : "",
                    pushed_at: it.pushed_at || "",
                });
            }
            onDone(results);
        });
    }
}
