// SearchBar — 搜索框组件
// 开发文档 §6.2：标题栏中的搜索框

import {
    HStack, Text, TextField, Button, type Widget,
    textfieldGetString,
    textSetFontSize, textSetColor,
    widgetMatchParentWidth, setCornerRadius, setPadding,
    widgetSetBackgroundColor,
} from "perry/ui";
import { COLORS, RADIUS, SPACING, FONT } from "../styles/theme";
import { PackageRepository } from "../../data";

export interface SearchResult {
    id: number;
    name: string;
    description: string;
    html_url: string;
}

// SearchBar — 可带回调或不带使用
export function SearchBar(onSearch?: (results: SearchResult[]) => void): Widget {
    const input = TextField("搜索软件...", () => { /* onChange */ });
    const label = Text("*");
    textSetFontSize(label, FONT.md);

    const searchBtn = Button("搜索", () => {
        const query = textfieldGetString(input).toLowerCase();
        if (!query) return;

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

    const row = HStack(SPACING.sm, [label, input, searchBtn]);
    widgetMatchParentWidth(row);
    widgetSetBackgroundColor(row, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setCornerRadius(row, RADIUS.button);
    setPadding(row, SPACING.xs, SPACING.sm, SPACING.xs, SPACING.sm);

    return row;
}