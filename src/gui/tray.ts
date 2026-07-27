import {
  trayCreate,
  trayAttachMenu,
  trayOnClick,
  menuCreate,
  menuAddItem,
  menuAddSeparator,
} from "perry/ui";
import { join } from "node:path";
import { existsSync } from "node:fs";

// FIXME: logger 模块在 Perry 编译后 init 可能静默失败 → 用 console.log 替代

// Decide icon path at module level. Tray icon file (assets/icon.png) MUST exist on disk;
// perry/ui will SIGSEGV if trayCreate receives a nonexistent path.
// 优先使用 .ico 格式（Windows tray 需要 .ico）
const iconPathIco = join(process.cwd(), "assets", "icon.ico");
const iconPathPng = join(process.cwd(), "assets", "icon.png");
// 图标路径确认（静默）
const iconPath = existsSync(iconPathIco) ? iconPathIco : (existsSync(iconPathPng) ? iconPathPng : "");
const trayIcon = iconPath;

export function initTray() {
  // trayCreate BEFORE App() — produces harmless warning, tray still works
  const tray = trayCreate(trayIcon);

  const trayMenu = menuCreate();
  menuAddItem(trayMenu, "显示主窗口", () => {
    console.log("[tray] 显示主窗口");
  });
  menuAddSeparator(trayMenu);
  menuAddItem(trayMenu, "退出", () => {
    console.log("[tray] 退出程序");
    process.exit(0);
  });
  trayAttachMenu(tray, trayMenu);

  trayOnClick(tray, () => {
    console.log("[tray] 托盘双击 / 点击，显示主窗口");
  });

  console.log("[tray] 系统托盘已启动");
}