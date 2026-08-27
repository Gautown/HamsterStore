// DedupMap 模型定义
export interface DedupMap {
    id: number;
    url_hash: string;
    canonical_package_id: number;
    source_entry_ids: string;
    merge_method: 'exact' | 'fuzzy' | 'manual' | 'new';
    merged_at: string | null;
    created_at: string;
}