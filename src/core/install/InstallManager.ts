// InstallManager v2 — 软件安装/卸载/进程检测生命周期
// v2 变更（Perry 0.5.1665 合规审计，2026-11-19）：
//   1. execSync 拼字符串（引号变字面量/& 拆参/> 不重定向，Perry 下必挂）
//      → spawn 数组 / cmd /c 内部 shell（cmd 自己解析引号与重定向，可靠）
//   2. 子进程完成判定：cmd /c "命令 && echo ok > marker || echo fail > marker"
//      + setInterval 轮询 marker（与 netFetch 同源模式，零子进程事件回调依赖）
//   3. install/isRunning 改回调式（Perry 无 async/await，忙等会饿死事件循环）
//   4. class → 对象字面量（上游 #14982 预防：方法闭包带 GC roots）
//   5. 修复 markUninstalled(packageId) → markUninstalled(inst.id)（原实现标错行）
//   6. zip 下载换 netDownload（完整性校验 + 镜像加速）

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { InstallationRepository, PackageRepository } from "../../data";
import type { Installation } from "../../data/models/Installation";
import { netDownload } from "../net/netFetch";

function tmpDir(): string {
    const dir = join(process.env.TEMP || process.env.TMP || ".", "hamsterstore_install");
    try { mkdirSync(dir, { recursive: true }); } catch {}
    return dir;
}

let markerSeq = 0;
function newMarker(): string {
    markerSeq++;
    return join(tmpDir(), "mark_" + Date.now().toString(36) + "_" + markerSeq + ".txt");
}

// 轮询 marker 文件内容（ok/fail），出现即完成
function pollMarker(marker: string, timeoutMs: number, onDone: (ok: boolean) => void): void {
    const start = Date.now();
    const timer = setInterval(() => {
        let content = "";
        try { if (existsSync(marker)) content = readFileSync(marker, "utf8").trim(); } catch {}
        if (content.length > 0) {
            clearInterval(timer);
            try { unlinkSync(marker); } catch {}
            onDone(content.indexOf("ok") === 0);
            return;
        }
        if (Date.now() - start > timeoutMs) {
            clearInterval(timer);
            try { unlinkSync(marker); } catch {}
            onDone(false);
        }
    }, 400);
}

// 经 cmd /c 执行命令（cmd 内部解析引号/重定向），结果写 marker 后轮询
function runCmdMarked(command: string, timeoutMs: number, onDone: (ok: boolean) => void): void {
    const marker = newMarker();
    const full = command + ' && echo ok > "' + marker + '" || echo fail > "' + marker + '"';
    try {
        const child = spawn("cmd", ["/c", full], { detached: true, stdio: "ignore" });
        try { child.unref(); } catch {}
    } catch {
        onDone(false);
        return;
    }
    pollMarker(marker, timeoutMs, onDone);
}

function getAppDataDir(): string {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || join(process.cwd(), "appdata");
    const dir = join(base, "HamsterStore");
    mkdirSync(dir, { recursive: true });
    return dir;
}

