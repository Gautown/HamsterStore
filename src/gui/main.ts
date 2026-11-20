// HamsterStore GUI — 生产入口（完整 Bento UI，Perry 0.5.1665）
// 2026-11-19 由复现工作台 _repro.ts 提升：08-10 栈溢出在 1665 未复现（90s+ 稳定），
// 交互验证后此文件即为正式 GUI 入口。构建：npm run build:gui（含 --debug-symbols/--emit-attest）
import { App } from "perry/ui";
import { initDatabase } from "../data";
import { buildMainBody } from "../ui/app";
import { ProxyManager } from "../core/proxy/ProxyManager";

console.log("[GUI] Starting...");
try {
    initDatabase();
    console.log("[GUI] Database initialized");

    try {
        ProxyManager.getInstance().init();
        console.log("[GUI] Proxy manager initialized");
    } catch (e: any) {
        console.error("[GUI] Proxy init failed:", e.message);
    }

    const body = buildMainBody();
    console.log("[GUI] Body built, entering event loop");
    App({
        title: "HamsterStore 仓鼠软库",
        width: 1024,
        height: 768,
        body,
    });
    console.log("[GUI] Event loop ended");
} catch (e: any) {
    console.error("[GUI] Fatal error:", e.message);
    console.error(e.stack);
    process.exit(1);
}
