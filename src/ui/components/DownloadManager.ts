// DownloadManager — 下载管理 UI 组件（增强版 v2）
// 特性：实时速度、重试失败任务、打开文件/文件夹、状态颜色区分

import {
    VStack, HStack, Text, Button, Divider, type Widget,
    widgetMatchParent, widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding, widgetSetOnMouseDown,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { DownloadRepository } from "../../data";
import { DownloadManager } from "../../core/download/DownloadManager";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// 全局刷新回调
let _rebuildBody: (() => void) | null = null;
export function setRebuildBody(fn: () => void): void {
    _rebuildBody = fn;
}

// 轮询间隔（毫秒）
const POLL_INTERVAL = 500;
let _pollTimer: any = null;

export function DownloadsPage(): Widget {
    // 启动轮询更新
    startPolling();

    const title = Text("下载管理");
    textSetFontSize(title, FONT.xl);
    textSetColor(title, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const all = DownloadRepository.getAll();
    const doneTasks = all.filter((t: any) => t.status === "done").slice(0, 20);
    const failedTasks = all.filter((t: any) => t.status === "failed");
    const pausedTasks = all.filter((t: any) => t.status === "paused");

    const activeStates = DownloadManager.getActive();
    const queuedStates = DownloadManager.getQueued();

    // 合并显示
    const mergedActive = activeStates.length > 0 ? activeStates : [];
    const displayQueue = queuedStates.length > 0 ? queuedStates : [];

    const children: Widget[] = [title, Divider()];

    // --- 状态摘要栏 ---
    const runningCount = mergedActive.length;
    const queueCount = displayQueue.length;
    const totalDownloads = doneTasks.length + failedTasks.length + pausedTasks.length;

    const summary = Text("运行中: " + runningCount + " | 队列: " + queueCount + " | 历史: " + totalDownloads);
    textSetFontSize(summary, FONT.sm);
    textSetColor(summary, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
    children.push(summary);
    children.push(Divider());

    // --- 进行中 ---
    if (mergedActive.length > 0) {
        const activeHeader = createSectionHeader("进行中 (" + mergedActive.length + ")");
        children.push(activeHeader);

        for (let i = 0; i < mergedActive.length; i++) {
            children.push(buildActiveCard(mergedActive[i]));
        }
        children.push(Divider());
    }

    // --- 队列 ---
    if (displayQueue.length > 0) {
        const queueHeader = createSectionHeader("等待中 (" + displayQueue.length + ")");
        children.push(queueHeader);

        for (let i = 0; i < displayQueue.length; i++) {
            children.push(buildQueueCard(displayQueue[i]));
        }
        children.push(Divider());
    }

    // --- 失败任务 ---
    if (failedTasks.length > 0) {
        const failHeader = createSectionHeader("失败 (" + failedTasks.length + ")");
        children.push(failHeader);

        for (let i = 0; i < Math.min(failedTasks.length, 5); i++) {
            children.push(buildFailedCard(failedTasks[i]));
        }
        children.push(Divider());
    }

    // --- 成功历史 ---
    const histHeader = createSectionHeader("已完成 (" + doneTasks.length + ")");
    children.push(histHeader);

    if (doneTasks.length === 0) {
        const empty = Text("暂无下载记录");
        textSetFontSize(empty, FONT.sm);
        textSetColor(empty, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        children.push(empty);
    } else {
        for (let i = 0; i < Math.min(doneTasks.length, 10); i++) {
            children.push(buildDoneCard(doneTasks[i]));
        }
    }

    // --- 操作按钮 ---
    children.push(Divider());
    const btnRow = HStack(SPACING.sm, [
        Button("清空历史", () => {
            DownloadManager.clearCompleted();
            DownloadRepository.clearAll();
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

// 创建节标题
function createSectionHeader(text: string): Widget {
    const header = Text(text);
    textSetFontSize(header, FONT.md);
    textSetColor(header, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    return header;
}

// 构建进行中的卡片
function buildActiveCard(st: any): Widget {
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

    // 重试按钮
    const retryBtn = Button("重试", () => {
        DownloadManager.startDownload(st.packageId || 0, st.url, st.name);
        _rebuildBody && _rebuildBody();
    });
    textSetFontSize(retryBtn, FONT.xs);

    const row = HStack(SPACING.sm, [nameW]);
    const infoRow = HStack(SPACING.sm, [progressW, retryBtn]);
    const card = VStack(SPACING.xs, [row, infoRow, detailW]);
    widgetMatchParentWidth(card);
    widgetSetBackgroundColor(card, COLORS.bgCard.r, COLORS.bgCard.g, COLORS.bgCard.b, 1.0);
    setCornerRadius(card, RADIUS.smallCard);
    setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    // 高亮边框表示活跃状态
    const borderColor = COLORS.primary;
    const borderWidget = VStack(SPACING.zero, [card]);
    widgetMatchParentWidth(borderWidget);
    widgetSetBackgroundColor(borderWidget, borderColor.r, borderColor.g, borderColor.b, 0.1);
    setPadding(borderWidget, SPACING.xs, SPACING.xs, SPACING.xs, SPACING.xs);

    return borderWidget;
}

// 构建等待中的卡片
function buildQueueCard(q: any): Widget {
    const nameW = Text("○ " + (q.name || q.url.split("/").pop() || "排队中..."));
    textSetFontSize(nameW, FONT.sm);
    textSetColor(nameW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const card = VStack(SPACING.xs, [nameW]);
    widgetMatchParentWidth(card);
    widgetSetBackgroundColor(card, COLORS.bgCard.r, COLORS.bgCard.g, COLORS.bgCard.b, 1.0);
    setCornerRadius(card, RADIUS.smallCard);
    setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    return card;
}

// 构建失败卡片（含重试按钮）
function buildFailedCard(task: any): Widget {
    const urlShort = (task.url || "").split("/").pop() || task.url || "";
    const nameW = Text("✗ " + urlShort);
    textSetFontSize(nameW, FONT.base);
    textSetColor(nameW, COLORS.error.r, COLORS.error.g, COLORS.error.b, 1.0);

    const retryBtn = Button("重试", () => {
        DownloadManager.startDownload(task.package_id || task.packageId || 0, task.url, urlShort);
        _rebuildBody && _rebuildBody();
    });
    textSetFontSize(retryBtn, FONT.xs);

    const deleteBtn = Button("删除", () => {
        DownloadRepository.deleteById(task.id);
        _rebuildBody && _rebuildBody();
    });
    textSetFontSize(deleteBtn, FONT.xs);

    const actionRow = HStack(SPACING.sm, [retryBtn, deleteBtn]);
    const card = VStack(SPACING.xs, [nameW, actionRow]);
    widgetMatchParentWidth(card);
    widgetSetBackgroundColor(card, COLORS.error.r, COLORS.error.g, COLORS.error.b, 0.05);
    setCornerRadius(card, RADIUS.smallCard);
    setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    return card;
}

// 构建已完成卡片（含打开文件按钮）
function buildDoneCard(task: any): Widget {
    const urlShort = (task.url || "").split("/").pop() || task.url || "";
    const nameW = Text("✓ " + urlShort);
    textSetFontSize(nameW, FONT.base);
    textSetColor(nameW, COLORS.success.r, COLORS.success.g, COLORS.success.b, 1.0);

    // 打开文件按钮
    const openBtn = Button("打开", () => {
        openDownloadedFile(task.url);
    });
    textSetFontSize(openBtn, FONT.xs);

    const deleteBtn = Button("删除", () => {
        DownloadRepository.deleteById(task.id);
        _rebuildBody && _rebuildBody();
    });
    textSetFontSize(deleteBtn, FONT.xs);

    const actionRow = HStack(SPACING.sm, [openBtn, deleteBtn]);
    const statusW = Text(task.status + " " + task.progress + "%");
    textSetFontSize(statusW, FONT.xs);
    textSetColor(statusW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const card = VStack(SPACING.xs, [nameW, actionRow, statusW]);
    widgetMatchParentWidth(card);
    widgetSetBackgroundColor(card, COLORS.bgCard.r, COLORS.bgCard.g, COLORS.bgCard.b, 1.0);
    setCornerRadius(card, RADIUS.smallCard);
    setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

    return card;
}

// 打开已下载文件
function openDownloadedFile(url: string): void {
    try {
        const downloadDir = getDownloadDir();
        const urlPath = url.split("/").pop() || "";
        const safeName = urlPath.replace(/[<>:"|?*()\[\]]/g, "_");
        const filePath = join(downloadDir, safeName);

        if (existsSync(filePath)) {
            // 使用 rundll32 打开文件
            const { spawn } = require("node:child_process");
            const proc = spawn("rundll32", ["url.dll,FileProtocolHandler", filePath], {
                detached: true,
                stdio: "ignore",
            });
            proc.unref();
        } else {
            // 文件不存在，尝试打开文件夹
            const { spawn } = require("node:child_process");
            spawn("explorer", [downloadDir], { detached: true, stdio: "ignore" }).unref();
        }
    } catch (e: any) {
        console.log("[DownloadManager] 打开文件失败: " + e.message);
    }
}

// 获取下载目录
function getDownloadDir(): string {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || process.env.USERPROFILE || ".";
    const dir = join(base, "HamsterStore", "downloads");
    mkdirSync(dir, { recursive: true });
    return dir;
}

// 启动轮询更新
function startPolling(): void {
    if (_pollTimer) return;

    _pollTimer = setInterval(() => {
        const active = DownloadManager.getActive();
        if (active.length > 0 && _rebuildBody) {
            _rebuildBody();
        }
    }, POLL_INTERVAL);
}
