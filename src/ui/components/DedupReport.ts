// DedupReport — 去重报告 UI 组件

import {
    VStack, HStack, Text, Button, Divider, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";
import { dedupCleaner } from "../../core/dedup/DedupCleaner";

// 全局刷新回调（由 app.ts 在页面切换时设置）
let _rebuildBody: (() => void) | null = null;
export function setRebuildBody(fn: () => void): void {
    _rebuildBody = fn;
}

export function DedupReportPage(): Widget {
    let report: any;
    try {
        report = dedupCleaner.generateReport();
    } catch (e) {
        const err = Text("去重报告生成失败: " + (e instanceof Error ? e.message : String(e)));
        textSetFontSize(err, FONT.sm);
        textSetColor(err, COLORS.danger.r, COLORS.danger.g, COLORS.danger.b, 1.0);
        return err;
    }

    const title = Text("去重报告");
    textSetFontSize(title, FONT.xl);
    textSetColor(title, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    // 统计卡片
    const stats = [
        { label: "总软件数", value: String(report.totalPackages) },
        { label: "唯一 Hash", value: String(report.uniqueHashes) },
        { label: "重复组数", value: String(report.duplicateGroups) },
        { label: "重复条目", value: String(report.totalDuplicates) },
    ];

    const children: Widget[] = [title, Divider()];
    for (const s of stats) {
        const row = HStack(SPACING.md, [
            Text(s.label),
            Text(s.value),
        ]);
        textSetFontSize(row, FONT.base);
        children.push(row);
    }
    children.push(Divider());

    // 精确重复组
    const exactHeader = Text("精确重复 (url_hash 相同) — " + report.groups.length + " 组");
    textSetFontSize(exactHeader, FONT.md);
    textSetColor(exactHeader, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    children.push(exactHeader);

    if (report.groups.length === 0) {
        const ok = Text("✓ 无精确重复项");
        textSetFontSize(ok, FONT.sm);
        textSetColor(ok, COLORS.success.r, COLORS.success.g, COLORS.success.b, 1.0);
        children.push(ok);
    } else {
        for (let i = 0; i < Math.min(report.groups.length, 20); i++) {
            const g = report.groups[i];
            children.push(buildExactGroupCard(g));
        }
        if (report.groups.length > 20) {
            const more = Text("... 还有 " + (report.groups.length - 20) + " 组未显示");
            textSetFontSize(more, FONT.xs);
            textSetColor(more, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
            children.push(more);
        }
    }

    // 模糊候选
    children.push(Divider());
    const fuzzyHeader = Text("模糊匹配候选 (名称相似) — " + report.fuzzyCandidates.length + " 对");
    textSetFontSize(fuzzyHeader, FONT.md);
    textSetColor(fuzzyHeader, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    children.push(fuzzyHeader);

    if (report.fuzzyCandidates.length === 0) {
        const ok = Text("✓ 无模糊重复项");
        textSetFontSize(ok, FONT.sm);
        textSetColor(ok, COLORS.success.r, COLORS.success.g, COLORS.success.b, 1.0);
        children.push(ok);
    } else {
        for (let i = 0; i < Math.min(report.fuzzyCandidates.length, 10); i++) {
            const fc = report.fuzzyCandidates[i];
            children.push(buildFuzzyCard(fc));
        }
    }

    // 操作按钮
    children.push(Divider());
    const btnRow = HStack(SPACING.sm, [
        Button("执行清理", () => {
            try {
                const result = dedupCleaner.runCleanup();
                // 显示结果
                const info = Text("✓ 已清理 " + result.cleaned + " 条重复记录");
                textSetFontSize(info, FONT.sm);
                textSetColor(info, COLORS.success.r, COLORS.success.g, COLORS.success.b, 1.0);
                children.push(info);
                // 刷新页面
                setTimeout(() => { _rebuildBody && _rebuildBody(); }, 300);
            } catch (e) {
                const err = Text("清理失败: " + (e instanceof Error ? e.message : String(e)));
                textSetFontSize(err, FONT.sm);
                textSetColor(err, COLORS.danger.r, COLORS.danger.g, COLORS.danger.b, 1.0);
                children.push(err);
            }
        }),
        Button("刷新报告", () => {
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

function buildExactGroupCard(group: any): Widget {
    const canonicalName = (group.canonical.name || "Unknown").split("/").pop() || group.canonical.name || "";
    const dupNames = group.duplicates.map((d: any) => {
        return (d.name || "Unknown").split("/").pop() || d.name || "";
    });

    const header = Text("重复组 [" + (group.urlHash || "").substring(0, 12) + "...]");
    textSetFontSize(header, FONT.sm);
    textSetColor(header, COLORS.warning.r, COLORS.warning.g, COLORS.warning.b, 1.0);

    const canonicalW = Text("✓ " + canonicalName + " (保留)");
    textSetFontSize(canonicalW, FONT.base);
    textSetColor(canonicalW, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);

    const dupLines: Widget[] = [];
    for (const name of dupNames) {
        const w = Text("  ✗ " + name);
        textSetFontSize(w, FONT.sm);
        textSetColor(w, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        dupLines.push(w);
    }

    const card = VStack(SPACING.xs, [header, canonicalW, ...dupLines]);
    widgetMatchParentWidth(card);
    widgetSetBackgroundColor(card, COLORS.bgCard.r, COLORS.bgCard.g, COLORS.bgCard.b, 1.0);
    setCornerRadius(card, RADIUS.smallCard);
    setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);
    return card;
}

function buildFuzzyCard(fc: any): Widget {
    const score = Math.round(fc.score * 100);
    const nameA = (fc.pkg.name || "Unknown").split("/").pop() || fc.pkg.name || "";
    const nameB = (fc.match.name || "Unknown").split("/").pop() || fc.match.name || "";

    const row = HStack(SPACING.sm, [
        Text(nameA),
        Text("≈ " + score + "%"),
        Text(nameB),
    ]);
    textSetFontSize(row, FONT.sm);
    widgetMatchParentWidth(row);

    const card = VStack(SPACING.xs, [row]);
    widgetSetBackgroundColor(card, COLORS.bgCard.r, COLORS.bgCard.g, COLORS.bgCard.b, 1.0);
    widgetMatchParentWidth(card);
    setCornerRadius(card, RADIUS.smallCard);
    setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);
    return card;
}
