// GUI 数据适配层 — 仅保留入口初始化
// 其他数据读取由 ui/components 直接调用 data/Repository

import { initDatabase } from "../data/Database";
import { initSeedSources } from "../core/sync/seedRepos";

export function initData(): void {
    initDatabase();
    initSeedSources();
}