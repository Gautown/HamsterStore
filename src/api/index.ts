import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "../db";

async function handleApi(req: any, res: any) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  try {
    if (path === "/api/categories") {
      const rows = db.prepare(`
        SELECT c.name,COUNT(rc.repo_id) count
        FROM categories c
        LEFT JOIN repo_categories rc ON c.id=rc.category_id
        GROUP BY c.id ORDER BY c.priority ASC
      `).all();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rows));
      return;
    }
    if (path === "/api/repos" && req.method === "GET") {
      const cat = url.searchParams.get("category");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      if (!cat) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "缺少category", code: 1001 }));
        return;
      }
      const rows = db.prepare(`
        SELECT r.id,r.full_name,r.description,r.language,r.stars,r.forks,r.html_url,r.latest_release
        FROM repositories r
        JOIN repo_categories rc ON r.id=rc.repo_id
        JOIN categories c ON rc.category_id=c.id
        WHERE c.name=? ORDER BY r.stars DESC LIMIT ? OFFSET ?
      `).all(cat, limit, offset);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rows));
      return;
    }
    if (path === "/api/search") {
      const q = url.searchParams.get("q");
      if (!q) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "缺少q参数", code: 1001 }));
        return;
      }
      const p = `%${q}%`;
      const rows = db.prepare(`
        SELECT id,full_name,description,language,stars,forks,html_url,latest_release
        FROM repositories
        WHERE full_name LIKE ? OR description LIKE ?
        ORDER BY stars DESC LIMIT 50
      `).all(p, p);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rows));
      return;
    }
    if (path === "/api/download" && req.method === "POST") {
      const buf = await new Promise<Buffer>((resolve) => {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
      });
      const body = JSON.parse(buf.toString());
      if (!body.url) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "缺少url", code: 1001 }));
        return;
      }
      const taskId = `dl_${Date.now()}`; // 下载由GUI的startDownload处理（execSync start URL）
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ taskId }));
      return;
    }
    if (path.startsWith("/api/download/")) {
      const taskId = path.split("/").pop();
      const task = { id: taskId, url: "", status: "completed", progress: 100, totalSize: 0 };
      if (!task) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "任务不存在", code: 1002 }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(task));
      return;
    }
    if (path === "/api/install-guide") {
      const repoId = url.searchParams.get("repoId");
      if (!repoId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "缺少repoId", code: 1001 }));
        return;
      }
      const row = db.prepare(`
        SELECT full_name,language,html_url,latest_release
        FROM repositories WHERE id=?
      `).get(repoId);
      if (!row) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "仓库不存在", code: 1002 }));
        return;
      }
      const guides: any[] = [];
      const release = row.latest_release ? JSON.parse(row.latest_release) : null;
      if (row.language) {
        const lang = row.language.toLowerCase();
        if (lang === "javascript" || lang === "typescript")
          guides.push({type:"npm",command:`npm install -g ${row.full_name.split("/")[1]}`,description:"NPM全局安装"});
        if (lang === "python")
          guides.push({type:"pip",command:`pip install ${row.full_name.split("/")[1]}`,description:"PIP安装"});
        if (lang === "go")
          guides.push({type:"go",command:`go install ${row.full_name}@latest`,description:"Go安装"});
        if (lang === "rust")
          guides.push({type:"cargo",command:`cargo install ${row.full_name.split("/")[1]}`,description:"Cargo安装"});
      }
      if (release && release.assets) {
        release.assets.forEach((a: any) => {
          guides.push({
            type:"binary",
            command:a.browser_download_url,
            description:`下载 ${a.name} (${(a.size/1024/1024).toFixed(2)}MB)`
          });
        });
      }
      guides.push({type:"git",command:`git clone ${row.html_url}.git`,description:"克隆源码"});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(guides));
      return;
    }
    // Static file serving
    let filePath: string;
    if (path === "/") filePath = join(process.cwd(), "public", "index.html");
    else filePath = join(process.cwd(), "public", path.substring(1));
    if (existsSync(filePath)) {
      const ext = filePath.split(".").pop() || "";
      const mime: Record<string, string> = {
        html:"text/html",css:"text/css",js:"application/javascript",
        json:"application/json",png:"image/png",jpg:"image/jpeg",svg:"image/svg+xml"
      };
      const content = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
      res.end(content);
      return;
    }
    res.writeHead(404); res.end("Not Found");
  } catch (err: any) {
    console.log(`[api] 请求异常: ${err.message}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "服务器内部错误", code: 5000 }));
  }
}

export async function startApiServer(preferredPort?: number): Promise<number> {
  const port = preferredPort || 5678;
  const server = createServer(handleApi);
  server.listen(port);
  console.log(`[api] API服务启动 端口 ${port}`);
  return port;
}