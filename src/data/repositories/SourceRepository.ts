// Source Repository — 软件源 CRUD
import { safePrepare } from "../Database";
import type { Source, CreateSourceInput } from "../models/Source";

export const SourceRepository = {
    getAll(): Source[] {
        const rows = safePrepare("SELECT * FROM sources").all();
        return rows.map(hydrateSource);
    },

    getById(id: number): Source | undefined {
        return safePrepare("SELECT * FROM sources WHERE id = ?").get(id) || undefined;
    },

    findByName(owner: string, repo: string): Source | undefined {
        const all = this.getAll();
        return all.find(s => s.owner === owner && s.repo === repo);
    },

    create(input: CreateSourceInput): Source {
        const nextId = this.count() + 1;
        // perry v0.5.1220: run() 最多 7 个参数
        // parser_config 放进额外列，parent_source_id 聚合到 extra_json
        safePrepare(
            "INSERT INTO sources (id, source_type, owner, repo, list_repo, category, parser_config) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(
            nextId,
            input.source_type,
            input.owner || "",
            input.repo || "",
            input.list_repo || "",
            input.category || "",
            input.parser_config || "generic"
        );
        return this.getById(nextId)!;
    },

    updateLastSync(id: number): void {
        safePrepare("UPDATE sources SET last_sync = datetime('now') WHERE id = ?").run(id);
    },

    setEnabled(id: number, enabled: boolean): void {
        safePrepare("UPDATE sources SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
    },

    delete(id: number): void {
        safePrepare("DELETE FROM sources WHERE id = ?").run(id);
    },

    count(): number {
        return this.getAll().length;
    }
};

function hydrateSource(row: any): any {
    if (!row.parser_config) row.parser_config = "generic";
    return row;
}