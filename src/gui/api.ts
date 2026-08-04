// GUI 内部 API 调用封装
// 1. GitHub 请求（api.github.com / github.com）走加速器（DNS+IP 直连）
// 2. 本地 CLI API 请求（127.0.0.1:5678）— perry 编译版 fetch 是 stub，
//    改用 execSync("curl") 真正发 HTTP 请求
// NOTE: 不导入 utils/logger — Perry 编译后 logger init 可能失败导致 GUI 空白

import { fetchAccelerated } from "./accelerator";
import { execSync } from "node:child_process";

let apiPort = process.env.API_PORT || "5678";

// 判断 URL 是否是 GitHub 域名 — 如果是则走加速器
function isGithubUrl(url: string): boolean {
  return url.includes("github.com") ||
    url.includes("githubusercontent.com") ||
    url.includes("githubstatus.com");
}

// 统一 fetch 封装：GitHub URL → 加速器；本地 API → curl（绕过 perry fetch stub）
export async function fetchApi(path: string, options?: RequestInit): Promise<any> {
  const isLocal = path.startsWith("/") || path.startsWith("http://127.0.0.1");
  const url = isLocal
    ? (path.startsWith("http") ? path : `http://127.0.0.1:${apiPort}${path}`)
    : path;

  try {
    if (isGithubUrl(url)) {
      const res = await fetchAccelerated(url, options);
      // GitHub 请求使用原生 Response，ok/json 可用
      if (!res.ok) throw new Error(`API 请求失败: ${res.status} ${res.statusText}`);
      return await res.json();
    }

    // 本地 API：curl 直接返回 body，跳过 perry Response 的 stub 方法
    const body = curlGetBody(url);
    if (!body || body.length === 0) throw new Error("API 返回空数据");
    return JSON.parse(body);
  } catch (err: any) {
    console.log(`[api] fetchApi(${path}) 失败: ${err.message}`);
    throw err;
  }
}

// 用 curl 直接返回 body 文本（不构造 Response，绕过 perry stub 问题）
// Windows CreateProcess → cmd.exe /C：& 被解析为命令分隔符，必须用 ^ 转义
// 不能用引号——curl 在引号内把 "http://..." 当非法 URL
function curlGetBody(url: string): string {
  const safeUrl = url.replace(/&/g, "^&").replace(/\*/g, "^*");
  const cmd = `curl -sS --max-time 5 --retry 2 --retry-delay 1 ${safeUrl}`;
  const stdout = execSync(cmd, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 12000,
    stdio: ["pipe", "pipe", "pipe"],
  }) as unknown as Buffer;
  return stdout.toString("utf8").trim();
}

// 直接通过加速器 fetch GitHub URL（用于爬虫/获取 release 信息）
export async function fetchGithub(url: string, options?: RequestInit): Promise<Response> {
  return fetchAccelerated(url, options);
}

export function setApiPort(port: string) {
  apiPort = port;
}

export function getApiPort() {
  return apiPort;
}