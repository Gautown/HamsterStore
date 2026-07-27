// GitHub 加速代理面板 — FastGithub 风格（DNS 查询 + IP 测速 + IP 直连）
// 默认开启，无需手动配置
// 不导入 utils/logger（空白窗口）和 ../proxy（node:http 链接失败）
import {
  VStack, Text, Toggle, Button,
  widgetClearChildren, widgetAddChild,
  textSetString, toggleSetState, type Widget,
} from "perry/ui";
import {
  getStatus, setAcceleratorEnabled, setStatusCallback,
  startAccelerator, type AcceleratorStatus, type AccelDomain,
} from "./accelerator";

// Module-scoped widget handles
let statusLine: Widget;
let domainContainer: Widget;
let enabledToggle: Widget;

export function createProxyPanel(): Widget {
  // 加速开关（默认开启）
  enabledToggle = Toggle("启用 GitHub 加速（默认开启，无需手动配置）", (val: boolean) => {
    setAcceleratorEnabled(val);
    toggleSetState(enabledToggle, val ? 1 : 0);
    renderStatus(getStatus());
    renderDomains(getStatus());
  });
  toggleSetState(enabledToggle, 1);

  // 状态摘要
  statusLine = Text("FastGithub 加速模块初始化中...");

  // 域名-IP 状态列表
  domainContainer = VStack(2, []);

  // 手动刷新按钮
  const refreshBtn = Button("手动刷新 IP 测速", () => {
    textSetString(statusLine, "正在重新查询 DNS 并测速...");
    startAccelerator();
  });

  // 注册状态变化回调
  setStatusCallback((s) => {
    renderStatus(s);
    renderDomains(s);
  });

  // 启动加速器
  startAccelerator();

  return VStack(10, [
    Text("GitHub 加速模块 (FastGithub 风格)"),
    Text("DNS 查询 + IP 测速 + IP 直连，绕过 DNS 污染和 SNI 阻断"),
    enabledToggle,
    statusLine,
    domainContainer,
    refreshBtn,
    Text("—"),
    Text("自动从公共 DNS 解析 GitHub 域名 IP"),
    Text("测速选最快 IP，fetch 时直接连接 IP"),
  ]);
}

function renderStatus(s: AcceleratorStatus) {
  if (!s.enabled) {
    textSetString(statusLine, "○ 加速已关闭 — 直连 GitHub");
    return;
  }
  const ok = s.domains.filter(d => d.bestIP).length;
  const total = s.acceleratedDomainCount;
  textSetString(statusLine, `✅ 加速模式 — ${ok}/${total} 域名有可用 IP`);
}

function renderDomains(s: AcceleratorStatus) {
  if (!domainContainer) return;
  widgetClearChildren(domainContainer);

  if (s.domains.length === 0) {
    widgetAddChild(domainContainer, Text("正在查询 DNS..."));
    return;
  }
  for (const d of s.domains as AccelDomain[]) {
    const icon = d.bestIP ? "✅" : "❌";
    const best = d.bestIP ? ` ${d.bestIP.ip} (${d.bestIP.latency}ms)` : " 无可用 IP";
    const ipCount = d.ips.length;
    const row = Text(`${icon} ${d.domain}${best} [${ipCount} IPs]`);
    widgetAddChild(domainContainer, row);
  }
}