// BentoGrid — Bento 网格容器
// 开发文档 §6.1：12列响应式网格

import {
    VStack, HStack, type Widget,
    widgetMatchParentWidth,
} from "perry/ui";
import { SPACING } from "../styles/theme";

export interface BentoGridOptions {
    columns?: number;  // 每行卡片数
    spacing?: number;
}

// 用 HStack 模拟网格行（perry ui 没有 GridLayout）
export function BentoGrid(items: Widget[], options: BentoGridOptions = {}): Widget {
    const cols = options.columns || 3;
    const gap = options.spacing || SPACING.md;
    const rows: Widget[] = [];

    for (let i = 0; i < items.length; i += cols) {
        const slice = items.slice(i, i + cols);
        const row = HStack(gap, slice);
        widgetMatchParentWidth(row);
        rows.push(row);
    }

    const grid = VStack(gap, rows);
    widgetMatchParentWidth(grid);
    return grid;
}