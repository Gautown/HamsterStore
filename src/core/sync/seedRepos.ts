// 种子仓库配置（文档§1.5 的6个种子仓库）
// 这是 HamsterStore 的数据源根基，同步引擎从这些种子仓库获取软件信息

import type { Source } from "../../types";
import { RepoSyncEngine } from "./RepoSyncEngine";
import { initDatabase } from "../../data/Database";
import { SourceRepository, PackageRepository } from "../../data";
import { GitHubAPIClient } from "./GitHubAPIClient";
import { BUILT_IN_PACKAGES } from "./BuiltInData";

// 种子仓库列表（按优先级排序）
export const SEED_REPOS: Array<{
    owner: string;
    repo: string;
    source_type: Source["source_type"];
    description: string;
    parserConfig: string;
    branch?: string;
}> = [
    {
        owner: "sindresorhus",
        repo: "awesome",
        source_type: "awesome_list",
        description: "Awesome lists about all kinds of interesting topics",
        parserConfig: "awesome_index",
        branch: "main",
    },
    {
        owner: "stackia",
        repo: "best-windows-apps",
        source_type: "awesome_list",
        description: "优秀 Windows 应用推荐",
        parserConfig: "stackia",
        branch: "master",
    },
    {
        owner: "holyshell",
        repo: "AppsForWindows",
        source_type: "awesome_list",
        description: "开源/免费 Windows 软件推荐",
        parserConfig: "holyshell",
        branch: "main",
    },
    {
        owner: "ziyouvip",
        repo: "awesome-windows-software",
        source_type: "awesome_list",
        description: "Windows 备忘录",
        parserConfig: "ziyouvip",
        branch: "main",
    },
    {
        owner: "ttionya",
        repo: "Personal-Software",
        source_type: "awesome_list",
        description: "个人常用软件分类",
        parserConfig: "ttionya",
        branch: "master",
    },
    {
        owner: "ossdate",
        repo: "open-source-software-for-enterprises",
        source_type: "awesome_list",
        description: "企业级开源软件",
        parserConfig: "ossdate",
        branch: "main",
    },
];

// 初始化种子数据库 — 将6个种子仓库写入 Source 表
export function initSeedSources(): number {
    let created = 0;
    for (let i = 0; i < SEED_REPOS.length; i++) {
        const seed = SEED_REPOS[i];
        const listRepo = `https://github.com/${seed.owner}/${seed.repo}`;
        const existing = SourceRepository.getAll().find(s => s.list_repo === listRepo);
        if (!existing) {
            SourceRepository.create({
                source_type: seed.source_type,
                owner: seed.owner,
                repo: seed.repo,
                list_repo: listRepo,
                parser_config: seed.parserConfig,
            });
            created++;
        }
    }
    return created;
}

// 首次启动注入真实种子软件库（BUILT_IN_PACKAGES）— 保证离线/未 sync 也能展示真实数据。
// 仅当本地软件包极少时注入，避免覆盖用户已 sync 的数据。
export function seedBuiltInPackages(): number {
    const source = SourceRepository.getAll().find(s => s.owner === "sindresorhus" && s.repo === "awesome");
    const sourceId = source ? source.id : 0;
    let created = 0;
    for (let i = 0; i < BUILT_IN_PACKAGES.length; i++) {
        const p = BUILT_IN_PACKAGES[i];
        const name = p.owner + "/" + p.repo;
        const hash = GitHubAPIClient.urlHash(p.url);
        if (PackageRepository.getByUrlHash(hash)) continue; // 已存在则跳过
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

// 批量同步种子仓库到数据库
export async function startSync(targets?: string[]): Promise<void> {
    const engine = new RepoSyncEngine();
    const sources = SourceRepository.getEnabled();
    const filtered = targets
        ? sources.filter(s => targets.includes(`${s.owner}/${s.repo}`))
        : sources;
    console.log(`[Seeds] Syncing ${filtered.length} of ${sources.length} sources...`);
    for (const source of filtered) {
        try {
            await engine.syncGitHubRepo(source);
            console.log(`[Seeds] synced ${source.owner}/${source.repo}`);
        } catch (e) {
            console.log(`[Seeds] failed ${source.owner}/${source.repo}: ${(e as Error).message}`);
        }
    }
}