// HamsterStoreApp — Microsoft Store 风格全屏布局
// 顶部标题栏 + 左侧导航 + 右侧内容区

import {
    HStack, VStack, Text, Button, Divider, Spacer, type Widget,
    widgetAddChild, widgetClearChildren, widgetMatchParentWidth,
    widgetSetWidth,
    widgetSetBackgroundColor, setPadding, setCornerRadius,
    textSetFontSize, textSetColor, onFrame, widgetSetOnMouseDown,
} from "perry/ui";

// Perry v0.5.1220: 内联颜色常量，避免导入链问题
const COLORS = {
    primary: { r: 0.145, g: 0.388, b: 0.922 },
    secondary: { r: 0.063, g: 0.725, b: 0.506 },
    neutral: { r: 0.118, g: 0.161, b: 0.231 },
    white: { r: 1.0, g: 1.0, b: 1.0 },
    bg: { r: 0.945, g: 0.953, b: 0.965 },
    bgCard: { r: 1.0, g: 1.0, b: 1.0 },
    text: { r: 0.118, g: 0.161, b: 0.231 },
    textSecondary: { r: 0.392, g: 0.451, b: 0.510 },
    divider: { r: 0.878, g: 0.886, b: 0.902 },
    error: { r: 0.937, g: 0.267, b: 0.267 },
    success: { r: 0.22, g: 0.72, b: 0.40 },
    warning: { r: 0.96, g: 0.68, b: 0.16 },
    danger: { r: 0.94, g: 0.24, b: 0.24 },
    star: { r: 0.961, g: 0.725, b: 0.141 },
};

const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const FONT = { xs: 10, sm: 12, base: 14, md: 16, lg: 18, xl: 22, title: 28 };
const RADIUS = { card: 16, smallCard: 12, button: 10 };
import { AppLayout } from "./AppLayout";
import { PackageList } from "./components/PackageList";
import { InstalledList } from "./components/InstalledList";
import { SettingsPanel } from "./components/SettingsPanel";
import { UpdateCenter } from "./components/UpdateCenter";
import { DownloadsPage, setRebuildBody as setDownloadRebuild } from "./components/DownloadManager";
import { DedupReportPage, setRebuildBody as setDedupRebuild } from "./components/DedupReport";
import { CategoryBrowser } from "./components/CategoryBrowser";
import { PackageDetail } from "./components/PackageDetail";
import { PackageRepository, InstallationRepository, DownloadRepository, SourceRepository } from "../data";
import { CATEGORY_TREE } from "../core/categorization/CategoryEngine";
import { getSpec, contentWidth, gridCardWidth } from "./responsive";
import { DownloadManager } from "../core/download/DownloadManager";
import { dedupCleaner } from "../core/dedup/DedupCleaner";

// === 全局状态 ===
let currentPage: string = "home";
let selectedCategory: string | null = null;
let selectedSourceId: number = 0;
let selectedPackageId: number = 0;
let searchQuery: string = "";

// 使用 defineProperty 避免只读属性冲突
const defineGlobal = (name: string, value: any): void => {
    try {
        Object.defineProperty(globalThis, name, {
            value: value,
            writable: true,
            configurable: true,
            enumerable: true,
        });
    } catch {
        // 如果已存在且不可配置，尝试删除后重新定义
        try {
            delete (globalThis as any)[name];
            (globalThis as any)[name] = value;
        } catch {}
    }
};

// 暴露给 SideNav 和 ContentArea 的导航函数
defineGlobal("__hamsterStoreNavigate", function(pageId: string): void {
    currentPage = pageId;
    defineGlobal("__hamsterStoreCurrentPage", currentPage);
    // 只切换可见性：SideNav 改高亮，ContentArea 换页面（均为 show/hide，不销毁控件）
    const setNav = (globalThis as any).__hamsterStoreSetNavPage;
    if (typeof setNav === "function") setNav(pageId);
    const setContent = (globalThis as any).__hamsterStoreSetContentPage;
    if (typeof setContent === "function") setContent(pageId);
});

defineGlobal("__hamsterStoreCategory", null);
defineGlobal("__hamsterStoreSourceId", 0);
defineGlobal("__hamsterStoreQuery", "");
defineGlobal("__hamsterStoreCurrentPage", currentPage);
defineGlobal("__hamsterStoreGetPackages", () => PackageRepository.getAll());
defineGlobal("__hamsterStoreRebuild", rebuildContent);

// === §6.2 构建主窗口主体 ===
export function buildMainBody(): Widget {
    return AppLayout();
}

// === 底部状态栏 ===
export function getStatusBar(): Widget {
    return StatusBar();
}

