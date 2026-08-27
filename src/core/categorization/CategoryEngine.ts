// CategoryEngine — 标准化软件分类引擎
// 将 GitHub 仓库按规范分类维度进行分类
// 种子仓库只是数据入口之一，所有 GitHub 仓库统一分类

// 标准分类体系
export const CATEGORY_TREE: Record<string, { name: string; keywords: string[]; icon?: string }> = {
    "dev-tools":    { name: "开发工具", keywords: ["editor", "ide", "terminal", "git", "compiler", "debug", "build", "linter", "formatter", "language", "framework", "library", "sdk", "api", "cli", "devtool", "programming", "code"] },
    "dev-ops":      { name: "DevOps", keywords: ["ci", "cd", "docker", "kubernetes", "k8s", "container", "deploy", "devops", "infra", "terraform", "ansible", "pipeline", "jenkins", "github-actions"] },
    "system-tools": { name: "系统工具", keywords: ["system", "monitor", "task-manager", "cleaner", "backup", "restore", "file-manager", "launcher", "clipboard", "screenshot", "screen-recorder", "partition", "disk"] },
    "network":      { name: "网络工具", keywords: ["network", "vpn", "proxy", "dns", "firewall", "wifi", "bandwidth", "tcp", "proxy-server", "router", "mitm", "packet", "sniffer"] },
    "security":     { name: "安全工具", keywords: ["security", "antivirus", "malware", "privacy", "password", "encrypt", "decrypt", "firewall", "vulnerability", "penetration", "exploit", "hash"] },
    "media":        { name: "媒体创作", keywords: ["video", "audio", "image", "photo", "music", "player", "editor", "streaming", "recorder", "ffmpeg", "gif", "screen-recorder", "screenshot", "3d", "animation"] },
    "office":       { name: "办公效率", keywords: ["office", "document", "spreadsheet", "presentation", "pdf", "markdown", "note", "calendar", "todo", "pomodoro", "focus", "workflow", "automation", "zapier"] },
    "communication":{ name: "社交通讯", keywords: ["chat", "messenger", "email", "mail", "im", "irc", "webchat", "telegram", "discord", "slack", "bbs", "forum"] },
    "browser":      { name: "浏览器增强", keywords: ["browser", "chromium", "firefox", "extension", "plugin", "bookmark", "tab", "adblock", "user-script"] },
    "design":       { name: "设计创作", keywords: ["design", "ux", "ui", "svg", "color", "font", "typography", "mockup", "prototyping", "icon", "artwork", "drawing"] },
    "database":     { name: "数据库", keywords: ["database", "sql", "nosql", "elasticsearch", "redis", "postgres", "mysql", "sqlite", "etl", "analytics"] },
    "education":    { name: "教育学习", keywords: ["education", "learning", "tutorial", "course", "reference", "wiki", "documentation", "book", "cheatsheet"] },
    "game":         { name: "游戏娱乐", keywords: ["game", "gaming", "emulator", "mod", "text-game", "puzzle", "chess", "poker"] },
    "utility":      { name: "实用工具", keywords: ["utility", "calculator", "converter", "timer", "stopwatch", "calendar", "clock", "currency", "weather", "translation", "ocr", "clipboard"] },
    "web":          { name: "Web 应用", keywords: ["web", "browser", "frontend", "backend", "website", "static-site", "ssr", "cms", "rest", "graphql", "wasm"] },
    "ai":           { name: "人工智能", keywords: ["ai", "artificial-intelligence", "llm", "gpt", "machine-learning", "deep-learning", "neural", "nlp", "vision", "transformer", "chatbot"] },
    "perry":        { name: "Perry生态", keywords: ["perry", "deno", "v8", "rust", "powershell", "gnullvm"] },
};

// 从 topics / description / name 中推断分类
export function inferCategories(name: string, description: string, topics: string[], language: string): string[] {
    const hitCategories: string[] = [];
    
    // 步骤1：topics 中的 CategoryEngine id 直接采用（短路命中）
    const knownCats = Object.keys(CATEGORY_TREE);
    for (const t of topics) {
        const tl = t.toLowerCase();
        if (knownCats.includes(tl) && !hitCategories.includes(tl)) {
            hitCategories.push(tl);
        }
    }

    const searchText = (name + " " + description + " " + topics.join(" ")).toLowerCase();

    for (const [key, cat] of Object.entries(CATEGORY_TREE)) {
        if (hitCategories.includes(key)) continue; // 已命中跳过
        let score = 0;
        for (const kw of cat.keywords) {
            if (searchText.includes(kw)) {
                score++;
                if (score >= 2) break;
            }
        }
        if (language && ["rust", "typescript", "python", "go", "java", "c++", "c"].includes(language.toLowerCase())) {
            if (key === "dev-tools" || key === "perry") score++;
        }
        if (score >= 2) hitCategories.push(key);
    }

    // 如果没有检测到分类，默认给 "utility"
    if (hitCategories.length === 0) hitCategories.push("utility");
    return hitCategories;
}

// 判断分类是否属于软件开发相关
export function isDeveloperCategory(category: string): boolean {
    return ["dev-tools", "perry", "database", "network"].includes(category);
}