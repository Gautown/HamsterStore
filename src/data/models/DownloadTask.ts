// DownloadTask 模型定义
export interface DownloadTask {
    id: number;
    package_id: number;
    url: string;
    local_path: string;
    progress: number;
    status: 'waiting' | 'downloading' | 'done' | 'failed';
    created_at: string;
}