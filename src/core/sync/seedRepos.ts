// 种子仓库配置（v2 — 参考 komi-store 优化）
// 替换为高质量 Windows 软件推荐仓库 + 支持 GitHub Releases 直接抓取

import type { Source } from "../../types";
import { SourceRepository, PackageRepository } from "../../data";
import { GitHubAPIClient } from "./GitHubAPIClient";
import { BUILT_IN_PACKAGES } from "./BuiltInData";

// 高质量种子仓库列表
// 优先级：Windows 专用源 > 通用 awesome 列表 > 分类精选
export const SEED_REPOS: Array<{
    owner: string;
    repo: string;
    source_type: Source["source_type"];
    description: string;
    parserConfig: string;
    branch?: string;
    // 是否启用 GitHub Releases 直接抓取（需要 token）
    fetchReleases?: boolean;
}> = [
    // === Windows 专用精选源（高优先级）===
    {
        owner: "Axorax",
        repo: "awesome-free-apps",
        source_type: "awesome_list",
        description: "最佳免费应用精选（跨平台，含大量 Windows 应用）",
        parserConfig: "awesome_sublist_default",
        branch: "main",
        fetchReleases: true,
    },
    {
        owner: "thechampagne",
        repo: "awesome-windows",
        source_type: "awesome_list",
        description: "Windows 10/11 最佳应用和工具精选",
        parserConfig: "awesome_sublist_default",
        branch: "main",
        fetchReleases: true,
    },
    {
        owner: "0PandaDEV",
        repo: "awesome-windows",
        source_type: "awesome_list",
        description: "Windows 10/11 工具和应用列表（含 AI、CAD 等分类）",
        parserConfig: "awesome_sublist_default",
        branch: "main",
        fetchReleases: true,
    },
    {
        owner: "icrawl",
        repo: "awesome-windows-desktop-apps",
        source_type: "awesome_list",
        description: "Windows 桌面应用精选",
        parserConfig: "awesome_sublist_default",
        branch: "main",
        fetchReleases: true,
    },
    // === 通用 Awesome 列表 ===
    {
        owner: "sindresorhus",
        repo: "awesome",
        source_type: "awesome_list",
        description: "Awesome lists 主索引",
        parserConfig: "awesome_index",
        branch: "main",
        fetchReleases: false,
    },
    {
        owner: "vinta",
        repo: "awesome-python",
        source_type: "awesome_list",
        description: "Python 生态精选",
        parserConfig: "awesome_sublist_default",
        branch: "main",
        fetchReleases: true,
    },
    {
        owner: "mxnchelsea",
        repo: "awesome-rust",
        source_type: "awesome_list",
        description: "Rust 生态精选",
        parserConfig: "awesome_sublist_default",
        branch: "main",
        fetchReleases: true,
    },
    // === 特定领域精选 ===
    {
        owner: "mtdvio",
        repo: "every-programmer-should-know",
        source_type: "awesome_list",
        description: "程序员必备知识精选",
        parserConfig: "awesome_sublist_default",
        branch: "main",
        fetchReleases: false,
    },
    {
        owner: "josephmisiti",
        repo: "awesome-machine-learning",
        source_type: "awesome_list",
        description: "机器学习资源精选",
        parserConfig: "awesome_sublist_default",
        branch: "main",
        fetchReleases: true,
    },
    // === Windows 工具/实用程序 ===
    {
        owner: "file-New-Project",
        repo: "EarTrumpet",
        source_type: "github_release",
        description: "Windows 音量控制应用",
        parserConfig: "github_release",
        branch: "main",
        fetchReleases: true,
    },
    {
        owner: "translucenttb",
        repo: "TranslucentTB",
        source_type: "github_release",
        description: "任务栏透明化工具",
        parserConfig: "github_release",
        branch: "main",
        fetchReleases: true,
    },
    {
        owner: "glzr-io",
        repo: "glazewm",
        source_type: "github_release",
        description: "Rust 窗口管理器",
        parserConfig: "github_release",
        branch: "main",
        fetchReleases: true,
    },
    {
        owner: "niri-wm",
        repo: "niri",
        source_type: "github_release",
        description: "平铺式窗口管理器",
        parserConfig: "github_release",
        branch: "main",
        fetchReleases: true,
    },
];

// 初始化种子数据库
export function initSeedSources(): number {
    let created = 0;
    for (const seed of SEED_REPOS) {
        const listRepo = `https://github.com/${seed.owner}/${seed.repo}`;
        const existing = findSource(seed.owner, seed.repo);
        if (!existing) {
            createSource(seed, listRepo);
            created++;
        }
    }
    return created;
}

function findSource(owner: string, repo: string): any {
    const all = SourceRepository.getAll();
    return all.find((s: any) => s.owner === owner && s.repo === repo);
}

function createSource(seed: typeof SEED_REPOS[0], listRepo: string): void {
    SourceRepository.create({
        source_type: seed.source_type,
        owner: seed.owner,
        repo: seed.repo,
        list_repo: listRepo,
        parser_config: seed.parserConfig,
    });
}

// 首次启动注入真实种子软件库（BUILT_IN_PACKAGES）— 保证离线/未 sync 也能展示真实数据。
// 仅当本地软件包极少时注入，避免覆盖用户已 sync 的数据。
export function seedBuiltInPackages(): number {
    const source = SourceRepository.getAll().find((s: any) => s.owner === "sindresorhus" && s.repo === "awesome");
    const sourceId = source ? source.id : 0;
    let created = 0;
    for (let i = 0; i < BUILT_IN_PACKAGES.length; i++) {
        const p = BUILT_IN_PACKAGES[i];
        const name = p.owner + "/" + p.repo;
        const hash = GitHubAPIClient.urlHash(p.url);
        if (PackageRepository.getByUrlHash(hash)) continue;
        PackageRepository.create({
            source_id: sourceId,
            name,
            version: "",
            description: p.description,
            categories: JSON.stringify([p.category]),
            platform_assets: "[]",
            project_url: p.url,
            url_hash: hash,
            download_url: p.url,
            data_source: "builtin-awesome",
        });
        created++;
    }
    return created;
}
