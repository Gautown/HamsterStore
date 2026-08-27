// 通用辅助工具函数
// sleep、generateId、formatBytes、elapsedTime 等

export function sleep(ms: number): void {
    // perry v0.5.1220: setTimeout 回调非 UI 线程 → SIGSEGV
    // 用自旋阻塞替代
    const start = Date.now();
    while (Date.now() - start < ms) {}
}

export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatDate(iso: string): string {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleDateString("zh-CN");
    }
    catch {
        return iso;
    }
}

export function elapsedTime(start: number): string {
    const ms = Date.now() - start;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}

// 安全的 JSON parse
export function safeJsonParse(text: string): any | null {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

// 文件名清洗（替换非法字符）
export function sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_");
}