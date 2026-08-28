// HamsterStoreApp — Bento UI 主应用窗口
// 开发文档 §6.2 Bento Grid + §6.4 七大核心页面

import {
    VStack, HStack, Text, Button, Divider, type Widget,
    widgetAddChild, widgetClearChildren, widgetMatchParentWidth,
    widgetSetBackgroundColor, setPadding, setCornerRadius,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { COLORS, SPACING, FONT, RADIUS } from "./styles/theme";
import { BentoTitleBar } from "./components/BentoTitleBar";
import { StatusBar } from "./components/StatusBar";
import { BentoCard } from "./components/BentoCard";
import { PackageList } from "./components/PackageList";
import { InstalledList } from "./components/InstalledList";
import { SettingsPanel } from "./components/SettingsPanel";
import { UpdateCenter } from "./components/UpdateCenter";
import { DownloadsPage } from "./components/DownloadManager";
import { CategoryBrowser } from "./components/CategoryBrowser";
import { BentoGrid } from "./components/BentoGrid";
import { PackageDetail } from "./components/PackageDetail";
import { PackageRepository, InstallationRepository, DownloadRepository, SourceRepository } from "../data";
import { CATEGORY_TREE } from "../core/categorization/CategoryEngine";

// 全局窗口引用 + 当前页面状态
let windowRef: Widget | null = null;
let contentRef: Widget | null = null;
let currentPage: string = "home";
let selectedCategory: string | null = null;
let selectedPackageId: number = 0;
let selectedSourceId: number = 0;
let searchQuery: string = "";

// === §6.2 构建主窗口主体 ===
export function buildMainBody(): Widget {
    const titleBar = BentoTitleBar();
    const navPlaceholder = VStack(0, []);
    navRef = navPlaceholder;
    const nav = buildNav();
    widgetAddChild(navPlaceholder, nav);
    // contentRef 是空容器，rebuildBody 会 clear+add 切换页面内容
    const contentPlaceholder = VStack(0, []);
    contentRef = contentPlaceholder;
    const initialContent = buildPageContent(currentPage);
    widgetAddChild(contentPlaceholder, initialContent);
    const status = StatusBar();

    const body = VStack(SPACING.md, [
        titleBar,
        HStack(SPACING.md, [navPlaceholder, contentPlaceholder]),
        status,
    ]);

    widgetMatchParentWidth(body);
    widgetSetBackgroundColor(body, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(body, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    windowRef = body;
    return body;
}

// === §6.4 导航栏 — 八大页面入口（Bento 风格竖向按钮） ===
function buildNav(): Widget {
    const navItems = [
        { id: "home", label: "首页", icon: "[H]" },
        { id: "packages", label: "软件库", icon: "[P]" },
        { id: "featured", label: "精选推荐", icon: "[F]" },
        { id: "categories", label: "分类浏览", icon: "[C]" },
        { id: "downloads", label: "下载管理", icon: "[D]" },
        { id: "installed", label: "已安装", icon: "[I]" },
        { id: "updates", label: "更新中心", icon: "[U]" },
        { id: "settings", label: "设置", icon: "[S]" },
    ];

    const btns: Widget[] = [];
    for (let i = 0; i < navItems.length; i++) {
        const itemId = navItems[i].id;
        const icon = navItems[i].icon;
        const label = navItems[i].label;
        // 高亮当前选中
        const isActive = currentPage === itemId;
        const displayLabel = (isActive ? "> " : "  ") + icon + " " + label;
        const btn = Button(displayLabel, () => {
            currentPage = itemId;
            // 选中分类/来源时重置
            if (itemId === "home" || itemId === "packages") {
                selectedCategory = null;
                selectedSourceId = 0;
            }
            rebuildBody();
        });
        btns.push(btn);
    }

    const nav = VStack(SPACING.xs, btns);
    widgetMatchParentWidth(nav);
    widgetSetBackgroundColor(nav, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setCornerRadius(nav, RADIUS.card);
    setPadding(nav, SPACING.sm, SPACING.xs, SPACING.sm, SPACING.xs);
    return nav;
}

let navRef: Widget | null = null;

function rebuildBody(): void {
    if (!contentRef || !navRef) return;
    // 重建内容区
    widgetClearChildren(contentRef);
    const newContent = buildPageContent(currentPage);
    widgetAddChild(contentRef, newContent);
    // 重建导航栏（更新选中高亮）
    widgetClearChildren(navRef);
    const newNav = buildNav();
    widgetAddChild(navRef, newNav);
}

// === §6.4 页面路由 ===
function buildPageContent(page: string): Widget {
    switch (page) {
        case "packages": return PackageList({ category: selectedCategory, sourceId: selectedSourceId, query: searchQuery });
        case "featured": return buildFeaturedPage();
        case "categories": return CategoryBrowser((catId) => {
            selectedCategory = catId || null;
            selectedSourceId = 0;
            currentPage = "packages";
            rebuildBody();
        });
        case "downloads": return DownloadsPage();
        case "installed": return InstalledList();
        case "updates": return UpdateCenter();
        case "settings": return SettingsPanel();
        case "detail": return PackageDetail(selectedPackageId);
        default: return buildHomePage();
    }
}

// 导出给 PackageList 用：点击卡片跳转详情
export function navigateToDetail(packageId: number): void {
    selectedPackageId = packageId;
    currentPage = "detail";
    rebuildBody();
}

// 导出给标题栏搜索用：本地搜索并跳转到软件库（按关键词过滤）
export function runSearch(query: string): void {
    searchQuery = (query || "").trim().toLowerCase();
    selectedCategory = null;
    selectedSourceId = 0;
    currentPage = "packages";
    rebuildBody();
}

// === §6.2 首页 Bento Grid 布局 ===
function buildHomePage(): Widget {
    const pkgs = PackageRepository.getAll();
    const installed = safeCount(() => InstallationRepository.getAll());
    const sources = SourceRepository.getAll().length;
    const updatable = 0;
    const downloads = safeCount(() => DownloadRepository.getAll());

    // 第一行：统计 + 热门推荐 + 更新提醒
    const statCard = BentoCard({
        title: "软件统计",
        subtitle: "已安装: " + installed + " | 可更新: " + updatable + " | 软件源: " + sources + " 个",
        size: "large",
    });

    const hotCard = BentoCard({
        title: "热门推荐",
        subtitle: pkgs.length > 0 ? pkgs[0].name : "暂无",
        size: "small",
    });

    const updateCard = BentoCard({
        title: "更新提醒",
        subtitle: updatable + " 个待更新 | 下载: " + downloads,
        size: "small",
    });

    const topRow = BentoGrid([statCard, hotCard, updateCard], { columns: 3, spacing: SPACING.md });

    // 第二行：精选推荐 + 分类浏览
    const sources = SourceRepository.getAll();
    const seedLines: Widget[] = [];
    for (let i = 0; i < Math.min(sources.length, 6); i++) {
        seedLines.push(buildSeedLine(sources[i].owner + "/" + sources[i].repo));
    }

    const featuredCard = BentoCard({
        title: "精选推荐（来自种子仓库）",
        size: "medium",
    }, seedLines);

    const catKeys = Object.keys(CATEGORY_TREE).slice(0, 6);
    const catLabels: Widget[] = [];
    for (let i = 0; i < catKeys.length; i++) {
        catLabels.push(buildSeedLine(emojiForCat(catKeys[i]) + " " + CATEGORY_TREE[catKeys[i]].name));
    }

    const catCard = BentoCard({
        title: "分类浏览",
        size: "medium",
    }, catLabels);

    const midRow = BentoGrid([featuredCard, catCard], { columns: 2, spacing: SPACING.md });

    // 第三行：搜索栏
    const searchBar = Text("提示: 使用顶部搜索框检索 " + pkgs.length + " 个软件");
    textSetFontSize(searchBar, FONT.xs);
    textSetColor(searchBar, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    // 第四行：软件卡片预览（前4个）
    const pkgPreview: Widget[] = [];
    const previewCount = Math.min(pkgs.length, 4);
    for (let i = 0; i < previewCount; i++) {
        const p = pkgs[i];
        const name = (p.name || "").split("/").pop() || (p.name || "Unknown");
        pkgPreview.push(BentoCard({
            title: name,
            subtitle: (p.description || "").substring(0, 50),
            size: "small",
        }));
    }

    const previewGrid = pkgPreview.length > 0 ? BentoGrid(pkgPreview, { columns: 4, spacing: SPACING.sm }) : buildSeedLine("暂无软件包 — 运行 sync 同步获取");

    const container = VStack(SPACING.md, [topRow, midRow, searchBar, previewGrid]);
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, SPACING.md, SPACING.md, SPACING.md, SPACING.md);
    return container;
}

// === §6.4 精选推荐页面 ===
function buildFeaturedPage(): Widget {
    const sources = SourceRepository.getAll();

    const btns: Widget[] = [];
    for (let i = 0; i < sources.length; i++) {
        const s = sources[i];
        const label = s.owner + "/" + s.repo;
        const sourceId = s.id;
        const btn = Button(label, () => {
            selectedSourceId = sourceId;
            currentPage = "packages";
            rebuildBody();
        });
        btns.push(btn);
    }

    const card = BentoCard({
        title: "精选推荐 — 种子仓库 (" + sources.length + ")",
        subtitle: "点击查看每个种子仓库收录的软件",
        size: "large",
    }, btns);

    const container = VStack(SPACING.md, [card]);
    widgetMatchParentWidth(container);
    setPadding(container, SPACING.md, SPACING.md, SPACING.md, SPACING.md);
    return container;
}

function buildSeedLine(text: string): Widget {
    const w = Text(text);
    textSetFontSize(w, FONT.xs);
    textSetColor(w, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
    return w;
}

function emojiForCat(catId: string): string {
    // perry parser 不支持 Record<string,string> + emoji → 用 if-else 链
    if (catId === "dev-tools") return "[dev]";
    if (catId === "dev-ops") return "[ops]";
    if (catId === "system") return "[sys]";
    if (catId === "network") return "[net]";
    if (catId === "security") return "[sec]";
    if (catId === "media") return "[media]";
    if (catId === "office") return "[office]";
    if (catId === "communication") return "[comm]";
    if (catId === "browser") return "[browser]";
    if (catId === "design") return "[design]";
    if (catId === "database") return "[db]";
    if (catId === "education") return "[edu]";
    if (catId === "game") return "[game]";
    if (catId === "utility") return "[util]";
    if (catId === "web") return "[web]";
    if (catId === "ai") return "[ai]";
    return "[pkg]";
}

function safeCount(fn: () => any[]): number {
    try { return fn().length; } catch { return 0; }
}