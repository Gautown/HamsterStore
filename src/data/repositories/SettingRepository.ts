// Setting Repository — 应用设置 CRUD
import { safePrepare } from "../Database";
import type { Setting } from "../models/Setting";

export const SettingRepository = {
    getAll(): Setting[] {
        return safePrepare("SELECT * FROM settings ORDER BY key").all() as Setting[];
    },

    getByKey(key: string): Setting | undefined {
        return safePrepare("SELECT * FROM settings WHERE key = ?").get(key) as Setting | undefined;
    },

    getValue(key: string): string {
        const row = this.getByKey(key);
        return row ? row.value : "";
    },

    setValue(key: string, value: string): void {
        safePrepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))")
            .run(key, value);
    },

    deleteByKey(key: string): void {
        safePrepare("DELETE FROM settings WHERE key = ?").run(key);
    },
};