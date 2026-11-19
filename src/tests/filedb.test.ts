// FileDB 回归测试 — SQL 子集正确性 + 原子写盘
// 运行: npm run test:filedb（perry 编译为真实原生二进制执行，非 tsx 模拟）
// 覆盖: INSERT 自增 id / WHERE 参数时序(v2 修复) / AND 多条件 / LIKE /
//       UPDATE / DELETE / ORDER+LIMIT / 跨实例持久化 / .tmp 无残留
import { FileDB } from "../data/FileDB";
import { join } from "node:path";
import { readdirSync, readFileSync, unlinkSync, rmdirSync } from "node:fs";

let passed = 0;
let failed = 0;
function check(name: string, actual: any, expected: any): void {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { passed++; console.log("  ✓ " + name); }
    else { failed++; console.log("  ✗ " + name + " — 期望 " + JSON.stringify(expected) + "，实际 " + JSON.stringify(actual)); }
}

// 隔离目录：不触碰真实 ~/.hamsterstore
const base = join(process.env.TEMP || process.env.TMP || ".", "hs_filedb_test_" + Date.now());
const dbPath = join(base, "store.db");
const filedbDir = join(base, "filedb");
const db = new FileDB(dbPath);

console.log("FileDB 回归测试套件\n");

// ── INSERT ──
console.log("[INSERT]");
const ins = db.prepare("INSERT INTO packages (name, version, description) VALUES (?, ?, ?)");
const r1 = ins.run("alpha", "1.0", "first tool");
const r2 = ins.run("beta", "1.5", "second tool");
const r3 = ins.run("gamma", "2.0", "third tool");
check("INSERT changes", r1.changes, 1);
check("自增 id 递增", r3.lastInsertRowid, r1.lastInsertRowid + 2);
check("SELECT 行数", db.prepare("SELECT * FROM packages").all().length, 3);

// ── WHERE（v2 参数时序修复：参数在 .get/.all 调用时捕获）──
console.log("\n[WHERE]");
const got = db.prepare("SELECT * FROM packages WHERE name = ?").get("alpha");
check("WHERE 命中", got ? got.name : null, "alpha");
check("WHERE 字段值", got ? got.version : null, "1.0");
const miss = db.prepare("SELECT * FROM packages WHERE name = ?").get("nope");
check("WHERE 未命中返回 undefined", miss === undefined, true);
check("AND 命中", db.prepare("SELECT * FROM packages WHERE name = ? AND version = ?").all("beta", "1.5").length, 1);
check("AND 不命中", db.prepare("SELECT * FROM packages WHERE name = ? AND version = ?").all("beta", "9.9").length, 0);
check("LIKE 子串（includes 语义）", db.prepare("SELECT * FROM packages WHERE name LIKE ?").all("amm").length, 1);
// IN 多值（DownloadRepository.getActive 依赖）
const insTask = db.prepare("INSERT INTO download_tasks (url, status) VALUES (?, ?)");
insTask.run("http://a", "waiting");
insTask.run("http://b", "done");
insTask.run("http://c", "downloading");
check("IN 多值命中", db.prepare("SELECT * FROM download_tasks WHERE status IN ('waiting','downloading')").all().length, 2);

// ── UPDATE / DELETE ──
console.log("\n[UPDATE / DELETE]");
const up = db.prepare("UPDATE packages SET version = ? WHERE name = ?").run("2.5", "alpha");
check("UPDATE changes", up.changes, 1);
const got2 = db.prepare("SELECT * FROM packages WHERE name = ?").get("alpha");
check("UPDATE 生效", got2 ? got2.version : null, "2.5");
const up0 = db.prepare("UPDATE packages SET version = ? WHERE name = ?").run("9.9", "nope");
check("UPDATE 未命中 changes=0", up0.changes, 0);
const del = db.prepare("DELETE FROM packages WHERE name = ?").run("beta");
check("DELETE changes", del.changes, 1);
check("DELETE 后行数", db.prepare("SELECT * FROM packages").all().length, 2);

// ── ORDER BY + LIMIT（个位数 id 的字符串序与数值序一致）──
console.log("\n[ORDER / LIMIT]");
const ord = db.prepare("SELECT * FROM packages ORDER BY id DESC LIMIT 1").all();
check("ORDER+LIMIT 行数", ord.length, 1);
check("ORDER DESC 首行", ord[0].name, "gamma");

// ── 持久化：新实例读同一目录 ──
console.log("\n[持久化]");
const db2 = new FileDB(dbPath);
const all2 = db2.prepare("SELECT * FROM packages").all();
check("跨实例行数", all2.length, 2);
check("跨实例内容", all2.map((r: any) => r.name).sort().join(","), "alpha,gamma");
const got3 = db2.prepare("SELECT * FROM packages WHERE name = ?").get("alpha");
check("跨实例 WHERE（nextId 重建后查询仍命中）", got3 ? got3.version : null, "2.5");

// ── 原子写盘：无 .tmp 残留，所有表 JSON 完整可解析 ──
console.log("\n[原子写盘]");
const files = readdirSync(filedbDir);
let tmpLeft = 0;
let badJson = 0;
for (const f of files) {
    if (f.endsWith(".tmp")) tmpLeft++;
    if (f.endsWith(".json")) {
        try { JSON.parse(readFileSync(join(filedbDir, f), "utf8")); } catch { badJson++; }
    }
}
check("无 .tmp 残留", tmpLeft, 0);
check("全部表 JSON 可解析", badJson, 0);

// 清理隔离目录
try {
    for (const f of readdirSync(filedbDir)) unlinkSync(join(filedbDir, f));
    rmdirSync(filedbDir);
    rmdirSync(base);
} catch {}

console.log("\n==============================================");
console.log("通过 " + passed + " / 失败 " + failed);
if (failed > 0) { console.log("测试失败"); process.exit(1); }
console.log("全部测试通过");
process.exit(0);
