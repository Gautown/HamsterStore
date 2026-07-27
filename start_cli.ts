// 爬虫 v2 — 从 6 个种子仓库的 README 中提取分类+应用列表
//   1. stackia/best-windows-apps — 最佳 Windows 应用（表格格式）
//   2. holyshell/AppsForWindows — Windows 应用合集（链接列表格式）
//   3. ziyouvip/awesome-windows-software — Windows 软件推荐（简单列表）
//   4. ttionya/Personal-Software — 个人软件清单（表格格式）
//   5. ossdate/open-source-software-for-enterprises — 企业级开源软件（表格）
//   6. sindresorhus/awesome — 终极 awesome 列表（awesome-list 格式）
// 对每个提取到的 GitHub 仓库：
//   - api.github.com/repos/{owner}/{repo} → 基础信息
//   - api.github.com/repos/{owner}/{repo}/releases/latest → 版本+下载链接
//   - 写入 SQLite

import { startAccelerator, fetchAccelerated } from "./src/cli/accelerator-node";
import { startApiServer } from "./src/api";
import { saveRepository, getOrCreateCategory, linkRepoToCategory, getRepositoryCount, db } from "./src/db";

// ============================================================
// 6 个种子仓库 — 各自配置解析策略
// ============================================================
interface SeedRepo {
  owner: string; repo: string;
  type: "markdown-table" | "link-list" | "simple-list" | "awesome-list";
  note: string;
  branch: string; // master 或 main
  // 可选优先级：数据少的种子仓库设置低优先级
  priority?: number;
}

const SEED_REPOS: SeedRepo[] = [
  // 原有 6 个核心种子
  { owner: "stackia", repo: "best-windows-apps", type: "markdown-table", note: "最佳 Windows 应用", branch: "master", priority: 1 },
  { owner: "ttionya", repo: "Personal-Software", type: "markdown-table", note: "个人软件清单", branch: "master", priority: 2 },
  { owner: "holyshell", repo: "AppsForWindows", type: "link-list", note: "Windows 应用合集", branch: "main", priority: 3 },
  { owner: "ossdate", repo: "open-source-software-for-enterprises", type: "markdown-table", note: "企业级开源软件", branch: "main", priority: 4 },
  { owner: "ziyouvip", repo: "awesome-windows-software", type: "simple-list", note: "Windows 软件推荐", branch: "main", priority: 5 },
  { owner: "sindresorhus", repo: "awesome", type: "awesome-list", note: "终极 awesome 列表", branch: "main", priority: 6 },

  // 新增种子仓库 — 拓宽软件覆盖面
  { owner: "Awesome-Windows", repo: "Awesome", type: "link-list", note: "Windows精选(42k⭐)", branch: "master", priority: 7 },
  { owner: "mikeroyal", repo: "Windows-11-Guide", type: "link-list", note: "Win11工具指南", branch: "main", priority: 8 },
  { owner: "dkapur17", repo: "awesome-productivity-tools", type: "link-list", note: "生产力工具", branch: "main", priority: 9 },
  { owner: "markusschanta", repo: "awesome-jupyter", type: "link-list", note: "Jupyter生态", branch: "master", priority: 10 },
];

// ============================================================
// 解析器：三种 README 格式
// ============================================================

// --- 格式1: Markdown 表格 ---
// | 名称 | 描述 | ... | → 从任意单元格中提取 github.com/owner/repo 链接
function parseMarkdownTable(readme: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  let currentCategory = "其他";

  const lines = readme.split("\n");
  for (const line of lines) {
    // ### 或 ## 作为分类标题
    const heading = line.match(/^#{2,3}\s+(.+)/);
    if (heading) {
      let name = heading[1].trim();
      // 过滤目录、License、无关标题
      if (name === "Contents" || name === "Table of Contents" || name === "目录" ||
          name.includes("License") || name.includes("Contribut") || name === "Apps" ||
          name === "Package manager" || name.includes("introduction")) {
        continue;
      }
      // 清理编号前缀: "1. For Everyone" → "For Everyone"
      name = name.replace(/^\d+\.\s*/, "");
      // 清理中文编号: "一、" → ""
      name = name.replace(/^[一二三四五六七八九十]+、/, "");
      // 清理残留 # 前缀（从 ### ### 标题匹配过来）
      name = name.replace(/^#\s*/, "");
      if (name.length === 0) continue;
      currentCategory = name;
      continue;
    }

    // 表格行：| col1 | col2 | ...
    if (line.includes("|") && !line.includes("---") && !line.includes("名称") && !line.includes("软件")) {
      const cells = line.split("|").map(c => c.trim()).filter(c => c.length > 0);
      // 从所有单元格中提取 github.com 链接
      const githubLinks: string[] = [];
      for (const cell of cells) {
        const matches = cell.matchAll(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/g);
        for (const m of matches) {
          const fullName = `${m[1]}/${m[2]}`;
          if (!githubLinks.includes(fullName)) githubLinks.push(fullName);
        }
      }
      if (githubLinks.length > 0) {
        if (!result.has(currentCategory)) result.set(currentCategory, []);
        for (const link of githubLinks) {
          if (!result.get(currentCategory)!.includes(link)) {
            result.get(currentCategory)!.push(link);
          }
        }
      }
    }
  }
  return result;
}

// --- 格式2: 链接列表 (holyshell 风格) ---
// [Name](url)：描述 — 提取所有含 github.com 的链接
function parseLinkList(readme: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  let currentCategory = "Windows 应用";

  const lines = readme.split("\n");
  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)/);
    if (heading) {
      let name = heading[1].trim();
      if (name === "introduction" || name.includes("Package manager") ||
          name.includes("目录") || name.includes("Contents") || name.includes("License")) {
        continue;
      }
      currentCategory = name;
      continue;
    }

    // 匹配所有 github.com 链接
    const matches = line.matchAll(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/g);
    for (const m of matches) {
      const fullName = `${m[1]}/${m[2]}`;
      if (!result.has(currentCategory)) result.set(currentCategory, []);
      if (!result.get(currentCategory)!.includes(fullName)) {
        result.get(currentCategory)!.push(fullName);
      }
    }
  }
  return result;
}

