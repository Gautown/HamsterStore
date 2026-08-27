// SyncFacade — 统一同步入口
// 简化版：直接用 GitHubCrawler + ListParser + CategoryEngine
// 不依赖 async RepoSyncEngine，避免 perry async 问题

import { GitHubCrawler } from "../crawler/GitHubCrawler";
import { GitHubSearchEngine } from "../discovery/GitHubSearchEngine";
import { ListParser, type ParsedEntry } from "../parser/ListParser";
import { inferCategories } from "../categorization/CategoryEngine";
import { PackageRepository, SourceRepository } from "../../data";
import type { Source } from "../../data/models/Source";

interface RepoData {
    name: string;
    description: string;
    stargazers_count: number;
    language: string;
    topics: string[];
    html_url: string;
    homepage: string;
    license: string;
    version: string;
}

export class SyncFacade {
    private crawler: GitHubCrawler;
    private searchEngine: GitHubSearchEngine;
    private listParser: ListParser;
    private useCrawler: boolean;

    constructor(token: string = "") {
        this.crawler = new GitHubCrawler();
        this.searchEngine = new GitHubSearchEngine(token);
        this.listParser = new ListParser();
        this.useCrawler = !token;
    }

    // 主同步入口
    syncAll(): number {
        const sources = SourceRepository.getAll();
        let ok = 0;

        for (let i = 0; i < sources.length; i++) {
            const s = sources[i];
            console.log("[" + (i + 1) + "/" + sources.length + "] " + s.owner + "/" + s.repo);

            // 步骤1：保存种子仓库自身
            ok += this.saveSeedMeta(s);

            // 步骤2：解析 README 提取二级软件
            ok += this.parseReadme(s);
        }

        // 步骤3：GitHub 公开搜索补充
        ok += this.syncFromDiscovery();

        return ok;
    }

    // 仅 GitHub 搜索
    syncFromDiscovery(): number {
        let ok = 0;

        try {
            console.log("  [搜索] 发现 Windows 应用...");
            const winApps = this.searchEngine.discoverWindowsSoftware(1);
            for (const item of winApps) {
                if (this.savePackageFromSearch(item)) ok++;
            }
        } catch {}

        const categories = ["dev-tools", "office", "media", "utility"];
        for (const cat of categories) {
            try {
                console.log("  [搜索] 分类 " + cat + "...");
                const results = this.searchEngine.searchByCategory(cat, 1, 20);
                for (const item of results) {
                    if (this.savePackageFromSearch(item)) ok++;
                }
            } catch {}
        }

        return ok;
    }

    // 保存种子仓库自身 meta（网络失败也保存基本信息）
    private saveSeedMeta(s: Source): number {
        const html = this.crawler.fetchPage("https://github.com/" + s.owner + "/" + s.repo);
        const data = this.parseHtml(html, s.owner, s.repo);

        if (data) {
            return this.savePackage(data, s.id, this.useCrawler ? "crawler" : "seed-api") ? 1 : 0;
        }

        // fallback
        const fallback: RepoData = {
            name: s.owner + "/" + s.repo,
            description: "",
            stargazers_count: 0,
            language: "",
            topics: [],
            html_url: "https://github.com/" + s.owner + "/" + s.repo,
            homepage: "",
            license: "",
            version: "",
        };
        return this.savePackage(fallback, s.id, "seed-fallback") ? 1 : 0;
    }

    // 解析 README 提取软件列表
    private parseReadme(s: Source): number {
        const readme = this.crawler.fetchReadme(s.owner, s.repo);
        if (!readme || readme.length < 100) return 0;

        const cfg = s.parser_config || "generic";
        console.log("  解析: " + cfg);
        const entries: ParsedEntry[] = this.listParser.parse(readme, cfg);
        console.log("  parsed: " + entries.length + " entries");

        let ok = 0;
        for (const entry of entries.slice(0, 100)) {
            if (!entry.project_url) continue;
            const data: RepoData = {
                name: entry.name,
                description: entry.description,
                stargazers_count: 0,
                language: "",
                topics: [entry.category],
                html_url: entry.project_url,
                homepage: entry.project_url,
                license: entry.license || "",
                version: "",
            };
            if (this.savePackage(data, s.id, "parsed-" + cfg)) ok++;
        }
        return ok;
    }

    // HTML 解析提取 meta
    private parseHtml(html: string, owner: string, repo: string): RepoData | null {
        if (!html || html.length < 100) return null;
        let desc = "", stars = 0, lang = "", homepage = "";
        const topics: string[] = [];

        const dm = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
        if (dm) desc = dm[1].trim();

        const sm = html.match(/aria-label="([\d,]+)\s*users?\s*starred/i);
        if (sm) stars = parseInt(sm[1].replace(/,/g, "")) || 0;

        const hm = html.match(/itemprop="url"\s*href="([^"]+)"/);
        if (hm) homepage = hm[1];

        return {
            name: owner + "/" + repo,
            description: desc,
            stargazers_count: stars,
            language: lang,
            topics,
            html_url: "https://github.com/" + owner + "/" + repo,
            homepage,
            license: "",
            version: "",
        };
    }

    // 保存软件包（带去重）
    private savePackage(data: RepoData, sourceId: number, source: string): boolean {
        const hash = this.computeHash(data.html_url);

        // 去重
        const all = PackageRepository.getAll();
        if (all.find(p => p.url_hash === hash)) return false;

        const cats = inferCategories(data.name, data.description, data.topics, data.language);

        try {
            PackageRepository.create({
                source_id: sourceId,
                name: data.name,
                version: data.version,
                description: data.description,
                categories: JSON.stringify(cats),
                platform_assets: "[]",
                project_url: data.html_url,
                url_hash: hash,
                download_url: data.homepage || data.html_url,
                data_source: source,
            });
            return true;
        } catch { return false; }
    }

    // 保存搜索结果
    savePackageFromSearchPublic(item: any): boolean {
        return this.savePackageFromSearch(item);
    }

    private savePackageFromSearch(item: any): boolean {
        if (!item || !item.full_name) return false;
        const hash = this.computeHash("https://github.com/" + item.full_name);

        const all = PackageRepository.getAll();
        if (all.find(p => p.url_hash === hash)) return false;

        const repoName = item.full_name.split("/").pop() || item.full_name;
        const cats = inferCategories(repoName, item.description || "", item.topics || [], item.language || "");

        try {
            PackageRepository.create({
                source_id: 0,
                name: item.full_name,
                version: item.latest_release?.tag_name || "",
                description: item.description || "",
                categories: JSON.stringify(cats),
                platform_assets: "[]",
                project_url: item.html_url,
                url_hash: hash,
                download_url: item.homepage || "",
                data_source: "search-api",
            });
            return true;
        } catch { return false; }
    }

    // 纯 JS hash（perry node:crypto 是 stub）
    private computeHash(url: string): string {
        let h = 0;
        const s = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
        for (let i = 0; i < s.length; i++) {
            const ch = s.charCodeAt(i);
            h = ((h << 5) - h) + ch;
            h = h & h;
        }
        return Math.abs(h).toString(16);
    }
}

// 兼容别名
export { SyncFacade as SourceSyncer };