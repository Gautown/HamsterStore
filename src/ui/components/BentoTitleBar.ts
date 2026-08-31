// BentoTitleBar — 自定义无边框标题栏
// 方案：隐藏系统标题栏视觉，用 UI 组件在窗口顶部模拟标题栏（见 utils/window.ts makeFrameless）。
// 交互：perry 的 Button.onPress 在真实点击下不触发，故所有交互统一用
//   widgetSetOnMouseDown 绑到 HStack 容器（已实机验证可靠的命中机制）。
//   - 拖动：Logo+标题区域 onMouseDown -> Win32 WM_SYSCOMMAND(SC_MOVE)
//   - 控制：最小/最大/关闭 各自独立 HStack 容器 onMouseDown -> 对应 Win32 消息

import {
    HStack, Text, TextField, type Widget,
    widgetSetBackgroundColor, widgetMatchParentWidth,
    widgetSetOnMouseDown,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor, textfieldGetString,
} from "perry/ui";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";
import { closeWindow, sendSysCommand, enableFramelessDrag, minimizeWindow, maximizeWindow } from "../utils/window";
import { runSearch } from "../app";

// 把一个 HStack 容器变成"可点击区域"（绑定 onMouseDown -> 发 Win32 消息）
function clickArea(label: string, action: () => void): Widget {
    const area = HStack(SPACING.xs, [Text(label)]);
    widgetSetOnMouseDown(area, () => action());
    return area;
}

export function BentoTitleBar(): Widget {
    // 左：Logo + 标题（拖动区域）
    const logoText = Text("HS");
    textSetFontSize(logoText, 16);
    textSetColor(logoText, COLORS.primary.r, COLORS.primary.g, COLORS.primary.b, 1.0);
    const titleText = Text("HamsterStore 仓鼠软库");
    textSetFontSize(titleText, FONT.md);
    textSetColor(titleText, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    const dragArea = HStack(SPACING.sm, [logoText, titleText]);
    enableFramelessDrag(dragArea); // 仅 Logo+标题区域可拖动

    // 中：搜索框 — 唯一搜索入口；搜索按钮点击触发 runSearch
    const searchInput = TextField("搜索软件...", () => {
        const q = textfieldGetString(searchInput).trim();
        if (q.length >= 2) runSearch(q);
    });
    const searchBtnArea = clickArea("搜索", () => {
        const q = textfieldGetString(searchInput).trim();
        if (q) runSearch(q);
    });
    const searchSection = HStack(SPACING.xs, [searchInput, searchBtnArea]);
    widgetMatchParentWidth(searchSection);

    // 右：窗口控制（每个按钮独立 HStack 容器，绑定 onMouseDown）
    const minArea = clickArea("—", () => minimizeWindow(minArea));
    const maxArea = clickArea("□", () => maximizeWindow(maxArea));
    const closeArea = clickArea("✕", () => closeWindow());
    const controlsSection = HStack(SPACING.xs, [minArea, maxArea, closeArea]);

    const bar = HStack(SPACING.lg, [dragArea, searchSection, controlsSection]);
    widgetMatchParentWidth(bar);
    widgetSetBackgroundColor(bar, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setCornerRadius(bar, 0); // 无边框标题栏，去掉圆角
    setPadding(bar, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    return bar;
}
