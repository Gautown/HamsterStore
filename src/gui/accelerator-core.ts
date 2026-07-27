// accelerator-core.ts — FastGithub 加速器核心（GUI + CLI 共用）
// 不含 node:https / execSync（确保 perry 编译不出 undefined symbol）
// FastGithub 原理：https://github.com/creazyboyone/FastGithub
//   1. 硬编码 GitHub IP 段（应对 DNS 全面投毒）
//   2. 多 DNS 服务器补充查询 + 过滤投毒 IP
//   3. TCP 测速选最快 IP
//   4. URL 改写为 IP 直连

import { resolve4, Resolver } from "node:dns";
import * as net from "node:net";

// ============================================================
// 硬编码 GitHub IP 段 — 已知可连通的 IP
// ============================================================
const HARDCODED_IPS: Record<string, string[]> = {
  "github.com": [
    "20.205.243.166",  "20.205.243.165",  "20.205.243.167",
    "140.82.112.3",    "140.82.112.4",    "140.82.113.4",
  ],
  "api.github.com": [
    "20.205.243.168",  "20.205.243.166",  "20.205.243.165",
  ],
  "raw.githubusercontent.com": [
    "185.199.108.133", "185.199.109.133", "185.199.110.133", "185.199.111.133",
  ],
  "codeload.github.com": [
    "20.205.243.165",  "20.205.243.166",
  ],
  "objects.githubusercontent.com": [
    "185.199.108.133", "185.199.109.133", "185.199.110.133", "185.199.111.133",
  ],
  "githubstatus.com": [
    "185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153",
  ],
  "gist.github.com": [
    "20.205.243.166",  "140.82.112.3",
  ],
};

const ACCEL_DOMAINS = Object.keys(HARDCODED_IPS);
const PUBLIC_DNS_SERVERS = ["1.1.1.1", "8.8.8.8", "114.114.114.114", "223.5.5.5"];

const TCP_PROBE_TIMEOUT_MS = 3000;
const MAX_IP_COUNT = 3;
const DNS_TIMEOUT_MS = 4000;
const RECHECK_INTERVAL_MS = 10 * 60 * 1000;

// ============================================================
// 类型与状态
// ============================================================
export interface AccelIP { ip: string; latency: number; alive: boolean; lastCheck: number; }
export interface AccelDomain { domain: string; ips: AccelIP[]; bestIP: AccelIP | null; lastResolved: number; }
export interface AcceleratorStatus {
  enabled: boolean;
  mode: "accelerated" | "direct";
  domains: AccelDomain[];
  acceleratedDomainCount: number;
}

let enabled = true;
let accelDomains: Map<string, AccelDomain> = new Map();
let recheckTimer: ReturnType<typeof setInterval> | null = null;
let onStatusChange: ((status: AcceleratorStatus) => void) | null = null;

export function isAcceleratorEnabled() { return enabled; }
export function setAcceleratorEnabled(v: boolean) { enabled = v; emitStatus(); }
export function setStatusCallback(cb: (s: AcceleratorStatus) => void) { onStatusChange = cb; }
export function getStatus(): AcceleratorStatus {
  return {
    enabled,
    mode: enabled ? "accelerated" : "direct",
    domains: Array.from(accelDomains.values()),
    acceleratedDomainCount: ACCEL_DOMAINS.length,
  };
}

export function startAccelerator() {
  console.log(`[accelerator] FastGithub 加速器启动 — ${ACCEL_DOMAINS.length} 个域名`);
  refreshAllDomains().then(() => {
    const ready = Array.from(accelDomains.values()).filter(d => d.bestIP).length;
    console.log(`[accelerator] 初始化完成 — ${ready}/${ACCEL_DOMAINS.length} 域名有可用 IP`);
    emitStatus();
  }).catch((e) => console.log(`[accelerator] 初始化失败: ${e?.message || e}`));

  if (recheckTimer) clearInterval(recheckTimer);
  recheckTimer = setInterval(refreshAllDomains, RECHECK_INTERVAL_MS);
}

export function stopAccelerator() {
  if (recheckTimer) { clearInterval(recheckTimer); recheckTimer = null; }
}

