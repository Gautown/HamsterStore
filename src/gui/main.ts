// 仓鼠软库 GUI v2 — Bento UI 桌面应用
// 开发文档 §6 Bento Grid 布局 + 5 页面导航

import { App } from "perry/ui";
import { initData } from "./api";
import { buildMainBody } from "../ui/app";

initData();
const body = buildMainBody();
// 注：自定义无边框标题栏（frameless + 拖拽 + 控制）因 perry v0.5.1220 运行时无法调用
// Win32（execSync 阻塞事件循环 / spawn 起不了 powershell）而暂缓交付。相关正确实现见
// src/ui/utils/window.ts（makeFrameless / sendSysCommand），待 perry 升级支持运行时
// Win32 FFI 或 frameless 选项后启用。当前保持普通窗口，自定义栏 UI 仍渲染在顶部。
App({
    title: "HamsterStore 仓鼠软库",
    width: 1024,
    height: 768,
    body,
});