export const InstallManager = {
    // 1. .exe 安装程序（等待完成，10 分钟预算）
    installExe(installerPath: string, onDone: (ok: boolean) => void): void {
        runCmdMarked('start "" /wait "' + installerPath + '"', 600000, onDone);
    },

    // 2. .msi 安装（msiexec 静默，cmd 内同步等待）
    installMsi(msiPath: string, onDone: (ok: boolean) => void): void {
        runCmdMarked('msiexec /i "' + msiPath + '" /qn /norestart', 600000, onDone);
    },

    // 3. .zip 下载解压安装（netDownload 完整性校验 + PowerShell Expand-Archive）
    installZip(zipUrl: string, destDir: string, onDone: (ok: boolean) => void): void {
        const tempZip = join(destDir, "_hamster_dl.zip");
        netDownload(zipUrl, tempZip, { timeoutMs: 300000 },
            () => {},
            (ok: boolean, bytes: number) => {
                if (!ok || bytes <= 0) { onDone(false); return; }
                const ps = "Expand-Archive -Path '" + tempZip + "' -DestinationPath '" + destDir + "' -Force";
                runCmdMarked('powershell -NoProfile -ExecutionPolicy Bypass -Command "' + ps + '"', 120000, (ok2: boolean) => {
                    try { unlinkSync(tempZip); } catch {}
                    onDone(ok2);
                });
            });
    },

    // 安装一个软件包（主流程 — 回调式）
    install(packageId: number, filePath: string | undefined, onDone: (inst: Installation | null) => void): void {
        const pkg = PackageRepository.getById(packageId);
        if (!pkg) {
            console.log("[Install] Package #" + packageId + " not found");
            onDone(null);
            return;
        }
        const downloadUrl = filePath || pkg.download_url || pkg.project_url || "";
        if (!downloadUrl) {
            console.log("[Install] No download URL for " + pkg.name);
            onDone(null);
            return;
        }

        const finish = (success: boolean): void => {
            if (success) {
                onDone(InstallationRepository.create(packageId, pkg.version || "", downloadUrl));
            } else {
                onDone(null);
            }
        };

        // 根据文件后缀路由
        const ext = (downloadUrl.split(".").pop() || "").toLowerCase();
        if (ext === "exe") InstallManager.installExe(downloadUrl, finish);
        else if (ext === "msi") InstallManager.installMsi(downloadUrl, finish);
        else if (ext === "zip") {
            const pkgName = (pkg.name || "").replace(/[\/\\]/g, "_") || ("package_" + pkg.id);
            const pkgDir = join(getAppDataDir(), pkgName);
            mkdirSync(pkgDir, { recursive: true });
            InstallManager.installZip(downloadUrl, pkgDir, finish);
        } else {
            // 通用：打开浏览器下载（spawn 数组 fire-and-forget）
            try {
                const child = spawn("cmd", ["/c", "start", "", downloadUrl], { detached: true, stdio: "ignore" });
                try { child.unref(); } catch {}
                finish(true);
            } catch {
                finish(false);
            }
        }
    },

    // 卸载（taskkill 尽力而为 + 安装记录标记；同步）
    uninstall(packageId: number): boolean {
        try {
            const inst = InstallationRepository.getByPackageId(packageId);
            if (!inst) return false;
            const pkg = PackageRepository.getById(packageId);
            if (!pkg) return false;
            const nameHint = (pkg.name || "").split("/").pop() || pkg.name || "";
            try {
                const child = spawn("taskkill", ["/F", "/IM", nameHint + ".exe"], { detached: true, stdio: "ignore" });
                try { child.unref(); } catch {}
            } catch {
                // 进程不在运行
            }
            InstallationRepository.markUninstalled(inst.id);
            return true;
        } catch (e) {
            console.log("[Uninstall] Failed: " + (e as Error).message);
            return false;
        }
    },

    // 进程检测（tasklist 输出经 cmd 重定向到文件 + 轮询；回调式）
    isRunning(nameHint: string, onDone: (running: boolean) => void): void {
        const outFile = newMarker();
        const full = 'tasklist /FI "IMAGENAME eq ' + nameHint + '.exe" /FO CSV /NH > "' + outFile + '"';
        try {
            const child = spawn("cmd", ["/c", full], { detached: true, stdio: "ignore" });
            try { child.unref(); } catch {}
        } catch {
            onDone(false);
            return;
        }
        const start = Date.now();
        const timer = setInterval(() => {
            let text = "";
            try { if (existsSync(outFile)) text = readFileSync(outFile, "utf8"); } catch {}
            if (text.length > 0) {
                clearInterval(timer);
                try { unlinkSync(outFile); } catch {}
                onDone(text.indexOf("INFO: No tasks") < 0);
                return;
            }
            if (Date.now() - start > 8000) {
                clearInterval(timer);
                try { unlinkSync(outFile); } catch {}
                onDone(false);
            }
        }, 300);
    },
};