export function rewriteUrl(originalUrl: string): { url: string; host: string | null } {
  if (!enabled) return { url: originalUrl, host: null };
  try {
    const u = new URL(originalUrl);
    const accelDomain = accelDomains.get(u.hostname);
    if (accelDomain && accelDomain.bestIP) {
      const portPart = u.port ? `:${u.port}` : "";
      return {
        url: `${u.protocol}//${accelDomain.bestIP.ip}${portPart}${u.pathname}${u.search}`,
        host: u.hostname,
      };
    }
    return { url: originalUrl, host: null };
  } catch {
    return { url: originalUrl, host: null };
  }
}

// ============================================================
// 内部：DNS 查询 + IP 测速（优先用硬编码 IP）
// ============================================================
async function refreshAllDomains() {
  const tasks = ACCEL_DOMAINS.map((domain) => refreshDomain(domain));
  await Promise.allSettled(tasks);
  emitStatus();
}

async function refreshDomain(domain: string) {
  let candidateIPs = HARDCODED_IPS[domain] || [];
  try {
    const dnsIPs = await resolveDomainViaMultipleDns(domain);
    const merged = new Set(candidateIPs);
    for (const ip of dnsIPs) {
      if (!ip.startsWith("127.") && !ip.startsWith("0.") && !ip.startsWith("10.")) {
        merged.add(ip);
      }
    }
    candidateIPs = Array.from(merged);
  } catch (e: any) {
    console.log(`[accelerator] DNS 查询 ${domain} 失败（用硬编码 IP）: ${e.message}`);
  }

  if (candidateIPs.length === 0) {
    accelDomains.set(domain, { domain, ips: [], bestIP: null, lastResolved: 0 });
    return;
  }

  const ipResults = await Promise.all(candidateIPs.map((ip) => probeIP(ip)));
  const aliveIPs = ipResults
    .filter((r): r is AccelIP => r !== null && r.alive)
    .sort((a, b) => a.latency - b.latency)
    .slice(0, MAX_IP_COUNT);

  const bestIP = aliveIPs.length > 0 ? aliveIPs[0] : null;
  accelDomains.set(domain, { domain, ips: aliveIPs, bestIP, lastResolved: Date.now() });
  if (bestIP) {
    console.log(`[accelerator] ${domain} 最佳 IP: ${bestIP.ip} (${bestIP.latency}ms)`);
  } else {
    console.log(`[accelerator] ${domain} 所有 IP 不可用`);
  }
}

async function resolveDomainViaMultipleDns(domain: string): Promise<string[]> {
  const ipSet = new Set<string>();
  const tasks = PUBLIC_DNS_SERVERS.map(async (dnsServer) => {
    try {
      const ips = await resolveWithServer(domain, dnsServer);
      for (const ip of ips) ipSet.add(ip);
    } catch (e: any) {
      console.log(`[accelerator] DNS ${dnsServer} 查询 ${domain} 失败: ${e.message}`);
    }
  });
  await Promise.allSettled(tasks);
  return Array.from(ipSet);
}

function resolveWithServer(domain: string, dnsServer: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const resolver = new Resolver();
    resolver.setServers([dnsServer]);
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error(`DNS ${dnsServer} timeout`)); }
    }, DNS_TIMEOUT_MS);
    resolver.resolve4(domain, (err, addresses) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(addresses || []);
    });
  });
}

async function probeIP(ip: string): Promise<AccelIP | null> {
  const startTime = Date.now();
  return new Promise<AccelIP | null>((resolve) => {
    let settled = false;
    const done = (result: AccelIP | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => done(null), TCP_PROBE_TIMEOUT_MS);
    const socket = net.createConnection({ host: ip, port: 443 }, () => {
      clearTimeout(timer);
      const latency = Date.now() - startTime;
      done({ ip, latency, alive: true, lastCheck: Date.now() });
    });
    socket.on("error", () => { clearTimeout(timer); done(null); });
    // 不用 socket.setTimeout — winget perry 缺 js_net_socket_set_timeout 符号
  });
}

function emitStatus() { if (onStatusChange) onStatusChange(getStatus()); }