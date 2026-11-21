// SideNav — 左侧导航栏（Microsoft Store 风格）
// 竖向列表，当前选中项高亮

import {
    VStack, HStack, Spacer, Text, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    widgetSetWidth,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
    textSetString,
    widgetSetOnMouseDown,
    widgetSetOnClick,
} from "perry/ui";
import { COLORS, SPACING, FONT, RADIUS } from "../styles/theme";
import { getSpec } from "../responsive";

// 导航项定义
const NAV_ITEMS = [
    { id: "home", label: "首页", icon: "⌂" },
    { id: "packages", label: "软件库", icon: "▦" },
    { id: "featured", label: "精选推荐", icon: "★" },
    { id: "categories", label: "分类浏览", icon: "☰" },
    { id: "downloads", label: "下载管理", icon: "↓" },
    { id: "dedup", label: "去重报告", icon: "◎" },
    { id: "installed", label: "已安装", icon: "✓" },
    { id: "updates", label: "更新中心", icon: "↻" },
    { id: "settings", label: "设置", icon: "⚙" },
];

let _currentPage: string = "home";

interface NavItemState {
    id: string;
    icon: string;
    labelText: string;
    compact: boolean;
    area: Widget;
    label: Widget;
}

let _navItems: NavItemState[] = [];

function refreshNav(): void {
    for (let i = 0; i < _navItems.length; i++) {
        const st = _navItems[i];
        const active = _currentPage === st.id || (_currentPage === "detail" && st.id === "packages");
        textSetString(st.label, st.compact ? st.icon : st.icon + "  " + st.labelText);
        textSetColor(
            st.label,
            active ? COLORS.primary.r : COLORS.textSecondary.r,
            active ? COLORS.primary.g : COLORS.textSecondary.g,
            active ? COLORS.primary.b : COLORS.textSecondary.b,
            1.0,
        );
        widgetSetBackgroundColor(st.area, active ? 0.945 : COLORS.white.r, active ? 0.953 : COLORS.white.g, active ? 0.965 : COLORS.white.b, 1.0);
        setCornerRadius(st.area, active ? RADIUS.smallCard : 0);
    }
}

export function setCurrentPage(page: string): void {
    _currentPage = page;
    refreshNav();
}
(globalThis as any).__hamsterStoreSetNavPage = setCurrentPage;

function NavItem(item: typeof NAV_ITEMS[0]): Widget {
    const spec = getSpec();
    const compact = spec.compact;
    const label = Text(compact ? item.icon : item.icon + "  " + item.label);
    textSetFontSize(label, compact ? 16 : FONT.base);
    textSetColor(label, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const area = HStack(SPACING.md, [label]);
    widgetMatchParentWidth(area);
    // 统一白色底；选中态交给 refreshNav（单一状态源，避免多处高亮不同步）
    widgetSetBackgroundColor(area, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    if (compact) {
        setPadding(area, 6, 16, 6, 16);
    } else {
        setPadding(area, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);
    }
    const activate = () => {
        if (item.id === "home" || item.id === "packages") {
            (globalThis as any).__hamsterStoreCategory = null;
            (globalThis as any).__hamsterStoreSourceId = 0;
        }
        _currentPage = item.id;
        // 通知 AppLayout 更新内容区
        (globalThis as any).__hamsterStoreNavigate && (globalThis as any).__hamsterStoreNavigate(item.id);
    };
    widgetSetOnMouseDown(area, activate);
    widgetSetOnClick(label, activate);

    _navItems.push({ id: item.id, icon: item.icon, labelText: item.label, compact: compact, area: area, label: label });
    return area;
}

export function SideNav(): Widget {
    const spec = getSpec();
    const items: Widget[] = [];
    _navItems = [];
    for (const item of NAV_ITEMS) {
        items.push(NavItem(item));
    }
    refreshNav();

    items.push(Spacer());
    const nav = VStack(SPACING.xs, items);
    widgetSetWidth(nav, spec.sidebar);
    widgetSetBackgroundColor(nav, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setPadding(nav, spec.compact ? 4 : SPACING.sm, 0, SPACING.sm, 0);

    return nav;
}
