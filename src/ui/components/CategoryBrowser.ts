// CategoryBrowser — 分类浏览器
// 开发文档 §6.4：按分类浏览（继承 awesome 分类体系）

import {
    VStack, HStack, Text, Button, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { COLORS, SPACING, FONT } from "../styles/theme";
import { CATEGORY_TREE } from "../../core/categorization/CategoryEngine";

export function CategoryBrowser(onSelect: (catId: string) => void): Widget {
    const catIds = Object.keys(CATEGORY_TREE);
    const header = Text("分类浏览");
    textSetFontSize(header, FONT.lg);
    textSetColor(header, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const btns: Widget[] = [];

    // All 按钮
    const allBtn = Button("全部", () => onSelect(""));
    btns.push(allBtn);

    for (let i = 0; i < Math.min(catIds.length, 10); i++) {
        const catId = catIds[i];
        const catName = CATEGORY_TREE[catId].name;
        const btn = Button(catName, () => onSelect(catId));
        btns.push(btn);
    }

    const row = HStack(SPACING.sm, btns);
    widgetMatchParentWidth(row);
    setPadding(row, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    const container = VStack(SPACING.md, [header, row]);
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);

    return container;
}