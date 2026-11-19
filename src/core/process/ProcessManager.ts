// ProcessManager — 进程管理（Windows 平台）
// 列出运行中的进程、杀死进程、监视已安装软件运行状态

import { execSync } from "node:child_process";

export class ProcessManager {
    // 列出所有运行进程
    listProcesses(): { name: string; pid: number; memKB: number }[] {
        // tasklist /FO CSV → 解析列
        const out = execSync("tasklist /FO CSV /NH", {
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 10000,
        }) as unknown as Buffer;
        const text = out.toString("utf8");
        const lines = text.split("\n");
        const procs: { name: string; pid: number; memKB: number }[] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const cols = trimmed.split(",").map(c => c.replace(/^"|"$/g, "").trim());
            if (cols.length < 2) continue;
            const name = cols[0];
            const pid = parseInt(cols[1], 10) || 0;
            const memKB = parseInt(cols[4]?.replace(/[^\d.]+/g, ""), 10) || 0;
            if (pid > 0) procs.push({ name, pid, memKB });
        }
        return procs;
    }

    // 按名称杀死进程
    killByName(name: string): boolean {
        try {
            execSync(`taskkill /F /IM "${name}"`, {
                stdio: "pipe",
                timeout: 5000,
            });
            return true;
        } catch {
            return false;
        }
    }

    // 检查进程是否运行
    isRunning(name: string): boolean {
        const procs = this.listProcesses();
        return procs.some(p => p.name.toLowerCase().includes(name.toLowerCase()));
    }
}