// HamsterStore 数据层入口
// 统一导出数据库操作、模型和 Repository

export { initDatabase, beginTransaction, commitTransaction, rollbackTransaction } from './Database';

// 模型
export type { Source, CreateSourceInput } from './models/Source';
export type { Package, CreatePackageInput } from './models/Package';
export { Installation } from './models/Installation';
export { DownloadTask } from './models/DownloadTask';
export { SourceEntry } from './models/SourceEntry';
export { DedupMap } from './models/DedupMap';
export { Setting } from './models/Setting';

// Repositories
export { SourceRepository } from './repositories/SourceRepository';
export { PackageRepository } from './repositories/PackageRepository';
export { InstallationRepository } from './repositories/InstallationRepository';
export { DownloadRepository } from './repositories/DownloadRepository';
export { DedupRepository } from './repositories/DedupRepository';
export { SettingRepository } from './repositories/SettingRepository';