// 重建内容区（由 SideNav 点击导航项触发）
function rebuildContent(): void {
    // ContentArea 自己管理状态，这里只做全局状态同步
    defineGlobal("__hamsterStoreCurrentPage", currentPage);
}

// 导出给 PackageList 用：点击卡片跳转详情
export function navigateToDetail(packageId: number): void {
    selectedPackageId = packageId;
    currentPage = "detail";
    defineGlobal("__hamsterStoreDetailId", packageId);
    const nav = (globalThis as any).__hamsterStoreNavigate;
    if (typeof nav === "function") nav("detail");
}

// 暴露给 TitleBar 使用
defineGlobal("__hamsterRunSearch", runSearch);
defineGlobal("__hamsterCloseWindow", () => { try { process.exit(0); } catch {} });

export function runSearch(query: string): void {
    searchQuery = (query || "").trim().toLowerCase();
    selectedCategory = null;
    selectedSourceId = 0;
    currentPage = "packages";
    defineGlobal("__hamsterStoreQuery", searchQuery);
    defineGlobal("__hamsterStoreCurrentPage", currentPage);
    const nav = (globalThis as any).__hamsterStoreNavigate;
    if (typeof nav === "function") nav("packages");
}

// === §6.2 首页 Bento Grid 布局 ===
export function buildHomePage(): Widget {
    console.log("[buildHomePage] Starting...");
    const pkgs = PackageRepository.getAll();
    console.log("[buildHomePage] Packages loaded:", pkgs?.length);
    const installed = safeCount(() => InstallationRepository.getAll());
    console.log("[buildHomePage] Installed:", installed);
    const sources = SourceRepository.getAll().length;
    console.log("[buildHomePage] Sources:", sources);
    const updatable = 0;
    const downloads = safeCount(() => DownloadRepository.getAll());
    console.log("[buildHomePage] Downloads:", downloads);

    const spec = getSpec();
    const cw = contentWidth();
    const cardW = gridCardWidth(spec.columns, spec.gap);
    const midW = gridCardWidth(spec.midColumns, spec.gap);
    const previewW = gridCardWidth(spec.previewColumns, SPACING.sm);

    // 第一行：统计卡片
    console.log("[buildHomePage] Building statCard...");
    const statCard = BentoCard({
        title: "软件统计",
        subtitle: "已安装: " + installed + " | 可更新: " + updatable + " | 软件源: " + sources + " 个",
        size: "large",
        width: cardW,
    });

    const hotCard = BentoCard({
        title: "热门推荐",
        subtitle: pkgs.length > 0 ? pkgs[0].name : "暂无",
        size: "small",
        width: cardW,
    });

    const updateCard = BentoCard({
        title: "更新提醒",
        subtitle: updatable + " 个待更新 | 下载: " + downloads,
        size: "small",
        width: cardW,
    });

    // 下载管理快捷入口
    const dlCard = BentoCard({
        title: "下载管理",
        subtitle: "运行中: " + DownloadManager.getActive().length + " | 队列: " + DownloadManager.getQueued().length,
        size: "small",
        width: cardW,
        bgColor: { r: COLORS.primary.r, g: COLORS.primary.g, b: COLORS.primary.b },
        onPress: () => { (globalThis as any).__hamsterStoreNavigate("downloads"); },
    });

    const dedupReport = (() => {
        try {
            // Perry v0.5.1220: 跳过去重报告，避免崩溃
            return "去重: 暂不可用";
        } catch { return "去重: 检查中"; }
    })();
    const dedupCard = BentoCard({
        title: "去重报告",
        subtitle: dedupReport,
        size: "small",
        width: cardW,
        bgColor: { r: COLORS.warning.r, g: COLORS.warning.g, b: COLORS.warning.b },
        onPress: () => { (globalThis as any).__hamsterStoreNavigate("dedup"); },
    });

    const topRow = BentoGrid([statCard, hotCard, updateCard, dlCard, dedupCard], { columns: spec.columns, spacing: spec.gap, width: cw });

    // 第二行：精选推荐 + 分类浏览
    const sourcesList = SourceRepository.getAll();
    const seedLines: Widget[] = [];
    for (let i = 0; i < Math.min(sourcesList.length, 6); i++) {
        seedLines.push(buildSeedLine(sourcesList[i].owner + "/" + sourcesList[i].repo));
    }

    const featuredCard = BentoCard({
        title: "精选推荐（来自种子仓库）",
        size: "medium",
        width: midW,
    }, seedLines);

    const catKeys = Object.keys(CATEGORY_TREE).slice(0, 6);
    const catLabels: Widget[] = [];
    for (let i = 0; i < catKeys.length; i++) {
        catLabels.push(buildSeedLine(emojiForCat(catKeys[i]) + " " + CATEGORY_TREE[catKeys[i]].name));
    }

    const catCard = BentoCard({
        title: "分类浏览",
        size: "medium",
        width: midW,
    }, catLabels);

    const midRow = BentoGrid([featuredCard, catCard], { columns: spec.midColumns, spacing: spec.gap, width: cw });

    // 第三行：搜索提示
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
            width: previewW,
        }));
    }

    const previewGrid = pkgPreview.length > 0 ? BentoGrid(pkgPreview, { columns: spec.previewColumns, spacing: SPACING.sm, width: cw }) : buildSeedLine("暂无软件包 — 运行 sync 同步获取");

    const container = VStack(spec.gap, [topRow, midRow, searchBar, previewGrid, Spacer()]);
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, 0, 0, 0, 0);
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
            defineGlobal("__hamsterStoreSourceId", sourceId);
            defineGlobal("__hamsterStoreCategory", null);
            const nav = (globalThis as any).__hamsterStoreNavigate;
            if (typeof nav === "function") nav("packages");
        });
        btns.push(btn);
    }

    const card = BentoCard({
        title: "精选推荐 — 种子仓库 (" + sources.length + ")",
        subtitle: "点击查看每个种子仓库收录的软件",
        size: "large",
    }, btns);

    const container = VStack(SPACING.md, [card, Spacer()]);
    widgetMatchParentWidth(container);
    setPadding(container, 0, 0, 0, 0);
    return container;
}

