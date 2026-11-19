// GitHubSearchEngine — 使用 spawn 替代 execSync（实验性）
// 注意：Perry v0.5.1220 中 spawn 网络请求可能不稳定
// 此模块作为实验性功能保留，待 Perry 升级后启用

import { spawn } from "node:child_process";
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
    private userAgent = "HamsterStore/1.0";

    constructor(token: string = "") {
        this.token = token;
    }

    // 按关键词搜索
    searchByKeyword(keyword: string, page: number = 1): SearchResult[] {
        const query = `${keyword} in:name,description language:all archived:false`;
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&page=${page}&per_page=10`;
        return this.apiCall(url);
    }

    // 调用 GitHub API（使用 spawn curl）
    private apiCall(url: string): SearchResult[] {
        try {
            const args = [
                "-sS", "-L", "--ssl-no-revoke",
                "--max-time", "10",
                "-H", "User-Agent: HamsterStore/1.0",
                "-H", "Accept: application/vnd.github+json",
            ];
            
            if (this.token) {
                args.push("-H", "Authorization: Bearer " + this.token.substring(0, 10) + "...");
            }
            
            args.push(url);
            
            // 使用 spawn 执行 curl
            const proc = spawn("curl", args, {
                stdio: ["ignore", "pipe", "pipe"],
            });
            
            let stdout = "";
            let stderr = "";
            
            proc.stdout.on("data", (chunk: Buffer) => {
                stdout += chunk.toString("utf8");
            });
            
            proc.stderr.on("data", (chunk: Buffer) => {
                stderr += chunk.toString("utf8");
            });
            
            // 由于 Perry 不支持 async/await，我们只能尝试同步等待
            // 但这在实践中不可靠，返回空数组
            console.log("[GitHubSearchEngine] spawn curl 在 Perry 中不可靠，返回空结果");
            return [];
            
        } catch (e: any) {
            console.log("[GitHubSearchEngine] Error:", e.message);
            return [];
        }
    }
}
