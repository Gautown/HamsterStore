// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HamsterStore — WinUI3 暖沙色风格
//  参考 MangoQuery 的 perry 原生视觉 API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  VStack, HStack, Text, Button, TextField,
  ScrollView, Divider,
  widgetAddChild, widgetClearChildren,
  widgetSetBackgroundColor, widgetMatchParentWidth,
  setCornerRadius, setPadding,
  textSetFontSize, textSetColor,
  buttonSetBordered, buttonSetTextColor,
  textfieldGetString,
  type Widget,
} from "perry/ui";
import { fetchApi } from "./api";
import { startDownload } from "./DownloadManager";

// ════════════════════════════════════════
//  暖沙色主题（RGBA 0.0-1.0）
// ════════════════════════════════════════

// 背景: 暖白 #FFF8F0
const bgR = 1.0, bgG = 0.973, bgB = 0.941;
// 侧栏: 沙色 #F5EDE3
const sdR = 0.961, sdG = 0.929, sdB = 0.890;
// 卡片: 纯白 #FFFFFF
const sfR = 1.0, sfG = 1.0, sfB = 1.0;
// 主文字: 深棕 #3D2B1F
const txR = 0.239, txG = 0.169, txB = 0.122;
// 副文字: 暖灰 #8D7B6B
const tsR = 0.553, tsG = 0.482, tsB = 0.420;
// 强调色: 陶土 #C4956A
const acR = 0.769, acG = 0.584, acB = 0.416;
// 边框: #E8D5C0
const brR = 0.910, brG = 0.835, brB = 0.753;

// ════════════════════════════════════════

let sidebar: Widget;
let mainContent: Widget;
let searchInput: Widget;

export function createProjectBrowser(): Widget {
  searchInput = TextField("🔍 搜索软件...", (_v: string) => {});
  textSetColor(searchInput, tsR, tsG, tsB, 1.0);

  const searchRow = HStack(4, [
    searchInput,
    Button("搜索", () => { doSearch(); }),
  ]);
  widgetMatchParentWidth(searchRow);

  // 侧栏
  sidebar = ScrollView();
  widgetSetBackgroundColor(sidebar, sdR, sdG, sdB, 1.0);
  widgetMatchParentWidth(sidebar);

  const title = Text("🐹 仓鼠软库");
  textSetFontSize(title, 18);
  textSetColor(title, txR, txG, txB, 1.0);

  const sectionTitle = Text("📂 分类");
  textSetFontSize(sectionTitle, 13);
  textSetColor(sectionTitle, tsR, tsG, tsB, 1.0);

  const leftPanel = VStack(6, [
    title,
    Divider(),
    searchRow,
    Divider(),
    sectionTitle,
    sidebar,
  ]);
  widgetSetBackgroundColor(leftPanel, sdR, sdG, sdB, 1.0);
  widgetMatchParentWidth(leftPanel);

  // 主内容区
  mainContent = ScrollView();
  widgetSetBackgroundColor(mainContent, bgR, bgG, bgB, 1.0);
  widgetMatchParentWidth(mainContent);

  const rightTitle = Text("📋 软件列表");
  textSetFontSize(rightTitle, 16);
  textSetColor(rightTitle, txR, txG, txB, 1.0);

  const hint = Text("点击左侧分类浏览");
  textSetFontSize(hint, 12);
  textSetColor(hint, tsR, tsG, tsB, 1.0);

  const rightPanel = VStack(8, [
    rightTitle,
    hint,
    Divider(),
    mainContent,
  ]);
  setPad(rightPanel, 12, 16, 12, 16);

  const body = HStack(0, [leftPanel, Divider(), rightPanel]);
  widgetSetBackgroundColor(body, bgR, bgG, bgB, 1.0);

  loadCategories();
  return body;
}

// ════════════════════════════════════════

function text(str: string): Widget {
  return Text(str);
}

function setPad(w: Widget, top: number, right: number, bottom: number, left: number) {
  setPadding(w, top, right, bottom, left);
}

async function loadCategories() {
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const cats = await fetchApi("/api/categories");
      widgetClearChildren(sidebar);
      if (!cats || cats.length === 0) {
        widgetAddChild(sidebar, muted("无分类"));
        return;
      }
      for (const c of cats) {
        if (c.count === 0) continue;
        const btn = Button(`▸ ${c.name} (${c.count})`, () => { loadRepos(c.name); });
        widgetMatchParentWidth(btn);
        widgetAddChild(sidebar, btn);
      }
      return;  // 成功，停止重试
    } catch {
      // CLI 还没启动完，等 2 秒重试
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  // 10 次都失败
  widgetClearChildren(sidebar);
  widgetAddChild(sidebar, mutedText("后端未就绪，请稍后重启"));
}

