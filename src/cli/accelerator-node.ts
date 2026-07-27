// accelerator-node.ts — Node.js/CLI 版本（含 node:https + execSync）
// 用于 start_cli.ts、爬虫等需要真正 fetch GitHub 的 Node 环境
// 不可导入 GUI（会使 perry 编译缺 js_https_* 符号）

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
} from "../gui/accelerator-core";

import * as https from "node:https";
import { execSync } from "node:child_process";
import { rewriteUrl } from "../gui/accelerator-core";

// ============================================================
// fetchAccelerated — Node.js 完整版：https IP 直连 + curl 兜底
// ============================================================
export async function fetchAccelerated(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const { host } = rewriteUrl(input);
  if (!host) {
    return fetchWithTimeout(input, init, 15000);
  }

  // api.github.com 和 raw.githubusercontent.com IP 直连可能触发 GitHub 重定向+403
  // 直接用系统 DNS curl（系统 DNS 能正常解析 GitHub 域名）
  const isCdnDomain = host.includes("githubusercontent.com") || host === "api.github.com";
  if (isCdnDomain) {
    return await curlDirectFetch(input, init);
  }

  // github.com 主站仍走 IP 直连 https.request（系统 DNS 对 github.com 返回 127.0.0.1）
  try {
    return await httpsGetWithRedirect(input, init, 5);
  } catch (e: any) {
    console.log(`[accelerator] https IP 直连失败: ${e.message}，尝试 curl 兜底`);
    try {
      return await curlFetch(input, host, init);
    } catch (e2: any) {
      console.log(`[accelerator] curl 兜底失败: ${e2.message}`);
      throw e2;
    }
  }
}

async function fetchWithTimeout(input: string, init?: RequestInit, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(input, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

async function httpsGetWithRedirect(input: string, init: RequestInit | undefined, max: number): Promise<Response> {
  let current = input;
  for (let i = 0; i < max; i++) {
    const { url, host } = rewriteUrl(current);
    if (!host) throw new Error("无 IP 缓存");
    const res = await httpsGetOnce(url, host, init);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const loc = res.headers.get("location")!;
      current = loc.startsWith("http") ? loc : new URL(loc, current).toString();
      console.log(`[accelerator] 重定向 ${i + 1}: ${current}`);
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

function httpsGetOnce(url: string, host: string, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers: Record<string, string> = {
      "User-Agent": "HamsterStore/1.0",
      "Accept": "application/json, text/plain, */*",
      "Host": host,
    };
    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) headers["Authorization"] = `Bearer ${githubToken}`;
    if (init?.headers) {
      const h = init.headers;
      if (h instanceof Headers) {
        h.forEach((v, k) => { if (k.toLowerCase() !== "host") headers[k] = v; });
      } else if (Array.isArray(h)) {
        for (const [k, v] of h as [string, string][]) {
          if (k.toLowerCase() !== "host") headers[k] = v;
        }
      } else {
        for (const [k, v] of Object.entries(h)) {
          if (k.toLowerCase() !== "host") headers[k] = v as string;
        }
      }
    }
    const req = https.request(
      {
        host: u.hostname,
        port: u.port ? parseInt(u.port) : 443,
        path: u.pathname + u.search,
        method: init?.method || "GET",
        servername: host,
        rejectUnauthorized: false,
        headers,
      } as any,
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const respHeaders = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) respHeaders.set(k, Array.isArray(v) ? v.join(", ") : (v as string));
          }
          resolve(new Response(buf, {
            status: res.statusCode || 200,
            statusText: res.statusMessage || "OK",
            headers: respHeaders,
          }));
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    if (init?.body) req.write(init.body as any);
    req.end();
  });
}

function curlFetch(input: string, host: string, init?: RequestInit): Promise<Response> {
  const { rewriteUrl } = require("../gui/accelerator-core");
  const { url: _url, host: resolveHost } = rewriteUrl(input);
  if (!resolveHost) throw new Error(`curl 兜底无 IP: ${host}`);

  const u = new URL(_url);
  const ip = u.hostname;
  const resolveArg = `${host}:443:${ip}`;
  const method = init?.method || "GET";

  // 构建 headers（-H "Key: Value" 引号避免空格被 cmd.exe 拆分）
  const headerArgs: string[] = [];
  headerArgs.push("-H", `"User-Agent: HamsterStore/1.0"`);
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) headerArgs.push("-H", `"Authorization: Bearer ${githubToken}"`);
  if (init?.headers) {
    const h = init.headers;
    if (h instanceof Headers) {
      h.forEach((v, k) => { if (k.toLowerCase() !== "host") headerArgs.push("-H", `"${k}: ${v}"`); });
    } else if (Array.isArray(h)) {
      for (const [k, v] of h as [string, string][]) {
        if (k.toLowerCase() !== "host") headerArgs.push("-H", `"${k}: ${v}"`);
      }
    } else {
      for (const [k, v] of Object.entries(h)) {
        if (k.toLowerCase() !== "host") headerArgs.push("-H", `"${k}: ${v as string}"`);
      }
    }
  }

  const args = ["-sS", "--max-time", "20", "-X", method, "--resolve", resolveArg, "-k", ...headerArgs, "-L", input];
  const cmd = `curl ${args.join(" ")}`;
  console.log(`[accelerator] curl cmd: ${cmd.slice(0, 120)}`);

  const stdout = execSync(cmd, {
    maxBuffer: 50 * 1024 * 1024,
    timeout: 25000,
  }) as unknown as Buffer;
  const body = stdout.subarray(0);
  console.log(`[accelerator] curl ✓ ${body.length} bytes`);
  return Promise.resolve(new Response(body, { status: 200, statusText: "OK" }));
}

// 不用 IP 直连，直接用系统 DNS + curl（不指定 --resolve）
function curlDirectFetch(input: string, init?: RequestInit): Promise<Response> {
  const headerArgs: string[] = [];
  headerArgs.push("-H", `"User-Agent: HamsterStore/1.0"`);
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) headerArgs.push("-H", `"Authorization: Bearer ${githubToken}"`);
  if (init?.headers) {
    const h = init.headers;
    if (h instanceof Headers) {
      h.forEach((v, k) => headerArgs.push("-H", `"${k}: ${v}"`));
    } else if (Array.isArray(h)) {
      for (const [k, v] of h as [string, string][]) headerArgs.push("-H", `"${k}: ${v}"`);
    } else {
      for (const [k, v] of Object.entries(h)) headerArgs.push("-H", `"${k}: ${v as string}"`);
    }
  }
  const args = ["-sS", "--max-time", "30", "-k", ...headerArgs, "-L", input];
  const cmd = `curl ${args.join(" ")}`;
  console.log(`[accelerator] curl direct: ${cmd.slice(0, 100)}`);

  const stdout = execSync(cmd, {
    maxBuffer: 50 * 1024 * 1024,
    timeout: 35000,
  }) as unknown as Buffer;
  const body = stdout.subarray(0);
  console.log(`[accelerator] curl direct ✓ ${body.length} bytes`);
  return Promise.resolve(new Response(body, { status: 200, statusText: "OK" }));
}