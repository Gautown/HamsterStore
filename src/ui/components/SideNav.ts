// SideNav — 左侧导航栏（Microsoft Store 风格）
// 竖向列表，当前选中项高亮

import {
    VStack, HStack, Text, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
    widgetSetOnMouseDown,
} from "perry/ui";
import { COLORS, SPACING, FONT, RADIUS } from "../styles/theme";

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

export function setCurrentPage(page: string): void {
    _currentPage = page;
}

function NavItem(item: typeof NAV_ITEMS[0]): Widget {
    const isActive = _currentPage === item.id;
    const label = Text((isActive ? "› " : "  ") + item.icon + "  " + item.label);
    textSetFontSize(label, FONT.base);

    // 文字颜色：选中用主色，未选中用次要色
    textSetColor(label,
        isActive ? COLORS.primary.r : COLORS.textSecondary.r,
        isActive ? COLORS.primary.g : COLORS.textSecondary.g,
        isActive ? COLORS.primary.b : COLORS.textSecondary.b,
        1.0
    );

    const area = HStack(SPACING.md, [label]);
    widgetMatchParentWidth(area);
    // 选中时加浅灰背景
    if (isActive) {
        widgetSetBackgroundColor(area, 0.945, 0.953, 0.965, 1.0);
        setCornerRadius(area, RADIUS.smallCard);
    } else {
        widgetSetBackgroundColor(area, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    }
    setPadding(area, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);
    widgetSetOnMouseDown(area, () => {
        _currentPage = item.id;
        // 通知 AppLayout 更新内容区
        (globalThis as any).__hamsterStoreNavigate && (globalThis as any).__hamsterStoreNavigate(item.id);
    });

    return area;
}

export function SideNav(): Widget {
    const items: Widget[] = [];
    for (const item of NAV_ITEMS) {
        items.push(NavItem(item));
    }

    const nav = VStack(SPACING.xs, items);
    widgetMatchParentWidth(nav);
    widgetSetBackgroundColor(nav, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setPadding(nav, SPACING.sm, 0, SPACING.sm, 0);

    return nav;
}
