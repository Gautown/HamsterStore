// InstallManager — 完整软件安装/卸载/进程检测生命周期
// 支持 Windows .exe / .msi / .zip 安装，taskkill 卸载，进程列表
// perry v0.5.1220 不支持 async/await → 全同步实现

import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { InstallationRepository, PackageRepository } from "../../data";
import type { Installation } from "../../data/models/Installation";

export class InstallManager {
    // 1. .exe 安装程序（等待完成）
    static installExe(installerPath: string): boolean {
        try {
            execSync('start "" /wait "' + installerPath + '"', {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 120000,
            });
            return true;
        } catch (e) {
            console.log("[Install] .exe failed: " + (e as Error).message);
            return false;
        }
    }

    // 2. .msi 安装（msiexec 静默）
    static installMsi(msiPath: string): boolean {
        try {
            execSync('msiexec /i "' + msiPath + '" /qn /norestart', {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 120000,
            });
            return true;
        } catch (e) {
            console.log("[Install] .msi failed: " + (e as Error).message);
            return false;
        }
    }

    // 3. .zip 解压安装
    static installZip(zipUrl: string, destDir: string): boolean {
        try {
            const tempZip = join(destDir, "_hamster_dl.zip");
            // curl 下载（单引号包裹 URL 避免 shell 转义）
            execSync("curl -sS -L --ssl-no-revoke --max-time 120 -o '" + tempZip + "' '" + zipUrl + "'", {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 120000,
            });
            // PowerShell 解压
            execSync("powershell -Command \"Expand-Archive -Path '" + tempZip + "' -DestinationPath '" + destDir + "' -Force\"", {
                stdio: "pipe",
                timeout: 30000,
            });
            // 清理
            try { execSync('rm -f "' + tempZip + '"', { stdio: "pipe", timeout: 2000 }); } catch {}
            return true;
        } catch (e) {
            console.log("[Install] .zip failed: " + (e as Error).message);
            return false;
        }
    }

    // 安装一个软件包（主流程 — 同步）
    static install(packageId: number, filePath?: string): Installation | null {
        const pkg = PackageRepository.getById(packageId);
        if (!pkg) {
            console.log("[Install] Package #" + packageId + " not found");
            return null;
        }

        const downloadUrl = filePath || pkg.download_url || pkg.project_url || "";
        if (!downloadUrl) {
            console.log("[Install] No download URL for " + pkg.name);
            return null;
        }

        // 根据文件后缀路由
        const ext = (downloadUrl.split(".").pop() || "").toLowerCase();
        let success = false;

        if (ext === "exe") success = InstallManager.installExe(downloadUrl);
        else if (ext === "msi") success = InstallManager.installMsi(downloadUrl);
        else if (ext === "zip") {
            const pkgName = (pkg.name || "").replace(/[\/\\]/g, "_") || "package_" + pkg.id;
            const pkgDir = join(getAppDataDir(), pkgName);
            mkdirSync(pkgDir, { recursive: true });
            success = InstallManager.installZip(downloadUrl, pkgDir);
        } else {
            // 通用：打开浏览器下载
            try {
                const child = spawn("rundll32", ["url.dll,FileProtocolHandler", downloadUrl], {
                    detached: true, stdio: "ignore",
                });
                child.unref();
                success = true;
            } catch {}
        }

        if (success) {
            return InstallationRepository.create(packageId, pkg.version || "", downloadUrl);
        }
        return null;
    }

    // 卸载
    static uninstall(packageId: number): boolean {
        try {
            const inst = InstallationRepository.getByPackageId(packageId);
            if (!inst) return false;
            const pkg = PackageRepository.getById(packageId);
            if (!pkg) return false;

            const nameHint = (pkg.name || "").split("/").pop() || pkg.name || "";
            try {
                execSync('taskkill /F /IM "' + nameHint + '.exe"', { stdio: "pipe" });
            } catch {
                // 进程不在运行
            }

            InstallationRepository.markUninstalled(packageId);
            return true;
        } catch (e) {
            console.log("[Uninstall] Failed: " + (e as Error).message);
            return false;
        }
    }

    // 进程检测 — 查看目标软件是否运行中
    static isRunning(nameHint: string): boolean {
        try {
            const cmd = 'tasklist /FI "IMAGENAME eq ' + nameHint + '.exe" /FO CSV /NH';
            const out = execSync(cmd, {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 5000,
            }) as unknown as Buffer;
            const text = out.toString("utf8");
            return text.length > 0 && !text.includes("INFO: No tasks");
        } catch {
            return false;
        }
    }
}

function getAppDataDir(): string {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || join(process.cwd(), "appdata");
    const dir = join(base, "HamsterStore");
    mkdirSync(dir, { recursive: true });
    return dir;
}