// RepoSyncEngine — 仓库同步引擎
// API 优先 + 爬虫降级 + 本地缓存兜底 + 批量处理 + Awesome 递归解析
// 按文档§8.2 实现

import { GitHubAPIClient, type RepoInfo } from "./GitHubAPIClient";
import { GitHubCrawler } from "../crawler/GitHubCrawler";
import { ListParser, type ParsedEntry, type ParsedSublist } from "../parser/ListParser";
import { PlatformDetector } from "../platform/PlatformDetector";
import { ProxyManager } from "../proxy/ProxyManager";
import {
    SourceRepository, PackageRepository, DedupRepository,
    beginTransaction, commitTransaction, rollbackTransaction,
} from "../../data";
import type { Source, Release } from "../../types";

export class RepoSyncEngine {
    private apiClient: GitHubAPIClient;
    private crawler: GitHubCrawler;
    private platformDetector: PlatformDetector;
    private proxyManager: ProxyManager;
    private parser: ListParser;
    private maxRecursionDepth: number = 2;  // sindresorhus/awesome 递归深度
    private readmeCache: Map<string, { text: string; fetchedAt: number }> = new Map();
    private readonly readmeCacheTtl = 24 * 60 * 60 * 1000;  // 24 小时

    constructor() {
        this.apiClient = new GitHubAPIClient();
        this.crawler = new GitHubCrawler();
        this.platformDetector = new PlatformDetector();
        this.proxyManager = ProxyManager.getInstance();
        this.parser = new ListParser();
    }

    // 同步所有软件源
    async syncAll(): Promise<{ sources: number; packages: number; errors: number }> {
        const sources = SourceRepository.getEnabled();
        let totalPackages = 0;
        let totalErrors = 0;

        for (const source of sources) {
            try {
                console.log(`[SyncEngine] Syncing source #${source.id}: ${source.list_repo || `${source.owner}/${source.repo}`}`);
                if (source.source_type === "github_repo") {
                    const n = await this.syncGitHubRepo(source);
                    totalPackages += n;
                } else if (source.source_type === "awesome_list") {
                    const n = await this.syncAwesomeList(source, 0);
                    totalPackages += n;
                } else if (source.source_type === "awesome_sublist") {
                    const n = await this.syncAwesomeSublist(source, 1);
                    totalPackages += n;
                }
                SourceRepository.updateLastSync(source.id);
            } catch (e) {
                console.log(`[SyncEngine] Source #${source.id} failed: ${(e as Error).message}`);
                totalErrors++;
            }
        }
        return { sources: sources.length, packages: totalPackages, errors: totalErrors };
    }

    // 同步 GitHub 仓库（API 优先 + 爬虫降级 + 缓存兜底）
    async syncGitHubRepo(source: Source): Promise<number> {
        let release: Release | null = null;
        let dataSource: 'api' | 'crawler' | 'cache' = 'api';

        // 1. 优先尝试 API
        try {
            release = this.apiClient.getLatestRelease(source.owner, source.repo);
            if (release) dataSource = 'api';
        } catch (e) {
            if (this.isRateLimitError(e)) {
                // 2. 限流 → 降级到爬虫
                try {
                    release = this.crawler.fetchLatestRelease(source.owner, source.repo);
                    if (release) dataSource = 'crawler';
                } catch {
                    // 3. 全部失败 → 缓存兜底
                    const cached = PackageRepository.getCachedRelease(source.id);
                    if (cached) {
                        console.log(`[SyncEngine] Using cached data for ${source.owner}/${source.repo}`);
                        return 0;  // cached，不算新获取
                    }
                    dataSource = 'cache';
                }
            } else {
                throw e;
            }
        }

        // API/爬虫都没拿到 → 尝试缓存
        if (!release) {
            const cached = PackageRepository.getCachedRelease(source.id);
            if (cached) {
                console.log(`[SyncEngine] Falling back to cache for ${source.owner}/${source.repo}`);
                return 0;
            }
            console.log(`[SyncEngine] No data for ${source.owner}/${source.repo}`);
            return 0;
        }

        // 平台识别 → 保存
        const platformAssets = this.platformDetector.classifyAssets(release.assets);
        const downloadUrl = this.platformDetector.pickDownloadUrl(release.assets, "windows");
        const projectUrl = `https://github.com/${source.owner}/${source.repo}`;
        const urlHash = GitHubAPIClient.urlHash(projectUrl);
        const pkgName = `${source.owner}/${source.repo}`;

        // 调用 API 获取仓库描述（如果还能调用）
        let description = "";
        try {
            const repoInfo = this.apiClient.getRepoInfo(source.owner, source.repo);
            if (repoInfo) description = repoInfo.description || "";
        } catch { /* rate limited, 描述可为空 */ }

        PackageRepository.saveFromRelease(
            pkgName, description, projectUrl, urlHash,
            release.tag_name, JSON.stringify(platformAssets), downloadUrl,
            source.id, dataSource
        );
        return 1;
    }

