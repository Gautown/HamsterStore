// DownloadManager — 简化的下载管理面板
// 下载任务存内存，用 os shell 的 start 命令打开浏览器下载（绕过 perry fetch stub）
// perry 版无法 import "../downloader/multiThread"（perry/thread 不可用）

import {
  VStack, Text, ScrollView, ProgressView,
  widgetAddChild, widgetClearChildren,
  type Widget,
} from "perry/ui";
import { execSync } from "node:child_process";

// 下载任务列表（内存中）
interface DlTask {
  id: string;
  url: string;
  filename: string;
  status: "pending" | "opening" | "done" | "error";
  error?: string;
}
const tasks: DlTask[] = [];

let taskList: Widget;

export function createDownloadManager(): Widget {
  taskList = ScrollView();
  renderTasks();
  return VStack(8, [
    Text("下载管理"),
    Text("点击下载按钮后，会打开默认浏览器获取文件"),
    taskList,
  ]);
}

function renderTasks() {
  widgetClearChildren(taskList);
  for (const t of tasks) {
    const icon = t.status === "done" ? "✅" : t.status === "error" ? "❌" : "⏳";
    widgetAddChild(taskList, Text(`${icon} ${t.filename} ${t.status}`));
  }
}

export function startDownload(url: string) {
  const id = String(Date.now());
  const filename = url.split("/").pop() || "download";
  const task: DlTask = { id, url, filename, status: "opening" };
  tasks.push(task);
  renderTasks();

  try {
    // 用 start 命令打开浏览器下载（系统默认浏览器）
    // Windows: start "" "url"
    const cmd = `start "" "${url}"`;
    execSync(cmd, { timeout: 5000 });
    task.status = "done";
    console.log("[download] 已打开下载: " + filename);
  } catch (e: any) {
    task.status = "error";
    task.error = e.message;
    console.log("[download] 失败: " + e.message);
  }
  renderTasks();
}