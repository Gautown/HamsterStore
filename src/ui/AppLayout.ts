// AppLayout — Microsoft Store 风格全屏布局
// 顶部标题栏 + 左侧导航 + 右侧内容区

import {
    HStack, VStack, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setPadding,
} from "perry/ui";
import { COLORS, SPACING } from "./styles/theme";
import { TitleBar } from "./components/TitleBar";
import { SideNav, setCurrentPage as setNavPage, setRebuildNav } from "./components/SideNav";
import { ContentArea, setCurrentPage as setContentPage } from "./components/ContentArea";

// 全局页面状态同步
let currentPage: string = "home";

export function navigateTo(page: string): void {
    currentPage = page;
    setNavPage(page);
    setContentPage(page);
}

export function AppLayout(): Widget {
    const titleBar = TitleBar();
    const nav = SideNav();
    const content = ContentArea();

    // 整体布局：顶部标题栏 + 下方左右分栏（全屏）
    const body = VStack(0, [
        titleBar,
        HStack(0, [nav, content]),
    ]);

    widgetMatchParentWidth(body);
    widgetSetBackgroundColor(body, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(body, 0, 0, 0, 0);

    return body;
}
