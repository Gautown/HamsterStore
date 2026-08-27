// FileDB — 纯 TS 文件存储替代 better-sqlite3
// 完全绕过 perry v0.5.1220 预编译版的 better-sqlite3 prepare() stub
// 使用 JSON 文件存储，支持任意 perry 版本。
// 所有 6 个 Repository 无需改动接口。

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

interface TableData {
    name: string;
    rows: Record<string, any>[];
    nextId: number;
}

class FileDB {
    private tables: Record<string, TableData> = {};
    private dbDir: string;

    constructor(dbPath: string) {
        const dir = dirname(dbPath);
        this.dbDir = join(dir, "filedb");

        if (!existsSync(this.dbDir)) {
            mkdirSync(this.dbDir, { recursive: true });
        }

        // Load existing tables
        const files = ["sources", "packages", "dedup_map", "source_entries",
                        "installations", "download_tasks", "settings"];
        for (const name of files) {
            const f = join(this.dbDir, name + ".json");
            if (existsSync(f)) {
                try {
                    const raw = readFileSync(f, "utf8");
                    const parsed = JSON.parse(raw);
                    const rows: Record<string, any>[] = Array.isArray(parsed) ? parsed : [];
                    const maxId = rows.reduce((max: number, r: any) =>
                        r.id && r.id > max ? r.id : max, 0);
                    this.tables[name] = { name, rows, nextId: maxId + 1 };
                } catch {
                    this.tables[name] = { name, rows: [], nextId: 1 };
                }
            } else {
                this.tables[name] = { name, rows: [], nextId: 1 };
            }
        }
        this.open = true;
    }

    public open: boolean = false;

    exec(_sql: string): void {
        // No-op — tables defined at creation time
    }

    prepare(sql: string): any {
        const self = this;
        const trimmed = sql.trim();

        // INSERT OR IGNORE INTO
        // INSERT OR REPLACE INTO (multi-line support via [\s\S])
        const insertRe = /INSERT\s+(?:OR\s+(?:IGNORE|REPLACE)\s+)?INTO\s+(\w+)\s*\(([\s\S]+?)\)\s*VALUES\s*\(([^)]+)\)/i;
        const im = trimmed.match(insertRe);
        if (im) {
            const tableName = im[1];
            const isReplace = /OR\s+REPLACE/i.test(trimmed);
            const cols = im[2].split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
            // handle multi-line columns — strip newlines
            for (let i = 0; i < cols.length; i++) {
                cols[i] = cols[i].replace(/\s+/g, " ").trim();
            }
            return {
                run: function (...params: any[]) {
                    const t = self.tables[tableName];
                    if (!t) return { changes: 0, lastInsertRowid: 0 };
                    if (isReplace) {
                        const keyCol = cols[0];
                        const keyVal = String(params[0]);
                        const existingIdx = t.rows.findIndex((r: any) => String(r[keyCol]) === keyVal);
                        if (existingIdx >= 0) {
                            for (let i = 0; i < cols.length; i++) {
                                t.rows[existingIdx][cols[i]] = String(params[i] || "");
                            }
                            self._save(tableName);
                            return { changes: 1, lastInsertRowid: t.rows[existingIdx].id || 0 };
                        }
                    }
                    const row: Record<string, any> = {};
                    let id = 0;
                    for (let i = 0; i < cols.length; i++) {
                        const v = params[i] !== undefined ? String(params[i]) : "";
                        row[cols[i]] = v;
                        if (cols[i] === "id" && params[i]) id = Number(params[i]);
                    }
                    if (!id) {
                        id = t.nextId++;
                        row["id"] = id;
                    }
                    t.rows.push(row);
                    self._save(tableName);
                    return { changes: 1, lastInsertRowid: id };
                }
            };
        }

        // SELECT * FROM <table> [WHERE ...] [ORDER BY ...]
        const selRe = /SELECT\s+\*\s+FROM\s+(\w+)/i;
        const sm = trimmed.match(selRe);
        if (sm) {
            const tableName = sm[1];
            // 先分离 ORDER BY
            let whereClause: string | null = null;
            let orderCol: string | null = null;
            let orderDir = "ASC";
            const hasOrder = /ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i.exec(trimmed);
            if (hasOrder) {
                orderCol = hasOrder[1];
                orderDir = (hasOrder[2] || "ASC").toUpperCase();
            }
            // WHERE 是 ORDER BY 之前的部分
            const hasWhere = /WHERE\s+(.+?)(?:\s+ORDER\s+BY|$)/i.exec(trimmed);
            whereClause = hasWhere ? hasWhere[1].trim() : null;

            return {
                all: function (...params: any[]): any[] {
                    const t = self.tables[tableName];
                    if (!t) return [];
                    let rows = t.rows.slice();
                    if (whereClause) {
                        rows = self._filter(rows, whereClause, params);
                    }
                    if (orderCol) {
                        rows.sort((a: any, b: any) => {
                            const va = a[orderCol]; const vb = b[orderCol];
                            if (va < vb) return orderDir === "ASC" ? -1 : 1;
                            if (va > vb) return orderDir === "ASC" ? 1 : -1;
                            return 0;
                        });
                    }
                    // Convert numeric strings back
                    return rows.map((r: any) => {
                        const out: Record<string, any> = {};
                        for (const k of Object.keys(r)) {
                            const v = r[k];
                            out[k] = (!isNaN(Number(v))) ? Number(v) : v;
                        }
                        return out;
                    });
                },
                get: function (...params: any[]): any | undefined {
                    const all = this.all.apply(this, params);
                    return all.length > 0 ? all[0] : undefined;
                },
                run: function (...params: any[]): any {
                    const all = this.all.apply(this, params);
                    return { changes: all.length };
                }
            };
        }

