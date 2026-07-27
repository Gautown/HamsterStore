// 检查数据库内容（用 node:sqlite）
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("C:/Users/GauTown/.hamsterstore/store.db");

console.log("repositories:", db.prepare("SELECT COUNT(*) as c FROM repositories").get().c);
console.log("categories:", db.prepare("SELECT COUNT(*) as c FROM categories").get().c);

try {
  const rows = db.prepare("SELECT full_name, stars, language, description FROM repositories ORDER BY stars DESC LIMIT 10").all();
  for (const row of rows) {
    console.log(`${row.full_name} ⭐${row.stars} ${row.language || ""} ${(row.description || "").slice(0, 60)}`);
  }
} catch (e: any) {
  console.log("read repos fail:", e.message);
}

try {
  console.log("\n--- 分类连接 ---");
  const cats = db.prepare("SELECT c.name as cat, r.full_name as repo FROM repo_categories rc JOIN categories c ON c.id=rc.category_id JOIN repositories r ON r.id=rc.repo_id ORDER BY c.name LIMIT 20").all();
  for (const row of cats) {
    console.log(`  ${row.cat} -> ${row.repo}`);
  }
} catch (e: any) {
  console.log("read cats fail:", e.message);
}

db.close();
process.exit(0);