// TitleBar — top bar (responsive)
// left: logo + app name; center: search field; right: close
import {
    HStack, Text, TextField, Spacer, type Widget,
    widgetMatchParentWidth, widgetSetBackgroundColor,
    widgetSetWidth,
    setPadding,
    textSetFontSize, textSetColor, textfieldGetString,
    widgetSetOnMouseDown,
} from "perry/ui";
import { COLORS, SPACING, FONT } from "../styles/theme";
import { getSpec,getViewport } from "../responsive";

function ClickArea(label: string, action: () => void): Widget {
    const text = Text(label);
    textSetFontSize(text, FONT.base);
    const area = HStack(SPACING.sm, [text]);
    widgetSetOnMouseDown(area, action);
    widgetSetOnMouseDown(text, action);
    return area;
}

export function TitleBar(): Widget {
    const vp = getViewport();
    const spec = getSpec();
    const compact = spec.compact;

    const logo = Text("HS");
    textSetFontSize(logo, 18);
    textSetColor(logo, COLORS.primary.r, COLORS.primary.g, COLORS.primary.b, 1.0);
    const leftItems: Widget[] = [logo];
    if (!compact) {
        const appName = Text("HamsterStore");
        textSetFontSize(appName, FONT.md);
        textSetColor(appName, COLORS.text.r, COLORS.text.g, COLORS.text.b, 1.0);
        leftItems.push(appName);
    }
    const leftSection = HStack(SPACING.sm, leftItems);

    const searchInput = TextField("搜索软件...", () => {});
    const searchW = Math.max(180, Math.min(460, Math.floor(vp.width * 0.36)));
    widgetSetWidth(searchInput, searchW);

    const searchBtn = ClickArea("搜索", () => {
        const q = textfieldGetString(searchInput).trim();
        if (q.length < 2) return;
        (globalThis as any).__hamsterRunSearch && (globalThis as any).__hamsterRunSearch(q);
    });
    const searchSection = HStack(SPACING.xs, [searchInput, searchBtn]);

    const closeBtn = ClickArea("X", () => {
        (globalThis as any).__hamsterCloseWindow && (globalThis as any).__hamsterCloseWindow();
    });

    const bar = HStack(SPACING.md, [leftSection, Spacer(), searchSection, Spacer(), closeBtn]);
    widgetMatchParentWidth(bar);
    widgetSetBackgroundColor(bar, COLORS.white.r, COLORS.white.g, COLORS.white.b, 1.0);
    setPadding(bar, SPACING.sm, compact ? SPACING.sm : SPACING.md, SPACING.sm, compact ? SPACING.sm : SPACING.md);
    return bar;
}
