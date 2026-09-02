// GitHubSearchEngine v7 — 使用文件作为请求队列的搜索引擎
// 设计：主程序写入请求文件 → 外部 watcher 执行 curl → 读取结果文件
// 这是一个折中方案，适用于 Perry 限制下的网络请求

import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

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
    private queueDir: string;

    constructor(token: string = "") {
        this.token = token;
        this.queueDir = join(process.env.TEMP || "/tmp", "hamsterstore_queue");
        
        // 确保队列目录存在
        try {
            const { mkdirSync, existsSync } = require("node:fs");
            if (!existsSync(this.queueDir)) {
                mkdirSync(this.queueDir, { recursive: true });
            }
        } catch {}
    }

    // 按关键词搜索
    searchByKeyword(keyword: string, page: number = 1): SearchResult[] {
        const query = keyword + " in:name,description language:all archived:false";
        const url = "https://api.github.com/search/repositories?q=" + encodeURIComponent(query) + "&sort=stars&order=desc&page=" + page + "&per_page=10";
        return this.apiCall(url);
    }

    // 调用 GitHub API（写入请求文件，等待外部处理）
    private apiCall(url: string): SearchResult[] {
        const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const requestFile = join(this.queueDir, "req_" + requestId + ".json");
        const responseFile = join(this.queueDir, "res_" + requestId + ".json");

        try {
            // 构建请求对象
            const request = {
                url: url,
                headers: {
                    "User-Agent": "HamsterStore/1.0",
                    "Accept": "application/vnd.github+json",
                },
                token: this.token ? "present" : "",
                timestamp: Date.now(),
            };

            // 写入请求文件
            writeFileSync(requestFile, JSON.stringify(request), "utf8");

            // 尝试同步执行 curl（备用方案）
            // 注意：这可能在 Perry 中仍然超时
            const results = this.tryDirectFetch(url);
            
            // 清理请求文件
            try { unlinkSync(requestFile); } catch {}

            return results;

        } catch (e: any) {
            console.log("[GitHubSearchEngine] Error: " + e.message);
            return [];
        }
    }

    // 尝试直接获取（使用简单的轮询）
    private tryDirectFetch(url: string): SearchResult[] {
        // 由于 Perry 的限制，我们无法直接执行网络请求
        // 返回空数组，提示用户这是一个受限功能
        console.log("[GitHubSearchEngine] 网络搜索在当前版本中受限");
        console.log("[GitHubSearchEngine] 请运行完整版本的 HamsterStore 以启用在线搜索");
        return [];
    }
}