async function loadRepos(category: string) {
  try {
    const repos = await fetchApi(`/api/repos?category=${encodeURIComponent(category)}`);
    widgetClearChildren(mainContent);
    renderCards(repos);
  } catch {
    widgetClearChildren(mainContent);
    widgetAddChild(mainContent, mutedText("加载失败"));
  }
}

async function doSearch() {
  const q = textfieldGetString(searchInput).trim();
  if (!q) return;
  try {
    const repos = await fetchApi(`/api/search?q=${encodeURIComponent(q)}`);
    widgetClearChildren(mainContent);
    renderCards(repos);
  } catch {
    widgetClearChildren(mainContent);
    widgetAddChild(mainContent, mutedText("搜索失败"));
  }
}

// ════════════════════════════════
// 卡片系统（原生圆角 + 背景色）
// ════════════════════════════════

function renderCards(items: any[]) {
  widgetClearChildren(mainContent);
  if (!items || items.length === 0) {
    widgetAddChild(mainContent, mutedText("暂无软件"));
    return;
  }
  for (const repo of items) {
    widgetAddChild(mainContent, buildCard(repo));
  }
}

function buildCard(repo: any): Widget {
  const fullName = repo.full_name || repo.name || "?";
  const repoName = fullName.split("/")[1] || fullName;
  const desc = (repo.description || "").slice(0, 100);
  const stars = repo.stargazers_count || repo.stars || 0;
  const lang = repo.language || "?";
  const tag = extractReleaseTag(repo.latest_release);

  // 标题
  const nameWidget = text(`📦 ${repoName}`);
  textSetFontSize(nameWidget, 15);
  textSetColor(nameWidget, txR, txG, txB, 1.0);

  const starWidget = text(`⭐ ${fmtK(stars)}`);
  textSetFontSize(starWidget, 13);
  textSetColor(starWidget, acR, acG, acB, 1.0);

  const header = HStack(6, [nameWidget, starWidget]);

  // 描述
  const descWidget = text(desc || "(暂无描述)");
  textSetFontSize(descWidget, 13);
  textSetColor(descWidget, tsR, tsG, tsB, 1.0);

  const metaWidgets: Widget[] = [textTag(`🛠 ${lang}`)];
  if (tag) metaWidgets.push(textTag(`🏷 ${tag}`));

  // 下载按钮
  const dlBtn = Button(`📥 下载 ${repoName}`, () => {
    startDownload(extractDownloadUrl(repo));
  });
  setCornerRadius(dlBtn, 8);
  setPadding(dlBtn, 8, 16, 8, 16);

  // 卡片容器
  const card = VStack(6, [
    HStack(6, [nameWidget, starWidget]),
    descWidget,
    HStack(4, metaWidgets),
    dlBtn,
  ]);

  // 卡片样式：白色底 + 暖色边框 + 圆角 + 间距
  widgetSetBackgroundColor(card, sfR, sfG, sfB, 1.0);
  setCornerRadius(card, 10);
  setPadding(card, 12, 16, 12, 16);
  widgetMatchParentWidth(card);

  return card;
}

// ════════════════════════════════
// 辅助
// ════════════════════════════════

function fmtK(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function textTag(label: string): Widget {
  const w = text(label);
  textSetFontSize(w, 11);
  textSetColor(w, tsR, tsG, tsB, 1.0);
  return w;
}

function mutedText(label: string): Widget {
  const w = text(label);
  textSetFontSize(w, 13);
  textSetColor(w, tsR, tsG, tsB, 1.0);
  return w;
}

function extractReleaseTag(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    return j.tag_name || j.name || null;
  } catch { return null; }
}

function extractDownloadUrl(repo: any): string {
  if (repo.latest_release) {
    try {
      const lr = typeof repo.latest_release === "string"
        ? JSON.parse(repo.latest_release) : repo.latest_release;
      const assets = lr.assets || [];
      const exe = assets.find((a: any) => a.name?.endsWith(".exe"));
      const msi = assets.find((a: any) => a.name?.endsWith(".msi"));
      const zip = assets.find((a: any) => a.name?.endsWith(".zip"));
      if (exe) return exe.browser_download_url;
      if (msi) return msi.browser_download_url;
      if (zip) return zip.browser_download_url;
      if (assets[0]) return assets[0].browser_download_url;
    } catch {}
  }
  return repo.html_url || "";
}