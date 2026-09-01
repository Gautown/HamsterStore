// PackageDetail — 软件详情页面
// 开发文档 §6.4 软件详情

import {
    VStack, HStack, Text, Button, Divider, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { PackageRepository } from "../../data";
import { DownloadManager } from "../../core/download/DownloadManager";
import { InstallManager } from "../../core/install/InstallManager";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";
import { formatStars, truncateText, formatDate } from "../utils/formatters";

export function PackageDetail(packageId: number): Widget {
    const pkg = PackageRepository.getById(packageId);
    if (!pkg) {
        const err = Text("软件包未找到");
        textSetFontSize(err, FONT.md);
        return err;
    }

    const title = Text((pkg.name || "").split("/").pop() || (pkg.name || "Unknown"));
    textSetFontSize(title, FONT.xl);
    textSetColor(title, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const fullName = Text(pkg.name || "");
    textSetFontSize(fullName, FONT.sm);
    textSetColor(fullName, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    // 分类标签
    let catLabels: string[] = [];
    try { catLabels = JSON.parse(pkg.categories || "[]"); } catch { }
    const catText = Text("分类: " + (catLabels.join(" / ") || "未分类"));
    textSetFontSize(catText, FONT.xs);
    textSetColor(catText, COLORS.secondary.r, COLORS.secondary.g, COLORS.secondary.b, 1.0);

    // 描述
    const descLabel = Text("描述");
    textSetFontSize(descLabel, FONT.sm);
    textSetColor(descLabel, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    const descW = Text(pkg.description || "暂无描述");
    textSetFontSize(descW, FONT.sm);
    textSetColor(descW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    // 版本
    const versionW = Text("版本: " + (pkg.version || "未知"));
    textSetFontSize(versionW, FONT.xs);
    textSetColor(versionW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    // 按钮
    const dlUrl = pkg.download_url || ("https://github.com/" + (pkg.name || ""));
    const downloadBtn = Button("下载", () => {
        DownloadManager.startDownload(pkg.id, dlUrl, pkg.name || "download");
    });

    const installBtn = Button("安装", () => {
        const result = InstallManager.install(packageId);
        if (result) {
            // 安装成功
        }
    });

    const openBtn = Button("在GitHub查看", () => {
        DownloadManager.openInBrowser(dlUrl);
    });

    const buttonRow = HStack(SPACING.sm, [downloadBtn, installBtn, openBtn]);

    const container = VStack(SPACING.md, [
        title, fullName,
        Divider(),
        catText, versionW,
        Divider(),
        descLabel, descW,
        Divider(),
        buttonRow,
    ]);

    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, SPACING.lg, SPACING.lg, SPACING.lg, SPACING.lg);

    return container;
}