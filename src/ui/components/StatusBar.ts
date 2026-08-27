// StatusBar — 底部状态栏
// 显示真实代理状态、软件包总数、版本信息
import {
    HStack, Text, type Widget,
    widgetSetBackgroundColor, widgetMatchParentWidth,
    setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { COLORS, SPACING, FONT } from "../styles/theme";
import { PackageRepository } from "../../data";
import { ProxyManager } from "../../core/proxy/ProxyManager";

export function StatusBar(): Widget {
    // 真实代理状态
    let proxyLabel = "未启用";
    try {
        const pm = ProxyManager.getInstance();
        const best = pm.getBestNode();
        if (best) {
            const latency = best.latency > 0 ? best.latency + "ms" : "未测速";
            proxyLabel = best.name + " (" + latency + ")";
        }
    } catch {
        proxyLabel = "代理初始化中";
    }

    let pkgCount = 0;
    try { pkgCount = PackageRepository.getAll().length; } catch {}

    const proxyText = Text("代理: " + proxyLabel + " | 软件库: " + pkgCount + " 个");
    textSetFontSize(proxyText, FONT.xs);
    textSetColor(proxyText, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const versionText = Text("v1.0.0");
    textSetFontSize(versionText, FONT.xs);
    textSetColor(versionText, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const row = HStack(SPACING.lg, [proxyText, versionText]);
    widgetMatchParentWidth(row);
    widgetSetBackgroundColor(row, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setPadding(row, SPACING.xs, SPACING.md, SPACING.xs, SPACING.md);

    return row;
}