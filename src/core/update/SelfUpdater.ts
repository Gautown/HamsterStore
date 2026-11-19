// SelfUpdater v2 — 应用自身自动更新
// v2 变更（Perry 0.5.1665 适配，上游 #14982 + 回调式网络统一）：
//   1. class → 对象字面量工厂（避开 $pshape COFF alias 编译拒绝）
//   2. checkUpdate 改回调式（v1 用早已不存在的同步 API，永远返回 null 静默失效）
//   3. downloadUpdate 换 netDownload（execSync 拼引号 URL 在 Perry 二进制必挂）
//   4. restartWithNewExe 换 spawn 数组（fire-and-forget，同 DownloadManager.openInBrowser）
//   5. appOwner 修正为实际远程仓库 Gautown（原 GoghStudio 已过时）

import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGitHubAPIClient } from "../sync/GitHubAPIClient";
import { netDownload } from "../net/netFetch";

export interface SelfUpdateInfo {
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    releaseNotes: string;
    downloadUrl: string;
}

// 语义化版本比较
function compareVersions(a: string, b: string): number {
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

export function createSelfUpdater(currentExePath: string, currentVersion: string = "1.0.0") {
    const client = createGitHubAPIClient("");
    const appOwner = "Gautown";
    const appRepo = "HamsterStore";

    return {
        // 检查更新（回调式）
        checkUpdate(onDone: (info: SelfUpdateInfo | null) => void): void {
            client.getLatestRelease(appOwner, appRepo, (release) => {
                if (!release) { onDone(null); return; }
                const latestVersion = (release.tag_name || "").replace(/^v/, "");
                const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
                const assets = release.assets || [];
                const dlUrl = assets.length > 0 ? (assets[0].browser_download_url || "") : "";
                onDone({
                    currentVersion,
                    latestVersion,
                    hasUpdate,
                    releaseNotes: release.body || "",
                    downloadUrl: dlUrl,
                });
            });
        },

        // 下载更新（回调式，netDownload 完整性校验）
        downloadUpdate(url: string, onDone: (path: string | null) => void): void {
            const exeName = "HamsterStore-v" + Date.now() + ".exe";
            const targetPath = join(currentExePath, "..", exeName);
            netDownload(url, targetPath, { timeoutMs: 300000 },
                () => {},
                (ok: boolean, bytes: number) => {
                    if (ok && bytes > 0 && existsSync(targetPath)) { onDone(targetPath); return; }
                    onDone(null);
                });
        },

        // 替换进程（重启）：bat 延迟移动 + 重启，spawn 数组 fire-and-forget
        restartWithNewExe(newExePath: string): void {
            const batContent = "@echo off\r\ntimeout /t 2 /nobreak > nul\r\nmove /Y \"" + newExePath + "\" \"" + currentExePath + "\"\r\nstart \"\" \"" + currentExePath + "\"\r\ndel \"%~f0\" & exit\r\n";
            const batPath = join(currentExePath, "..", ".update.bat");
            try {
                writeFileSync(batPath, batContent, "ascii");
                const child = spawn("cmd", ["/c", "start", "", batPath], { detached: true, stdio: "ignore" });
                try { child.unref(); } catch {}
            } catch {}
        },
    };
}
