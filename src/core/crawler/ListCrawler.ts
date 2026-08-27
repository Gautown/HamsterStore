// ListCrawler — Awesome-list / Markdown 仓库列表解析器
// 从 Markdown README 中提取 GitHub 仓库链接，作为种子仓库的二级索引

import { GitHubCrawler } from "./GitHubCrawler";
import type { Source } from "../../data/models/Source";

export interface ExtractedRepo {
    owner: string;
    repo: string;
    url: string;
    name: string;
    description: string;
    category: string;
}

export class ListCrawler {
    private crawler: GitHubCrawler;

    constructor() {
        this.crawler = new GitHubCrawler();
    }

    // 从种子仓库的 README 中提取所有 GitHub 链接
    extractRepos(source: Source): ExtractedRepo[] {
        const readme = this.crawler.fetchReadme(source.owner, source.repo);
        if (!readme || readme.length < 100) return [];

        const repos: ExtractedRepo[] = [];
        const seen = new Set<string>();
        const lines = readme.split("\n");
        let currentCategory = "";

        for (const line of lines) {
            const headingMatch = line.match(/^#{2,3}\s+(.+)$/);
            if (headingMatch) {
                currentCategory = headingMatch[1].trim();
                continue;
            }

            // 提取 [text](https://github.com/owner/repo) 链接
            const linkMatches = line.matchAll(/\[([^\]]*)\]\(https:\/\/github\.com\/([^\/\s]+)\/([^\/\s)#?]+)[^)]*\)/g);
            for (const m of linkMatches) {
                const name = m[1];
                const owner = m[2];
                const repo = m[3];

                if (!owner || !repo) continue;
                const url = "https://github.com/" + owner + "/" + repo;

                const FILTER = ["topics", "features", "about", "signup", "login", "pricing", "marketplace",
                    "settings", "notifications", "explore", "new", "import", "organizations"];
                if (FILTER.includes(repo.toLowerCase())) continue;
                if (seen.has(url)) continue;
                seen.add(url);

                const descMatch = line.match(/\)\s*[—\-–·•]\s*(.+)$/);
                const description = descMatch ? descMatch[1].trim() : "";

                repos.push({ owner, repo, url, name, description, category: currentCategory });
            }
        }
        return repos;
    }
}