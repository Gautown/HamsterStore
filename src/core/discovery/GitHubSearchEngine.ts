// GitHubSearchEngine v9 — 真实网络搜索（netFetch 回调式）
// v9 变更（Perry 0.5.1665 适配，上游 #14982）：class → 对象字面量工厂，
// 避开 class 方法 $pshape COFF alias 触发的 compact-map rewriter 拒绝。
// 调用点：new GitHubSearchEngine(token) → createGitHubSearchEngine(token)。
// v8 基础：移除"受限版"文件队列桩（从未工作过），改用 GitHubAPIClient.searchRepositories，
// 经 ProxyManager 加速（gh-proxy.org 实测可前缀代理 api.github.com）。

import { createGitHubAPIClient } from "../sync/GitHubAPIClient";

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

export function createGitHubSearchEngine(token: string = "") {
    const client = createGitHubAPIClient(token);
    return {
        // 按关键词搜索（回调式）
        searchByKeyword(keyword: string, perPage: number, onDone: (results: SearchResult[]) => void): void {
            client.searchRepositories(keyword, perPage, (items) => {
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
        },
    };
}
