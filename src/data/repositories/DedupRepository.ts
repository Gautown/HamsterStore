// Dedup Repository — 去重映射 CRUD
import { safePrepare } from "../Database";
import type { DedupMap } from "../models/DedupMap";

export const DedupRepository = {
    getAll(): DedupMap[] {
        return safePrepare("SELECT * FROM dedup_map ORDER BY created_at DESC").all() as DedupMap[];
    },

    getByUrlHash(hash: string): DedupMap | undefined {
        return safePrepare("SELECT * FROM dedup_map WHERE url_hash = ?").get(hash) as DedupMap | undefined;
    },

    getByCanonicalId(packageId: number): DedupMap[] {
        return safePrepare("SELECT * FROM dedup_map WHERE canonical_package_id = ?").all(packageId) as DedupMap[];
    },

    create(input: { url_hash: string; canonical_package_id: number; source_entry_ids?: string; merge_method?: string }): DedupMap {
        const nextId = this.count() + 1;
        safePrepare(
            "INSERT INTO dedup_map (id, url_hash, canonical_package_id, source_entry_ids, merge_method) VALUES (?, ?, ?, ?, ?)"
        ).run(
            nextId,
            input.url_hash,
            input.canonical_package_id,
            input.source_entry_ids || "[]",
            input.merge_method || "new"
        );
        return this.getByUrlHash(input.url_hash)!;
    },

    merge(existing: DedupMap, newEntryId: number, method: string): void {
        const ids = JSON.parse(existing.source_entry_ids) as number[];
        if (!ids.includes(newEntryId)) {
            ids.push(newEntryId);
        }
        safePrepare("UPDATE dedup_map SET source_entry_ids = ?, merge_method = ?, merged_at = datetime('now') WHERE id = ?")
            .run(JSON.stringify(ids), method, existing.id);
    },

    count(): number {
        const all = this.getAll();
        return all.length;
    }
};