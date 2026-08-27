// UpdateCenter — 更新中心
// 开发文档 §6.4：集中展示软件包更新和应用自身更新

import {
    VStack, HStack, Text, Button, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { PackageRepository, InstallationRepository } from "../../data";
import { SelfUpdater } from "../../core/update/SelfUpdater";
import { InstallManager } from "../../core/install/InstallManager";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";

export function UpdateCenter(): Widget {
    const title = Text("更新中心");
    textSetFontSize(title, FONT.xl);
    textSetColor(title, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const sections: Widget[] = [title];

    // === 软件包更新 ===
    const pkgs = PackageRepository.getAll();
    const installations = InstallationRepository.getAll();
    let updatable = 0;
    for (const inst of installations) {
        if (inst.update_available === 1) updatable++;
    }

    const pkgHeader = Text("软件包更新 (" + updatable + " 个可更新)");
    textSetFontSize(pkgHeader, FONT.md);
    textSetColor(pkgHeader, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    sections.push(pkgHeader);

    if (updatable === 0) {
        const noUpdate = Text("所有软件均为最新版本 [OK]");
        textSetFontSize(noUpdate, FONT.sm);
        textSetColor(noUpdate, COLORS.secondary.r, COLORS.secondary.g, COLORS.secondary.b, 1.0);
        sections.push(noUpdate);
    } else {
        for (const inst of installations) {
            if (inst.update_available !== 1) continue;
            const pkg = PackageRepository.getById(inst.package_id);
            const pkgName = pkg ? (pkg.name || "").split("/").pop() || "Unknown" : "Unknown";

            const nameW = Text(pkgName);
            textSetFontSize(nameW, FONT.sm);
            textSetColor(nameW, COLORS.primary.r, COLORS.primary.g, COLORS.primary.b, 1.0);

            const oldVer = Text("当前: " + (inst.installed_version || "unknown"));
            textSetFontSize(oldVer, FONT.xs);
            textSetColor(oldVer, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);

            const updateBtn = Button("更新", () => {
                            // 触发更新：重新下载安装
                            if (pkg) {
                                try {
                                    InstallManager.install(pkg.id);
                                } catch {}
                            }
                        });

            sections.push(HStack(SPACING.sm, [nameW, oldVer, updateBtn]));
        }
    }

    // === 应用自身更新 ===
    const appDivider = Text("应用自身更新");
    textSetFontSize(appDivider, FONT.md);
    textSetColor(appDivider, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    sections.push(appDivider);

    const currentVer = Text("当前版本: v1.0.0");
    textSetFontSize(currentVer, FONT.sm);
    textSetColor(currentVer, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
    sections.push(currentVer);

    const checkBtn = Button("检查更新", () => {
        try {
            const exePath = process.argv[0] || process.execPath || "";
            const updater = new SelfUpdater(exePath, "1.0.0");
            const info = updater.checkUpdate();
            if (info && info.hasUpdate) {
                console.log("[Update] New version: " + info.latestVersion);
            }
        } catch {}
    });
    sections.push(checkBtn);

    const container = VStack(SPACING.md, sections);
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    setPadding(container, SPACING.lg, SPACING.lg, SPACING.lg, SPACING.lg);

    return container;
}