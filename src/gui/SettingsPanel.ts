// SettingsPanel — 系统设置面板

import {
  VStack, Text, TextField, Button,
  type Widget,
  textfieldGetString, textfieldSetString,
} from "perry/ui";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let tokenInput: Widget;
let concurInput: Widget;
let statusWidget: Widget;

function loadConfig(): any {
  const path = join(process.cwd(), "config", "settings.json");
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
    const envPath = join(process.cwd(), ".env");
    if (existsSync(envPath)) {
      const env = readFileSync(envPath, "utf8");
      const m = env.match(/GITHUB_TOKEN=(.+)/);
      return m ? { GITHUB_TOKEN: m[1], CRAWL_CONCURRENCY: "5" } : {};
    }
  } catch {}
  return {};
}

export function createSettingsPanel(): Widget {
  const cfg = loadConfig();
  tokenInput = TextField("GitHub Token (optional)", (_v: string) => {});
  if (cfg.GITHUB_TOKEN) textfieldSetString(tokenInput, cfg.GITHUB_TOKEN);

  concurInput = TextField("Crawl batch size (default 20)", (_v: string) => {});
  textfieldSetString(concurInput, cfg.CRAWL_CONCURRENCY || "20");

  statusWidget = Text("");

  return VStack(10, [
    Text("Settings"),
    Text("GitHub Token (increases API rate limit from 60/h to 5000/h)"),
    tokenInput,
    Text("Crawler batch size"),
    concurInput,
    Button("Save Config", () => { saveConfig(); }),
    statusWidget,
    Text(""),
    Text("Restart CLI after saving: npx tsx start_cli.ts"),
  ]);
}

function saveConfig() {
  const config = {
    GITHUB_TOKEN: textfieldGetString(tokenInput).trim(),
    CRAWL_CONCURRENCY: textfieldGetString(concurInput).trim() || "20",
  };

  const configDir = join(process.cwd(), "config");
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

  const path = join(configDir, "settings.json");
  try {
    writeFileSync(path, JSON.stringify(config, null, 2));

    const envPath = join(process.cwd(), ".env");
    const envContent = config.GITHUB_TOKEN
      ? "GITHUB_TOKEN=" + config.GITHUB_TOKEN
      : "";
    writeFileSync(envPath, envContent);

    console.log("[settings] config saved");
    textfieldSetString(statusWidget, "OK - restart CLI to apply");
  } catch (err: any) {
    console.log("[settings] save failed: " + err.message);
    textfieldSetString(statusWidget, "FAIL: " + err.message);
  }
}