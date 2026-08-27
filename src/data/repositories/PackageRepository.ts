// Package Repository — 软件信息 CRUD
import { safePrepare } from "../Database";
import type { Package, CreatePackageInput } from "../models/Package";

export const PackageRepository = {
    getAll(): Package[] {
        const rows = safePrepare("SELECT * FROM packages ORDER BY name").all();
        return rows.map((r: any) => hydratePackage(r));
    },

    getById(id: number): Package | undefined {
        const r = safePrepare("SELECT * FROM packages WHERE id = ?").get(id);
        return r ? hydratePackage(r) : undefined;
    },

    getByUrlHash(hash: string): Package | undefined {
        const r = safePrepare("SELECT * FROM packages WHERE url_hash = ?").get(hash);
        return r ? hydratePackage(r) : undefined;
    },

    getByName(name: string): Package | undefined {
        const r = safePrepare("SELECT * FROM packages WHERE name = ?").get(name);
        return r ? hydratePackage(r) : undefined;
    },

    search(query: string, limit: number = 50): Package[] {
        const q = "%" + query + "%";
        const rows = safePrepare(
            "SELECT * FROM packages WHERE name LIKE ? OR description LIKE ? ORDER BY name LIMIT ?"
        ).all(q, q, limit);
        return rows.map((r: any) => hydratePackage(r));
    },

    create(input: CreatePackageInput): Package {
        const nextId = this.count() + 1;
        // perry v0.5.1220: run() 最多可靠接收 7 个参数
        // 所有扩展字段打包到 extra_json
        const ext = {
            platform_assets: input.platform_assets || "[]",
            project_url: input.project_url,
            download_url: input.download_url || "",
            data_source: input.data_source || "cache",
        };
        safePrepare(
            "INSERT INTO packages (id, source_id, name, version, description, categories, url_hash, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
            nextId,
            input.source_id || null,
            input.name,
            input.version || "",
            input.description || "",
            input.categories || "[]",
            input.url_hash || "",
            JSON.stringify(ext)
        );
        return this.getById(nextId)!;
    },

    saveFromRelease(
        name: string, description: string, project_url: string, url_hash: string,
        version: string, platform_assets: string, download_url: string,
        source_id: number, data_source: string
    ): Package {
        const existing = this.getByUrlHash(url_hash);
        if (existing) {
            safePrepare("UPDATE packages SET version = ?, extra_json = ? WHERE id = ?")
                .run(version, JSON.stringify({
                    platform_url: project_url,
                    download_url,
                    data_source,
                    project_url,
                    platform_assets,
                }), existing.id);
            return this.getById(existing.id)!;
        }
        return this.create({
            source_id, name, version, description, project_url, url_hash,
            download_url, data_source, platform_assets, categories: "[]"
        });
    },

    updateLastSync(id: number): void {
        safePrepare("UPDATE packages SET last_sync_success = datetime('now') WHERE id = ?").run(id);
    },

    getCachedRelease(sourceId: number): Package | undefined {
        const r = safePrepare(
            "SELECT * FROM packages WHERE source_id = ? ORDER BY last_sync_success DESC LIMIT 1"
        ).get(sourceId);
        return r ? hydratePackage(r) : undefined;
    },

    count(): number {
        const all = this.getAll();
        return all.length;
    },
};

// 从 extra_json 还原完整 Package 对象
function hydratePackage(row: any): any {
    if (!row) return row;
    // 如果已经有 project_url 字段（非 extra_json），直接返回
    if (row.project_url !== undefined && row.download_url !== undefined) return row;
    // 展开 extra_json
    try {
        const ext = typeof row.extra_json === "string" ? JSON.parse(row.extra_json) : (row.extra_json || {});
        return Object.assign({}, row, {
            project_url: ext.project_url || row.project_url || "",
            download_url: ext.download_url || row.download_url || "",
            data_source: ext.data_source || row.data_source || "",
            platform_assets: ext.platform_assets || row.platform_assets || "[]",
        });
    } catch {
        return row;
    }
}