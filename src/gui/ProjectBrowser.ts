// ProjectBrowser — Microsoft Store 风格界面
// perry/ui: VStack, HStack, Text, Button, TextField, ScrollView, Divider, widgetAddChild, widgetClearChildren, textfieldGetString

import {
  VStack, HStack, Text, Button, TextField,
  ScrollView, Divider,
  widgetAddChild, widgetClearChildren,
  textfieldGetString,
  type Widget,
} from "perry/ui";
import { fetchApi } from "./api";
import { startDownload } from "./DownloadManager";

let sidebar: Widget;
let mainContent: Widget;
let searchInput: Widget;

export function createProjectBrowser(): Widget {
  searchInput = TextField("搜索应用...", (_v: string) => {});
  const searchRow = HStack(4, [
    searchInput,
    Button("搜索", () => { doSearch(); }),
  ]);

  sidebar = ScrollView();
  const leftPanel = VStack(6, [
    Text("📱 HamsterStore"),
    searchRow,
    Divider(),
    Text("分类"),
    sidebar,
  ]);

  mainContent = ScrollView();
  const rightPanel = VStack(6, [
    Text("项目列表"),
    mainContent,
  ]);

  const body = HStack(6, [leftPanel, rightPanel]);
  loadCategories();
  return body;
}

async function loadCategories() {
  try {
    const cats = await fetchApi("/api/categories");
    widgetClearChildren(sidebar);

    if (cats.length === 0) {
      widgetAddChild(sidebar, Text("暂无分类"));
      return;
    }

    widgetAddChild(sidebar, Text("全部应用"));

    for (const c of cats) {
      if (c.count === 0) continue;
      const label = `${c.name} (${c.count})`;
      const btn = Button(label, () => {
        loadRepos(c.name);
      });
      widgetAddChild(sidebar, btn);
    }

    const popular = Button("🔥 热门项目", () => { loadTrending(); });
    widgetAddChild(sidebar, popular);

    // 自动加载最佳分类：优先 Apps，其次是仓库数最多的
    let bestCat = cats.find((c: any) => c.name === "Apps" && c.count > 0);
    if (!bestCat) {
      bestCat = cats.filter((c: any) => c.count > 0).sort((a: any, b: any) => b.count - a.count)[0];
    }
    if (bestCat) {
      console.log(`[project] 自动加载: ${bestCat.name} (${bestCat.count}个)`);
      setTimeout(() => { loadRepos(bestCat.name); }, 2000);
    }

  } catch (err: any) {
    widgetClearChildren(sidebar);
    widgetAddChild(sidebar, Text("加载失败"));
  }
}

async function loadRepos(category: string) {
  try {
    const repos = await fetchApi(`/api/repos?category=${encodeURIComponent(category)}`);
    widgetClearChildren(mainContent);
    renderCards(repos);
  } catch (err: any) {
    widgetClearChildren(mainContent);
    widgetAddChild(mainContent, Text("加载失败"));
  }
}

async function loadTrending() {
  try {
    const repos = await fetchApi("/api/search?q=react&sort=stars");
    widgetClearChildren(mainContent);
    renderCards(repos);
  } catch (err: any) {
    widgetClearChildren(mainContent);
    widgetAddChild(mainContent, Text("加载失败"));
  }
}

async function doSearch() {
  const q = textfieldGetString(searchInput).trim();
  if (!q) return;
  try {
    const repos = await fetchApi(`/api/search?q=${encodeURIComponent(q)}`);
    widgetClearChildren(mainContent);
    renderCards(repos);
  } catch (err: any) {
    widgetClearChildren(mainContent);
    widgetAddChild(mainContent, Text("搜索失败"));
  }
}

function renderCards(items: any[]) {
  widgetClearChildren(mainContent);
  if (!items || items.length === 0) {
    widgetAddChild(mainContent, Text("暂无项目"));
    return;
  }

  for (const repo of items) {
    const card = buildCard(repo);
    widgetAddChild(mainContent, card);
    widgetAddChild(mainContent, Divider());
  }
}

function buildCard(repo: any): Widget {
  const fullName = repo.full_name || repo.name || "Unknown";
  const owner = fullName.split("/")[0] || "";
  const repoName = fullName.split("/")[1] || fullName;
  const desc = (repo.description || "").slice(0, 120);
  const stars = repo.stargazers_count || repo.stars || 0;
  const lang = repo.language || "?";
  const forks = repo.forks_count || repo.forks || 0;

  const rl = extractRelease(repo.latest_release);
  const releaseTag = rl ? rl.tag : "";

  // 头部：仓库名 + 星数
  const header = HStack(6, [
    Text(`📦 ${repoName}`),
    Text("⭐ " + stars),
  ]);

  // 元信息行
  const meta = HStack(8, [
    Text("🛠 " + lang),
    Text("🍴 " + forks),
    releaseTag ? Text("🏷 " + releaseTag) : Text(""),
  ]);

  // 描述
  const descWidget = desc ? Text(desc) : Text("暂无描述");

  // 下载按钮
  const downloadBtn = Button("📥 获取", () => {
    let downloadUrl = repo.html_url || "";
    if (repo.latest_release) {
      try {
        const lr = typeof repo.latest_release === "string" 
          ? JSON.parse(repo.latest_release) 
          : repo.latest_release;
        const assets = lr.assets || [];
        const exe = assets.find((a: any) => a.name?.endsWith(".exe"));
        const msi = assets.find((a: any) => a.name?.endsWith(".msi"));
        const zip = assets.find((a: any) => a.name?.endsWith(".zip"));
        const first = assets[0];
        if (exe) downloadUrl = exe.browser_download_url;
        else if (msi) downloadUrl = msi.browser_download_url;
        else if (zip) downloadUrl = zip.browser_download_url;
        else if (first) downloadUrl = first.browser_download_url;
      } catch {}
    }
    startDownload(downloadUrl);
  });

  const cardBody = VStack(4, [
    header,
    descWidget,
    meta,
    downloadBtn,
  ]);

  return cardBody;
}

function extractRelease(raw: string | null): any {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    return { tag: j.tag_name || j.name || "", full: j.name || j.tag_name || "" };
  } catch {
    return null;
  }
}
