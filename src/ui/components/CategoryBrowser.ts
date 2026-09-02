// CategoryBrowser — 分类浏览器（树形结构）
import {
    VStack, HStack, Text, Button, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    setPadding, setCornerRadius,
    textSetFontSize, textSetColor,
    widgetSetBackgroundColorOnHover,
} from "perry/ui";
import { COLORS, SPACING, FONT, RADIUS } from "../styles/theme";
import { PackageRepository } from "../../data";

interface CategoryNode {
    id: string;
    name: string;
    count: number;
    children?: CategoryNode[];
}

export function CategoryBrowser(onSelect: (catId: string) => void): Widget {
    // 统计数据
    const pkgs = PackageRepository.getAll();
    const catCounts: Record<string, number> = {};
    
    for (const p of pkgs) {
        try {
            const cats = JSON.parse(p.categories || "[]");
            if (Array.isArray(cats)) {
                for (const c of cats) {
                    catCounts[c] = (catCounts[c] || 0) + 1;
                }
            }
        } catch {}
    }
    
    // 构建树形结构
    const ROOT_CATS: CategoryNode[] = [
        { id: "all", name: "全部", count: pkgs.length },
        { id: "dev-tools", name: "开发工具", count: catCounts["dev-tools"] || 0 },
        { id: "education", name: "学习教育", count: catCounts["education"] || 0 },
        { id: "utility", name: "实用工具", count: catCounts["utility"] || 0 },
        { id: "web", name: "Web开发", count: catCounts["web"] || 0 },
        { id: "database", name: "数据库", count: catCounts["database"] || 0 },
        { id: "office", name: "办公效率", count: catCounts["office"] || 0 },
        { id: "game", name: "游戏娱乐", count: catCounts["game"] || 0 },
        { id: "media", name: "多媒体", count: catCounts["media"] || 0 },
        { id: "security", name: "安全相关", count: catCounts["security"] || 0 },
        { id: "system-tools", name: "系统工具", count: catCounts["system-tools"] || 0 },
        { id: "network", name: "网络工具", count: catCounts["network"] || 0 },
        { id: "communication", name: "通讯社交", count: catCounts["communication"] || 0 },
        { id: "dev-ops", name: "运维部署", count: catCounts["dev-ops"] || 0 },
    ];
    
    const header = Text("分类浏览");
    textSetFontSize(header, FONT.lg);
    textSetColor(header, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
    
    const btns: Widget[] = [];
    
    for (const cat of ROOT_CATS) {
        const catBtn = createCatButton(cat, onSelect);
        btns.push(catBtn);
    }
    
    const grid = createButtonGrid(btns);
    
    const container = VStack(SPACING.md, [header, grid]);
    widgetMatchParentWidth(container);
    widgetSetBackgroundColor(container, COLORS.bg.r, COLORS.bg.g, COLORS.bg.b, 1.0);
    
    return container;
}

function createCatButton(cat: CategoryNode, onSelect: (catId: string) => void): Widget {
    const countText = cat.count > 0 ? ` (${cat.count})` : "";
    const label = Text(cat.name + countText);
    textSetFontSize(label, FONT.base);
    textSetColor(label, cat.id === "all" ? COLORS.primary.r : COLORS.text.r,
                  cat.id === "all" ? COLORS.primary.g : COLORS.text.g,
                  cat.id === "all" ? COLORS.primary.b : COLORS.text.b, 1.0);
    
    const btn = Button("", () => onSelect(cat.id));
    widgetMatchParentWidth(btn);
    setCornerRadius(btn, RADIUS.smallCard);
    setPadding(btn, SPACING.sm, SPACING.md, SPACING.sm, SPACING.md);
    
    // 将 label 和 button 组合
    const content = HStack(SPACING.xs, [label]);
    widgetMatchParentWidth(content);
    
    return content;
}

function createButtonGrid(btns: Widget[]): Widget {
    const cols = 4;
    const rows: Widget[] = [];
    
    for (let i = 0; i < btns.length; i += cols) {
        const rowBtns = btns.slice(i, i + cols);
        const row = HStack(SPACING.sm, rowBtns);
        widgetMatchParentWidth(row);
        rows.push(row);
    }
    
    return VStack(SPACING.xs, rows);
}
