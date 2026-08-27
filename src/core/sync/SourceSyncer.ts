// SourceSyncer — 统一种子仓库同步器
// 两步走：
//   1) 种子仓库：遍历列表提取 GitHub 链接
//   2) GitHub 搜索：按分类进行主题探索，补充种子仓库未覆盖的软件
// 所有入库软件经过 CategoryEngine 统一分类

import { SourceRepository, PackageRepository } from "../../data";
import type { Source } from "../../data/models/Source";
import { GitHubAPIClient } from "../sync/GitHubAPIClient";
import { GitHubCrawler } from "../crawler/GitHubCrawler";
import { GitHubSearchEngine } from "../discovery/GitHubSearchEngine";
import { inferCategories } from "../categorization/CategoryEngine";
import { ListCrawler } from "../crawler/ListCrawler";
import { ListParser, type ParsedEntry } from "../parser/ListParser";
import { BUILT_IN_PACKAGES, type BuiltInPackage } from "./BuiltInData";
import { DedupEngine } from "../dedup/DedupEngine";

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

export class SourceSyncer {
    private api: GitHubAPIClient;
    private crawler: GitHubCrawler;
    private search: GitHubSearchEngine;
    private listCrawler: ListCrawler;
    private listParser: ListParser;
    private dedup: DedupEngine;
    private useCrawler: boolean;

    constructor(token: string) {
        this.api = new GitHubAPIClient(token);
        this.crawler = new GitHubCrawler();
        this.search = new GitHubSearchEngine(token);
        this.listCrawler = new ListCrawler();
        this.listParser = new ListParser();
        this.dedup = new DedupEngine();
        this.useCrawler = !token;
    }

    // 全量同步：种子库 + 公开搜索
    syncAll(): number {
        let ok = 0;

        // 阶段1：种子仓库
        console.log("=== 种子仓库扫描 ===");
        ok += this.syncSeeds();

        // 阶段2：GitHub 搜索补充（常用分类）
        console.log("=== GitHub 公开搜索补充 ===");
        ok += this.syncFromDiscovery();

        // 阶段3：内置数据补充（确保离线场景也有真实软件库）
        const pkgCount = PackageRepository.getAll().length;
        if (pkgCount < 30) {
            console.log("=== 内置数据补充 ===");
            ok += this.syncBuiltIn();
        }

        return ok;
    }

    // 从内置数据集加载真实软件（从 sindresorhus/awesome README 提取）
    syncBuiltIn(): number {
        let ok = 0;
        let skipped = 0;
        for (let i = 0; i < BUILT_IN_PACKAGES.length; i++) {
            const p = BUILT_IN_PACKAGES[i];
            const data: RepoData = {
                name: p.owner + "/" + p.repo,
                description: p.description,
                stargazers_count: 0,
                language: "",
                topics: [p.category, "awesome-list"],
                html_url: p.url,
                homepage: p.url,
                license: "",
                version: "",
            };
            if (this.savePackage(data, 0, "builtin-awesome")) ok++;
            else skipped++;
        }
        console.log("  内置数据: " + ok + " 入库, " + skipped + " 已存在跳过");
        return ok;
    }

