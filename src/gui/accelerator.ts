// accelerator.ts — GUI 版本（perry 编译安全，不含 node:https / execSync）
// 核心功能从 accelerator-core.ts 导入
// fetchAccelerated 在 perry 编译版中只做 fetch 直连（fetch 在 perry 中是 stub，
// 但 GUI 对 GitHub 请求走本地 CLI API，不需要真正 fetch GitHub）
//
// 重要：禁止导入 node:https、node:child_process — winget perry v0.5.1220 缺 js_https_* 符号

// Re-export 核心 API
export {
  isAcceleratorEnabled,
  setAcceleratorEnabled,
  setStatusCallback,
  getStatus,
  startAccelerator,
  stopAccelerator,
  rewriteUrl,
  type AccelIP,
  type AccelDomain,
  type AcceleratorStatus,
} from "./accelerator-core";

// GUI 版 fetchAccelerated — 不依赖 node:https，只用 fetch（perry 版是 stub，但不影响）
export async function fetchAccelerated(
  input: string,
  init?: RequestInit
): Promise<Response> {
  // 加速器未启用 → 直接 fetch
  const { isAcceleratorEnabled } = await import("./accelerator-core");
  if (!isAcceleratorEnabled()) return fetch(input, init);

  // 带超时的 fetch
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}