function buildSeedLine(text: string): Widget {
    const w = Text(text);
    textSetFontSize(w, FONT.xs);
    textSetColor(w, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
    return w;
}

function emojiForCat(catId: string): string {
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

// === BentoCard 和 BentoGrid 内联（避免循环依赖）===
export function BentoCard(options: { title?: string; subtitle?: string; badge?: string; icon?: string; size?: "large" | "medium" | "small"; bgColor?: { r: number; g: number; b: number }; width?: number; onPress?: () => void }, children: Widget[] = []): Widget {
    const title = options.title;
    const subtitle = options.subtitle;
    const size = options.size || "medium";
    const bgColor = options.bgColor;

    const contentWidgets: Widget[] = [];
    if (title) {
        const titleW = Text(title);
        textSetFontSize(titleW, size === "large" ? FONT.lg : FONT.md);
        textSetColor(titleW, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
        contentWidgets.push(titleW);
    }
    if (subtitle) {
        const subW = Text(subtitle);
        textSetFontSize(subW, FONT.sm);
        textSetColor(subW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        contentWidgets.push(subW);
    }
    for (let i = 0; i < children.length; i++) {
        contentWidgets.push(children[i]);
    }

    const padding = size === "small" ? SPACING.sm : SPACING.md;
    const rd = size === "large" ? RADIUS.card : RADIUS.smallCard;
    const bg = bgColor || COLORS.bgCard;

    const card = VStack(SPACING.sm, contentWidgets);
    widgetSetBackgroundColor(card, bg.r, bg.g, bg.b, 1.0);
    widgetMatchParentWidth(card);
    if (options.width && options.width > 0) widgetSetWidth(card, options.width);
    setCornerRadius(card, rd);
    setPadding(card, padding, padding, padding, padding);

    if (options.onPress) {
        widgetSetOnMouseDown(card, options.onPress);
        for (let i = 0; i < contentWidgets.length; i++) {
            widgetSetOnMouseDown(contentWidgets[i], options.onPress);
        }
    }

    return card;
}

export function BentoGrid(items: Widget[], options: { columns?: number; spacing?: number; width?: number } = {}): Widget {
    const cols = Math.max(1, options.columns || 3);
    const gap = options.spacing || SPACING.md;
    const rows: Widget[] = [];

    // 单元格宽度：铺满 width（或内容区），最后一行不足 cols 时仍保持同宽
    const totalW = options.width && options.width > 0 ? options.width : contentWidth();
    const itemW = Math.max(120, Math.floor((totalW - gap * (cols - 1)) / cols));

    for (let i = 0; i < items.length; i += cols) {
        const slice = items.slice(i, i + cols);
        for (let c = 0; c < slice.length; c++) {
            widgetSetWidth(slice[c], itemW);
        }
        const rowKids: Widget[] = [];
        for (let c = 0; c < slice.length; c++) rowKids.push(slice[c]);
        // 末尾 Spacer 吸收余量，防止布局引擎把最后一张卡拉伸到剩余宽度
        rowKids.push(Spacer());
        const row = HStack(gap, rowKids);
        widgetMatchParentWidth(row);
        rows.push(row);
    }

    const grid = VStack(gap, rows);
    widgetMatchParentWidth(grid);
    return grid;
}