// DownloadManager — 下载管理 UI 组件（增强版）
// 实时进度条 + 队列显示 + 清空功能

import {
    VStack, HStack, Text, Button, Divider, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { DownloadRepository } from "../../data";
import { DownloadManager } from "../../core/download/DownloadManager";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";

// 全局刷新回调（由 app.ts 在页面切换时设置）
let _rebuildBody: (() => void) | null = null;
export function setRebuildBody(fn: () => void): void {
    _rebuildBody = fn;
}

export function DownloadsPage(): Widget {
    const title = Text("下载管理");
    textSetFontSize(title, FONT.xl);
    textSetColor(title, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    // 从 DB 获取所有任务
    const all = DownloadRepository.getAll();
    const activeTasks = all.filter((t: any) => t.status === "waiting" || t.status === "downloading");
    const doneTasks = all.filter((t: any) => t.status === "done").slice(0, 10);
    const failedTasks = all.filter((t: any) => t.status === "failed").slice(0, 5);

    // 合并内存中的实时状态
    const activeStates = DownloadManager.getActive();
    const queuedStates = DownloadManager.getQueued();

    const children: Widget[] = [title, Divider()];

    // --- 状态栏 ---
    const runningCount = activeStates.length;
    const queueCount = queuedStates.length;
    const statusText = Text("运行中: " + runningCount + " | 队列: " + queueCount + " | 总计: " + all.length);
    textSetFontSize(statusText, FONT.xs);
    textSetColor(statusText, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
    children.push(statusText);
    children.push(Divider());

    // --- 进行中 ---
    const activeHeader = Text("进行中 (" + activeStates.length + ")");
    textSetFontSize(activeHeader, FONT.md);
    textSetColor(activeHeader, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    children.push(activeHeader);

    if (activeStates.length === 0 && queueCount === 0) {
        const empty = Text("  暂无下载任务");
        textSetFontSize(empty, FONT.sm);
        textSetColor(empty, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        children.push(empty);
    }

    for (let i = 0; i < activeStates.length; i++) {
        children.push(buildProgressCard(activeStates[i]));
    }

    // 队列中的任务
    for (let i = 0; i < queuedStates.length; i++) {
        const q = queuedStates[i];
        const nameW = Text("○ 排队: " + q.name);
        textSetFontSize(nameW, FONT.sm);
        textSetColor(nameW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        children.push(nameW);
    }

    // --- 失败记录 ---
    if (failedTasks.length > 0) {
        children.push(Divider());
        const failHeader = Text("失败 (" + failedTasks.length + ")");
        textSetFontSize(failHeader, FONT.md);
        textSetColor(failHeader, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
        children.push(failHeader);

        for (let i = 0; i < failedTasks.length; i++) {
            const t = failedTasks[i];
            children.push(buildTaskCard(t, "failed"));
        }
    }

    // --- 成功历史 ---
    children.push(Divider());
    const histHeader = Text("成功 (" + doneTasks.length + ")");
    textSetFontSize(histHeader, FONT.md);
    textSetColor(histHeader, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    children.push(histHeader);

    if (doneTasks.length === 0) {
        const empty = Text("  暂无下载记录");
        textSetFontSize(empty, FONT.sm);
        textSetColor(empty, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        children.push(empty);
    }

    for (let i = 0; i < doneTasks.length; i++) {
        children.push(buildTaskCard(doneTasks[i], "done"));
    }

    // --- 操作按钮 ---
    children.push(Divider());
    const btnRow = HStack(SPACING.sm, [
        Button("清空历史", () => {
            DownloadRepository.clearAll();
            DownloadManager.clearAll();
            _rebuildBody && _rebuildBody();
        }),
        Button("刷新", () => {
            _rebuildBody && _rebuildBody();
        }),
    ]);
    children.push(btnRow);

    const container = VStack(SPACING.sm, children);
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, SPACING.md, SPACING.md, SPACING.md, SPACING.md);
    return container;
}

function buildProgressCard(st: any): Widget {
    // 进度条文本
    const barLen = 20;
    const filled = Math.round(st.progress / 100 * barLen);
    const bar = "█".repeat(filled) + "░".repeat(barLen - filled);

    const nameW = Text(st.name || st.url.split("/").pop() || "下载中...");
    textSetFontSize(nameW, FONT.base);
    textSetColor(nameW, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const progressW = Text(bar + " " + st.progress + "%");
    textSetFontSize(progressW, FONT.sm);
    textSetColor(progressW, COLORS.primary.r, COLORS.primary.g, COLORS.primary.b, 1.0);

    const detailW = Text(st.detail || "");
    textSetFontSize(detailW, FONT.xs);
    textSetColor(detailW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const row = VStack(SPACING.xs, [nameW, progressW, detailW]);
    widgetMatchParentWidth(row);

    const card = VStack(SPACING.xs, [row]);
    widgetSetBackgroundColor(card, COLORS.bgCard.r, COLORS.bgCard.g, COLORS.bgCard.b, 1.0);
    widgetMatchParentWidth(card);
    setCornerRadius(card, RADIUS.smallCard);
    setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    return card;
}

function buildTaskCard(task: any, status: string): Widget {
    const icon = status === "done" ? "✓" : "✗";
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
