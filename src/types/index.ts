// HamsterStore 共享类型定义

export type PlatformType = 'windows' | 'macos' | 'linux' | 'universal';

export type SourceType = 'github_repo' | 'awesome_list' | 'awesome_sublist';

export type DataSource = 'api' | 'crawler' | 'cache';

export type DedupStatus = 'new' | 'duplicate' | 'merged';

export type MergeMethod = 'exact' | 'fuzzy' | 'manual';

export type DownloadStatus = 'waiting' | 'downloading' | 'done' | 'failed';

// 软件源
export interface Source {
    id: number;
    source_type: SourceType;
    owner: string;
    repo: string;
    list_repo: string;
    parent_source_id: number | null;
    category: string;
    parser_config: string;  // JSON
    enabled: boolean;
    last_sync: string;
    created_at: string;
}

// 软件信息
export interface Package {
    id: number;
    source_id: number;
    name: string;
    version: string;
    description: string;
    categories: string[];     // JSON 存储
    platform_assets: PlatformAssets;  // JSON
    project_url: string;
    url_hash: string;
    download_url: string;
    data_source: DataSource;
    published_at: string;
    last_sync_success: string;
    created_at: string;
}

// 去重映射
export interface DedupMap {
    id: number;
    url_hash: string;
    canonical_package_id: number;
    source_entry_ids: number[];  // JSON
    merge_method: MergeMethod;
    merged_at: string;
    created_at: string;
}

// 精选条目
export interface SourceEntry {
    id: number;
    source_id: number;
    name: string;
    description: string;
    project_url: string;
    category: string;
    license: string;
    tags: string[];
    dedup_status: DedupStatus;
    canonical_id: number | null;
    raw_data: string;  // JSON
    created_at: string;
}

// 安装记录
export interface Installation {
    id: number;
    package_id: number;
    installed_version: string;
    install_path: string;
    install_date: string;
    status: number;  // 1=已安装, 0=已卸载
    update_available: boolean;
    last_update_check: string;
}

// 下载任务
export interface DownloadTask {
    id: number;
    package_id: number;
    url: string;
    local_path: string;
    progress: number;
    status: DownloadStatus;
    created_at: string;
}

export type DownloadStatus = 'waiting' | 'downloading' | 'done' | 'failed';

// 按平台分组的 Assets
export interface PlatformAssets {
    windows: Asset[];
    macos: Asset[];
    linux: Asset[];
    universal: Asset[];
}

export interface Asset {
    name: string;
    size: number;
    url: string;
    browser_download_url: string;
}

// GitHub Release
export interface Release {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    assets: Asset[];
}

// Awesome 子列表
export interface AwesomeSublist {
    name: string;
    url: string;
    owner: string;
    repo: string;
    category: string;
    parserConfig: string;
}

// 平台识别规则
export interface PlatformRule {
    platform: PlatformType;
    extensions: string[];
    keywords: string[];
}

// 自更新信息
export interface SelfUpdateInfo {
    hasUpdate: boolean;
    currentVersion?: string;
    latestVersion?: string;
    downloadUrl?: string;
    releaseNotes?: string;
    size?: number;
}

// 同步进度事件
export interface SyncProgress {
    source: number;
    processed: number;
    total: number;
}

// 应用设置
export interface AppSettings {
    app_version: string;
    auto_update_app: boolean;
    auto_update_packages: boolean;
    update_channel: 'stable' | 'beta';
    last_self_update_check: string;
    awesome_recursion_depth: number;
}