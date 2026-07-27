// 清空数据库脚本
import { DatabaseSync } from "node:sqlite";
import { homedir } from "os";
import { join } from "node:path";

const dbPath = join(homedir(), ".hamsterstore", "store.db");
console.log(`数据库路径: ${dbPath}`);

const db = new DatabaseSync(dbPath);

// 检查当前数据
const repoCount = db.prepare("SELECT COUNT(*) c FROM repositories").get().c;
const catCount = db.prepare("SELECT COUNT(*) c FROM categories").get().c;
console.log(`当前: ${repoCount} 仓库, ${catCount} 分类`);

// 备份旧分类
const oldCats = db.prepare("SELECT name, priority FROM categories ORDER BY priority").all();
console.log("旧分类:", oldCats.map((c: any) => c.name).join(", "));

// 清空
db.exec("DELETE FROM repo_categories");
db.exec("DELETE FROM repositories");

// 重置分类（保留基础分类）
db.exec("DELETE FROM categories");
const defaultCats = [
  "音频与视频", "办公PDF", "教育学习", "游戏",
  "图形图像（设计类）", "网络工具", "安全隐私", "系统工具", "实用工具",
];
defaultCats.forEach((name, i) => {
  db.prepare("INSERT INTO categories (name, priority) VALUES (?, ?)").run(name, i + 1);
});

const newRepoCount = db.prepare("SELECT COUNT(*) c FROM repositories").get().c;
const newCatCount = db.prepare("SELECT COUNT(*) c FROM categories").get().c;
console.log(`清空完成: ${newRepoCount} repositories, ${newCatCount} categories`);
db.close();