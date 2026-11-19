// ReleaseResolver — 把软件包解析为可下载的 Windows release 资产
// 背景：BuiltInData/seed 的 download_url 是仓库主页 URL，直接下载得到的是 HTML。
// 流程：parseOwnerRepo → getLatestRelease（netFetch 回调式，经 ProxyManager 加速）
//       → pickWindowsAsset 评分选择 → 写回包缓存（version/download_url/platform_assets）
// 缓存快路径：download_url 已含 /releases/download/ 时直接用，不再请求 API。
// pickWindowsAsset 是纯函数，离线单测覆盖（src/tests/release.test.ts）。

import type { Asset, Release } from "../../types";
import { GitHubAPIClient } from "../sync/GitHubAPIClient";
import { PackageRepository } from "../../data";

export interface ResolvedDownload {
    url: string;          // browser_download_url（原始未加速；DownloadManager 统一加速）
    version: string;      // tag_name
    assetName: string;
    size: number;         // 字节，0 = 未知
    fromCache: boolean;
}

// ── 资产选择规则（评分制，确定性，同分取第一个）──
// 排除：校验和/签名/文档/调试符号；GitHub 自动生成的 Source code 归档；
//       明确非 Windows 平台（linux/darwin/macos/android/bsd/.deb/.rpm/.dmg/.apk…）
// 加分：安装器扩展名 > 便携压缩包；Windows 平台关键词；x64 架构 > arm64 > 无架构信息
const EXCLUDE_EXT = [
    ".sha256", ".sha512", ".md5", ".asc", ".sig", ".txt", ".md",
    ".json", ".yml", ".yaml", ".pdb", ".blockmap", ".ipa",
];
const EXCLUDE_MARKERS = [
    "linux", "darwin", "macos", "apple", "android",
    "freebsd", "netbsd", "openbsd",
    ".deb", ".rpm", ".appimage", ".dmg", ".apk", ".snap", ".flatpak",
    "mac-", "-mac",
];
const WIN_MARKERS = ["windows", "win64", "win32", "win-x64", "win-arm64", "msvc", "mingw", "pc-windows"];
const X64_MARKERS = ["x86_64", "x64", "amd64"];
const ARM_MARKERS = ["arm64", "aarch64"];

function extOf(name: string): string {
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.substring(i).toLowerCase() : "";
}

function extScore(ext: string): number {
    if (ext === ".msi" || ext === ".exe") return 40;
    if (ext === ".zip") return 30;
    if (ext === ".msix" || ext === ".appx") return 25;
    if (ext === ".7z") return 20;
    return 5;
}

function hasAny(lower: string, markers: string[]): boolean {
    for (const m of markers) {
        if (lower.indexOf(m) >= 0) return true;
    }
    return false;
}

/** 从 release 资产中选出最适合 Windows 的一个；无可用资产返回 null */
export function pickWindowsAsset(assets: Asset[]): Asset | null {
    let best: Asset | null = null;
    let bestScore = -1;
    for (const a of assets) {
        const name = a.name || "";
        const lower = name.toLowerCase();
        if (!name || !a.browser_download_url) continue;
        if (lower.indexOf("source code") === 0) continue;
        const ext = extOf(lower);
        if (EXCLUDE_EXT.indexOf(ext) >= 0) continue;
        if (hasAny(lower, EXCLUDE_MARKERS)) continue;

        let score = extScore(ext);
        if (hasAny(lower, WIN_MARKERS)) score += 30;
        if (lower.indexOf("portable") >= 0) score += 5;
        if (hasAny(lower, X64_MARKERS)) score += 10;
        else if (hasAny(lower, ARM_MARKERS)) score += 2;
        else score += 4;

        if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
}

/** 解析包的下载目标（回调式）。无 release/无 Windows 资产/非 GitHub 仓库 → null */
export function resolveReleaseDownload(
    pkg: any, token: string,
    onDone: (r: ResolvedDownload | null) => void,
): void {
    // 缓存快路径：已解析过的 release 资产 URL
    const cached = pkg.download_url || "";
    if (cached.indexOf("/releases/download/") >= 0) {
        const seg = cached.split("/");
        onDone({
            url: cached,
            version: pkg.version || "",
            assetName: seg[seg.length - 1] || "",
            size: 0,
            fromCache: true,
        });
        return;
    }

    const repoUrl = pkg.project_url || cached;
    const parsed = GitHubAPIClient.parseOwnerRepo(repoUrl);
    if (!parsed) { onDone(null); return; }

    const client = new GitHubAPIClient(token);
    client.getLatestRelease(parsed.owner, parsed.repo, (rel: Release | null) => {
        if (!rel || !rel.assets || rel.assets.length === 0) { onDone(null); return; }
        const asset = pickWindowsAsset(rel.assets);
        if (!asset) { onDone(null); return; }

        // 写回缓存（尽力而为，失败不阻塞下载）：version + 资产 URL + 全量资产清单
        try {
            PackageRepository.saveFromRelease(
                pkg.name, pkg.description || "", repoUrl,
                pkg.url_hash || GitHubAPIClient.urlHash(repoUrl),
                rel.tag_name || "", JSON.stringify(rel.assets),
                asset.browser_download_url,
                pkg.source_id || 0, "api",
            );
        } catch {}

        onDone({
            url: asset.browser_download_url,
            version: rel.tag_name || "",
            assetName: asset.name,
            size: asset.size || 0,
            fromCache: false,
        });
    });
}
