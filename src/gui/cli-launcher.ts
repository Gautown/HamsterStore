// CLI 自启动模块 — GUI safe（不导入 node:http / utils/logger）
// GUI 启动时用 child_process.spawn 拉起 CLI 服务
// 确保数据库有数据，API 端口就绪
// 注意：不用 fetch 轮询（perry 编译版 fetch 是 stub）
//   — 用 execSync("curl") 检测端口是否就绪

import { spawn, ChildProcess, execSync } from "node:child_process";
import { setApiPort, getApiPort } from "./api";
import { join } from "node:path";

let cliProcess: ChildProcess | null = null;

export function startCliService() {
  if (cliProcess) {
    console.log("[cli-launcher] CLI 已在运行");
    return;
  }

  // 找 tsx 执行器
  const cliScript = join(process.cwd(), "start_cli.ts");
  // 如果用 npx tsx，在 perry 编译版中 npx 可能不可用
  // 用 node 直接 require tsx/esm 注册器启动 ts 文件
  const nodeExe = process.execPath; // perry binary 自己也可能是 node 路径
  // 退路：使用 process.env 中可能的 node 路径
  const tsxPath = findTsx();

  const env: Record<string, string> = {
    ...process.env as any,
    API_PORT: "5678",
    LOG_LEVEL: "INFO",
  };

  console.log(`[cli-launcher] 启动 CLI 服务: ${tsxPath || "node"} ${cliScript}`);
  try {
    if (tsxPath) {
      // 用 npx tsx
      cliProcess = spawn(tsxPath, [cliScript], {
        env,
        stdio: "pipe",
        detached: false,
      });
    } else {
      // fallback: node --loader tsx/esm
      // 检查 node_modules 中是否有 tsx
      const nodeModulesTsx = join(process.cwd(), "node_modules", ".bin", "tsx.cmd");
      cliProcess = spawn("node", ["--import", "tsx/esm", cliScript], {
        env,
        stdio: "pipe",
        detached: false,
      });
    }

    cliProcess.stdout?.on("data", (data: Buffer) => {
      const text = data.toString("utf8");
      // 不逐行打印到 stdout（避免干扰 GUI 日志）
      // 但保留关键事件检测
      if (text.includes("API 服务启动")) {
        console.log("[cli-launcher] CLI API 服务已启动");
      }
    });

    cliProcess.stderr?.on("data", (data: Buffer) => {
      console.log(`[cli] ${data.toString("utf8").trim()}`);
    });

    cliProcess.on("exit", (code: number | null) => {
      console.log(`[cli-launcher] CLI 进程退出 (code=${code})`);
      cliProcess = null;
    });

    console.log(`[cli-launcher] CLI 进程已启动 (pid=${cliProcess.pid})`);
  } catch (err: any) {
    console.log(`[cli-launcher] CLI 启动失败: ${err.message}`);
  }
}

export function stopCliService() {
  if (cliProcess) {
    cliProcess.kill("SIGTERM");
    cliProcess = null;
  }
}

// 等待 API 端口就绪
// perry 编译版不能用 fetch → 用execSync("curl") 检测
export async function waitForApiReady(maxWaitMs: number = 60000): Promise<number> {
  const start = Date.now();
  const ports = [5678, 5679, 5680, 5681, 5682];

  while (Date.now() - start < maxWaitMs) {
    for (const port of ports) {
      try {
        execSync(`curl -sS --max-time 3 http://127.0.0.1:${port}/api/categories`, {
          stdio: "pipe",
          timeout: 4000,
        });
        console.log(`[cli-launcher] API 端口 ${port} 就绪`);
        setApiPort(String(port));
        return port;
      } catch {
        // 端口未就绪
      }
    }
    // 等 2 秒再试
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("[cli-launcher] 等待超时，使用默认端口 5678");
  return 5678;
}

// 找 tsx 可执行文件路径
function findTsx(): string | null {
  try {
    // Windows: 用 where 命令
    const result = execSync("where tsx 2>nul || where npx 2>nul", {
      stdio: "pipe",
      timeout: 3000,
    });
    const lines = result.toString("utf8").trim().split("\n");
    if (lines.length > 0 && lines[0]) {
      const tsxCmd = lines[0].trim();
      console.log(`[cli-launcher] 找到 tsx: ${tsxCmd}`);
      return tsxCmd;
    }
  } catch {
    // where 命令失败
  }
  return null;
}