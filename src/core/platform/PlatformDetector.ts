// PlatformDetector — Release 文件智能分类
// 按 asset name 后缀/关键词自动归类到 windows / macos / linux / universal

import { PLATFORM_RULES, ARCHIVE_EXTENSIONS, type PlatformType, type PlatformRule } from "./rules";
import type { Asset, PlatformAssets } from "../../types";

export class PlatformDetector {
    // 将 Release assets 数组按平台分组
    classifyAssets(assets: Asset[]): PlatformAssets {
        const result: PlatformAssets = {
            windows: [],
            macos: [],
            linux: [],
            universal: [],
        };

        for (const asset of assets) {
            const name = (asset.name || "").toLowerCase();
            const platform = this.detectPlatform(name);
            result[platform].push(asset);
        }

        return result;
    }

    // 单个 asset 平台识别
    detectPlatform(name: string): PlatformType {
        // 第一优先级：精准后缀匹配
        for (const rule of PLATFORM_RULES) {
            if (rule.extensions.some(ext => name.endsWith(ext))) {
                return rule.platform;
            }
        }

        // 第二优先级：压缩包关键词匹配
        const isArchive = ARCHIVE_EXTENSIONS.some(ext => name.endsWith(ext));
        if (isArchive) {
            for (const rule of PLATFORM_RULES) {
                if (rule.keywords.some(kw => name.includes(kw))) {
                    return rule.platform;
                }
            }
        }

        // 第三优先级：归为通用
        return 'universal';
    }

    // 提取首选下载 URL（按 exe → msi → zip → 第一个 asset 优先级）
    pickDownloadUrl(assets: Asset[], preferPlatform: PlatformType = 'windows'): string {
        if (!assets || assets.length === 0) return "";
        const platformAssets = this.classifyAssets(assets);
        const pool = platformAssets[preferPlatform].length > 0
            ? platformAssets[preferPlatform]
            : assets;

        const exe = pool.find(a => a.name.toLowerCase().endsWith(".exe"));
        const msi = pool.find(a => a.name.toLowerCase().endsWith(".msi"));
        const zip = pool.find(a => a.name.toLowerCase().endsWith(".zip"));
        const first = pool[0];

        return (exe || msi || zip || first)?.browser_download_url || first?.url || "";
    }

    // 统计各平台 asset 数量
    countByPlatform(assets: Asset[]): { windows: number; macos: number; linux: number; universal: number } {
        const grouped = this.classifyAssets(assets);
        return {
            windows: grouped.windows.length,
            macos: grouped.macos.length,
            linux: grouped.linux.length,
            universal: grouped.universal.length,
        };
    }
}