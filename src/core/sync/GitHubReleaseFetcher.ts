// GitHubReleaseFetcher — 直接从 GitHub Releases 抓取可下载的二进制文件
// 参考 komi-store：支持 .exe, .msi, .dmg, .pkg, .deb, .rpm, .AppImage 等格式
// 用于种子仓库中 fetchReleases=true 的条目

import { GitHubAPIClient } from "./GitHubAPIClient";
import { PackageRepository } from "../../data";

// 支持的发布资产扩展名
const SUPPORTED_EXTENSIONS = [
    ".exe", ".msi", ".dmg", ".pkg",
    ".deb", ".rpm", ".AppImage",
    ".zip", ".tar.gz", ".7z",
];

// 平台识别
function detectPlatform(assetName: string): string {
    const name = assetName.toLowerCase();
    if (name.includes("windows") || name.includes("win32") || name.includes("win64") ||
        name.includes("x64") || name.includes("x86_64") || name.includes("amd64") ||
        name.endsWith(".exe") || name.endsWith(".msi")) return "windows";
    if (name.includes("macos") || name.includes("darwin") || name.includes("mac") ||
        name.endsWith(".dmg") || name.endsWith(".pkg")) return "macos";
    if (name.includes("linux") || name.endsWith(".deb") || name.endsWith(".rpm") ||
        name.endsWith(".appimage") || name.includes("appimage")) return "linux";
    return "cross";
}

// 过滤掉源压缩包
function isSourceArchive(assetName: string): boolean {
    const name = assetName.toLowerCase();
    return name.includes("source") || name.includes("sources") ||
           name.includes("-src") || name.includes("-source") ||
           name.includes("docs") || name.includes("readme");
}

// 从 release asset URL 提取平台
function getAssetInfo(asset: any): { name: string; url: string; platform: string; size: number } | null {
    const name = asset.name || asset.browser_download_url.split("/").pop() || "";
    if (isSourceArchive(name)) return null;

    let ext = "";
    for (const e of SUPPORTED_EXTENSIONS) {
        if (name.toLowerCase().endsWith(e)) { ext = e; break; }
    }
    if (!ext && !asset.browser_download_url.includes("releases/download")) return null;

    return {
        name,
        url: asset.browser_download_url,
        platform: detectPlatform(name),
        size: asset.size || 0,
    };
}

export interface ReleaseAsset {
    name: string;
    url: string;
    platform: string;
    size: number;
}

export interface ReleaseInfo {
    tag: string;
    name: string;
    description: string;
    publishedAt: string;
    assets: ReleaseAsset[];
}

export class GitHubReleaseFetcher {
    private client: GitHubAPIClient;

    constructor(token: string = "") {
        this.client = new GitHubAPIClient(token);
    }

    // 获取仓库的最新 release 信息
    async fetchLatestRelease(owner: string, repo: string): Promise<ReleaseInfo | null> {
        try {
            const release = await this.client.getLatestRelease(owner, repo);
            if (!release) return null;

            const assets: ReleaseAsset[] = [];
            for (const asset of (release.assets || [])) {
                const info = getAssetInfo(asset);
                if (info) assets.push(info);
            }

            return {
                tag: release.tag_name,
                name: release.name || repo,
                description: release.body?.substring(0, 200) || "",
                publishedAt: release.published_at || release.created_at || "",
                assets,
            };
        } catch (e) {
            console.log(`  [ReleaseFetcher] Failed: ${owner}/${repo}: ${(e as Error).message}`);
            return null;
        }
    }

    // 保存 release 信息为 Package
    saveReleaseAsPackage(release: ReleaseInfo, owner: string, repo: string, sourceId: number, dataPrefix: string): number {
        if (!release || release.assets.length === 0) return 0;

        const primaryAsset = release.assets[0];
        const name = `${owner}/${repo}`;
        const hash = this.computeHash(primaryAsset.url);

        // 去重检查
        if (PackageRepository.getByUrlHash(hash)) return 0;

        const platformAssets = JSON.stringify(release.assets.map(a => ({
            name: a.name,
            url: a.url,
            platform: a.platform,
            size: a.size,
        })));

        try {
            PackageRepository.saveFromRelease(
                name,
                release.description || `Release ${release.tag}`,
                `https://github.com/${owner}/${repo}`,
                hash,
                release.tag,
                platformAssets,
                primaryAsset.url,
                sourceId,
                dataPrefix
            );
            return 1;
        } catch {
            return 0;
        }
    }

    // 批量处理多个仓库
    async fetchAndSave(sources: Array<{ owner: string; repo: string; sourceId: number }>, dataPrefix: string): Promise<{ ok: number; skip: number; fail: number }> {
        let ok = 0, skip = 0, fail = 0;

        for (const s of sources) {
            try {
                const release = await this.fetchLatestRelease(s.owner, s.repo);
                if (!release) { fail++; continue; }
                if (release.assets.length === 0) { skip++; continue; }

                const saved = this.saveReleaseAsPackage(release, s.owner, s.repo, s.sourceId, dataPrefix);
                if (saved > 0) ok++;
                else skip++;
            } catch {
                fail++;
            }
        }

        return { ok, skip, fail };
    }

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
