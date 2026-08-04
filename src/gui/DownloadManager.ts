// DownloadManager — 简化下载管理
// 用 spawn 而非 execSync 打开浏览器（不阻塞 UI）

import {
  VStack, HStack, Text, ScrollView,
  widgetAddChild, widgetClearChildren,
  type Widget,
} from "perry/ui";
import { spawn, execSync } from "node:child_process";

interface DlTask {
  id: string;
  url: string;
  filename: string;
  status: "opening" | "done" | "error";
  time: string;
}
const tasks: DlTask[] = [];

let taskList: Widget;

export function createDownloadManager(): Widget {
  taskList = ScrollView();
  renderTasks();
  return VStack(6, [
    Text("📥 下载管理"),
    Divider(),
    taskList,
  ]);
}

function renderTasks() {
  widgetClearChildren(taskList);
  if (tasks.length === 0) {
    widgetAddChild(taskList, Text("暂无下载记录"));
    return;
  }
  for (const t of tasks.slice(-20)) {
    const badge = t.status === "done" ? "✓" : t.status === "error" ? "✗" : "→";
    widgetAddChild(taskList, Text(`${badge} ${t.filename} [${t.time}]`));
  }
}

export function startDownload(url: string) {
  const filename = decodeURIComponent(url.split("/").pop() || "download.exe");
  const task: DlTask = {
    id: String(Date.now()),
    url,
    filename,
    status: "opening",
    time: new Date().toLocaleTimeString(),
  };
  tasks.push(task);
  renderTasks();

  // spawn 不等待浏览器退出
  try {
    const child = spawn("rundll32", ["url.dll,FileProtocolHandler", url], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();  // 不等待
    // 立即标记完成（不阻塞）
    task.status = "done";
  } catch {
    // fallback to start without waiting
    try {
      execSync(`start \"\" \"${url}\"`, { timeout: 1000, stdio: "ignore" });
      task.status = "done";
    } catch {
      task.status = "error";
    }
  }
  renderTasks();
}