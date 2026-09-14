// FileDB — 纯 TS 文件存储，支持基本 SQL 语法（v2）
// v2 修复（真实二进制实测发现的致命 bug）：
//   1. SELECT 参数时序：参数必须在 .get(...)/.all(...)/.run(...) 调用时捕获，
//      prepare 时刻的 arguments 永远为空 → WHERE ? 全部匹配失败（getById 一直是 undefined）
//   2. 补 UPDATE/DELETE 分支：此前走 _noop，updateStatus/markDone/deleteById 全部静默失效
//   3. INSERT 混合字面量：VALUES (?, ?, 0.0) 中字面量被丢弃 → 按 ? 序数对位填充
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
                        const rid = Number(rows[i].id) || 0;
                        if (rid > maxId) maxId = rid;
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

        // ==================== INSERT ====================
        if (upper.indexOf("INSERT") === 0) {
            const intoIdx = upper.indexOf("INTO ");
            if (intoIdx < 0) return this._noop();

            let tableName = "";
            for (let i = intoIdx + 5; i < trimmed.length; i++) {
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

            // VALUES 部分的项（区分 ? 占位与字面量）
            const valuesOpen = trimmed.indexOf("(", parenClose);
            const valuesClose = trimmed.lastIndexOf(")");
            let valueTokens: string[] = [];
            if (valuesOpen >= 0 && valuesClose > valuesOpen) {
                const valsStr = trimmed.substring(valuesOpen + 1, valuesClose);
                valueTokens = valsStr.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
            }

            return {
                run: function (...runArgs: any[]) {
                    const t = self.tables[tableName];
                    if (!t) return { changes: 0, lastInsertRowid: 0 };

                    let id = t.nextId++;
                    const row: any = {};
                    for (let i = 0; i < cols.length; i++) {
                        const tok = valueTokens[i];
                        if (tok === "?") {
                            row[cols[i]] = runArgs.length > 0 ? String(runArgs.shift()) : "";
                        } else {
                            // 字面量（数字/字符串），去掉引号
                            row[cols[i]] = tok !== undefined ? tok.replace(/^'|'$/g, "").replace(/^"|"$/g, "") : "";
                        }
                    }
                    if (cols.indexOf("id") < 0) row["id"] = String(id);

                    t.rows.push(row);
                    self._save(tableName);
                    return { changes: 1, lastInsertRowid: id };
                }
            };
        }

        // ==================== UPDATE ====================
        if (upper.indexOf("UPDATE") === 0) {
            const setIdx = upper.indexOf(" SET ");
            const whereIdx = upper.indexOf("WHERE ");
            if (setIdx < 0) return this._noop();

            let tableName = "";
            for (let i = 6; i < setIdx; i++) tableName += trimmed[i];

            // SET 子句：col = ?, col2 = ?（支持字面量）
            const setClause = whereIdx > 0
                ? trimmed.substring(setIdx + 5, whereIdx).trim()
                : trimmed.substring(setIdx + 5).trim();
            const setPairs = setClause.split(",").map((s: string) => s.trim()).filter(Boolean);
            const setCols = setPairs.map((p: string) => p.split("=")[0].trim());
            const setToks = setPairs.map((p: string) => (p.split("=")[1] || "").trim());

            // WHERE 子句（单条件 col = ?）
            let whereCol: string | null = null;
            if (whereIdx > 0) {
                const w = trimmed.substring(whereIdx + 6).trim();
                const eqIdx = w.indexOf("=");
                if (eqIdx > 0) whereCol = w.substring(0, eqIdx).trim();
            }

            return {
                run: function (...runArgs: any[]) {
                    const t = self.tables[tableName.trim()];
                    if (!t) return { changes: 0 };
                    let changes = 0;
                    // 最后一个参数留给 WHERE，其余按 SET ? 顺序
                    const whereVal = whereCol ? String(runArgs[runArgs.length - 1]) : null;
                    const setVals = whereCol ? runArgs.slice(0, runArgs.length - 1) : runArgs;

                    for (let i = 0; i < t.rows.length; i++) {
                        const row = t.rows[i];
                        let match = true;
                        if (whereCol && whereVal !== null) {
                            match = String(row[whereCol]) === whereVal;
                        }
                        if (match) {
                            let vi = 0;
                            for (let c = 0; c < setCols.length; c++) {
                                if (setToks[c] === "?") {
                                    row[setCols[c]] = vi < setVals.length ? String(setVals[vi++]) : "";
                                } else {
                                    row[setCols[c]] = setToks[c].replace(/^'|'$/g, "");
                                }
                            }
                            changes++;
                        }
                    }
                    if (changes > 0) self._save(tableName.trim());
                    return { changes };
                }
            };
        }

        // ==================== DELETE ====================
        if (upper.indexOf("DELETE") === 0) {
            const fromIdx = upper.indexOf("FROM ");
            if (fromIdx < 0) return this._noop();

            let tableName = "";
            for (let i = fromIdx + 5; i < trimmed.length; i++) {
                const c = trimmed[i];
                if (c === " " || c === "\t" || c === "\n") break;
                tableName += c;
            }

            let whereCol: string | null = null;
            const whereIdx = upper.indexOf("WHERE ");
            if (whereIdx > 0) {
                const w = trimmed.substring(whereIdx + 6).trim();
                const eqIdx = w.indexOf("=");
                if (eqIdx > 0) whereCol = w.substring(0, eqIdx).trim();
            }

            return {
                run: function (...runArgs: any[]) {
                    const t = self.tables[tableName];
                    if (!t) return { changes: 0 };
                    if (!whereCol) {
                        const n = t.rows.length;
                        t.rows = [];
                        self._save(tableName);
                        return { changes: n };
                    }
                    const whereVal = String(runArgs[0]);
                    const kept: any[] = [];
                    let removed = 0;
                    for (let i = 0; i < t.rows.length; i++) {
                        if (String(t.rows[i][whereCol!]) === whereVal) {
                            removed++;
                        } else {
                            kept.push(t.rows[i]);
                        }
                    }
                    t.rows = kept;
                    if (removed > 0) self._save(tableName);
                    return { changes: removed };
                }
            };
        }

        // ==================== SELECT ====================
        if (upper.indexOf("SELECT") === 0) {
            const fromIdx = upper.indexOf("FROM ");
            if (fromIdx < 0) return this._noop();

            let tableName = "";
            for (let i = fromIdx + 5; i < trimmed.length; i++) {
                const c = trimmed[i];
                if (c === " " || c === "\t" || c === "\n") break;
                tableName += c;
            }

            const t = this.tables[tableName];
            if (!t) return this._noop();

            // WHERE clause（支持 AND 多条件，单/多 ?）
            let whereClause: string | null = null;
            const whereIdx = upper.indexOf("WHERE ");
            if (whereIdx > fromIdx) {
                let whereEnd = upper.indexOf(" ORDER", whereIdx);
                if (whereEnd < 0) whereEnd = upper.indexOf(" LIMIT", whereIdx);
                if (whereEnd < 0) whereEnd = upper.length;
                whereClause = trimmed.substring(whereIdx + 6, whereEnd).trim();
            }

            // ORDER BY
            let orderCol: string | null = null;
            let orderDir = "ASC";
            const orderIdx = upper.indexOf(" ORDER");
            if (orderIdx > 0) {
                let orderStart = orderIdx + 6;
                while (orderStart < upper.length && upper[orderStart] === " ") orderStart++;
                let orderStr = "";
                for (let i = orderStart; i < trimmed.length; i++) {
                    if (upper.startsWith("LIMIT", i)) break;
                    orderStr += trimmed[i];
                }
                const parts = orderStr.trim().split(/\s+/);
                if (parts.length >= 1) orderCol = parts[0];
                if (parts.length >= 2) orderDir = parts[1].toUpperCase();
            }

            // LIMIT
            let limitVal: number | null = null;
            const limitIdx = upper.indexOf(" LIMIT");
            if (limitIdx >= 0) {
                let limitStr = "";
                for (let i = limitIdx + 6; i < trimmed.length; i++) {
                    const c = trimmed[i];
                    if (c === " " || c === "\t") break;
                    limitStr += c;
                }
                limitVal = parseInt(limitStr, 10);
                if (isNaN(limitVal)) limitVal = null;
            }

            // 条件结构解析（AND 分隔的 col = ? 列表）
            const conditions: Array<{ col: string; val: any; isLike: boolean }> = [];
            if (whereClause) {
                const andParts = whereClause.split(/\s+AND\s+/i);
                let paramCursor = 0;
                for (const part of andParts) {
                    const likeM = part.match(/^(.+?)\s+LIKE\s+\?$/i);
                    if (likeM) {
                        conditions.push({ col: likeM[1].trim(), val: paramCursor++, isLike: true });
                        continue;
                    }
                    const eqM = part.match(/^(.+?)\s*=\s*(\?|'[^']*'|"[^"]*"|\d+)$/i);
                    if (eqM) {
                        conditions.push({ col: eqM[1].trim(), val: eqM[2], isLike: false });
                    }
                }
                // ? 在条件中的顺序即参数顺序；非 ? 字面量直接用值
            }

            // 关键修复：参数在调用时捕获（.get/.all/.run 的实参），
            // prepare 时刻的 arguments 永远为空
            return {
                all: function (...callArgs: any[]) {
                    let rows: any[] = [];
                    const src = t.rows;
                    for (let i = 0; i < src.length; i++) rows[i] = src[i];

                    if (conditions.length > 0) {
                        // ? 的序数 → callArgs 对位
                        let qIndex = 0;
                        const resolved = conditions.map((c) => {
                            if (c.val === "?") return { ...c, val: callArgs[qIndex++] };
                            if (typeof c.val === "string" && c.val !== "?" && !/^\d+$/.test(c.val)) {
                                return { ...c, val: c.val.replace(/^['"]|['"]$/g, "") };  // 字面量
                            }
                            return c;
                        });
                        const filtered: any[] = [];
                        for (let i = 0; i < rows.length; i++) {
                            const r = rows[i];
                            let ok = true;
                            for (const cond of resolved) {
                                const cell = String(r ? r[cond.col] : "");
                                const want = String(cond.val);
                                if (cond.isLike ? !cell.includes(want) : cell !== want) {
                                    ok = false;
                                    break;
                                }
                            }
                            if (ok) filtered.push(r);
                        }
                        rows = filtered;
                    }

                    if (orderCol) {
                        rows.sort((a: any, b: any) => {
                            const va = String(a[orderCol!] || "").toLowerCase();
                            const vb = String(b[orderCol!] || "").toLowerCase();
                            return orderDir === "DESC" ? vb.localeCompare(va) : va.localeCompare(vb);
                        });
                    }

                    if (limitVal !== null) {
                        rows = rows.slice(0, limitVal);
                    }
                    return rows;
                },
                get: function (...callArgs: any[]) {
                    const rows = this.all(...callArgs);
                    return rows.length > 0 ? rows[0] : undefined;
                },
                run: function (...callArgs: any[]) {
                    const rows = this.all(...callArgs);
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
