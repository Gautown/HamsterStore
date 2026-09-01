// Dedup 模块入口
export { DedupEngine, type MergeMethod, type DedupCandidate } from "./DedupEngine";
export { DedupCleaner, type DedupGroup, type DedupReport, dedupCleaner, generateDedupReport, runDedupCleanup } from "./DedupCleaner";