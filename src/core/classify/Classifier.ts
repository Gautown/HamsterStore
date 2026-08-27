// Classifier — 自动分类引擎
// 三步策略：精确匹配 → 关键词匹配 → 默认"其他"
// 支持多分类标签，按权重评分取最高分

import { DEFAULT_CATEGORIES, type CategoryDef } from "./categories";

class Classifier {
    private categories: CategoryDef[];
    private keywordMap: Map<string, { catId: string; weight: number }[]>;

    constructor() {
        this.categories = DEFAULT_CATEGORIES.filter(c => c.keywords.length > 0);
        this.keywordMap = this.buildKeywordMap();
    }

    // 对单个 package 分类（返回多分类数组）
    classify(name: string, description: string = "", topics: string[] = []): string[] {
        const text = `${name} ${description} ${topics.join(" ")}`.toLowerCase();
        // 对每分类打分
        const scores: { catId: string; score: number }[] = [];

        for (const cat of this.categories) {
            let score = 0;
            for (const { word, weight } of cat.keywords) {
                if (text.includes(word.toLowerCase())) {
                    score += weight;
                }
            }
            if (score > 0) scores.push({ catId: cat.id, score });
        }

        // 排序取排名
        scores.sort((a, b) => b.score - a.score);
        // 取前3个高分类
        const top = scores.slice(0, 3).map(s => s.catId);
        if (top.length === 0) {
            // 兜底
            const hasReleases = topics.some(t => t === "software" || t === "releases");
            top.push(hasReleases ? "other" : "other");
        }

        // 解析别名 / 层级
        return this.resolveAliases(top);
    }

    // 批量分类
    classifyBatch(items: { name: string; description?: string; topics?: string[] }[]): string[][] {
        return items.map(item => this.classify(item.name, item.description || "", item.topics || []));
    }

    // 为种子仓库自动推断分类
    inferCategory(repoName: string, repoDescription: string = ""): string {
        const cats = this.classify(repoName, repoDescription);
        return cats[0] || "other";
    }

    // 根据名称计算信息熵（Shannon 熵）— 去重辅助
    shannonEntropy(text: string): number {
        if (!text) return 0;
        const freq: { [k: string]: number } = {};
        for (const ch of text.toLowerCase()) {
            freq[ch] = (freq[ch] || 0) + 1;
        }
        const n = text.length;
        let entropy = 0;
        for (const count of Object.values(freq)) {
            const p = count / n;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    }

    // 别名/层级分辨率
    private resolveAliases(catIds: string[]): string[] {
        const result: string[] = [];
        const seen = new Set<string>();
        for (const id of catIds) {
            const cat = this.categories.find(c => c.id === id);
            if (!cat) continue;
            if (cat.parent) {
                if (!seen.has(cat.parent)) {
                    result.push(cat.parent);
                    seen.add(cat.parent);
                }
            } else if (!seen.has(id)) {
                result.push(id);
                seen.add(id);
            }
        }
        return result;
    }

    // 创建关键词倒排索引
    private buildKeywordMap(): Map<string, { catId: string; weight: number }[]> {
        const kmap = new Map<string, { catId: string; weight: number }[]>();
        for (const cat of this.categories) {
            for (const { word, weight } of cat.keywords) {
                const lower = word.toLowerCase();
                const entry = kmap.get(lower) || [];
                entry.push({ catId: cat.id, weight });
                kmap.set(lower, entry);
            }
        }
        return kmap;
    }
}

// 单例
let instance: Classifier | null = null;

export function getClassifier(): Classifier {
    if (!instance) instance = new Classifier();
    return instance;
}

export { Classifier };
export { DEFAULT_CATEGORIES, type CategoryDef };