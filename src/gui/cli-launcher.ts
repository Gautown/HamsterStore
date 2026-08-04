// CLI 自启动 — 在 Perry 编译版中用 execSync 启动 cmd 子进程
// 问题：perry spawn("npx") 不工作 → 用 ShellExecute + start.bat

import { existsSync } from "node:fs";
import { setApiPort } from "./api";
import { join } from "node:path";

let cliProcess: any = null;

export function startCliService() {
  if (cliProcess) {
    console.log("[cli-launcher] CLI 已在运行");
    return;
  }

  const cliScript = join(process.cwd(), "start_cli.ts");
  const batchFile = join(process.cwd(), "cli_start.bat");
  const env: any = { ...process.env, API_PORT: "5678", LOG_LEVEL: "INFO" };

  // 检查是否有 start.bat（推荐用 start.bat 预先启动）
  const npmBin = join(process.cwd(), "node_modules", ".bin", "tsx.cmd");

  if (existsSync(npmBin)) {
    console.log("[cli-launcher] 使用 npx tsx.cmd 启动 CLI");
    try {
      const { spawn } = require("node:child_process");
      cliProcess = spawn("cmd.exe", ["/C", npmBin, cliScript], {
        env,
        cwd: process.cwd(),
        stdio: "pipe",
      });
      console.log(`[cli-launcher] CLI 进程已启动 (pid=${cliProcess?.pid})`);
    } catch (err: any) {
      console.log("[cli-launcher] 无法启动CLI " + err.message);
    }
  } else {
    console.log("[cli-launcher] tsx.cmd 不存在，跳过CLI启动");
    console.log("[cli-launcher] 请在终端执行：npm install && npx tsx start_cli.ts");
  }
}

export function stopCliService() {
  // no-op: perry 编译版不管理子进程
}

function cliPath(): string {
  return join(process.cwd(), "start_cli.ts");
}