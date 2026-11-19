// StatusBar — 底部状态栏
// 显示真实代理状态、软件包总数、版本信息
import {
    HStack, Text, type Widget,
    widgetSetBackgroundColor, widgetMatchParentWidth,
    setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
// Perry v0.5.1220: 内联颜色常量
const COLORS = {
    white: { r: 1.0, g: 1.0, b: 1.0 },
    textSecondary: { r: 0.392, g: 0.451, b: 0.510 },
    success: { r: 0.22, g: 0.72, b: 0.40 },
    error: { r: 0.937, g: 0.267, b: 0.267 },
};
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24 };
const FONT = { xs: 10, sm: 12, base: 14, md: 16 };
import { PackageRepository } from "../../data";
import { ProxyManager } from "../../core/proxy/ProxyManager";

export function StatusBar(): Widget {
    // 真实代理状态
    let proxyLabel = "未启用";
    let proxyColor = COLORS.error;
    try {
        const pm = ProxyManager.getInstance();
        const best = pm.getBestNode();
        if (best) {
            const latency = best.latency > 0 ? best.latency + "ms" : "未测速";
            proxyLabel = best.name + " (" + latency + ")";
            proxyColor = COLORS.success;
        }
    } catch {
        proxyLabel = "代理初始化中";
    }

    let pkgCount = 0;
    try { pkgCount = PackageRepository.getAll().length; } catch {}

    const proxyText = Text("代理: " + proxyLabel + " | 软件库: " + pkgCount + " 个");
    textSetFontSize(proxyText, FONT.xs);
    textSetColor(proxyText, proxyColor.r, proxyColor.g, proxyColor.b, 1.0);

    const versionText = Text("v1.0.0");
    textSetFontSize(versionText, FONT.xs);
    textSetColor(versionText, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const row = HStack(SPACING.lg, [proxyText, versionText]);
    widgetMatchParentWidth(row);
    widgetSetBackgroundColor(row, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setPadding(row, SPACING.xs, SPACING.md, SPACING.xs, SPACING.md);

    return row;
}