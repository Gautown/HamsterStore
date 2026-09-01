// HamsterStoreApp — Microsoft Store 风格全屏布局
// 顶部标题栏 + 左侧导航 + 右侧内容区

import {
    HStack, VStack, Text, Button, Divider, type Widget,
    widgetAddChild, widgetClearChildren, widgetMatchParentWidth,
    widgetSetBackgroundColor, setPadding, setCornerRadius,
    textSetFontSize, textSetColor, onFrame,
} from "perry/ui";
import { COLORS, SPACING, FONT, RADIUS } from "./styles/theme";
import { AppLayout } from "./AppLayout";
import { PackageList } from "./components/PackageList";
import { InstalledList } from "./components/InstalledList";
import { SettingsPanel } from "./components/SettingsPanel";
import { UpdateCenter } from "./components/UpdateCenter";
import { DownloadsPage, setRebuildBody as setDownloadRebuild } from "./components/DownloadManager";
import { DedupReportPage, setRebuildBody as setDedupRebuild } from "./components/DedupReport";
import { CategoryBrowser } from "./components/CategoryBrowser";
import { PackageDetail } from "./components/PackageDetail";
import { PackageRepository, InstallationRepository, DownloadRepository, SourceRepository } from "./data";
import { CATEGORY_TREE } from "./core/categorization/CategoryEngine";
import { DownloadManager } from "./core/download/DownloadManager";
import { dedupCleaner } from "./core/dedup/DedupCleaner";

// === 全局状态 ===
let currentPage: string = "home";
let selectedCategory: string | null = null;
let selectedSourceId: number = 0;
let selectedPackageId: number = 0;
let searchQuery: string = "";

// 暴露给 SideNav 和 ContentArea 的导航函数
(globalThis as any).__hamsterStoreNavigate = function(pageId: string): void {
    currentPage = pageId;
    if (pageId === "home" || pageId === "packages") {
        selectedCategory = null;
        selectedSourceId = 0;
    }
    rebuildContent();
};

(globalThis as any).__hamsterStoreCategory = null;
(globalThis as any).__hamsterStoreSourceId = 0;
(globalThis as any).__hamsterStoreQuery = "";

// === §6.2 构建主窗口主体 ===
export function buildMainBody(): Widget {
    return AppLayout();
}

// 重建内容区（由 SideNav 点击导航项触发）
function rebuildContent(): void {
    // ContentArea 自己管理状态，这里只做全局状态同步
    (globalThis as any).__hamsterStoreCurrentPage = currentPage;
}

// 导出给 PackageList 用：点击卡片跳转详情
export function navigateToDetail(packageId: number): void {
    selectedPackageId = packageId;
    currentPage = "detail";
    rebuildContent();
    // 设置详情页面
    (globalThis as any).__hamsterStoreDetailPage = PackageDetail(packageId);
}

// 暴露给 TitleBar 使用
(globalThis as any).__hamsterRunSearch = runSearch;
(globalThis as any).__hamsterCloseWindow = () => { try { process.exit(0); } catch {} };

function runSearch(query: string): void {
    searchQuery = (query || "").trim().toLowerCase();
    selectedCategory = null;
    selectedSourceId = 0;
    currentPage = "packages";
    (globalThis as any).__hamsterStoreQuery = searchQuery;
    rebuildContent();
}

// === §6.2 首页 Bento Grid 布局 ===
export function buildHomePage(): Widget {
    const pkgs = PackageRepository.getAll();
    const installed = safeCount(() => InstallationRepository.getAll());
    const sources = SourceRepository.getAll().length;
    const updatable = 0;
    const downloads = safeCount(() => DownloadRepository.getAll());

    // 第一行：统计卡片
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

    // 下载管理快捷入口
    const dlCard = BentoCard({
        title: "下载管理",
        subtitle: "运行中: " + DownloadManager.getActive().length + " | 队列: " + DownloadManager.getQueued().length,
        size: "small",
        bgColor: { r: COLORS.primary.r, g: COLORS.primary.g, b: COLORS.primary.b },
        onPress: () => { (globalThis as any).__hamsterStoreNavigate("downloads"); },
    });

    const dedupReport = (() => {
        try {
            const r = dedupCleaner.generateReport();
            return "重复: " + r.duplicateGroups + " 组 | 模糊: " + r.fuzzyCandidates.length + " 对";
        } catch { return "去重: 检查中"; }
    })();
    const dedupCard = BentoCard({
        title: "去重报告",
        subtitle: dedupReport,
        size: "small",
        bgColor: { r: COLORS.warning.r, g: COLORS.warning.g, b: COLORS.warning.b },
        onPress: () => { (globalThis as any).__hamsterStoreNavigate("dedup"); },
    });

    const topRow = BentoGrid([statCard, hotCard, updateCard, dlCard, dedupCard], { columns: 5, spacing: SPACING.md });

    // 第二行：精选推荐 + 分类浏览
    const sourcesList = SourceRepository.getAll();
    const seedLines: Widget[] = [];
    for (let i = 0; i < Math.min(sourcesList.length, 6); i++) {
        seedLines.push(buildSeedLine(sourcesList[i].owner + "/" + sourcesList[i].repo));
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
            (globalThis as any).__hamsterStoreSourceId = sourceId;
            rebuildContent();
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
export function BentoCard(options: { title?: string; subtitle?: string; badge?: string; icon?: string; size?: "large" | "medium" | "small"; bgColor?: { r: number; g: number; b: number }; onPress?: () => void }, children: Widget[] = []): Widget {
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
    setCornerRadius(card, rd);
    setPadding(card, padding, padding, padding, padding);

    if (options.onPress) {
        // 注意：perry 中 Button.onPress 不可靠，用 widgetSetOnMouseDown
        // 但 BentoCard 是 VStack，无法直接绑定鼠标事件
        // 这里暂时不做点击处理，由调用方自己处理
    }

    return card;
}

export function BentoGrid(items: Widget[], options: { columns?: number; spacing?: number } = {}): Widget {
    const cols = options.columns || 3;
    const gap = options.spacing || SPACING.md;
    const rows: Widget[] = [];

    for (let i = 0; i < items.length; i += cols) {
        const slice = items.slice(i, i + cols);
        const row = HStack(gap, slice);
        widgetMatchParentWidth(row);
        rows.push(row);
    }

    const grid = VStack(gap, rows);
    widgetMatchParentWidth(grid);
    return grid;
}
