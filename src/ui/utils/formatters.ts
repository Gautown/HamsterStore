// Formatters — UI 格式化工具函数
// 数字格式化：大数以 k 为单位，日期格式化

export function formatStars(count: number): string {
    if (count >= 1000) return (count / 1000).toFixed(1) + "k";
    return String(count);
}

export function formatFileSize(bytes: number): string {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
}

export function truncateText(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + "...";
}

export function formatDate(isoDate: string): string {
    if (!isoDate) return "";
    return isoDate.substring(0, 10);
}