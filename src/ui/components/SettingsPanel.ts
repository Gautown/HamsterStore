// SettingsPanel — 设置面板（Bento 风格）
// Token 管理 + 加速器开关 + 版本信息

import {
    VStack, HStack, Text, Button, TextField, Divider, type Widget,
    textfieldGetString, textfieldSetString,
    widgetMatchParentWidth,
    widgetSetBackgroundColor, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { SettingRepository } from "../../data";
import { COLORS, SPACING, FONT } from "../styles/theme";

export function SettingsPanel(): Widget {
    const token = SettingRepository.getValue("github_token") || "";
    const proxyEnabled = SettingRepository.getValue("proxy_enabled") || "true";

    const title = Text("设置");
    textSetFontSize(title, FONT.xl);
    textSetColor(title, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const tokenLabel = Text("GitHub Token");
    textSetFontSize(tokenLabel, FONT.md);
    textSetColor(tokenLabel, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const tokenPlaceholder = token ? "已配置 (输入新值覆盖)" : "ghp_xxxxxxxxxxxx";
    const tokenInput = TextField(tokenPlaceholder, () => { /* onChange */ });
    textfieldSetString(tokenInput, token);
    const tokenStatus = Text(token ? "已配置 [OK]" : "未配置 [!]");
    textSetFontSize(tokenStatus, FONT.sm);
    textSetColor(tokenStatus, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const saveBtn = Button("保存 Token", () => {
        const val = textfieldGetString(tokenInput);
        SettingRepository.setValue("github_token", val);
    });

    const proxyLabel = Text("加速器");
    textSetFontSize(proxyLabel, FONT.md);
    textSetColor(proxyLabel, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const proxyToggle = Button(proxyEnabled === "true" ? "关闭加速器" : "开启加速器", () => {
        const nxt = proxyEnabled === "true" ? "false" : "true";
        SettingRepository.setValue("proxy_enabled", nxt);
    });

    const versionText = Text("HamsterStore v1.0.0 - Perry v0.5.1220");
    textSetFontSize(versionText, FONT.xs);
    textSetColor(versionText, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

    const container = VStack(SPACING.md, [
        title, Divider(),
        tokenLabel, tokenInput, tokenStatus, saveBtn,
        Divider(),
        proxyLabel, proxyToggle,
        Divider(),
        versionText,
    ]);

    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, SPACING.lg, SPACING.lg, SPACING.lg, SPACING.lg);

    return container;
}