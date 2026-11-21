// HamsterStore GUI — production entry (Perry 0.5.1520, responsive Bento UI)
// Window size: 86% of the desktop work area (clamped 900x600 .. 1500x940).
// HAMSTER_WIN_W / HAMSTER_WIN_H env vars override for resolution smoke tests.
// perry/ui has no resize event; src/ui/responsive.ts polls the client rect and
// rebuilds this tree when the window changes size.
import { App, VStack, Spacer, widgetMatchParentWidth, widgetMatchParentHeight, widgetSetBackgroundColor } from "perry/ui";
import { initDatabase } from "../data";
import { buildMainBody } from "../ui/app";
import { setCurrentPage as setInitialPage } from "../ui/components/ContentArea";
import { ProxyManager } from "../core/proxy/ProxyManager";
import { detectWorkArea, initialWindowSize, installResponsive, setViewport, FRAME_W, FRAME_H } from "../ui/responsive";

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

    const work = detectWorkArea();
    const size = initialWindowSize(work);
    setViewport(size.width - FRAME_W, size.height - FRAME_H);
    console.log("[GUI] window " + size.width + "x" + size.height + " (work area " + work.width + "x" + work.height + ")");

    const startPage = process.env.HAMSTER_START_PAGE || "";
    if (startPage) setInitialPage(startPage);

    const root = VStack(0, []);
    widgetMatchParentWidth(root);
    widgetMatchParentHeight(root);
    widgetSetBackgroundColor(root, 0.945, 0.953, 0.965, 1.0);

    installResponsive(root, buildMainBody);

    const cfg: any = {
        title: "HamsterStore 仓鼠软库",
        width: size.width,
        height: size.height,
        body: root,
    };
    const forced = !!(process.env.HAMSTER_WIN_W || process.env.HAMSTER_WIN_H);
    if (!forced) cfg.frameAutosaveName = "HamsterStore.MainWindow";

    App(cfg);
    console.log("[GUI] Event loop ended");
} catch (e: any) {
    console.error("[GUI] Fatal error:", e.message);
    console.error(e.stack);
    process.exit(1);
}
