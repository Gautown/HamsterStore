// SourceEntry 模型定义
export interface SourceEntry {
    id: number;
    source_id: number;
    name: string;
    description: string;
    project_url: string;
    category: string;
    license: string;
    tags: string;
    dedup_status: 'new' | 'duplicate' | 'merged';
    canonical_id: number | null;
    raw_data: string;
    created_at: string;
}

export interface CreateSourceEntryInput {
    source_id: number;
    name?: string;
    description?: string;
    project_url?: string;
    category?: string;
    license?: string;
    tags?: string;
    raw_data?: string;
}