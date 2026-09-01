// ContentArea — 右侧内容区域（全屏沉浸式）
// 根据当前页面动态渲染内容

import {
    VStack, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setPadding, Text,
} from "perry/ui";
import { COLORS, SPACING, FONT } from "./styles/theme";
import { PackageList } from "./PackageList";
import { InstalledList } from "./InstalledList";
import { SettingsPanel } from "./SettingsPanel";
import { UpdateCenter } from "./UpdateCenter";
import { DownloadsPage, setRebuildBody as setDownloadRebuild } from "./DownloadManager";
import { DedupReportPage, setRebuildBody as setDedupRebuild } from "./DedupReport";
import { CategoryBrowser } from "./CategoryBrowser";
import { PackageDetail } from "./PackageDetail";
import { PackageRepository, SourceRepository } from "../data";
import { buildHomePage, navigateToDetail } from "../app";

let _currentPage: string = "home";

export function setCurrentPage(page: string): void {
    _currentPage = page;
}

export function ContentArea(): Widget {
    const page = _currentPage;
    const pkgListFilter = {
        category: (globalThis as any).__hamsterStoreCategory || null,
        sourceId: (globalThis as any).__hamsterStoreSourceId || 0,
        query: (globalThis as any).__hamsterStoreQuery || "",
    };

    let content: Widget;
    switch (page) {
        case "packages":
            content = PackageList(pkgListFilter);
            break;
        case "featured":
            content = buildFeaturedPage();
            break;
        case "categories":
            content = CategoryBrowser((catId) => {
                (globalThis as any).__hamsterStoreCategory = catId || null;
                (globalThis as any).__hamsterStoreSourceId = 0;
                _currentPage = "packages";
            });
            break;
        case "downloads":
            setDownloadRebuild(() => { /* handled globally */ });
            content = DownloadsPage();
            break;
        case "dedup":
            setDedupRebuild(() => { /* handled globally */ });
            content = DedupReportPage();
            break;
        case "installed":
            content = InstalledList();
            break;
        case "updates":
            content = UpdateCenter();
            break;
        case "settings":
            content = SettingsPanel();
            break;
        case "detail":
            content = PackageDetail(selectedPackageId);
            break;
        default:
            content = buildHomePage();
    }

    const container = VStack(0, [content]);
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, SPACING.md, SPACING.md, SPACING.md, SPACING.md);

    return container;
}

let selectedPackageId: number = 0;

// 暴露给 PackageList 点击跳转
export function setSelectedPackageId(id: number): void {
    selectedPackageId = id;
}

// 精选推荐页面
function buildFeaturedPage(): Widget {
    const sources = SourceRepository.getAll();
    const items: Widget[] = [];

    for (let i = 0; i < Math.min(sources.length, 10); i++) {
        const s = sources[i];
        const label = Text(s.owner + "/" + s.repo);
        textSetFontSize(label, FONT.base);
        textSetColor(label, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
        items.push(label);
    }

    const title = Text("精选推荐 (" + sources.length + " 个种子仓库)");
    textSetFontSize(title, FONT.lg);
    textSetColor(title, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    return VStack(SPACING.md, [title, ...items]);
}
