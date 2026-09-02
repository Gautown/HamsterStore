// HamsterStore GUI v3 — 最小化版本，避免 Perry 兼容性问题
import { App, Text, VStack } from "perry/ui";

console.log("[GUI v3] Starting...");

// 内联所有常量，避免导入问题
const COLORS = {
    primary: { r: 0.145, g: 0.388, b: 0.922 },
    bg: { r: 0.945, g: 0.953, b: 0.965 },
    text: { r: 0.118, g: 0.161, b: 0.231 },
    textSecondary: { r: 0.392, g: 0.451, b: 0.510 },
    bgCard: { r: 1.0, g: 1.0, b: 1.0 },
    success: { r: 0.22, g: 0.72, b: 0.40 },
    error: { r: 0.937, g: 0.267, b: 0.267 },
    warning: { r: 0.96, g: 0.68, b: 0.16 },
};
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24 };
const FONT = { xs: 10, sm: 12, base: 14, md: 16, lg: 18, xl: 22 };

// 导入数据层
import { initDatabase, PackageRepository } from "../data";
import { ProxyManager } from "../core/proxy/ProxyManager";
import { hamsterProxy } from "../core/proxy/HamsterProxy";

try {
    console.log("[GUI v3] Initializing database...");
    initDatabase();
    console.log("[GUI v3] Database initialized");

    // 初始化代理管理器
    try {
        console.log("[GUI v3] Initializing proxy manager...");
        ProxyManager.getInstance().init();
        console.log("[GUI v3] Proxy manager initialized");
    } catch (e: any) {
        console.error("[GUI v3] Proxy init failed:", e.message);
    }

    const pkgs = PackageRepository.getAll();
    console.log("[GUI v3] Loaded", pkgs?.length, "packages");
    
    // 创建简单界面
    const title = Text("仓鼠软库 v1.3");
    const subtitle = Text("已加载 " + (pkgs?.length || 0) + " 个软件包");
    
    const container = VStack(SPACING.md, [title, subtitle]);
    
    App({
        title: "HamsterStore 仓鼠软库",
        width: 800,
        height: 600,
        body: container,
    });
    
    console.log("[GUI v3] App started successfully!");
    
} catch (e: any) {
    console.error("[GUI v3] Fatal error:", e.message);
    console.error(e.stack);
    process.exit(1);
}
