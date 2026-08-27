// Package 模型定义

export interface Package {
    id: number;
    source_id: number;
    name: string;
    version: string;
    description: string;
    categories: string;
    platform_assets: string;
    project_url: string;
    url_hash: string;
    download_url: string;
    data_source: string;
    published_at: string | null;
    last_sync_success: string | null;
    created_at: string;
}

export interface CreatePackageInput {
    source_id?: number;
    name: string;
    version?: string;
    description?: string;
    categories?: string;
    platform_assets?: string;
    project_url: string;
    url_hash: string;
    download_url?: string;
    data_source?: string;
}