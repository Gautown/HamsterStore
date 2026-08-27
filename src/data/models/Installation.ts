// Installation 模型定义
export interface Installation {
    id: number;
    package_id: number;
    installed_version: string;
    install_path: string;
    install_date: string;
    status: number;
    update_available: number;
    last_update_check: string | null;
}