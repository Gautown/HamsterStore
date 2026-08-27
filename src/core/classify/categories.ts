// 分类关键词库（文档§4.5 预置24分类 + 扩展）
// 每个分类有一个英文id、中文名称、一组关键词
// 匹配优先级：高权重关键词 > 低权重 > 默认

export interface CategoryDef {
    id: string;
    name: string;
    keywords: { word: string; weight: number }[];
    parent?: string;  // 多级分类父级 id
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
    {
        id: "dev-tools",
        name: "开发工具",
        keywords: [
            { word: "editor", weight: 3 }, { word: "ide", weight: 3 }, { word: "debug", weight: 3 },
            { word: "compiler", weight: 3 }, { word: "build", weight: 2 }, { word: "lint", weight: 2 },
            { word: "code", weight: 1 }, { word: "programming", weight: 1 }, { word: "developer", weight: 1 },
            { word: "vscode", weight: 3 }, { word: "terminal", weight: 2 }, { word: "formatter", weight: 2 },
        ],
    },
    {
        id: "version-control",
        name: "版本控制",
        keywords: [
            { word: "git", weight: 3 }, { word: "version", weight: 2 }, { word: "commit", weight: 2 },
            { word: "merge", weight: 1 }, { word: "repo", weight: 1 }, { word: "diff", weight: 2 },
            { word: "branch", weight: 1 }, { word: "pull-request", weight: 2 },
        ],
    },
    {
        id: "database",
        name: "数据库",
        keywords: [
            { word: "database", weight: 3 }, { word: "sql", weight: 3 }, { word: "nosql", weight: 3 },
            { word: "redis", weight: 3 }, { word: "postgres", weight: 3 }, { word: "mysql", weight: 3 },
            { word: "mongodb", weight: 3 }, { word: "sqlite", weight: 3 }, { word: "orm", weight: 2 },
            { word: "query", weight: 1 }, { word: "migration", weight: 1 },
        ],
    },
    {
        id: "networking",
        name: "网络工具",
        keywords: [
            { word: "http", weight: 3 }, { word: "proxy", weight: 3 }, { word: "vpn", weight: 3 },
            { word: "dns", weight: 3 }, { word: "network", weight: 2 }, { word: "tcp", weight: 2 },
            { word: "socket", weight: 2 }, { word: "websocket", weight: 2 }, { word: "firewall", weight: 2 },
        ],
    },
    {
        id: "security",
        name: "安全工具",
        keywords: [
            { word: "security", weight: 3 }, { word: "encryption", weight: 3 }, { word: "crypto", weight: 3 },
            { word: "password", weight: 2 }, { word: "auth", weight: 2 }, { word: "ssl", weight: 2 },
            { word: "tls", weight: 2 }, { word: "vulnerability", weight: 2 }, { word: "scanner", weight: 2 },
        ],
    },
    {
        id: "media",
        name: "多媒体",
        keywords: [
            { word: "video", weight: 3 }, { word: "audio", weight: 3 }, { word: "media", weight: 2 },
            { word: "player", weight: 3 }, { word: "codec", weight: 3 }, { word: "stream", weight: 2 },
            { word: "image", weight: 1 }, { word: "ffmpeg", weight: 3 }, { word: "music", weight: 2 },
            { word: "photo", weight: 2 }, { word: "screenshot", weight: 2 },
        ],
    },
    {
        id: "office",
        name: "办公效率",
        keywords: [
            { word: "office", weight: 3 }, { word: "note", weight: 2 }, { word: "document", weight: 2 },
            { word: "pdf", weight: 3 }, { word: "markdown", weight: 2 }, { word: "spreadsheet", weight: 3 },
            { word: "calendar", weight: 2 }, { word: "todo", weight: 2 }, { word: "productivity", weight: 2 },
            { word: "editor", weight: 1 },
        ],
    },
    {
        id: "browser",
        name: "浏览器",
        keywords: [
            { word: "browser", weight: 3 }, { word: "chrome", weight: 3 }, { word: "firefox", weight: 3 },
            { word: "extension", weight: 2 }, { word: "webview", weight: 2 },
        ],
    },
    {
        id: "file-manager",
        name: "文件管理",
        keywords: [
            { word: "file", weight: 2 }, { word: "explorer", weight: 3 }, { word: "finder", weight: 2 },
            { word: "archive", weight: 2 }, { word: "compress", weight: 2 }, { word: "backup", weight: 2 },
            { word: "sync", weight: 1 }, { word: "transfer", weight: 1 },
        ],
    },
    {
        id: "ui-design",
        name: "设计工具",
        keywords: [
            { word: "design", weight: 2 }, { word: "ui", weight: 3 }, { word: "ux", weight: 3 },
            { word: "figma", weight: 3 }, { word: "sketch", weight: 3 }, { word: "draw", weight: 2 },
            { word: "diagram", weight: 2 }, { word: "chart", weight: 2 }, { word: "svg", weight: 2 },
            { word: "color", weight: 1 },
        ],
    },
    {
        id: "ai-ml",
        name: "AI/机器学习",
        keywords: [
            { word: "ai", weight: 3 }, { word: "ml", weight: 3 }, { word: "machine-learning", weight: 3 },
            { word: "deep-learning", weight: 3 }, { word: "llm", weight: 3 }, { word: "gpt", weight: 3 },
            { word: "neural", weight: 2 }, { word: "model", weight: 1 }, { word: "inference", weight: 2 },
            { word: "training", weight: 2 }, { word: "diffusion", weight: 2 }, { word: "rag", weight: 2 },
        ],
    },
    {
        id: "container",
        name: "容器化/虚拟化",
        keywords: [
            { word: "docker", weight: 3 }, { word: "container", weight: 3 }, { word: "kubernetes", weight: 3 },
            { word: "k8s", weight: 3 }, { word: "vm", weight: 2 }, { word: "virtual", weight: 2 },
            { word: "podman", weight: 3 }, { word: "orchestration", weight: 2 },
        ],
    },
    {
        id: "devops",
        name: "运维/DevOps",
        keywords: [
            { word: "ci", weight: 3 }, { word: "cd", weight: 3 }, { word: "deploy", weight: 2 },
            { word: "monitor", weight: 2 }, { word: "pipeline", weight: 2 }, { word: "logs", weight: 2 },
            { word: "alert", weight: 2 }, { word: "grafana", weight: 3 }, { word: "prometheus", weight: 3 },
        ],
    },
    {
        id: "cli-tools",
        name: "命令行工具",
        keywords: [
            { word: "cli", weight: 3 }, { word: "command-line", weight: 3 }, { word: "terminal", weight: 2 },
            { word: "shell", weight: 2 }, { word: "bash", weight: 2 }, { word: "zsh", weight: 2 },
            { word: "tui", weight: 3 }, { word: "powershell", weight: 2 },
        ],
    },
    {
        id: "game",
        name: "游戏/引擎",
        keywords: [
            { word: "game", weight: 3 }, { word: "engine", weight: 2 }, { word: "godot", weight: 3 },
            { word: "unreal", weight: 3 }, { word: "unity", weight: 3 }, { word: "opengl", weight: 3 },
            { word: "vulkan", weight: 3 },
        ],
    },
    {
        id: "font-theme",
        name: "字体/主题",
        keywords: [
            { word: "font", weight: 3 }, { word: "theme", weight: 3 }, { word: "icon", weight: 2 },
            { word: "skin", weight: 2 }, { word: "cursor", weight: 2 }, { word: "wallpaper", weight: 2 },
        ],
    },
    {
        id: "messaging",
        name: "即时通讯",
        keywords: [
            { word: "chat", weight: 3 }, { word: "message", weight: 2 }, { word: "im", weight: 2 },
            { word: "telegram", weight: 3 }, { word: "discord", weight: 3 }, { word: "wechat", weight: 3 },
            { word: "slack", weight: 3 }, { word: "matrix", weight: 2 },
        ],
    },
    {
        id: "system-tools",
        name: "系统工具",
        keywords: [
            { word: "system", weight: 1 }, { word: "cleaner", weight: 3 }, { word: "monitor", weight: 1 },
            { word: "task", weight: 2 }, { word: "registry", weight: 3 }, { word: "driver", weight: 3 },
            { word: "boot", weight: 2 }, { word: "service", weight: 1 }, { word: "power", weight: 1 },
        ],
    },
    {
        id: "rss-reader",
        name: "RSS/阅读器",
        keywords: [
            { word: "rss", weight: 3 }, { word: "reader", weight: 3 }, { word: "feed", weight: 3 },
            { word: "news", weight: 2 }, { word: "ebook", weight: 3 },
        ],
    },
    {
        id: "package-manager",
        name: "包管理器",
        keywords: [
            { word: "package", weight: 2 }, { word: "installer", weight: 2 }, { word: "npm", weight: 3 },
            { word: "pip", weight: 3 }, { word: "apt", weight: 3 }, { word: "brew", weight: 3 },
            { word: "choco", weight: 3 }, { word: "winget", weight: 3 }, { word: "scoop", weight: 3 },
        ],
    },
    {
        id: "font-tools",
        name: "字体/主题 (同上, 别名)",
        keywords: [],
        parent: "font-theme",
    },
    {
        id: "other",
        name: "其他",
        keywords: [],
    },
];