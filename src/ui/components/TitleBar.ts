// TitleBar — 顶部标题栏（扁平设计）
// 左：Logo + 标题
// 中：搜索框
// 右：关闭窗口按钮

import {
    HStack, Text, TextField, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setPadding,
    textSetFontSize, textSetColor, textfieldGetString,
    widgetSetOnMouseDown,
} from "perry/ui";
import { COLORS, SPACING, FONT } from "./styles/theme";

// 简单的点击区域
function ClickArea(label: string, action: () => void): Widget {
    const area = HStack(SPACING.sm, [Text(label)]);
    widgetSetOnMouseDown(area, action);
    return area;
}

export function TitleBar(): Widget {
    // 左：Logo + 标题
    const logo = Text("HS");
    textSetFontSize(logo, 18);
    textSetColor(logo, COLORS.primary.r, COLORS.primary.g, COLORS.primary.b, 1.0);
    const appName = Text("HamsterStore");
    textSetFontSize(appName, FONT.md);
    textSetColor(appName, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    const leftSection = HStack(SPACING.sm, [logo, appName]);

    // 中：搜索框
    const searchInput = TextField("搜索软件...", () => {});
    const searchBtn = ClickArea("搜索", () => {
        const q = textfieldGetString(searchInput).trim();
        if (q.length >= 2) {
            // 通过 globalThis 调用 app.ts 中的 runSearch
            (globalThis as any).__hamsterRunSearch && (globalThis as any).__hamsterRunSearch(q);
        }
    });
    const searchSection = HStack(SPACING.xs, [searchInput, searchBtn]);

    // 右：关闭按钮
    const closeBtn = ClickArea("✕", () => {
        // 通过 globalThis 调用 closeWindow
        (globalThis as any).__hamsterCloseWindow && (globalThis as any).__hamsterCloseWindow();
    });

    const bar = HStack(SPACING.lg, [leftSection, searchSection, closeBtn]);
    widgetMatchParentWidth(bar);
    widgetSetBackgroundColor(bar, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setPadding(bar, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    return bar;
}