    // 同步种子仓库
    syncSeeds(): number {
        const sources = SourceRepository.getAll();
        let ok = 0;
        for (let i = 0; i < sources.length; i++) {
            const s = sources[i];
            console.log("[" + (i + 1) + "/" + sources.length + "] " + s.owner + "/" + s.repo);

            // 步骤1：获取种子仓库自身 meta（失败也保存基本信息）
            const data = this.fetch(s);
            if (data) {
                ok += this.savePackage(data, s.id, this.useCrawler ? "crawler" : "seed-api");
            } else {
                // 网络失败 fallback：保存基本信息
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
                ok += this.savePackage(fallback, s.id, "seed-fallback");
            }

            // 步骤2：根据 parser_config 用专用解析器提取 README 中的软件列表
            const readme = this.crawler.fetchReadme(s.owner, s.repo);
            if (readme && readme.length > 100) {
                const cfg = s.parserConfig || "generic";
                console.log("  解析: " + cfg);
                const entries: ParsedEntry[] = this.listParser.parse(readme, cfg);
                console.log("  parsed: " + entries.length + " entries");
                for (const entry of entries.slice(0, 100)) {
                    if (!entry.project_url) continue;
                    const childData: RepoData = {
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
                    ok += this.savePackage(childData, s.id, "parsed-" + cfg);
                }
            }
        }
        return ok;
    }

    // 通过搜索引擎补充软件库
    syncFromDiscovery(): number {
        let ok = 0;
        // 维度1：发现 Windows 应用
        console.log("  [搜索] 发现 Windows 应用...");
        const winApps = this.search.discoverWindowsSoftware(1);
        for (const item of winApps) {
            if (this.savePackageFromSearch(item)) ok++;
        }
        // 维度2：分类搜索
        const categories = ["dev-tools", "office", "media", "utility"];
        for (const cat of categories) {
            console.log("  [搜索] 分类 " + cat + "...");
            const results = this.search.searchByCategory(cat, 1, 20);
            for (const item of results) {
                if (this.savePackageFromSearch(item)) ok++;
            }
        }
        return ok;
    }

    // 公开版 savePackageFromSearch — 供 CLI search 调用
    savePackageFromSearchPublic(item: any): boolean {
        return this.savePackageFromSearch(item);
    }

    private fetch(source: Source): RepoData | null {
        if (!this.useCrawler) {
            const info = this.api.getRepoInfo(source.owner, source.repo);
            if (info) {
                return {
                    name: info.full_name,
                    description: info.description,
                    stargazers_count: info.stargazers_count,
                    language: info.language,
                    topics: info.topics || [],
                    html_url: info.html_url,
                    homepage: info.homepage || "",
                    license: info.license ? info.license.spdx_id : "",
                    version: info.latest_release ? info.latest_release.tag_name : "",
                };
            }
        }
        const html = this.crawler.fetchPage("https://github.com/" + source.owner + "/" + source.repo);
        return this.parseHtml(html, source.owner, source.repo);
    }

    private parseHtml(html: string, owner: string, repo: string): RepoData | null {
        if (!html || html.length < 100) return null;
        let desc = "", stars = 0, lang = "", topics: string[] = [], homepage = "", lic = "";

        const dm = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
        if (dm) desc = dm[1].trim();

        const sm = html.match(/aria-label="([\d,]+)\s*users?\s*starred/i);
        if (sm) stars = parseInt(sm[1].replace(/,/g, "")) || 0;

        const lm = html.match(/aria-label="([^"]*?)\s+[\d.]+%"[^>]*>/i);
        if (lm) lang = lm[1].trim();

        const tagRegex = /<a[^>]*class="[^"]*topic-tag[^"]*"[^>]*>(.+?)<\/a>/gi;
        let m: RegExpExecArray | null;
        while ((m = tagRegex.exec(html)) !== null) {
            topics.push(m[1].replace(/<[^>]+>/g, "").trim());
        }
        const hm = html.match(/itemprop="url"\s*href="([^"]+)"/);
        if (hm) homepage = hm[1];
        const lc = html.match(/aria-label="View license"[^>]*>([^<]+)</);
        if (lc) lic = lc[1].trim();

        return { name: owner + "/" + repo, description: desc, stargazers_count: stars, language: lang, topics, html_url: "https://github.com/" + owner + "/" + repo, homepage, license: lic, version: "" };
    }

    // 保存单个软件包（自动分类 + 去重）
    private savePackageFromSearch(item: any): boolean {
        if (!item || !item.full_name) return false;
        const repoName = item.full_name.split("/").pop() || item.full_name;
        const hash = GitHubAPIClient.urlHash(item.html_url || "https://github.com/" + item.full_name);

        // 去重检查
        const all = PackageRepository.getAll();
        const dup = this.dedup.deduplicateExact(hash, all);
        if (dup) return false;
        const fuzzy = this.dedup.findFuzzyMatch(item.full_name, all);
        if (fuzzy) return false;

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

    // 直接保存（带去重检查）
    private savePackage(data: RepoData, sourceId: number, dataSource: string): boolean {
        const hash = GitHubAPIClient.urlHash(data.html_url);
        
        // 去重检查：URL Hash 精确匹配
        const all = PackageRepository.getAll();
        const dup = this.dedup.deduplicateExact(hash, all);
        if (dup) {
            return false; // 已存在，跳过
        }

        // 模糊去重检查
        const fuzzy = this.dedup.findFuzzyMatch(data.name, all);
        if (fuzzy) {
            const merged = this.dedup.mergeSources(fuzzy, data as any, "fuzzy");
            // 更新已有记录而非创建新记录
            return false;
        }

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
                data_source: dataSource,
            });
            return true;
        } catch { return false; }
    }
}