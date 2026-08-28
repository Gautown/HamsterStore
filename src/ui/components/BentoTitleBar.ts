// BentoTitleBar — 顶部自定义标题栏
// 布局：[Logo + 标题]  [搜索框........]  [— □ ]
// Perry v0.5.1220 限制：系统标题栏保留，内部模拟标题栏作为视觉增强

import {
    HStack, Text, Button, TextField, type Widget,
    widgetSetBackgroundColor, widgetMatchParentWidth,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor, textfieldGetString,
} from "perry/ui";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";
import { closeWindow, minimizeWindow, maximizeWindow } from "../utils/window";
import { PackageRepository } from "../../data";
import { runSearch } from "../app";

export function BentoTitleBar(): Widget {
    // 左：Logo 文字 + 标题
    const logoText = Text("HS");
    textSetFontSize(logoText, 16);
    textSetColor(logoText, COLORS.primary.r, COLORS.primary.g, COLORS.primary.b, 1.0);

    const titleText = Text("HamsterStore 仓鼠软库");
    textSetFontSize(titleText, FONT.md);
    textSetColor(titleText, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    // 中：搜索框 — 唯一搜索入口（首页不再重复放置搜索框）
    const searchInput = TextField("搜索软件...", () => {
        // onChange: 输入即检索（轻量）
        const q = textfieldGetString(searchInput).trim();
        if (q.length >= 2) runSearch(q);
    });
    const searchBtn = Button("搜索", () => {
        const q = textfieldGetString(searchInput).trim();
        if (q) runSearch(q);
    });

    // 右：窗口控制
    const minBtn = Button("-", () => minimizeWindow());
    const maxBtn = Button("[]", () => maximizeWindow());
    const closeBtn = Button("X", () => closeWindow());

    const leftSection = HStack(SPACING.sm, [logoText, titleText]);
    const searchSection = HStack(SPACING.xs, [searchInput, searchBtn]);
    widgetMatchParentWidth(searchSection);
    const controlsSection = HStack(SPACING.xs, [minBtn, maxBtn, closeBtn]);

    const bar = HStack(SPACING.lg, [leftSection, searchSection, controlsSection]);
    widgetMatchParentWidth(bar);
    widgetSetBackgroundColor(bar, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setCornerRadius(bar, RADIUS.card);
    setPadding(bar, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    return bar;
}