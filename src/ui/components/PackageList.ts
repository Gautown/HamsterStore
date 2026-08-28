// PackageList — Bento 风格软件卡片列表
// 开发文档 §6.2：卡片网格布局

import {
    VStack, HStack, Text, Button, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { PackageRepository } from "../../data";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";
import { DownloadManager } from "../../core/download/DownloadManager";
import { navigateToDetail } from "../app";

export interface PackageListFilter {
    category?: string | null;
    sourceId?: number;
    query?: string;
}

export function PackageList(filter: PackageListFilter = {}): Widget {
    const all = PackageRepository.getAll();
    let pkgs = all;
    if (filter.query) {
        const q = filter.query.toLowerCase();
        pkgs = pkgs.filter(p => {
            const name = (p.name || "").toLowerCase();
            const desc = (p.description || "").toLowerCase();
            return name.includes(q) || desc.includes(q);
        });
    }
    if (filter.category) {
        pkgs = pkgs.filter(p => {
            try {
                const cats = JSON.parse(p.categories || "[]");
                return Array.isArray(cats) && cats.includes(filter.category);
            } catch { return false; }
        });
    }
    if (filter.sourceId && filter.sourceId > 0) {
        pkgs = pkgs.filter(p => String(p.source_id) === String(filter.sourceId));
    }

    const headerText = filter.query
        ? "搜索 \"" + filter.query + "\" (" + pkgs.length + ")"
        : filter.category
            ? "分类: " + filter.category + " (" + pkgs.length + ")"
            : "软件列表 (" + pkgs.length + ")";
    const header = Text(headerText);
    textSetFontSize(header, FONT.lg);
    textSetColor(header, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const rows: Widget[] = [];

    if (pkgs.length === 0) {
        const emptyText = Text("暂无软件包 — 运行 sync 同步获取");
        textSetFontSize(emptyText, FONT.sm);
        textSetColor(emptyText, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        rows.push(emptyText);
    }

    for (let i = 0; i < Math.min(pkgs.length, 20); i++) {
        const p = pkgs[i];
        const name = (p.name || "").split("/").pop() || (p.name || "Unknown");
        const desc = (p.description || "").substring(0, 100);

        let catLabels: string[] = [];
        try { catLabels = JSON.parse(p.categories || "[]"); } catch { }
        const catStr = catLabels.length > 0 ? catLabels.slice(0, 2).join(" | ") : "";

        const nameW = Text(name);
        textSetFontSize(nameW, FONT.md);
        textSetColor(nameW, COLORS.primary.r, COLORS.primary.g, COLORS.primary.b, 1.0);

        const descW = Text(desc);
        textSetFontSize(descW, FONT.xs);
        textSetColor(descW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

        const catW = Text(catStr);
        textSetFontSize(catW, FONT.xs);
        textSetColor(catW, COLORS.secondary.r, COLORS.secondary.g, COLORS.secondary.b, 1.0);

        const detailBtn = Button("详情", () => {
            navigateToDetail(p.id);
        });

        const dlBtn = Button("v", () => {
            const dlUrl = "https://github.com/" + p.name;
            DownloadManager.openInBrowser(dlUrl);
        });

        const row = HStack(SPACING.sm, [nameW, catW, detailBtn, dlBtn]);
        widgetMatchParentWidth(row);

        const card = VStack(SPACING.xs, [row, descW]);
        widgetSetBackgroundColor(card, COLORS.bgCard.r, COLORS.bgCard.g, COLORS.bgCard.b, 1.0);
        widgetMatchParentWidth(card);
        setCornerRadius(card, RADIUS.smallCard);
        setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

        rows.push(card);
    }

    const allWidgets: Widget[] = [header];
    for (let i = 0; i < rows.length; i++) {
        allWidgets.push(rows[i]);
    }
    const container = VStack(SPACING.md, allWidgets);
    widgetMatchParentWidth(container);
    setPadding(container, SPACING.md, SPACING.md, SPACING.md, SPACING.md);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);

    return container;
}