// AppLayout: top title bar + left nav + right content + bottom status bar.
// All sizes come from responsive.ts (breakpoint table). On window resize
// installResponsive() rebuilds this tree (perry/ui has no resize event).
import {
    HStack, VStack, Spacer, type Widget,
    widgetMatchParentWidth, widgetMatchParentHeight,
    widgetSetWidth, widgetSetHeight,
    widgetSetBackgroundColor,
    setPadding,
} from "perry/ui";
import { getSpec, getViewport, TITLEBAR_H, STATUSBAR_H } from "./responsive";
import { TitleBar } from "./components/TitleBar";
import { SideNav, setCurrentPage as setNavPage } from "./components/SideNav";
import { ContentArea, setCurrentPage as setContentPage } from "./components/ContentArea";
import { StatusBar } from "./components/StatusBar";

const COLORS = { bg: { r: 0.945, g: 0.953, b: 0.965 } };

let currentPage: string = "home";

export function navigateTo(page: string): void {
    currentPage = page;
    setNavPage(page);
    setContentPage(page);
}

export function AppLayout(): Widget {
    const vp = getViewport();
    const spec = getSpec();
    const mainH = Math.max(320, vp.height - TITLEBAR_H - STATUSBAR_H);

    const titleBar = TitleBar();
    const nav = SideNav();
    const content = ContentArea();
    const statusBar = StatusBar();

    widgetSetWidth(titleBar, vp.width);
    widgetSetHeight(titleBar, TITLEBAR_H);
    widgetSetWidth(nav, spec.sidebar);
    widgetSetHeight(nav, mainH);
    widgetSetHeight(content, mainH);
    widgetSetWidth(statusBar, vp.width);
    widgetSetHeight(statusBar, STATUSBAR_H);

    const main = HStack(0, [nav, content]);
    widgetMatchParentWidth(main);
    widgetSetHeight(main, mainH);

    const body = VStack(0, [titleBar, main, statusBar, Spacer()]);
    widgetMatchParentWidth(body);
    widgetMatchParentHeight(body);
    widgetSetBackgroundColor(body, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(body, 0, 0, 0, 0);

    return body;
}
