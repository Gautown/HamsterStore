// SearchBar — 搜索框组件（增强版）
import {
    HStack, Text, TextField, Button, type Widget,
    textfieldGetString, textfieldSetString,
    textSetFontSize, textSetColor,
    widgetMatchParentWidth, setCornerRadius, setPadding,
    widgetSetBackgroundColor,
    widgetSetOnChange,
} from "perry/ui";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";
import { PackageRepository } from "../../data";

export interface SearchResult {
    id: number;
    name: string;
    description: string;
    html_url: string;
}

export function SearchBar(onSearch?: (results: SearchResult[]) => void): Widget {
    let currentQuery = "";
    
    const input = TextField("", () => {
        currentQuery = textfieldGetString(input).toLowerCase();
    });
    textSetFontSize(input, FONT.base);
    
    const clearBtn = Button("×", () => {
        textfieldSetString(input, "");
        currentQuery = "";
        (globalThis as any).__hamsterStoreQuery = "";
        rebuildList();
    });
    
    const searchBtn = Button("搜索", () => {
        const query = textfieldGetString(input).toLowerCase();
        if (!query) return;
        
        (globalThis as any).__hamsterStoreQuery = query;
        (globalThis as any).__hamsterStoreNavigate && (globalThis as any).__hamsterStoreNavigate("packages");
        
        // 立即过滤显示
        const pkgs = PackageRepository.getAll();
        const results: SearchResult[] = [];
        for (let i = 0; i < pkgs.length; i++) {
            const p = pkgs[i];
            const name = (p.name || "").toLowerCase();
            const desc = (p.description || "").toLowerCase();
            if (name.includes(query) || desc.includes(query)) {
                results.push({
                    id: p.id,
                    name: p.name,
                    description: p.description || "",
                    html_url: "https://github.com/" + p.name,
                });
            }
        }
        if (onSearch) onSearch(results);
    });
    
    const label = Text("🔍");
    textSetFontSize(label, FONT.md);
    
    const row = HStack(SPACING.xs, [label, input, clearBtn, searchBtn]);
    widgetMatchParentWidth(row);
    widgetSetBackgroundColor(row, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setCornerRadius(row, RADIUS.button);
    setPadding(row, SPACING.xs, SPACING.sm, SPACING.xs, SPACING.sm);
    
    return row;
}

// 重建列表（由外部调用）
function rebuildList(): void {
    // 通过全局状态触发重渲染
    (globalThis as any).__hamsterStoreRebuild && (globalThis as any).__hamsterStoreRebuild();
}
