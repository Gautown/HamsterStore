// DedupEngine — 软件去重引擎
// 精确去重（URL Hash 对比）+ 模糊去重（Jaccard 名称相似度）
// 操作底层 DedupRepository 记录精确/模糊/新记录

import { DedupRepository, PackageRepository, type Package } from "../../data";
import type { DedupMap } from "../../data/models/DedupMap";

export type MergeMethod = 'exact' | 'fuzzy' | 'new' | 'manual';

export interface DedupCandidate {
    pkg: Package;
    urlHash: string;
    sources: number[];
}

export class DedupEngine {
    readonly fuzzyThreshold = 0.75;
    readonly prefixWeight = 0.4;

    // 精确去重：检查URL Hash是否已存在
    deduplicateExact(newUrlHash: string, candidates: Package[]): Package | null {
        const found = candidates.find(p => p.url_hash === newUrlHash);
        if (!found) return null;

        // 记录到 dedup_map
        const existing = DedupRepository.getByUrlHash(newUrlHash);
        if (existing) {
            DedupRepository.merge(existing, found.id, "exact");
        } else {
            DedupRepository.create({
                url_hash: newUrlHash,
                canonical_package_id: found.id,
                source_entry_ids: JSON.stringify([found.id]),
                merge_method: "exact",
            });
        }
        return found;
    }

    // 模糊去重：Jaccard 相似度 — 查找候选匹配
    findFuzzyMatch(name: string, candidates: Package[]): Package | null {
        if (!candidates.length) return null;

        const nameTokens = this.tokenize(name);
        let bestScore = 0;
        let best: Package | null = null;

        for (const cand of candidates) {
            const candTokens = this.tokenize(cand.name);
            const intersection = nameTokens.filter(t => candTokens.includes(t));
            const union = new Set([...nameTokens, ...candTokens]);
            const jaccard = intersection.length / union.size;

            const isSubset = nameTokens.every(t => candTokens.includes(t))
                          || candTokens.every(t => nameTokens.includes(t));
            let score = jaccard;
            if (isSubset) score += 0.1 * this.prefixWeight;
            if (name.startsWith(cand.name) || cand.name.startsWith(name)) {
                score += this.prefixWeight;
            }
            if (score > bestScore && score >= this.fuzzyThreshold) {
                bestScore = score;
                best = cand;
            }
        }
        return best;
    }

    // 多源合并：智能选择最优记录
    mergeSources(primary: Package, secondary: Package, method: MergeMethod): Package {
        const merged = { ...primary };
        // 从 secondary 补充空字段
        if (!merged.description && secondary.description) {
            merged.description = secondary.description;
        }
        if (!merged.version || merged.version === "" && secondary.version) {
            merged.version = secondary.version;
        }
        if (merged.data_source === 'cache' && secondary.data_source === 'api') {
            merged.data_source = 'api';
        }
        return merged;
    }

    // 计算两个名称的 Levenshtein 距离
    levenshtein(a: string, b: string): number {
        const m = a.length, n = b.length;
        const dp: number[][] = Array.from({length: n+1}, () => Array(m+1).fill(0));
        for (let i = 0; i <= m; i++) dp[0][i] = i;
        for (let j = 0; j <= n; j++) dp[j][0] = j;
        for (let j = 1; j <= n; j++) {
            for (let i = 1; i <= m; i++) {
                dp[j][i] = Math.min(
                    dp[j-1][i] + 1,                         // delete
                    dp[j][i-1] + 1,                         // insert
                    dp[j-1][i-1] + (a[i-1] === b[j-1] ? 0 : 1)  // replace
                );
            }
        }
        return dp[n][m];
    }

    // 名称归一化（tokenize）
    private tokenize(name: string): string[] {
        return name
            .toLowerCase()
            .replace(/[-_]/g, ' ')
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 0);
    }
}