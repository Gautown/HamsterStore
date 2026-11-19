// BentoCard — Bento UI 卡片组件
// 开发文档 §6.1：圆角16px、悬停阴影、内容自适应

import {
    VStack, HStack, Text, type Widget,
    widgetSetBackgroundColor, widgetMatchParentWidth,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";

export interface BentoCardOptions {
    title?: string;
    subtitle?: string;
    badge?: string;
    icon?: string;
    size?: "large" | "medium" | "small";
    bgColor?: { r: number; g: number; b: number };
    onPress?: () => void;
}

// 创建 Bento 卡片
export function BentoCard(options: BentoCardOptions, children: Widget[] = []): Widget {
    const title = options.title;
    const subtitle = options.subtitle;
    const size = options.size || "medium";
    const bgColor = options.bgColor;

    const contentWidgets: Widget[] = [];

    if (title) {
        const titleW = Text(title);
        textSetFontSize(titleW, size === "large" ? FONT.lg : FONT.md);
        textSetColor(titleW, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
        contentWidgets.push(titleW);
    }

    if (subtitle) {
        const subW = Text(subtitle);
        textSetFontSize(subW, FONT.sm);
        textSetColor(subW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        contentWidgets.push(subW);
    }

    for (let i = 0; i < children.length; i++) {
        contentWidgets.push(children[i]);
    }

    const padding = size === "small" ? SPACING.sm : SPACING.md;
    const rd = size === "large" ? RADIUS.card : RADIUS.smallCard;
    const bg = bgColor || COLORS.bgCard;

    const card = VStack(SPACING.sm, contentWidgets);
    widgetSetBackgroundColor(card, bg.r, bg.g, bg.b, 1.0);
    widgetMatchParentWidth(card);
    setCornerRadius(card, rd);
    setPadding(card, padding, padding, padding, padding);

    return card;
}