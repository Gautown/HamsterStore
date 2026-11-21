// Setting Repository — 应用设置 CRUD
// 注意：Windows GUI 构建下 prepare().get(key) 会原生崩溃（Perry 0.5.1520），
// 因此读取路径统一走 FileDB.getRows() 内存扫描，只保留写操作走 SQL。
import { safePrepare, getDatabase } from "../Database";
import type { Setting } from "../models/Setting";

function findRow(key: string): Setting | undefined {
    const rows: any[] = getDatabase().getRows("settings");
    for (let i = 0; i < rows.length; i++) {
        if (rows[i] && String(rows[i].key) === key) {
            return rows[i] as Setting;
        }
    }
    return undefined;
}

export const SettingRepository = {
    getAll(): Setting[] {
        return getDatabase().getRows("settings") as Setting[];
    },

    getByKey(key: string): Setting | undefined {
        return findRow(key);
    },

    getValue(key: string): string {
        const row = findRow(key);
        if (!row || row.value === undefined || row.value === null) return "";
        return String(row.value);
    },

    setValue(key: string, value: string): void {
        safePrepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))")
            .run(key, value);
    },

    deleteByKey(key: string): void {
        safePrepare("DELETE FROM settings WHERE key = ?").run(key);
    },
};