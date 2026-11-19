// 临时崩溃复现入口（docs/CRASH_REPRO.md 工作流）— 用完即删
// 目标：以 v2 Bento UI 完整接线复现 2026-08-10 EXCEPTION_STACK_OVERFLOW (0xC00000FD)。
// 与 bc80286 的 gui/main.ts 等价（initData 为空函数，此处直接 initDatabase），
// 构建带 --debug-symbols，崩溃时 .pdb 可符号化到 file:line。
import { App } from "perry/ui";
import { initDatabase } from "../data";
import { buildMainBody } from "../ui/app";
import { ProxyManager } from "../core/proxy/ProxyManager";

console.log("[repro] init database...");
initDatabase();
try { ProxyManager.getInstance().init(); } catch {}
console.log("[repro] building main body...");
const body = buildMainBody();
console.log("[repro] body built, calling App()...");
App({
    title: "HamsterStore 仓鼠软库 [CRASH REPRO]",
    width: 1024,
    height: 768,
    body,
});
console.log("[repro] App() returned (event loop ended)");
