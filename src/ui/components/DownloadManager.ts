// DownloadManager — 下载管理 UI 组件
// 开发文档 §6.4：下载管理页面 — 查看和管理下载任务

import {
    VStack, HStack, Text, Button, Divider, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { DownloadRepository } from "../../data";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";

export function DownloadsPage(): Widget {
    const title = Text("下载管理");
    textSetFontSize(title, FONT.xl);
    textSetColor(title, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const tasks = DownloadRepository.getActive();
    const all = DownloadRepository.getAll();
    const history = all.filter((t: any) => t.status === "done" || t.status === "failed").slice(0, 15);

    const children: Widget[] = [title, Divider()];

    // 进行中
    const activeHeader = Text("进行中 (" + tasks.length + ")");
    textSetFontSize(activeHeader, FONT.md);
    textSetColor(activeHeader, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    children.push(activeHeader);

    if (tasks.length === 0) {
        const empty = Text("  暂无下载任务");
        textSetFontSize(empty, FONT.sm);
        textSetColor(empty, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        children.push(empty);
    }

    for (let i = 0; i < tasks.length; i++) {
        children.push(buildTaskCard(tasks[i]));
    }

    // 历史记录
    children.push(Divider());
    const histHeader = Text("历史记录 (" + history.length + ")");
    textSetFontSize(histHeader, FONT.md);
    textSetColor(histHeader, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    children.push(histHeader);

    if (history.length === 0) {
        const empty = Text("  暂无历史记录");
        textSetFontSize(empty, FONT.sm);
        textSetColor(empty, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        children.push(empty);
    }

    for (let i = 0; i < Math.min(history.length, 10); i++) {
        children.push(buildTaskCard(history[i]));
    }

    const container = VStack(SPACING.sm, children);
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, SPACING.md, SPACING.md, SPACING.md, SPACING.md);
    return container;
}

function buildTaskCard(task: any): Widget {
    const icon = task.status === "done" ? "[OK]" : task.status === "failed" ? "[X]" : task.status === "downloading" ? "v" : "○";
    const urlShort = (task.url || "").split("/").pop() || task.url || "";

    const nameW = Text(icon + " " + urlShort);
    textSetFontSize(nameW, FONT.base);
    textSetColor(nameW, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const statusW = Text(task.status + (task.progress > 0 ? " " + task.progress + "%" : ""));
    textSetFontSize(statusW, FONT.xs);
    textSetColor(statusW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const row = HStack(SPACING.sm, [nameW, statusW]);
    widgetMatchParentWidth(row);

    const card = VStack(SPACING.xs, [row]);
    widgetSetBackgroundColor(card, COLORS.bgCard.r, COLORS.bgCard.g, COLORS.bgCard.b, 1.0);
    widgetMatchParentWidth(card);
    setCornerRadius(card, RADIUS.smallCard);
    setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    return card;
}