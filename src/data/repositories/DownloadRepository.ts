// Download Repository — 下载任务 CRUD
import { safePrepare } from "../Database";
import type { DownloadTask } from "../models/DownloadTask";

export const DownloadRepository = {
    getAll(): DownloadTask[] {
        return safePrepare("SELECT * FROM download_tasks ORDER BY created_at DESC").all() as DownloadTask[];
    },

    getById(id: number): DownloadTask | undefined {
        return safePrepare("SELECT * FROM download_tasks WHERE id = ?").get(id) as DownloadTask | undefined;
    },

    getActive(): DownloadTask[] {
        return safePrepare("SELECT * FROM download_tasks WHERE status IN ('waiting','downloading') ORDER BY created_at").all() as DownloadTask[];
    },

    create(data: { url: string; package_id: number; status?: string }): DownloadTask {
        safePrepare(
            "INSERT INTO download_tasks (package_id, url, status, progress) VALUES (?, ?, ?, 0.0)"
        ).run(data.package_id, data.url, data.status || "waiting");
        // FileDB 自增 id：取全表最大 id（create 后即新行）
        const all = this.getAll();
        let maxId = 0;
        for (const t of all) {
            const tid = Number(t.id) || 0;
            if (tid > maxId) maxId = tid;
        }
        return this.getById(maxId)!;
    },

    updateStatus(id: number, status: string, progress: number = 0): void {
        safePrepare("UPDATE download_tasks SET status = ?, progress = ? WHERE id = ?").run(status, progress, id);
    },

    markDone(id: number): void {
        this.updateStatus(id, "done", 100);
    },

    markFailed(id: number): void {
        this.updateStatus(id, "failed", 0);
    },

    deleteById(id: number): void {
        safePrepare("DELETE FROM download_tasks WHERE id = ?").run(id);
    },

    clearAll(): void {
        safePrepare("DELETE FROM download_tasks").run();
    },

    count(): number {
        const all = this.getAll();
        return all.length;
    }
};