        // UPDATE table SET ...
        const updRe = /UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i;
        const um = trimmed.match(updRe);
        if (um) {
            const tableName = um[1];
            const setClause = um[2];
            const whereClause = um[3] || null;
            const setPairs = setClause.split(",").map((s: string) => s.trim());
            const setMap: Record<string, string> = {};
            for (const pair of setPairs) {
                const eqIdx = pair.indexOf("=");
                if (eqIdx >= 0) {
                    setMap[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
                }
            }
            return {
                run: function (...params: any[]) {
                    const t = self.tables[tableName];
                    if (!t) return { changes: 0 };
                    let matched = 0;
                    // collect setMap columns to know the order
                    const setCols = Object.keys(setMap);
                    let pi = 0; // param index for SET ? placeholders
                    // build the actual set values map with params substituted
                    const actualSet: Record<string, string> = {};
                    for (const col of setCols) {
                        let val = setMap[col];
                        if (val === "?") {
                            val = String(params[pi] !== undefined ? params[pi] : "");
                            pi++;
                        }
                        actualSet[col] = val;
                    }
                    for (const row of t.rows) {
                        if (self._rowMatch(row, whereClause, params.slice(pi))) {
                            for (const col of setCols) {
                                row[col] = actualSet[col];
                            }
                            matched++;
                        }
                    }
                    if (matched > 0) self._save(tableName);
                    return { changes: matched };
                }
            };
        }

        // DELETE FROM
        const delRe = /DELETE\s+FROM\s+(\w+)/i;
        const dm = trimmed.match(delRe);
        if (dm) {
            const tableName = dm[1];
            return {
                run: function (...params: any[]) {
                    const t = self.tables[tableName];
                    if (!t) return { changes: 0 };
                    const before = t.rows.length;
                    t.rows = t.rows.filter((r: any) => {
                        if (params.length > 0) {
                            for (const key of Object.keys(r)) {
                                if (String(r[key]) === String(params[0])) return false;
                            }
                        }
                        return true;
                    });
                    const removed = before - t.rows.length;
                    if (removed > 0) self._save(tableName);
                    return { changes: removed };
                }
            };
        }

        // COUNT
        const countRe = /SELECT\s+COUNT\s*\(\s*\*\s*\)/i;
        if (countRe.test(trimmed)) {
            const tn = /FROM\s+(\w+)/i.exec(trimmed)?.[1];
            const t = tn ? this.tables[tn] : null;
            return {
                get: function (): any {
                    return { cnt: t ? t.rows.length : 0 };
                }
            };
        }

        return this._noop();
    }

    // Private helpers
    private _noop(): any {
        return { all: (): any[] => [], get: (): any => undefined, run: (): any => ({ changes: 0 }) };
    }

    private _save(tableName: string): void {
        const t = this.tables[tableName];
        if (!t) return;
        writeFileSync(join(this.dbDir, tableName + ".json"), JSON.stringify(t.rows, null, 2), "utf8");
    }

    private _filter(rows: Record<string, any>[], where: string, params: any[]): Record<string, any>[] {
        // Simplified filter: split on AND, handle col = value or col = ?
        return rows.filter(r => this._rowMatch(r, where, [...params]));
    }

    private _rowMatch(row: Record<string, any>, where: string | null, params: any[]): boolean {
        if (!where) return true;
        // 支持 OR 分割（顶层 OR）
        const orParts = where.split(/\s+OR\s+/i);
        for (const orPart of orParts) {
            if (this._andMatch(row, orPart, params)) return true;
        }
        return false;
    }

    private _andMatch(row: Record<string, any>, where: string, params: any[], paramOffset = { i: 0 }): boolean {
        const parts = where.split(/\s+AND\s+/i);
        let pi = 0;
        for (const part of parts) {
            // LIKE 运算符: col LIKE ?
            const likeMatch = part.match(/^(\w+)\s+LIKE\s+\?$/i);
            if (likeMatch) {
                const col = likeMatch[1];
                const pattern = String(params[pi++]);
                // SQL LIKE: % → .*, _ → .
                const regex = pattern.replace(/%/g, ".*").replace(/_/g, ".");
                if (!new RegExp(regex, "i").test(String(row[col] || ""))) return false;
                continue;
            }
            // = 运算符
            const eqIdx = part.indexOf("=");
            if (eqIdx < 0) continue;
            const col = part.substring(0, eqIdx).trim();
            const val = part.substring(eqIdx + 1).trim();
            let expected = val.replace(/['"]/g, "");
            if (val === "?" || (params.length > 0 && pi < params.length)) {
                expected = String(params[pi++]);
            }
            if (String(row[col]) !== String(expected)) return false;
        }
        return true;
    }
}

export { FileDB as default };