import { DatabaseSync } from "node:sqlite";
import { homedir } from "os";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dbDir = join(homedir(), ".hamsterstore");
const dbPath = join(dbDir, "store.db");
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA foreign_keys = ON");
console.log(`[db] 数据库: ${dbPath}`);

db.exec(`
CREATE TABLE IF NOT EXISTS repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT UNIQUE NOT NULL,
  description TEXT,
  language TEXT,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  watchers INTEGER DEFAULT 0,
  open_issues INTEGER DEFAULT 0,
  license TEXT,
  pushed_at DATETIME,
  created_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  html_url TEXT,
  topics TEXT,
  latest_release TEXT,
  crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  priority INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS repo_categories (
  repo_id INTEGER,
  category_id INTEGER,
  PRIMARY KEY (repo_id, category_id),
  FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS download_tasks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  dest_path TEXT,
  total_size INTEGER,
  completed_chunks TEXT,
  status TEXT,
  progress REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_repos_name ON repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_repos_stars ON repositories(stars);
CREATE INDEX IF NOT EXISTS idx_repos_crawled_at ON repositories(crawled_at);
`);

const defaultCats = [
  { name: "音频与视频", priority: 1 },
  { name: "办公PDF", priority: 2 },
  { name: "教育学习", priority: 3 },
  { name: "游戏", priority: 4 },
  { name: "图形图像（设计类）", priority: 5 },
  { name: "网络工具", priority: 6 },
  { name: "安全隐私", priority: 7 },
  { name: "系统工具", priority: 8 },
  { name: "实用工具", priority: 9 },
];

const insertCat = db.prepare(
  "INSERT OR IGNORE INTO categories (name,priority) VALUES (?,?)"
);
defaultCats.forEach((c) => insertCat.run(c.name, c.priority));

export function saveRepository(repo: any): number {
  const stmt = db.prepare(`
    INSERT INTO repositories (
      full_name,description,language,stars,forks,watchers,open_issues,
      license,pushed_at,created_at,html_url,topics,latest_release,crawled_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(full_name) DO UPDATE SET
      description=excluded.description,
      language=excluded.language,
      stars=excluded.stars,
      forks=excluded.forks,
      watchers=excluded.watchers,
      open_issues=excluded.open_issues,
      license=excluded.license,
      pushed_at=excluded.pushed_at,
      updated_at=CURRENT_TIMESTAMP,
      html_url=excluded.html_url,
      topics=excluded.topics,
      latest_release=excluded.latest_release,
      crawled_at=CURRENT_TIMESTAMP
  `);
  const res = stmt.run(
    repo.full_name,
    repo.description,
    repo.language,
    repo.stars,
    repo.forks,
    repo.watchers,
    repo.open_issues,
    repo.license,
    repo.pushed_at,
    repo.created_at,
    repo.html_url,
    JSON.stringify(repo.topics),
    JSON.stringify(repo.latest_release)
  );
  if (res.lastInsertRowid) return Number(res.lastInsertRowid);
  const row = db.prepare("SELECT id FROM repositories WHERE full_name=?").get(repo.full_name);
  return row.id;
}

export function getOrCreateCategory(name: string): number {
  let row = db.prepare("SELECT id FROM categories WHERE name=?").get(name);
  if (!row) {
    const res = db.prepare("INSERT INTO categories (name,priority) VALUES (?,99)").run(name);
    return Number(res.lastInsertRowid);
  }
  return row.id;
}

export function linkRepoToCategory(repoId: number, catId: number): void {
  db.prepare(
    "INSERT OR IGNORE INTO repo_categories (repo_id,category_id) VALUES (?,?)"
  ).run(repoId, catId);
}

export function deleteOldRepos(days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const res = db.prepare("DELETE FROM repositories WHERE crawled_at < ?").run(cutoff.toISOString());
  return res.changes;
}

export function getRepositoryCount(): number {
  const row = db.prepare("SELECT COUNT(*) cnt FROM repositories").get();
  return row.cnt;
}

export { db };