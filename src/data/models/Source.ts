// Source 模型 - 软件源
import type { SourceType } from "../../types";

export interface Source {
    id: number;
    source_type: SourceType;
    owner: string;
    repo: string;
    list_repo: string;
    parent_source_id: number | null;
    category: string;
    parser_config: string;
    enabled: boolean;
    last_sync: string | null;
    created_at: string;
}

export interface CreateSourceInput {
    source_type: SourceType;
    owner?: string;
    repo?: string;
    list_repo?: string;
    parent_source_id?: number;
    category?: string;
    parser_config?: string;
    enabled?: boolean;
    priority?: number;
}