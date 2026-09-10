// SettingsPanel — 设置面板（Bento 风格）
// Token 管理 + 加速器开关/重新测速 + 版本信息
// Perry v0.5.1220: 内联颜色常量，避免 theme.ts 导入链问题

import {
    VStack, HStack, Text, Button, TextField, Divider, type Widget,
    textfieldGetString, textfieldSetString,
    widgetMatchParentWidth,
    widgetSetBackgroundColor, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { SettingRepository } from "../../data";
import { ProxyManager } from "../../core/proxy/ProxyManager";

const COLORS = {
    primary: { r: 0.145, g: 0.388, b: 0.922 },
    bg: { r: 0.945, g: 0.953, b: 0.965 },
    text: { r: 0.118, g: 0.161, b: 0.231 },
    textSecondary: { r: 0.392, g: 0.451, b: 0.510 },
    success: { r: 0.22, g: 0.72, b: 0.40 },
    warning: { r: 0.96, g: 0.68, b: 0.16 },
};
const SPACING = { sm: 8, md: 16, lg: 24 };
const FONT = { xs: 10, sm: 12, base: 14, md: 16, xl: 22 };

export function SettingsPanel(): Widget {
    const token = SettingRepository.getValue("github_token") || "";
    const proxyEnabled = SettingRepository.getValue("proxy_enabled") || "true";

    const title = Text("设置");
    textSetFontSize(title, FONT.xl);
    textSetColor(title, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const tokenLabel = Text("GitHub Token");
    textSetFontSize(tokenLabel, FONT.md);
    textSetColor(tokenLabel, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const tokenPlaceholder = token ? "已配置 (输入新值覆盖)" : "粘贴 Token...";
    const tokenInput = TextField(tokenPlaceholder, () => { /* onChange */ });
    textfieldSetString(tokenInput, token);
    const tokenStatus = Text(token ? "已配置 [OK]" : "未配置 [!]");
    textSetFontSize(tokenStatus, FONT.sm);
    textSetColor(tokenStatus, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const saveBtn = Button("保存 Token", () => {
        const val = textfieldGetString(tokenInput);
        SettingRepository.setValue("github_token", val);
    });

    // 当前加速状态（实时读取 ProxyManager）
    const pm = ProxyManager.getInstance();
    const pmStatus = pm.getStatus();
    const proxyLabel = Text("加速器");
    textSetFontSize(proxyLabel, FONT.md);
    textSetColor(proxyLabel, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const proxyToggle = Button(proxyEnabled === "true" ? "关闭加速器" : "开启加速器", () => {
        const nxt = proxyEnabled === "true" ? "false" : "true";
        SettingRepository.setValue("proxy_enabled", nxt);
        ProxyManager.getInstance().setProxyEnabled(nxt === "true");
    });

    const retestBtn = Button("重新测速", () => {
        ProxyManager.getInstance().retest();
    });

    const statusLabel = pmStatus.measuring ? "测速中..." :
        (pmStatus.connected ? "已连接 " + pmStatus.nodeName + " (" + pmStatus.latency + "ms)" : "未连接（直连模式）");
    const statusText = Text(statusLabel);
    textSetFontSize(statusText, FONT.sm);
    const statusColor = pmStatus.connected ? COLORS.success : COLORS.warning;
    textSetColor(statusText, statusColor.r, statusColor.g, statusColor.b, 1.0);

    const versionText = Text("HamsterStore v1.0.0 - Perry v0.5.1220");
    textSetFontSize(versionText, FONT.xs);
    textSetColor(versionText, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const container = VStack(SPACING.md, [
        title, Divider(),
        tokenLabel, tokenInput, tokenStatus, saveBtn,
        Divider(),
        proxyLabel, HStack(SPACING.sm, [proxyToggle, retestBtn]), statusText,
        Divider(),
        versionText,
    ]);

    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, SPACING.lg, SPACING.lg, SPACING.lg, SPACING.lg);

    return container;
}
