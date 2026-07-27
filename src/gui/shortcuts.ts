import { addKeyboardShortcut } from "perry/ui";
// NOTE: 不导入 utils/logger — Perry 编译后 logger init 可能失败导致 GUI 空白

// Modifier bitmask: 1=Cmd/Ctrl, 2=Shift, 4=Alt, 8=Ctrl (standalone).
// On Windows, 1=Ctrl because the Perry runtime remaps Cmd→Ctrl on non-macOS.
// Key names: single-character strings; F1–F12 as "f1".."f12".

export function bindShortcuts() {
  // Ctrl+F — 搜索（ProjectBrowser 的搜索框已提供此功能）
    addKeyboardShortcut("f", 1, () => {});

    // Ctrl+Q — 退出
    addKeyboardShortcut("q", 1, () => {
      console.log("[shortcut] 快捷键退出");
      process.exit(0);
    });

    // F1 — 帮助（静默）
    addKeyboardShortcut("f1", 0, () => {});
}