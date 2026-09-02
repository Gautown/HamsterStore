// PackageList — Bento 风格软件卡片列表（增强版）
import {
    VStack, HStack, Text, Button, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setCornerRadius, setPadding,
    textSetFontSize, textSetColor,
} from "perry/ui";
import { PackageRepository } from "../../data";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";
import { DownloadManager } from "../../core/download/DownloadManager";
import { navigateToDetail } from "../app";

export interface PackageListFilter {
    category?: string | null;
    sourceId?: number;
    query?: string;
}

export function PackageList(filter: PackageListFilter = {}): Widget {
    const all = PackageRepository.getAll();
    let pkgs = all;
    
    // 搜索过滤
    if (filter.query) {
        const q = filter.query.toLowerCase();
        pkgs = pkgs.filter(p => {
            const name = (p.name || "").toLowerCase();
            const desc = (p.description || "").toLowerCase();
            return name.includes(q) || desc.includes(q);
        });
    }
    
    // 分类过滤
    if (filter.category) {
        pkgs = pkgs.filter(p => {
            try {
                const cats = JSON.parse(p.categories || "[]");
                return Array.isArray(cats) && cats.includes(filter.category);
            } catch { return false; }
        });
    }
    
    // 来源过滤
    if (filter.sourceId && filter.sourceId > 0) {
        pkgs = pkgs.filter(p => String(p.source_id) === String(filter.sourceId));
    }
    
    // 排序
    pkgs.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
    
    // Header
    const headerText = filter.query
        ? `搜索 "${filter.query}" (${pkgs.length} 个结果)`
        : filter.category
            ? `${getCategoryName(filter.category)} (${pkgs.length} 个)`
            : `软件库 (${pkgs.length} 个)`;
    const header = Text(headerText);
    textSetFontSize(header, FONT.lg);
    textSetColor(header, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    
    const rows: Widget[] = [];
    
    if (pkgs.length === 0) {
        const emptyText = Text("暂无匹配结果 — 尝试其他关键词或运行 sync 同步更多数据");
        textSetFontSize(emptyText, FONT.sm);
        textSetColor(emptyText, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
        rows.push(emptyText);
    } else {
        // 显示所有包
        for (let i = 0; i < pkgs.length; i++) {
            const p = pkgs[i];
            const shortName = (p.name || "").split("/").pop() || (p.name || "Unknown");
            const desc = (p.description || "").substring(0, 100);
            
            let catLabels: string[] = [];
            try { catLabels = JSON.parse(p.categories || "[]"); } catch { }
            const catStr = catLabels.length > 0 ? catLabels[0] : "其他";
            
            // 解析数据源
            let dataSource = "";
            try {
                const ext = JSON.parse(p.extra_json || "{}");
                dataSource = ext.data_source || "";
            } catch {}
            
            // 名称
            const nameW = Text(shortName);
            textSetFontSize(nameW, FONT.md);
            textSetColor(nameW, COLORS.primary.r, COLORS.primary.g, COLORS.primary.b, 1.0);
            
            // 描述
            const descW = Text(desc || "暂无描述");
            textSetFontSize(descW, FONT.xs);
            textSetColor(descW, COLORS.textSecondary.r, COLORS.textSecondary.g, COLORS.textSecondary.b, 1.0);
            
            // 分类标签
            const catW = createCatBadge(catStr);
            
            // 按钮
            const detailBtn = Button("详情", () => navigateToDetail(p.id));
            const openBtn = Button("查看", () => {
                const url = p.download_url || ("https://github.com/" + p.name);
                DownloadManager.openInBrowser(url);
            });
            
            const btnRow = HStack(SPACING.xs, [detailBtn, openBtn]);
            
            const row = HStack(SPACING.sm, [nameW, catW]);
            widgetMatchParentWidth(row);
            
            const card = VStack(SPACING.xs, [row, descW, btnRow]);
            widgetSetBackgroundColor(card, COLORS.bgCard.r, COLORS.bgCard.g, COLORS.bgCard.b, 1.0);
            widgetMatchParentWidth(card);
            setCornerRadius(card, RADIUS.smallCard);
            setPadding(card, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);
            
            rows.push(card);
        }
    }
    
    const allWidgets: Widget[] = [header];
    for (let i = 0; i < rows.length; i++) {
        allWidgets.push(rows[i]);
    }
    const container = VStack(SPACING.sm, allWidgets);
    widgetMatchParentWidth(container);
    setPadding(container, SPACING.md, SPACING.md, SPACING.md, SPACING.md);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    
    return container;
}

function createCatBadge(catStr: string): Widget {
    const badge = Text(catStr);
    textSetFontSize(badge, FONT.xs);
    textSetColor(badge, COLORS.secondary.r, COLORS.secondary.g, COLORS.secondary.b, 1.0);
    widgetSetBackgroundColor(badge, 0.95, 0.98, 1.0, 1.0);
    setCornerRadius(badge, 6);
    setPadding(badge, 2, 8, 2, 8);
    return badge;
}

function getCategoryName(catId: string): string {
    const names: Record<string, string> = {
        "dev-tools": "开发工具",
        "education": "学习教育",
        "utility": "实用工具",
        "web": "Web开发",
        "database": "数据库",
        "office": "办公效率",
        "game": "游戏娱乐",
        "media": "多媒体",
        "security": "安全相关",
        "system-tools": "系统工具",
        "network": "网络工具",
        "communication": "通讯社交",
        "dev-ops": "运维部署",
    };
    return names[catId] || catId;
}
