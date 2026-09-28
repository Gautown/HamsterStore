// DedupEngine — 软件去重引擎
// 精确去重（URL Hash 对比）+ 模糊去重（Jaccard 名称相似度）
// 操作底层 DedupRepository 记录精确/模糊/新记录

import { DedupRepository, PackageRepository, type Package } from "../../data";
import type { DedupMap } from "../../data/models/DedupMap";
import type { ThreadPool } from "../concurrent";

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

    // 模糊去重：查找最佳候选匹配（复用 similarity，避免第二份实现漂移）
    findFuzzyMatch(name: string, candidates: Package[]): Package | null {
        if (!candidates.length) return null;

        let bestScore = 0;
        let best: Package | null = null;

        for (const cand of candidates) {
            const score = this.similarity(name, cand.name || "");
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
    //  Perry 坑（0.5.1520 实测）：正则字面量在 .replace()/.split() 中会导致链接期
    //    `undefined symbol: js_regexp_new / js_string_replace_regex`（编译通过、链接失败）。
    //    必须改用字符遍历实现。此处同时由 private 改为 public：DedupCleaner 已在跨类调用它。
    tokenize(name: string): string[] {
        const lower = (name || "").toLowerCase();
        let normalized = "";
        for (let i = 0; i < lower.length; i++) {
            const c = lower.charAt(i);
            if (c === "-" || c === "_" || c === " " || c === "\t") normalized += " ";
            else if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9")) normalized += c;
        }
        return normalized.split(" ").filter(w => w.length > 0);
    }

    // 相似度：Jaccard + 子集加权 + 前缀加权（统一实现，避免 DedupCleaner 出现第二份漂移逻辑）
    similarity(a: string, b: string): number {
        const tokensA = this.tokenize(a);
        const tokensB = this.tokenize(b);
        let inter = 0;
        for (const t of tokensA) {
            if (tokensB.indexOf(t) >= 0) inter++;
        }
        const unionSize = tokensA.length + tokensB.length - inter;
        const jaccard = unionSize > 0 ? inter / unionSize : 0;

        const isSubset = tokensA.every(t => tokensB.indexOf(t) >= 0) ||
                         tokensB.every(t => tokensA.indexOf(t) >= 0);
        let score = jaccard;
        if (isSubset) score += 0.1 * this.prefixWeight;
        if (a.startsWith(b) || b.startsWith(a)) score += this.prefixWeight;
        return Math.min(score, 1.0);
    }

    // 并行批量打分（开发文档 §8.9.3「去重引擎：条目分片并行计算相似度」）
    // pairs 为待评估的名称对；返回数组与 pairs 顺序严格一致。
    scorePairsParallel(pairs: Array<{ a: string; b: string }>, pool: ThreadPool): number[] {
        return pool.mapParallel<{ a: string; b: string }, number>(
            pairs,
            (p: { a: string; b: string }) => this.similarity(p.a, p.b),
            "dedup-score"
        );
    }
}