// 仓鼠软库 CLI v1.2 — 统一同步入口（底层 RepoSyncEngine）
import { initDatabase, SourceRepository, PackageRepository } from "./data";
import { initSeedSources } from "./core/sync/seedRepos";
import { SourceSyncer } from "./core/sync/SyncFacade";
import { GitHubSearchEngine } from "./core/discovery/GitHubSearchEngine";

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
    console.log("仓鼠软库 v1.0");

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

        case "discover": {
            const syncer = new SourceSyncer(token);
            console.log("搜索 GitHub 公开仓库...\n");
            const n = syncer.syncFromDiscovery();
            console.log("\n发现: " + n + " 个新软件");
            break;
        }

        case "list": {
            const sources = SourceRepository.getAll();
            console.log("\n种子仓库 (" + sources.length + "):");
            for (const s of sources) {
                console.log("  " + s.owner + "/" + s.repo + " [" + s.parser_config + "]");
            }
            const pkgs = PackageRepository.getAll();
            console.log("\n软件包 (" + pkgs.length + "):");
            for (const p of pkgs) {
                const cats = JSON.parse(p.categories || "[]");
                const catLabel = Array.isArray(cats) ? cats.join("/") : "";
                console.log("  " + p.id + " | " + p.name + " | " + catLabel);
            }
            break;
        }

        case "categories": {
            const pkgs = PackageRepository.getAll();
            const catCounts: Record<string, number> = {};
            for (const p of pkgs) {
                const cats = JSON.parse(p.categories || "[]");
                if (Array.isArray(cats)) {
                    for (const c of cats) {
                        catCounts[c] = (catCounts[c] || 0) + 1;
                    }
                }
            }
            console.log("\n分类统计:");
            for (const [cat, count] of Object.entries(catCounts).sort()) {
                console.log("  " + cat + ": " + count + " 个");
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
                const syncer = new SourceSyncer(token);
                const engine = new GitHubSearchEngine(token);
                const results = engine.searchByKeyword(keyword, 1);
                console.log("  GitHub 找到 " + results.length + " 个结果:");
                for (const r of results.slice(0, 10)) {
                    console.log("    " + r.full_name + " ★" + r.stargazers_count + " — " + (r.description || "").substring(0, 60));
                }
                let added = 0;
                for (const r of results) {
                    if (syncer.savePackageFromSearchPublic(r)) added++;
                }
                console.log("\n  入库: " + added + " 个新软件");
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

        case "help":
        default:
            console.log("\n仓鼠软库 v1.0\n");
            console.log("  sync        拉取种子仓库 + 公开搜索\n");
            console.log("  discover    从 GitHub 搜索新软件\n");
            console.log("  search <kw> 按关键词搜索（本地→GitHub）\n");
            console.log("  info <id>   查看软件详情\n");
            console.log("  list        显示仓库 + 软件包（含分类）\n");
            console.log("  categories  显示分类统计\n");
            console.log("  help        帮助\n");
            console.log("选项: --token <PAT>\n");
            console.log("无 token 时采用爬虫方案\n");
    }
}

try { main(); } catch (e: any) { console.error("错误: " + e.message); process.exit(1); }