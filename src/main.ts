// 仓鼠软库 CLI v1.4 — 统一入口（netFetch 回调式网络）
import { initDatabase, SourceRepository, PackageRepository, DownloadRepository } from "./data";
import { initSeedSources } from "./core/sync/seedRepos";
import { SourceSyncer } from "./core/sync/SourceSyncer";
import { GitHubSearchEngine } from "./core/discovery/GitHubSearchEngine";
import { GitHubAPIClient } from "./core/sync/GitHubAPIClient";
import { ProxyManager } from "./core/proxy/ProxyManager";
import { DownloadManager } from "./core/download/DownloadManager";

function parseArgs(argv: string[]): { command: string; args: string[]; options: Record<string, string> } {
    const a = argv.slice(2);
    const cmd = a[0] || "help";
    const rest: string[] = [];
    const opts: Record<string, string> = {};
    for (let i = 1; i < a.length; i++) {
        if (a[i].startsWith("--")) {
            const k = a[i].replace(/^--/, "");
            opts[k] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : "true";
        } else rest.push(a[i]);
    }
    return { command: cmd, args: rest, options: opts };
}

function main(): void {
    const { command, args, options } = parseArgs(process.argv);
    console.log("仓鼠软库 v1.4");

    initDatabase();
    initSeedSources();

    const token = options.token || "";

    switch (command) {
        case "sync": {
            const syncer = new SourceSyncer(token);
            const n = syncer.syncAll();
            console.log("\n同步完成: " + n + " 个软件包");
            break;
        }

        case "discover":
        case "search-online": {
            console.log("搜索 GitHub 公开仓库...\n");
            const engine = new GitHubSearchEngine(token);
            const kw = args[0] || "awesome windows";
            engine.searchByKeyword(kw, 10, (results) => {
                console.log("GitHub 找到 " + results.length + " 个结果:");
                for (const r of results) {
                    console.log("  " + r.full_name + " ★" + r.stargazers_count + " — " + (r.description || "").substring(0, 60));
                }
                process.exit(0);
            });
            break;
        }

        case "list": {
            const sources = SourceRepository.getAll();
            console.log("\n种子仓库 (" + sources.length + "):");
            for (const s of sources) {
                console.log("  " + s.owner + "/" + s.repo + (s.source_type ? " [" + s.source_type + "]" : ""));
            }
            const pkgs = PackageRepository.getAll();
            console.log("\n软件包 (" + pkgs.length + ")");
            break;
        }

        case "categories": {
            const pkgs = PackageRepository.getAll();
            const catCounts: Record<string, number> = {};
            for (const p of pkgs) {
                try {
                    const cats = JSON.parse(p.categories || "[]");
                    if (Array.isArray(cats)) {
                        for (const c of cats) catCounts[c] = (catCounts[c] || 0) + 1;
                    }
                } catch {}
            }
            console.log("\n分类统计:");
            const keys = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a]);
            for (const k of keys) {
                console.log("  " + k + ": " + catCounts[k]);
            }
            break;
        }

        case "search": {
            const keyword = args[0] || "";
            if (!keyword) { console.log("用法: search <关键词>"); break; }
            console.log("\n搜索本地数据库: '" + keyword + "'\n");
            const matched = PackageRepository.search(keyword, 20);
            if (matched.length === 0) {
                console.log("  本地无匹配 — 尝试从 GitHub 在线搜索...");
                const engine = new GitHubSearchEngine(token);
                engine.searchByKeyword(keyword, 10, (results) => {
                    console.log("  GitHub 找到 " + results.length + " 个结果:");
                    for (const r of results) {
                        console.log("    " + r.full_name + " ★" + r.stargazers_count + " — " + (r.description || "").substring(0, 60));
                    }
                    process.exit(0);
                });
            } else {
                console.log("  本地匹配 " + matched.length + " 个:");
                for (const p of matched) {
                    const cats = JSON.parse(p.categories || "[]");
                    console.log("    " + p.id + " | " + p.name + " | " + (Array.isArray(cats) ? cats.join("/") : "") + " | " + (p.description || "").substring(0, 50));
                }
            }
            break;
        }

        case "info": {
            const id = parseInt(args[0] || "0", 10);
            if (!id) { console.log("用法: info <软件ID>"); break; }
            const p = PackageRepository.getById(id);
            if (!p) { console.log("未找到 ID=" + id); break; }
            console.log("\n软件详情:");
            console.log("  ID:        " + p.id);
            console.log("  名称:      " + p.name);
            console.log("  版本:      " + (p.version || "(无)"));
            console.log("  描述:      " + (p.description || "(无)"));
            const cats = JSON.parse(p.categories || "[]");
            console.log("  分类:      " + (Array.isArray(cats) ? cats.join(", ") : "(无)"));
            try {
                const ext = JSON.parse(p.extra_json || "{}");
                console.log("  项目地址:  " + (ext.project_url || "(无)"));
                console.log("  下载地址:  " + (ext.download_url || "(无)"));
                console.log("  数据来源:  " + (ext.data_source || "(无)"));
            } catch {}
            break;
        }

        case "proxy": {
            const pm = ProxyManager.getInstance();
            pm.init();  // 触发后台测速（回调式）
            // 等 12s 让测速跑完再打印（CLI 无 UI，靠 setInterval 保活）
            setTimeout(() => {
                const st = pm.getStatus();
                console.log("\n加速器状态:");
                console.log("  启用:     " + (pm.isProxyEnabled() ? "是" : "否"));
                console.log("  状态:     " + (st.connected ? "已连接" : (st.measuring ? "测速中" : "未连接（直连）")));
                console.log("  当前节点: " + st.nodeName + (st.latency > 0 ? " (" + st.latency + "ms)" : ""));
                console.log("  节点列表:");
                for (const n of pm.getAllNodes()) {
                    const mark = n.enabled ? (n.latency > 0 ? "OK " + n.latency + "ms" : "-") : "X";
                    console.log("    [" + mark + "] " + n.name + " (" + n.mode + ")");
                }
                process.exit(0);
            }, 12000);
            break;
        }

        case "download": {
            const id = parseInt(args[0] || "0", 10);
            if (!id) { console.log("用法: download <软件ID>  (从 info 查看 download_url)"); break; }
            const p = PackageRepository.getById(id);
            if (!p) { console.log("未找到 ID=" + id); break; }
            let url = "";
            try { url = JSON.parse(p.extra_json || "{}").download_url || ""; } catch {}
            // 项目页 URL（无资产路径）→ 需要走 release API 拿真实资产
            const isProjectPage = !url || /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/.test(url);
            if (isProjectPage) {
                // 回退：直接用 project_url 拼最新 release（调 API 拿真实资产）
                console.log("该包无预置 download_url，尝试获取最新 release...");
                const ownerRepo = parseOwnerRepo(p.name);
                if (!ownerRepo) { console.log("无法解析 owner/repo，中止"); break; }
                const client = new GitHubAPIClient(token);
                client.getLatestRelease(ownerRepo.owner, ownerRepo.repo, (rel) => {
                    if (!rel || !rel.assets || rel.assets.length === 0) {
                        console.log("未找到 release 资产，中止");
                        process.exit(1);
                    }
                    // 选 Windows 资产（严格优先 x86_64-pc-windows-msvc/GNU，排除 mac/linux）
                    const winAsset = rel.assets.find((a: any) => /x86_64-pc-windows|windows.*x86_64|x86_64.*windows/i.test(a.name)) ||
                        rel.assets.find((a: any) => /\.exe$|\.msi$|\.zip$/i.test(a.name) && !/darwin|linux|aarch64|arm/i.test(a.name)) ||
                        rel.assets[0];
                    console.log("Release: " + rel.tag_name + " → " + winAsset.name);
                    startCliDownload(p.id, winAsset.browser_download_url, winAsset.name);
                });
                break;
            }
            startCliDownload(p.id, url, (url.split("/").pop() || "download"), token);
            break;
        }

        case "help":
        default:
            console.log("\n仓鼠软库 v1.4\n");
            console.log("  sync              同步内置数据到本地库");
            console.log("  discover [kw]     从 GitHub 在线搜索新软件\n");
            console.log("  search <kw>       按关键词搜索（本地→GitHub）\n");
            console.log("  download <id>     下载软件（经加速器，自动直连回退）\n");
            console.log("  proxy             查看加速器状态（自动测速）\n");
            console.log("  info <id>         查看软件详情");
            console.log("  list              显示仓库 + 软件包");
            console.log("  categories        显示分类统计");
            console.log("  help              帮助\n");
            console.log("选项: --token <PAT>\n");
    }
}

function parseOwnerRepo(name: string): { owner: string; repo: string } | null {
    const m = name.match(/^([^\/]+)\/([^\/]+)$/);
    if (m) return { owner: m[1], repo: m[2] };
    return null;
}

function startCliDownload(packageId: number, url: string, name: string): void {
    console.log("开始下载: " + name);
    console.log("URL: " + url);
    const pm = ProxyManager.getInstance();
    pm.init();
    // 等 2s 让代理测速尽可能先出结果（预算 10s 内，第一节点通常 <1s）
    setTimeout(() => {
        const accel = pm.accelerateDownload(url);
        console.log(accel !== url ? "经加速节点下载: " + accel : "直连下载（无可用加速节点）");
        DownloadManager.startDownloadCli(packageId, url, name, (st) => {
            if (st.status === "done") {
                console.log("\n下载完成: " + st.detail);
                process.exit(0);
            } else {
                console.log("\n下载失败: " + st.detail);
                process.exit(1);
            }
        });
    }, 2000);
}

try { main(); } catch (e: any) { console.error("错误: " + e.message); process.exit(1); }
