// GUI 数据适配层 — 仅保留入口初始化
// 其他数据读取由 ui/components 直接调用 data/Repository

// Perry v0.5.1220: GUI 不需要显式初始化数据库
// 数据库由 FileDB 懒加载，Repository 方法会内部初始化

export function initData(): void {
    // 空函数，数据库会在首次访问时自动初始化
}
