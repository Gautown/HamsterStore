// HamsterStore — 文件存储后端
// 完全绕过 perry v0.5.1220 的 better-sqlite3 prepare() stub
// 使用 FileDB（JSON 文件持久化）实现全部 CRUD 操作

import Database from "./FileDB";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

let db: any = null;

function appDataSourceDir(): string {
    // Windows 优先 USERPROFILE/LOCALAPPDATA/APPDATA，跨平台用 HOME 兜底
    const env = process.env;
    const base = env.USERPROFILE || env.LOCALAPPDATA || env.HOME || env.APPDATA || ".";
    return join(base, ".hamsterstore");
}

export function getDatabase(): any {
    if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
    return db;
}

export function initDatabase(dbPath?: string): any {
    if (db) return db;
    // Path resolution: explicit > platform conventions
    let dir: string;
    let finalPath: string;
    if (dbPath) {
        const sep = dbPath.includes("/") ? "/" : "\\";
        dir = dbPath.substring(0, dbPath.lastIndexOf(sep));
        finalPath = dbPath;
    } else {
        dir = appDataSourceDir();
        finalPath = join(dir, "store.db");
    }
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    db = new Database(finalPath);
    console.log("[Database] FileDB loaded — " + dir);
    return db;
}

export function beginTransaction(): void {}
export function commitTransaction(): void {}
export function rollbackTransaction(): void {}

// FileDB prepare() 总是返回有效对象，不再需要 safePrepare
// 但保留兼容导出
export function safePrepare(sql: string): any {
    return getDatabase().prepare(sql);
}