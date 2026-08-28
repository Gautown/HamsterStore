// GUI 数据适配层 — 仅保留入口初始化
// 其他数据读取由 ui/components 直接调用 data/Repository

import { initDatabase, PackageRepository } from "../data";
import { initSeedSources, seedBuiltInPackages } from "../core/sync/seedRepos";

export function initData(): void {
    initDatabase();
    initSeedSources();
    // 首次启动/数据为空时注入真实种子软件库（离线可展示真实数据）
    if (PackageRepository.getAll().length < 30) {
        const n = seedBuiltInPackages();
        if (n > 0) console.log("[init] seeded " + n + " built-in packages");
    }
}
