// PackageDetail — 软件详情页面（增强版）
import {
    VStack, HStack, Text, Button, Divider, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { PackageRepository } from "../../data";
import { DownloadManager } from "../../core/download/DownloadManager";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";

export function PackageDetail(packageId: number): Widget {
    const pkg = PackageRepository.getById(packageId);
    if (!pkg) {
        const err = Text("软件包未找到");
        textSetFontSize(err, FONT.md);
        return err;
    }
    
    const shortName = (pkg.name || "").split("/").pop() || (pkg.name || "Unknown");
    const desc = pkg.description || "暂无描述";
    
    // 解析分类
    let catLabels: string[] = [];
    try { catLabels = JSON.parse(pkg.categories || "[]"); } catch { }
    const catStr = catLabels.length > 0 ? catLabels.join(" / ") : "未分类";
    
    // 解析 extra_json
    let projectUrl = "";
    let downloadUrl = "";
    let dataSource = "";
    try {
        const ext = JSON.parse(pkg.extra_json || "{}");
        projectUrl = ext.project_url || "";
        downloadUrl = ext.download_url || "";
        dataSource = ext.data_source || "";
    } catch {}
    
    // 标题
    const title = Text(shortName);
    textSetFontSize(title, FONT.xl);
    textSetColor(title, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    
    // 完整名称
    const fullName = Text(pkg.name || "");
    textSetFontSize(fullName, FONT.sm);
    textSetColor(fullName, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
    
    // 分类标签
    const catBadge = createCatBadge(catStr);
    
    // 描述
    const descLabel = Text("描述");
    textSetFontSize(descLabel, FONT.sm);
    textSetColor(descLabel, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    
    const descW = Text(desc);
    textSetFontSize(descW, FONT.base);
    textSetColor(descW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
    
    // 信息行
    const infoRows: Widget[] = [];
    
    if (projectUrl) {
        infoRows.push(createInfoRow("项目地址", projectUrl));
    }
    if (dataSource) {
        infoRows.push(createInfoRow("数据来源", dataSource));
    }
    if (pkg.version) {
        infoRows.push(createInfoRow("版本", pkg.version));
    }
    
    // 按钮组
    const url = projectUrl || downloadUrl || ("https://github.com/" + pkg.name);
    const openBtn = Button("在浏览器打开", () => DownloadManager.openInBrowser(url));
    
    const backBtn = Button("← 返回", () => {
        (globalThis as any).__hamsterStoreNavigate && (globalThis as any).__hamsterStoreNavigate("packages");
    });
    
    const buttonRow = HStack(SPACING.sm, [backBtn, openBtn]);
    
    // 组装
    const container = VStack(SPACING.md, [
        title,
        fullName,
        catBadge,
        Divider(),
        descLabel,
        descW,
        Divider(),
        ...infoRows,
        Divider(),
        buttonRow,
    ]);
    
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, SPACING.lg, SPACING.lg, SPACING.lg, SPACING.lg);
    
    return container;
}

function createCatBadge(catStr: string): Widget {
    const badge = Text("📁 " + catStr);
    textSetFontSize(badge, FONT.xs);
    textSetColor(badge, COLORS.secondary.r, COLORS.secondary.g, COLORS.secondary.b, 1.0);
    widgetSetBackgroundColor(badge, 0.9, 0.95, 1.0, 1.0);
    setCornerRadius(badge, RADIUS.tag);
    setPadding(badge, SPACING.xs, SPACING.sm, SPACING.xs, SPACING.sm);
    return badge;
}

function createInfoRow(label: string, value: string): Widget {
    const labelW = Text(label + ":");
    textSetFontSize(labelW, FONT.sm);
    textSetColor(labelW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
    
    const valueW = Text(value.length > 60 ? value.substring(0, 60) + "..." : value);
    textSetFontSize(valueW, FONT.sm);
    textSetColor(valueW, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    
    return HStack(SPACING.sm, [labelW, valueW]);
}