    // 同步精选列表（含 sindresorhus/awesome 递归解析）
    async syncAwesomeList(source: Source, depth: number = 0): Promise<number> {
        const readme = await this.getReadmeWithCache(source.list_repo);

        if (this.isAwesomeIndex(source)) {
            // 索引集合型：提取子列表
            const sublists = this.parser.parseAwesomeIndex(readme);
            console.log(`[SyncEngine] Awesome index: ${sublists.length} sublists`);

            let total = 0;
            if (depth < this.maxRecursionDepth) {
                for (const sublist of sublists) {
                    // 创建子列表源记录
                    const existing = SourceRepository.getAll().find(
                        s => s.list_repo === sublist.url
                    );
                    let subSource: Source;
                    if (existing) {
                        subSource = existing;
                    } else {
                        subSource = SourceRepository.create({
                            source_type: 'awesome_sublist',
                            list_repo: sublist.url,
                            owner: sublist.owner,
                            repo: sublist.repo,
                            parent_source_id: source.id,
                            category: sublist.category,
                            parser_config: sublist.parserConfig,
                        } as any);
                    }
                    total += await this.syncAwesomeSublist(subSource, depth + 1);
                }
            }
            return total;
        }

        // 直接列表型：解析为条目数组
        const entries = this.parser.parse(readme, source.parser_config);
        return this.processEntries(entries, source.id);
    }

    // 同步 awesome 子列表
    async syncAwesomeSublist(source: Source, depth: number = 1): Promise<number> {
        const readme = await this.getReadmeWithCache(source.list_repo);
        const entries = this.parser.parseAwesomeSublist(readme);

        // 继承父级分类
        if (source.parent_source_id) {
            const parent = SourceRepository.getById(source.parent_source_id);
            if (parent?.category) {
                for (const entry of entries) {
                    // 把父级分类添加到条目类别前
                    if (!entry.category || entry.category === "Uncategorized") {
                        entry.category = parent.category;
                    }
                }
            }
        }
        return this.processEntries(entries, source.id);
    }

    // 批量处理条目（去重 + 入库）
    private async processEntries(entries: ParsedEntry[], sourceId: number): Promise<number> {
        const batchSize = 50;  // 每 50 条一个事务
        let processed = 0;
        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = entries.slice(i, i + batchSize);
            try {
                this.processBatch(batch, sourceId);
                processed += batch.length;
                console.log(`[SyncEngine] Processed ${processed}/${entries.length} entries (source ${sourceId})`);
            } catch (e) {
                console.log(`[SyncEngine] Batch failed at #${i}: ${(e as Error).message}`);
            }
        }
        return processed;
    }

    // 单批处理（带事务）
    private processBatch(entries: ParsedEntry[], sourceId: number): void {
        beginTransaction();
        try {
            for (const entry of entries) {
                // 简化：用 URL Hash 做精确去重
                const urlHash = GitHubAPIClient.urlHash(entry.project_url);
                const existingPkg = PackageRepository.getByUrlHash(urlHash);
                if (existingPkg) {
                    // 已存在 → 不创建新记录
                    continue;
                }
                // 创建新 Package
                PackageRepository.create({
                    source_id: sourceId,
                    name: entry.name,
                    description: entry.description || "",
                    project_url: GitHubAPIClient.normalizeUrl(entry.project_url),
                    url_hash: urlHash,
                    categories: JSON.stringify(entry.category ? [entry.category] : []),
                    data_source: "api",  // 列表数据来自 API/爬虫，标记一致
                });
            }
            commitTransaction();
        } catch (e) {
            rollbackTransaction();
            throw e;
        }
    }

    // 获取 README（24 小时缓存）
    private async getReadmeWithCache(listRepo: string): Promise<string> {
        const cached = this.readmeCache.get(listRepo);
        const now = Date.now();
        if (cached && (now - cached.fetchedAt) < this.readmeCacheTtl) {
            return cached.text;
        }

        const parsed = GitHubAPIClient.parseOwnerRepo(listRepo) || GitHubAPIClient.parseOwnerRepo(`https://github.com/${listRepo}`);
        if (!parsed) {
            // listRepo 可能是一个 GitHub URL，直接 curl
            const readme = this.crawler.fetchReadme("", "", "main");
            if (readme) this.readmeCache.set(listRepo, { text: readme, fetchedAt: now });
            return readme;
        }
        const { owner, repo } = parsed;
        const readme = this.apiClient.getReadme(owner, repo) || this.crawler.fetchReadme(owner, repo);
        if (readme) {
            this.readmeCache.set(listRepo, { text: readme, fetchedAt: now });
        }
        return readme || "";
    }

    // 判断是否为 sindresorhus/awesome 索引
    private isAwesomeIndex(source: Source): boolean {
        return source.list_repo === "sindresorhus/awesome"
            || (source.owner === "sindresorhus" && source.repo === "awesome");
    }

    // 判断是否为 API 速率限制错误
    private isRateLimitError(error: any): boolean {
        if (!error) return false;
        const status = error.status || error.statusCode || 0;
        return status === 403 || status === 429;
    }

    // 设置 API Token
    setToken(token: string): void {
        this.apiClient.setToken(token);
    }

    // 清空 README 缓存
    clearCache(): void {
        this.readmeCache.clear();
    }
}