// --- 格式3: 简单列表 (ziyouvip 风格) ---
// - 数字.名称：github链接:xxx → 直接提取 github.com 链接
function parseSimpleList(readme: string): Map<string, string[]> {
  return parseLinkList(readme); // 同链接列表解析
}

// --- 格式4: awesome-list ---
// ## Category\n- [Name](github.com/owner/repo[/#readme]) - desc
function parseAwesomeList(readme: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  let currentCategory = "其他";

  const lines = readme.split("\n");
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      const name = h2[1].trim();
      if (name !== "Contents" && name !== "目录" && name !== "Table of Contents" &&
          !name.startsWith("License") && !name.startsWith("Contribut")) {
        currentCategory = name;
      }
      continue;
    }
    // - [Name](github.com/owner/repo[/...][#...]) - desc
    const item = line.match(/^\s*-\s+\[.+?\]\((https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+))(?:\/.*?)?(?:#.*?)?\)/);
    if (item) {
      const repoFullName = `${item[2]}/${item[3]}`;
      if (!result.has(currentCategory)) result.set(currentCategory, []);
      if (!result.get(currentCategory)!.includes(repoFullName)) {
        result.get(currentCategory)!.push(repoFullName);
      }
    }
  }
  return result;
}

// ============================================================
// 主爬取流程
// ============================================================
async function crawlFromSeedRepos() {
  // 合并所有种子仓库的分类+仓库名
  const allCategories = new Map<string, Set<string>>();

  // 按优先级排序（数据多的优先）
  const sorted = [...SEED_REPOS].sort((a, b) => (a.priority || 99) - (b.priority || 99));

  for (const seed of sorted) {
    console.log(`\n[crawler] ===== ${seed.owner}/${seed.repo} (${seed.type}) — ${seed.note} =====`);
    try {
      const rawUrl = `https://raw.githubusercontent.com/${seed.owner}/${seed.repo}/${seed.branch}/README.md`;
      console.log(`[crawler] 获取 README: ${rawUrl}`);
      const res = await fetchAccelerated(rawUrl);
      const readme = await res.text();

      if (readme.length < 20 || readme.includes("404: Not Found")) {
        console.log(`[crawler]   ⚠ README 太小/404，跳过（${readme.length} 字节）`);
        continue;
      }

      console.log(`[crawler]   README: ${readme.length} 字符, ${readme.split("\n").length} 行`);

      let categories: Map<string, string[]>;
      switch (seed.type) {
        case "awesome-list":
          categories = parseAwesomeList(readme);
          break;
        case "link-list":
          categories = parseLinkList(readme);
          break;
        case "simple-list":
          categories = parseSimpleList(readme);
          break;
        default:
          categories = parseMarkdownTable(readme);
      }

      console.log(`[crawler]   → 提取 ${categories.size} 个分类`);
      let totalRepos = 0;
      for (const [cat, repos] of categories) {
        console.log(`[crawler]     "${cat}": ${repos.length} 个仓库`);
        totalRepos += repos.length;
        if (!allCategories.has(cat)) allCategories.set(cat, new Set());
        for (const r of repos) allCategories.get(cat)!.add(r);
      }
      console.log(`[crawler]   → 共 ${totalRepos} 个仓库（含重复）`);
    } catch (e: any) {
      console.log(`[crawler]   ❌ 失败: ${e.message}`);
    }
  }

  // 统计合并结果
  console.log(`\n[crawler] ===== 合并统计 =====`);
  console.log(`[crawler] ${allCategories.size} 个分类`);
  let totalUnique = 0;
  for (const repos of allCategories.values()) totalUnique += repos.size;
  console.log(`[crawler] ${totalUnique} 个唯一仓库（去重前）`);

  // 全局去重
  const globalUniques = new Set<string>();
  for (const repos of allCategories.values()) for (const r of repos) globalUniques.add(r);
  console.log(`[crawler] ${globalUniques.size} 个唯一仓库（全局去重后）`);

  // 写入数据库
  let repoIndex = 0;
  for (const [catName, repos] of allCategories) {
    // 清理分类名
    const cleanName = catName.replace(/^#\s*/, "").trim();
    if (cleanName.length === 0 || cleanName === "其他") continue;

    const catId = getOrCreateCategory(cleanName);
    console.log(`\n[crawler] 分类: "${cleanName}" (id=${catId}, ${repos.size} repos)`);

    let i = 0;
    for (const fullName of repos) {
      // 全局去重——如果已经爬过就跳过
      if (!globalUniques.has(fullName)) {
        continue; // 前面已有其他分类收录
      }
      globalUniques.delete(fullName); // 标记已处理

      i++;
      repoIndex++;
      const [owner, repo] = fullName.split("/");

      console.log(`[crawler]   [#${repoIndex}] ${fullName}...`);

      try {
        // 获取仓库基本信息（带 rate limit 检测）
        let repoData: any;
        let retries = 0;
        while (true) {
          const repoRes = await fetchAccelerated(`https://api.github.com/repos/${owner}/${repo}`);
          const repoText = await repoRes.text();
          // 检测 rate limit 响应（<300 字节且非仓库JSON）
          if (repoText.length < 300 || repoText.includes("rate limit")) {
            retries++;
            if (retries > 3) {
              console.log(`[crawler]     ⚠ rate limit 重试${retries}次仍失败，跳过`);
              repoData = null;
              break;
            }
            const waitSec = 60 * retries;
            console.log(`[crawler]     ⏳ rate limit，等待 ${waitSec}s (重试${retries}/3)...`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
            continue;
          }
          try {
            repoData = JSON.parse(repoText);
          } catch {
            console.log(`[crawler]     ⚠ 非JSON响应(${repoText.length}字节)，跳过`);
            repoData = null;
          }
          break;
        }
        if (!repoData) continue; // 跳过这个仓库

        // 获取最新 release（带 rate limit 检测）
        let latestRelease = null;
        try {
          const relRes = await fetchAccelerated(
            `https://api.github.com/repos/${owner}/${repo}/releases/latest`
          );
          const relText = await relRes.text();
          if (relText.length < 200 || relText.includes("rate limit")) {
            console.log(`[crawler]     release: rate limited，跳过`);
          } else {
            try {
              const relData = JSON.parse(relText);
              if (relData.tag_name) {
                latestRelease = {
                  tag_name: relData.tag_name,
                  name: relData.name || relData.tag_name,
                  published_at: relData.published_at,
                  html_url: relData.html_url,
                  body: ((relData.body || "").slice(0, 500)),
                  assets: (relData.assets || []).map((a: any) => ({
                    name: a.name,
                    browser_download_url: a.browser_download_url,
                    size: a.size,
                    content_type: a.content_type,
                  })),
                };
                const assetCount = (relData.assets || []).length;
                console.log(`[crawler]     release: ${latestRelease.tag_name} (${assetCount} assets)`);
              }
            } catch {
              console.log(`[crawler]     release: 非JSON (${relText.slice(0,80)})`);
            }
          }
        } catch (relErr: any) {
          console.log(`[crawler]     release: ${relErr.message?.slice(0, 60)}`);
        }

        // 确保所有字段都有值（避免 SQLite binding 错误）
        const repoId = saveRepository({
          full_name: fullName,
          description: repoData.description || "",
          language: repoData.language || "",
          stars: repoData.stargazers_count || 0,
          forks: repoData.forks_count || 0,
          watchers: repoData.watchers_count || 0,
          open_issues: repoData.open_issues_count || 0,
          license: repoData.license?.spdx_id || null,
          pushed_at: repoData.pushed_at || null,
          created_at: repoData.created_at || null,
          html_url: repoData.html_url || `https://github.com/${fullName}`,
          topics: repoData.topics || [],
          latest_release: latestRelease,
        });

        linkRepoToCategory(repoId, catId);
        console.log(`[crawler]     → DB id=${repoId}`);

      } catch (repoErr: any) {
        console.log(`[crawler]     ❌ ${repoErr.message?.slice(0, 80)}`);
      }

      // 无 token: 60 req/hour → 每请求至少间隔 60秒/60 = 1秒。保守取 5s
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log(`\n[crawler] ===== 爬取完成 — 共 ${getRepositoryCount()} 个仓库 =====`);
}

async function main() {
  console.log("[cli] HamsterStore CLI v2 启动 (6 种子仓库)");

  // 1. 启动加速器
  console.log("[cli] 启动加速器...");
  startAccelerator();
  await new Promise(r => setTimeout(r, 6000));
  console.log("[cli] 加速器就绪");

  // 2. 启动 API server
  const apiPort = await startApiServer(5678);
  console.log(`[cli] API 端口: ${apiPort}`);

  // 3. 爬取
  const count = getRepositoryCount();
  console.log(`[cli] 当前数据库有 ${count} 个仓库`);

  console.log("[cli] 开始从 6 个种子仓库爬取...\n");
  await crawlFromSeedRepos();

  console.log("[cli] 爬取完成，保持运行...");
}

main().catch(e => {
  console.error("[cli] 致命错误:", e);
  process.exit(1);
});
