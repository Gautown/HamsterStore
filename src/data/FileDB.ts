// FileDB — 纯 TS 文件存储
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

interface TableData {
    name: string;
    rows: any[];
    nextId: number;
}

export class FileDB {
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
                    const rows = Array.isArray(parsed) ? parsed : [];
                    let maxId = 0;
                    for (let i = 0; i < rows.length; i++) {
                        if (rows[i].id > maxId) maxId = rows[i].id;
                    }
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

    exec(_sql: string): void {}

    prepare(sql: string): any {
        const self = this;
        const trimmed = sql.trim();
        const upper = trimmed.toUpperCase();

        // INSERT parsing
        if (upper.indexOf("INSERT") === 0) {
            const intoIdx = upper.indexOf("INTO ");
            if (intoIdx < 0) return this._noop();
            
            const tableStart = intoIdx + 5;
            let tableName = "";
            for (let i = tableStart; i < trimmed.length; i++) {
                const c = trimmed[i];
                if (c === " " || c === "(" || c === "\t" || c === "\n") break;
                tableName += c;
            }
            
            const parenOpen = trimmed.indexOf("(", intoIdx);
            const parenClose = trimmed.indexOf(")", parenOpen);
            let cols: string[] = [];
            if (parenOpen >= 0 && parenClose > parenOpen) {
                const colsStr = trimmed.substring(parenOpen + 1, parenClose);
                cols = colsStr.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
            }
            
            return {
                run: function (...params: any[]) {
                    const t = self.tables[tableName];
                    if (!t) return { changes: 0, lastInsertRowid: 0 };
                    
                    let id = t.nextId++;
                    const row: any = {};
                    for (let i = 0; i < cols.length; i++) {
                        row[cols[i]] = params[i] !== undefined ? String(params[i]) : "";
                    }
                    if (!row["id"]) row["id"] = String(id);
                    
                    t.rows.push(row);
                    self._save(tableName);
                    return { changes: 1, lastInsertRowid: id };
                }
            };
        }

        // SELECT parsing with WHERE support
        if (upper.indexOf("SELECT") === 0) {
            const fromIdx = upper.indexOf("FROM ");
            if (fromIdx < 0) return this._noop();
            
            let tableName = "";
            for (let i = fromIdx + 5; i < trimmed.length; i++) {
                const c = trimmed[i];
                if (c === " " || c === "\t" || c === "\n") break;
                tableName += c;
            }
            
            const t = self.tables[tableName];
            if (!t) return this._noop();
            
            // Extract WHERE clause
            let whereClause: string | null = null;
            const whereIdx = upper.indexOf("WHERE ");
            if (whereIdx > fromIdx) {
                let whereEnd = upper.indexOf(" ORDER", whereIdx);
                if (whereEnd < 0) whereEnd = upper.indexOf(" LIMIT", whereIdx);
                if (whereEnd < 0) whereEnd = upper.length;
                whereClause = trimmed.substring(whereIdx + 6, whereEnd).trim();
            }
            
            // Parse WHERE condition
            let filterCol: string | null = null;
            let filterVal: string | null = null;
            
            if (whereClause) {
                const eqIdx = whereClause.indexOf(" = ");
                if (eqIdx > 0) {
                    filterCol = whereClause.substring(0, eqIdx).trim();
                    let val = whereClause.substring(eqIdx + 3).trim();
                    // Remove placeholder or quotes
                    if (val.startsWith("?")) {
                        val = String((arguments as any)[0]);
                    } else {
                        val = val.replace(/^'|"|$/g, "");
                    }
                    filterVal = val;
                }
            }
            
            return {
                all: function () {
                    if (!filterCol || !filterVal) return t.rows.slice();
                    return t.rows.filter((r: any) => String(r[filterCol]) === filterVal);
                },
                get: function () {
                    const rows = this.all();
                    return rows.length > 0 ? rows[0] : undefined;
                },
                run: function () { 
                    const rows = this.all();
                    return { changes: rows.length }; 
                }
            };
        }

        return this._noop();
    }

    private _noop(): any {
        return { all: () => [], get: () => undefined, run: () => ({ changes: 0 }) };
    }

    private _save(tableName: string): void {
        const t = this.tables[tableName];
        if (!t) return;
        const path = join(this.dbDir, tableName + ".json");
        const json = JSON.stringify(t.rows, null, 2);
        writeFileSync(path, json, "utf8");
    }
}

export { FileDB as default };
