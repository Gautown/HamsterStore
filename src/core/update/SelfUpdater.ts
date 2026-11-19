// SelfUpdater — 应用自身自动更新
// 检查 GitHub Release 新版本、下载、替换当前进程
// perry v0.5.1220: 全同步实现

import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GitHubAPIClient } from "../sync/GitHubAPIClient";

export interface SelfUpdateInfo {
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    releaseNotes: string;
    downloadUrl: string;
}

export class SelfUpdater {
    private client: GitHubAPIClient;
    private readonly appOwner = "GoghStudio";
    private readonly appRepo = "HamsterStore";
    private readonly currentVersion: string;
    private readonly currentExe: string;

    constructor(currentExePath: string, currentVersion: string = "1.0.0") {
        this.client = new GitHubAPIClient("");
        this.currentVersion = currentVersion;
        this.currentExe = currentExePath;
    }

    // 检查更新
    checkUpdate(): SelfUpdateInfo | null {
        try {
            const release = this.client.getLatestRelease(this.appOwner, this.appRepo);
            if (!release) return null;

            const latestVersion = (release.tag_name || "").replace(/^v/, "");
            const hasUpdate = this.compareVersions(latestVersion, this.currentVersion) > 0;
            const assets = release.assets || [];
            const dlUrl = assets.length > 0 ? (assets[0].browser_download_url || "") : "";

            return {
                currentVersion: this.currentVersion,
                latestVersion,
                hasUpdate,
                releaseNotes: release.body || "",
                downloadUrl: dlUrl,
            };
        } catch {
            return null;
        }
    }

    // 下载更新（同步）
    downloadUpdate(url: string): string {
        const exeName = "HamsterStore-v" + Date.now() + ".exe";
        const injectDir = join(this.currentExe, "..");
        const targetPath = join(injectDir, exeName);

        // curl 下载（单引号包裹 URL）
        execSync("curl -L --ssl-no-revoke --max-time 300 -o '" + targetPath + "' '" + url + "'", {
            stdio: "pipe",
            timeout: 300000,
        });

        if (!existsSync(targetPath)) {
            throw new Error("Download failed: file not found");
        }
        return targetPath;
    }

    // 替换进程（重启）
    restartWithNewExe(newExePath: string): void {
        const batContent = "@echo off\r\ntimeout /t 2 /nobreak > nul\r\nmove /Y \"" + newExePath + "\" \"" + this.currentExe + "\"\r\nstart \"\" \"" + this.currentExe + "\"\r\ndel \"%~f0\" & exit\r\n";
        const batPath = join(this.currentExe, "..", ".update.bat");
        try {
            writeFileSync(batPath, batContent, "ascii");
            execSync('cmd /c start "" "' + batPath + '"', { stdio: "ignore", timeout: 1000 });
        } catch {}
    }

    // 语义化版本比较
    private compareVersions(a: string, b: string): number {
        const ap = a.split(".").map(Number);
        const bp = b.split(".").map(Number);
        for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
            const av = ap[i] || 0;
            const bv = bp[i] || 0;
            if (av > bv) return 1;
            if (av < bv) return -1;
        }
        return 0;
    }
}