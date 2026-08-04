import {
  App, VStack, HStack, Text, Button, onTerminate,
  widgetClearChildren, widgetAddChild, type Widget,
} from "perry/ui";
import { createProjectBrowser } from "./ProjectBrowser";
import { createDownloadManager } from "./DownloadManager";
import { createProxyPanel } from "./ProxyPanel";
import { createSettingsPanel } from "./SettingsPanel";
import { initTray } from "./tray";
import { bindShortcuts } from "./shortcuts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { startCliService, stopCliService } from "./cli-launcher";

// HamsterStore GUI 主入口
// 注意: 不使用 utils/logger — Perry 编译后 logger 模块顶层代码可能失败
// 注意: 不使用 TabBar/tabbarAddTab — winget perry v0.5.1220 的 TabBar 导致空白窗口
// 所有日志使用 console.log 直接输出

// 当前选中的标签索引，面板容器（用于切换）
let currentTab = 0;
let panelContainer: Widget;

// 预先创建所有面板（只在 startGUI 中调用，确保 VStack 正确嵌套）
function switchToTab(idx: number) {
  currentTab = idx;
  console.log(`[gui] 切换到标签页 #${idx}`);
  renderPanel();
}

function renderPanel() {
  if (!panelContainer) return;
  widgetClearChildren(panelContainer);

  let panel: Widget;
  switch (currentTab) {
    case 0:
      panel = createProjectBrowser();
      break;
    case 1:
      panel = createDownloadManager();
      break;
    case 2:
      panel = createProxyPanel();
      break;
    case 3:
      panel = createSettingsPanel();
      break;
    default:
      panel = Text("未知标签页");
  }
  widgetAddChild(panelContainer, panel);
}

async function startGUI() {
  try {
    console.log("[gui] HamsterStore GUI 启动中...");

    //   1. 加速器在 CLI 端运行，不在 GUI 启动 node:dns/node:net blocking probes
    //   2. 启动 CLI 服务（spawn Node.js 子进程——不等待它就绪）
    console.log("[gui] 启动 CLI 后端服务...");
    startCliService();

    // 不阻塞等 API —— 分类加载用 fetchApi 的重试机制
    // 窗口直接出现，分类数据异步加载（curl 失败时会重试）

    // 用 Button 行替代 TabBar
    const tabButtons = HStack(2, [
      Button("项目浏览", () => { switchToTab(0); }),
      Button("下载管理", () => { switchToTab(1); }),
      Button("代理设置", () => { switchToTab(2); }),
      Button("系统设置", () => { switchToTab(3); }),
    ]);

    // 面板容器 — 间距 8px，初始显示第一个标签
    panelContainer = VStack(8, [createProjectBrowser()]);
    currentTab = 0;

    const body = VStack(4, [tabButtons, panelContainer]);

    // GitHub 加速 — 内置模块，无需手动配置，默认开启
    // accelerator 由 ProxyPanel 的 import 链自动初始化
    // 所有 GitHub 访问通过加速节点代理

    // 托盘在 App() 创建后初始化（避免 perry warning: trayCreate before appCreate）
    // 用 setTimeout 延迟到 App 的 HWND 就绪后
    setTimeout(() => {
      initTray();
      bindShortcuts();
    }, 1000);

    onTerminate(() => {
      console.log("[gui] 窗口关闭，程序退出");
      stopCliService();
    });

    console.log("[gui] GUI 启动完成");

    // 优先使用 .ico 格式（Windows 原生图标），fallback .png
    const iconPathIco = join(process.cwd(), "assets", "icon.ico");
    const iconPathPng = join(process.cwd(), "assets", "icon.png");
    const iconPath = existsSync(iconPathIco) ? iconPathIco : (existsSync(iconPathPng) ? iconPathPng : "");
    const appIconPath = iconPath;

    console.log("[gui] 即将调用 App()...");
    App({
      title: "Hamster Ilmi 仓鼠软库 v1.0.0",
      width: 1200,
      height: 800,
      icon: appIconPath,
      body,
    });
    console.log("[gui] App() 返回（窗口关闭后）");
  } catch (err: any) {
    console.log("[gui] 启动失败: " + err.message);
    process.exit(1);
  }
}

startGUI().catch((err) => {
  console.log("[gui] 全局启动异常: " + err.message);
  process.exit(1);
});