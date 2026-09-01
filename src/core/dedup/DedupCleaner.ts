// DedupCleaner — 一次性去重清理脚本
// 扫描所有 packages，按 url_hash 分组，标记重复项

import { PackageRepository, DedupRepository } from "../../data";
import type { Package } from "../../data/models/Package";
import { DedupEngine } from "./DedupEngine";

export interface DedupGroup {
    urlHash: string;
    canonical: Package;
    duplicates: Package[];
    method: 'exact' | 'fuzzy';
}

export interface DedupReport {
    totalPackages: number;
    uniqueHashes: number;
    duplicateGroups: number;
    totalDuplicates: number;
    groups: DedupGroup[];
    fuzzyCandidates: Array<{ pkg: Package; match: Package; score: number }>;
}

export class DedupCleaner {
    private engine = new DedupEngine();

    // 按 url_hash 分组，找出所有重复
    findDuplicateGroups(): DedupGroup[] {
        const all = PackageRepository.getAll();
        const hashMap = new Map<string, Package[]>();

        for (const pkg of all) {
            const hash = pkg.url_hash || "";
            if (!hash) continue;
            if (!hashMap.has(hash)) {
                hashMap.set(hash, []);
            }
            hashMap.get(hash)!.push(pkg);
        }

        const groups: DedupGroup[] = [];
        for (const [hash, pkgs] of hashMap) {
            if (pkgs.length <= 1) continue;

            // 按 created_at 排序，最早的是 canonical
            const sorted = pkgs.sort((a, b) => {
                return (a.created_at || "").localeCompare(b.created_at || "");
            });
            const canonical = sorted[0];
            const duplicates = sorted.slice(1);

            groups.push({
                urlHash: hash,
                canonical,
                duplicates,
                method: 'exact',
            });
        }

        return groups;
    }

    // 模糊匹配：找名称相似但 url_hash 不同的包
    findFuzzyCandidates(): Array<{ pkg: Package; match: Package; score: number }> {
        const all = PackageRepository.getAll();
        const candidates: Array<{ pkg: Package; match: Package; score: number }> = [];

        // 用 name token 索引加速
        const nameIndex = new Map<string, Package[]>();
        for (const pkg of all) {
            const tokens = this.engine.tokenize(pkg.name || "");
            for (const token of tokens) {
                if (!nameIndex.has(token)) nameIndex.set(token, []);
                nameIndex.get(token)!.push(pkg);
            }
        }

        const seen = new Set<string>();
        for (const pkg of all) {
            const tokens = this.engine.tokenize(pkg.name || "");
            const potential = new Set<Package>();
            for (const token of tokens) {
                const group = nameIndex.get(token) || [];
                for (const p of group) {
                    if (p.id !== pkg.id && p.url_hash !== pkg.url_hash) {
                        potential.add(p);
                    }
                }
            }

            for (const match of potential) {
                const pairKey = [pkg.id, match.id].sort().join("-");
                if (seen.has(pairKey)) continue;
                seen.add(pairKey);

                const score = this.computeSimilarity(pkg.name || "", match.name || "");
                if (score >= 0.75) {
                    candidates.push({ pkg, match, score });
                }
            }
        }

        return candidates.sort((a, b) => b.score - a.score);
    }

    // 计算两个名称的相似度（Jaccard + 前缀加权）
    private computeSimilarity(a: string, b: string): number {
        const tokensA = this.engine.tokenize(a);
        const tokensB = this.engine.tokenize(b);

        const intersection = tokensA.filter(t => tokensB.includes(t));
        const union = new Set([...tokensA, ...tokensB]);
        const jaccard = union.size > 0 ? intersection.length / union.size : 0;

        const isSubset = tokensA.every(t => tokensB.includes(t)) ||
                         tokensB.every(t => tokensA.includes(t));
        let score = jaccard;
        if (isSubset) score += 0.1;
        if (a.startsWith(b) || b.startsWith(a)) score += 0.4;

        return Math.min(score, 1.0);
    }

    // 生成完整报告
    generateReport(): DedupReport {
        const all = PackageRepository.getAll();
        const groups = this.findDuplicateGroups();
        const fuzzy = this.findFuzzyCandidates();

        return {
            totalPackages: all.length,
            uniqueHashes: all.filter(p => p.url_hash).length,
            duplicateGroups: groups.length,
            totalDuplicates: groups.reduce((sum, g) => sum + g.duplicates.length, 0),
            groups,
            fuzzyCandidates: fuzzy,
        };
    }

    // 执行清理：将重复项标记到 dedup_map
    runCleanup(): { cleaned: number; groups: DedupGroup[] } {
        const groups = this.findDuplicateGroups();
        let cleaned = 0;

        for (const group of groups) {
            // 为 canonical 创建 dedup_map 条目
            const existing = DedupRepository.getByUrlHash(group.urlHash);
            if (existing) {
                // 更新 source_entry_ids
                const ids = JSON.parse(existing.source_entry_ids || "[]") as number[];
                for (const dup of group.duplicates) {
                    if (!ids.includes(dup.id)) {
                        ids.push(dup.id);
                    }
                }
                DedupRepository.merge(existing, group.canonical.id, "exact");
            } else {
                const entryIds = [group.canonical.id, ...group.duplicates.map(d => d.id)];
                DedupRepository.create({
                    url_hash: group.urlHash,
                    canonical_package_id: group.canonical.id,
                    source_entry_ids: JSON.stringify(entryIds),
                    merge_method: "exact",
                });
            }
            cleaned += group.duplicates.length;
        }

        return { cleaned, groups };
    }
}

// 导出便捷函数
export const dedupCleaner = new DedupCleaner();
export function generateDedupReport(): DedupReport {
    return dedupCleaner.generateReport();
}
export function runDedupCleanup(): { cleaned: number; groups: DedupGroup[] } {
    return dedupCleaner.runCleanup();
}
