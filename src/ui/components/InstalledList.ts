// InstalledList — 已安装软件列表
// 开发文档 §6.4 已安装页面

import {
    VStack, HStack, Text, Button, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { InstallationRepository, PackageRepository } from "../../data";
import { execSync } from "node:child_process";
import { InstallManager } from "../../core/install/InstallManager";
import { ProcessManager } from "../../core/process/ProcessManager";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";

export function InstalledList(): Widget {
    const installations = InstallationRepository.getAll();
    const header = Text("已安装 (" + installations.length + ")");
    textSetFontSize(header, FONT.lg);
    textSetColor(header, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const cards: Widget[] = [header];

    if (installations.length === 0) {
        const emptyMsg = Text("暂无已安装的软件");
        textSetFontSize(emptyMsg, FONT.sm);
        textSetColor(emptyMsg, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        cards.push(emptyMsg);
    }

    for (let i = 0; i < installations.length; i++) {
            const inst = installations[i];
            const pkgId = inst.package_id;
            const pkg = PackageRepository.getById(pkgId);
            const pkgName = pkg ? (pkg.name || "").split("/").pop() || "Unknown" : "Unknown";
            const date = (inst.install_date || "").substring(0, 10);
            const ver = inst.installed_version || "";

            const nameW = Text(pkgName);
            textSetFontSize(nameW, FONT.md);
            textSetColor(nameW, COLORS.primary.r, COLORS.primary.g, COLORS.primary.b, 1.0);

            const versionW = Text(inst.installed_version || "");
            textSetFontSize(versionW, FONT.xs);
            textSetColor(versionW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

            const dateW = Text(date);
            textSetFontSize(dateW, FONT.xs);
            textSetColor(dateW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

            const exeName = pkgName;
            const launchBtn = Button("启动", () => {
                try {
                    execSync('start "" "' + exeName + '.exe"', { stdio: "ignore", timeout: 3000 });
                } catch { /* ignore */ }
            });

            const targetId = pkgId;
            const uninstallBtn = Button("卸载", () => {
                InstallManager.uninstall(targetId);
            });

        const row = HStack(SPACING.sm, [nameW, versionW, dateW, launchBtn, uninstallBtn]);
        widgetMatchParentWidth(row);

        const card = VStack(SPACING.xs, [row]);
        widgetSetBackgroundColor(card, COLORS.bgCard.r, COLORS.bgCard.g, COLORS.bgCard.b, 1.0);
        widgetMatchParentWidth(card);
        setCornerRadius(card, RADIUS.smallCard);
        setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);

        cards.push(card);
    }

    const container = VStack(SPACING.md, cards);
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, SPACING.md, SPACING.md, SPACING.md, SPACING.md);

    return container;
}