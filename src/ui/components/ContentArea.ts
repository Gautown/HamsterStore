// ContentArea — right content region (responsive)
// Page content is wrapped in a ScrollView so small window heights still work.
import {
    VStack, ScrollView, Text, type Widget,
    widgetAddChild, widgetMatchParentWidth, widgetSetBackgroundColor,
    widgetSetHeight, widgetSetHidden, scrollviewSetChild,
    setPadding, textSetFontSize, textSetColor,
} from "perry/ui";
import { COLORS, SPACING, FONT } from "../styles/theme";
import { PackageList } from "./PackageList";
import { InstalledList } from "./InstalledList";
import { SettingsPanel } from "./SettingsPanel";
import { UpdateCenter } from "./UpdateCenter";
import { DownloadsPage, setRebuildBody as setDownloadRebuild } from "./DownloadManager";
import { DedupReportPage, setRebuildBody as setDedupRebuild } from "./DedupReport";
import { CategoryBrowser } from "./CategoryBrowser";
import { PackageDetail } from "./PackageDetail";
import { SourceRepository } from "../../data";
import { buildHomePage } from "../app";
import { getSpec, mainRowHeight } from "../responsive";

let _currentPage: string = "home";
let _host: Widget | null = null;
let _sv: Widget | null = null;
let _pages: Record<string, Widget> = {};
let _widgets: Widget[] = [];

function pageKey(page: string): string {
    if (page === "packages") {
        const cat = (globalThis as any).__hamsterStoreCategory || "";
        const src = (globalThis as any).__hamsterStoreSourceId || 0;
        const q = (globalThis as any).__hamsterStoreQuery || "";
        return "packages|" + cat + "|" + src + "|" + q;
    }
    if (page === "detail") {
        return "detail|" + ((globalThis as any).__hamsterStoreDetailId || 0);
    }
    return page;
}

function buildPage(page: string): Widget | null {
    switch (page) {
        case "packages":
            return PackageList({
                category: (globalThis as any).__hamsterStoreCategory || null,
                sourceId: (globalThis as any).__hamsterStoreSourceId || 0,
                query: (globalThis as any).__hamsterStoreQuery || "",
            });
        case "featured":
            return buildFeaturedPage();
        case "categories":
            return CategoryBrowser((catId) => {
                (globalThis as any).__hamsterStoreCategory = catId || null;
                (globalThis as any).__hamsterStoreSourceId = 0;
                const nav = (globalThis as any).__hamsterStoreNavigate;
                if (typeof nav === "function") nav("packages");
            });
        case "downloads":
            setDownloadRebuild(() => { /* handled globally */ });
            return DownloadsPage();
        case "dedup":
            setDedupRebuild(() => { /* handled globally */ });
            return DedupReportPage();
        case "installed":
            return InstalledList();
        case "updates":
            return UpdateCenter();
        case "settings":
            return SettingsPanel();
        case "detail":
            return PackageDetail((globalThis as any).__hamsterStoreDetailId || selectedPackageId);
        default:
            return buildHomePage();
    }
}

// 切页：旧页只隐藏不销毁（0.5.1520 Windows 销毁控件会 AV），新页首次访问时构建
export function setCurrentPage(page: string): void {
    _currentPage = page;
    if (!_host) return;
    const key = pageKey(page);
    let target: Widget | null = _pages[key] || null;
    if (!target) {
        target = buildPage(page) || Text("页面构建失败");
        _pages[key] = target;
        _widgets.push(target);
        widgetAddChild(_host, target);
    }
    for (let i = 0; i < _widgets.length; i++) {
        widgetSetHidden(_widgets[i], _widgets[i] === target ? 0 : 1);
    }
    if (_sv) scrollviewSetChild(_sv, _host);
}
(globalThis as any).__hamsterStoreSetContentPage = setCurrentPage;

export function ContentArea(): Widget {
    _pages = {};
    _widgets = [];
    const host = VStack(0, []);
    widgetMatchParentWidth(host);
    _host = host;

    const first = buildPage(_currentPage) || Text("页面构建失败");
    _pages[pageKey(_currentPage)] = first;
    _widgets.push(first);
    widgetAddChild(host, first);

    const spec = getSpec();
    const sv = ScrollView();
    _sv = sv;
    scrollviewSetChild(sv, host);
    widgetMatchParentWidth(sv);
    widgetSetHeight(sv, Math.max(160, mainRowHeight() - spec.pagePad * 2));

    const container = VStack(0, [sv]);
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, spec.pagePad, spec.pagePad, spec.pagePad, spec.pagePad);

    return container;
}

let selectedPackageId: number = 0;

// exposed for PackageList click-through
export function setSelectedPackageId(id: number): void {
    selectedPackageId = id;
}

// featured page
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
