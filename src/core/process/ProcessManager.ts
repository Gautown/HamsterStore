// ProcessManager v2 — 进程管理（Windows 平台）
// v2 变更（Perry 0.5.1665 合规审计，2026-11-19）：
//   1. execSync 捕获 stdout 在 Perry 二进制不可靠 → cmd /c 重定向到文件 + 轮询
//   2. listProcesses/isRunning 改回调式；killByName 改 spawn 数组（尽力而为）
//   3. class → 对象字面量（上游 #14982 预防）

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export interface ProcessInfo {
    name: string;
    pid: number;
    memKB: number;
}

function tmpDir(): string {
    const dir = join(process.env.TEMP || process.env.TMP || ".", "hamsterstore_install");
    try { mkdirSync(dir, { recursive: true }); } catch {}
    return dir;
}

function parseTasklistCsv(text: string): ProcessInfo[] {
    const lines = text.split("\n");
    const procs: ProcessInfo[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const cols = trimmed.split(",").map(c => c.replace(/^"|"$/g, "").trim());
        if (cols.length < 2) continue;
        const name = cols[0];
        const pid = parseInt(cols[1], 10) || 0;
        const memKB = parseInt((cols[4] || "").replace(/[^\d.]+/g, ""), 10) || 0;
        if (pid > 0) procs.push({ name, pid, memKB });
    }
    return procs;
}

export const ProcessManager = {
    // 列出所有运行进程（回调式：tasklist 输出重定向到文件 + 轮询）
    listProcesses(onDone: (procs: ProcessInfo[]) => void): void {
        const outFile = join(tmpDir(), "procs_" + Date.now().toString(36) + ".csv");
        try {
            const child = spawn("cmd", ["/c", 'tasklist /FO CSV /NH > "' + outFile + '"'], { detached: true, stdio: "ignore" });
            try { child.unref(); } catch {}
        } catch {
            onDone([]);
            return;
        }
        const start = Date.now();
        const timer = setInterval(() => {
            let text = "";
            try { if (existsSync(outFile)) text = readFileSync(outFile, "utf8"); } catch {}
            if (text.length > 0) {
                clearInterval(timer);
                try { unlinkSync(outFile); } catch {}
                onDone(parseTasklistCsv(text));
                return;
            }
            if (Date.now() - start > 10000) {
                clearInterval(timer);
                try { unlinkSync(outFile); } catch {}
                onDone([]);
            }
        }, 300);
    },

    // 按名称杀死进程（spawn 数组，尽力而为；不等待结果）
    killByName(name: string): boolean {
        try {
            const child = spawn("taskkill", ["/F", "/IM", name], { detached: true, stdio: "ignore" });
            try { child.unref(); } catch {}
            return true;
        } catch {
            return false;
        }
    },

    // 检查进程是否运行（回调式）
    isRunning(name: string, onDone: (running: boolean) => void): void {
        ProcessManager.listProcesses((procs) => {
            const lower = name.toLowerCase();
            onDone(procs.some(p => p.name.toLowerCase().includes(lower)));
        });
    },
};
