// AppLayout — Microsoft Store 风格全屏布局
// 顶部标题栏 + 左侧导航 + 右侧内容区

import {
    HStack, VStack, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setPadding,
} from "perry/ui";

// Perry v0.5.1220: 内联颜色常量
const COLORS = {
    primary: { r: 0.145, g: 0.388, b: 0.922 },
    bg: { r: 0.945, g: 0.953, b: 0.965 },
};
const SPACING = { md: 16 };

import { TitleBar } from "./components/TitleBar";
import { SideNav, setCurrentPage as setNavPage, setRebuildNav } from "./components/SideNav";
import { ContentArea, setCurrentPage as setContentPage } from "./components/ContentArea";
import { StatusBar } from "./components/StatusBar";

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
    const statusBar = StatusBar();

    // 整体布局：顶部标题栏 + 下方左右分栏（全屏）+ 底部状态栏
    const body = VStack(0, [
        titleBar,
        HStack(0, [nav, content]),
        statusBar,
    ]);

    widgetMatchParentWidth(body);
    widgetSetBackgroundColor(body, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(body, 0, 0, 0, 0);

    return body;
}
