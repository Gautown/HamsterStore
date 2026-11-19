// Package Repository — 软件信息 CRUD（绕过 Perry bundler 剥离）
import { getDatabase } from "../Database";
import type { Package, CreatePackageInput } from "../models/Package";

function getRawRows(): any[] {
    const db = getDatabase();
    const table = (db as any).tables?.packages;
    if (!table) return [];
    return table.rows || [];
}

export const PackageRepository = {
    getAll(): Package[] {
        const rows = getRawRows();
        return rows.map((r: any) => hydratePackage(r));
    },

    getById(id: number): Package | undefined {
        const rows = getRawRows();
        const r = rows.find((row: any) => Number(row.id) === id);
        return r ? hydratePackage(r) : undefined;
    },

    getByUrlHash(hash: string): Package | undefined {
        const rows = getRawRows();
        const r = rows.find((row: any) => row.url_hash === hash);
        return r ? hydratePackage(r) : undefined;
    },

    getByName(name: string): Package | undefined {
        const rows = getRawRows();
        const r = rows.find((row: any) => row.name === name);
        return r ? hydratePackage(r) : undefined;
    },

    search(query: string, limit: number = 50): Package[] {
        const rows = getRawRows();
        const q = (query || "").toLowerCase();
        const matched = rows.filter((r: any) => {
            const name = (r.name || "").toLowerCase();
            const desc = (r.description || "").toLowerCase();
            return name.includes(q) || desc.includes(q);
        });
        // Sort by name
        matched.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
        return matched.slice(0, limit).map((r: any) => hydratePackage(r));
    },

    create(input: CreatePackageInput): Package {
        const db = getDatabase();
        const table = (db as any).tables?.packages;
        if (!table) throw new Error("packages table not found");

        // nextId 对齐既有数据：取 max(id)+1（防止历史数据导致的 ID 冲突）
        let nextId = Number(table.nextId) || 0;
        for (const r of (table.rows || [])) {
            const rid = Number(r.id) || 0;
            if (rid >= nextId) nextId = rid + 1;
        }
        table.nextId = nextId + 1;
        const ext = {
            platform_assets: input.platform_assets || "[]",
            project_url: input.project_url,
            download_url: input.download_url || "",
            data_source: input.data_source || "cache",
        };
        const row: any = {
            id: String(nextId),
            source_id: input.source_id || null,
            name: input.name,
            version: input.version || "",
            description: input.description || "",
            categories: input.categories || "[]",
            url_hash: input.url_hash || "",
            extra_json: JSON.stringify(ext),
        };
        table.rows.push(row);
        (db as any)._save("packages");
        return this.getById(nextId)!;
    },

    saveFromRelease(
        name: string, description: string, project_url: string, url_hash: string,
        version: string, platform_assets: string, download_url: string,
        source_id: number, data_source: string
    ): Package {
        const existing = this.getByUrlHash(url_hash);
        if (existing) {
            // Update existing
            // 注意：FileDB 的 id 存为字符串，existing.id 是 string —— 必须 Number() 归一，
            // 否则 Number(r.id) === existing.id 恒 false，更新静默失效（真实 e2e 抓出）
            const db = getDatabase();
            const table = (db as any).tables?.packages;
            if (table) {
                const row = table.rows.find((r: any) => Number(r.id) === Number(existing.id));
                if (row) {
                    row.version = version;
                    row.extra_json = JSON.stringify({
                        platform_url: project_url,
                        download_url,
                        data_source,
                        project_url,
                        platform_assets,
                    });
                    (db as any)._save("packages");
                }
            }
            return this.getById(Number(existing.id))!;
        }
        return this.create({
            source_id, name, version, description, project_url, url_hash,
            download_url, data_source, platform_assets, categories: "[]"
        });
    },

    count(): number {
        return this.getAll().length;
    },
};

// 从 extra_json 还原完整 Package 对象
// id 归一为 number：FileDB 内部存字符串，但 Package.id 类型声明是 number。
// 不归一的话 getById(pkg.id) 这类「拿返回对象的 id 再查询」会因 1 === "1" 恒 false 静默失效。
function hydratePackage(row: any): any {
    if (!row) return row;
    const base = Object.assign({}, row, { id: Number(row.id) });
    // 如果已经有 project_url 字段（非 extra_json），直接返回
    if (base.project_url !== undefined && base.download_url !== undefined) return base;
    // 展开 extra_json
    try {
        const ext = typeof base.extra_json === "string" ? JSON.parse(base.extra_json) : (base.extra_json || {});
        return Object.assign(base, {
            project_url: ext.project_url || base.project_url || "",
            download_url: ext.download_url || base.download_url || "",
            data_source: ext.data_source || base.data_source || "",
            platform_assets: ext.platform_assets || base.platform_assets || "[]",
        });
    } catch {
        return base;
    }
}
