// InstallationRepository — 安装记录 CRUD
import { safePrepare } from "../Database";
import type { Installation } from "../models/Installation";

export const InstallationRepository = {
    getAll(): Installation[] {
        return safePrepare("SELECT * FROM installations ORDER BY install_date DESC").all() as Installation[];
    },

    getById(id: number): Installation | undefined {
        return safePrepare("SELECT * FROM installations WHERE id = ?").get(id) as Installation | undefined;
    },

    getByPackageId(packageId: number): Installation | undefined {
        return safePrepare("SELECT * FROM installations WHERE package_id = ? AND status = 1").get(packageId) as Installation | undefined;
    },

    getInstalled(): Installation[] {
        return safePrepare("SELECT * FROM installations WHERE status = 1 ORDER BY install_date DESC").all() as Installation[];
    },

    getUpdatable(): Installation[] {
        return safePrepare("SELECT * FROM installations WHERE status = 1 AND update_available = 1").all() as Installation[];
    },

    create(packageId: number, version: string, installPath: string): Installation {
        const nextId = this.count() + 1;
        safePrepare(
            "INSERT INTO installations (id, package_id, installed_version, install_path, install_date) VALUES (?, ?, ?, ?, datetime('now'))"
        ).run(nextId, packageId, version, installPath);
        return this.getById(nextId)!;
    },

    markUninstalled(id: number): void {
        safePrepare("UPDATE installations SET status = 0 WHERE id = ?").run(id);
    },

    count(): number {
        const all = this.getAll();
        return all.length;
    }
};