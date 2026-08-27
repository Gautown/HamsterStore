// 仓鼠软库 GUI v2 — Bento UI 桌面应用
// 开发文档 §6 Bento Grid 布局 + 5 页面导航

import { App } from "perry/ui";
import { initData } from "./api";
import { buildMainBody } from "../ui/app";

// 启动前初始化数据层（种子仓库 + FileDB）
initData();

// Bento UI 入口
App({
    title: "HamsterStore 仓鼠软库",
    width: 1024,
    height: 768,
    body: buildMainBody(),
});