// ListParser — 精选列表解析主入口
// 根据仓库类型选择对应的子解析器

import type { AwesomeSublist } from "../../types";

export interface ParsedEntry {
    name: string;
    description: string;
    project_url: string;
    category: string;
    license?: string;
    tags?: string[];
    raw?: string;
}

export interface ParsedSublist {
    name: string;
    url: string;
    owner: string;
    repo: string;
    category: string;
    parserConfig: string;
}

export class ListParser {
    // 根据父仓库选择解析器
    parse(readme: string, parserConfig: string): ParsedEntry[] {
        // parserConfig 指定解析器名称
        switch (parserConfig) {
            case "stackia":
                return this.parseStackia(readme);
            case "holyshell":
                return this.parseHolyShell(readme);
            case "ziyouvip":
                return this.parseZiyouvip(readme);
            case "ttionya":
                return this.parseTtionya(readme);
            case "ossdate":
                return this.parseOssdate(readme);
            case "awesome_sublist_default":
                return this.parseAwesomeSublist(readme);
            default:
                // 通用 Markdown 列表解析
                return this.parseGenericList(readme);
        }
    }

    // 解析 sindresorhus/awesome 主索引 → 子列表链接
    parseAwesomeIndex(readme: string): ParsedSublist[] {
        const sublists: ParsedSublist[] = [];
        const seen = new Set<string>();

        // 提取一级分类标题（## Platforms / ## Programming Languages 等）
        const sectionRegex = /^##\s+(.+?)$/gm;
        let sectionMatch: RegExpExecArray | null;
        const sections: { title: string; start: number }[] = [];

        while ((sectionMatch = sectionRegex.exec(readme)) !== null) {
            sections.push({
                title: sectionMatch[1].trim(),
                start: sectionMatch.index + sectionMatch[0].length,
            });
        }

        // 对每个 section 提取 github.com 链接
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const end = (i + 1 < sections.length) ? sections[i + 1].start - sectionMatch![0].length : readme.length;
            const sectionContent = readme.substring(section.start, end);

            // 匹配 [- Name](https://github.com/owner/repo) 或 - [Name](https://github.com/owner/repo#readme)
            const linkRegex = /(?:^|\s)[-*]\s*\[(.+?)\]\((https?:\/\/github\.com\/([^/\s)]+)\/([^/\s)#]+)(?:[/?#][^)]*)?\)/gm;
            let linkMatch: RegExpExecArray | null;
            while ((linkMatch = linkRegex.exec(sectionContent)) !== null) {
                const name = linkMatch[1].trim();
                const owner = linkMatch[3];
                const repo = linkMatch[4];
                const key = `${owner}/${repo}`.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                sublists.push({
                    name,
                    url: `https://github.com/${owner}/${repo}`,
                    owner,
                    repo,
                    category: section.title,
                    parserConfig: this.detectParserConfig(repo),
                });
            }
        }
        return sublists;
    }

    // 解析 awesome 子列表（如 awesome-nodejs）的 README
    parseAwesomeSublist(readme: string): ParsedEntry[] {
        const entries: ParsedEntry[] = [];
        // 与 parseAwesomeIndex 类似，先提取 ## 分类标题
        const sectionRegex = /^##\s+(.+?)$/gm;
        let sectionMatch: RegExpExecArray | null;
        const sections: { title: string; start: number }[] = [];
        while ((sectionMatch = sectionRegex.exec(readme)) !== null) {
            sections.push({
                title: sectionMatch[1].trim(),
                start: sectionMatch.index + sectionMatch[0].length,
            });
        }

        if (sections.length === 0) {
            // 简单列表：直接提取 GitHub 链接
            return this.parseGenericList(readme);
        }

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const end = (i + 1 < sections.length) ? sections[i + 1].start : readme.length;
            const content = readme.substring(section.start, end);
            this.extractLinksFromSection(content, section.title, entries);
        }
        return entries;
    }

    // 根据仓库名推断解析器配置
    private detectParserConfig(repo: string): string {
        const r = repo.toLowerCase();
        if (r.includes("nodejs") || r.includes("node")) return "awesome_sublist_default";
        if (r.includes("python")) return "awesome_sublist_default";
        if (r.includes("rust")) return "awesome_sublist_default";
        if (r.includes("go")) return "awesome_sublist_default";
        if (r.includes("react") || r.includes("vue") || r.includes("angular")) return "awesome_sublist_default";
        return "awesome_sublist_default";
    }

    // 从 section 内容中提取 GitHub 链接
    private extractLinksFromSection(content: string, category: string, entries: ParsedEntry[]): void {
        // 兼容列表项 [- name](url) - description 和表格 | name | description | [link](url) | 等
        const linkRegex = /\[(.+?)\]\((https?:\/\/github\.com\/([^/\s)]+)\/([^/\s)#]+)(?:[/?#][^)]*)?\)/g;
        let m: RegExpExecArray | null;
        const seen = new Set<string>();
        while ((m = linkRegex.exec(content)) !== null) {
            const name = m[1].trim();
            const owner = m[3];
            const repo = m[4];
            const key = `${owner}/${repo}`.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            // 提取同一行的描述（链接后面的 - 揂描述 或表格其他列）
            const lineEnd = content.indexOf("\n", m.index);
            const line = content.substring(m.index, lineEnd > -1 ? lineEnd : undefined);
            let description = "";
            // 对试匹配后面 - description 或 - Description of something
            const descMatch = line.match(/\)\s*[-:]\s*(.+?)(?:\s*$|\s*\|)/);
            if (descMatch) description = descMatch[1].trim();

            entries.push({
                name,
                description,
                project_url: `https://github.com/${owner}/${repo}`,
                category,
            });
        }
    }

    // Stackia 表格解析
    parseStackia(readme: string): ParsedEntry[] {
        // stackia/best-windows-apps 使用 Markdown 表格 + 引用链接
        // 先收集引用链接映射表 [N]: url
        const refMap: { [k: string]: string } = {};
        const refRegex = /^\[(\d+)\]:\s*(https?:\/\/github\.com\/[^/\s)]+\/[^/\s)#]+)/gm;
        let rm: RegExpExecArray | null;
        while ((rm = refRegex.exec(readme)) !== null) {
            refMap[rm[1]] = rm[2];
        }
        // 提取分类（## title）
        const sectionRegex = /^##\s+(.+?)$/gm;
        let sm: RegExpExecArray | null;
        const sections: { title: string; start: number }[] = [];
        while ((sm = sectionRegex.exec(readme)) !== null) {
            sections.push({ title: sm[1].trim(), start: sm.index + sm[0].length });
        }

        const entries: ParsedEntry[] = [];
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const end = (i + 1 < sections.length) ? sections[i + 1].start : readme.length;
            const content = readme.substring(section.start, end);
            const rows = content.split("\n").filter(l => l.startsWith("|"));
            for (const row of rows) {
                const cols = row.split("|").map(c => c.trim()).filter(Boolean);
                if (cols.length < 2) continue;
                const name = cols[0].replace(/[*`]/g, "");
                // 查找引用链接 [10] → refMap["10"]
                let url = "";
                const refLinkMatch = row.match(/\[(\d+)\]/);
                if (refLinkMatch && refMap[refLinkMatch[1]]) {
                    url = refMap[refLinkMatch[1]];
                } else {
                    const httpMatch = row.match(/https?:\/\/github\.com\/[^/\s)]+\/[^/\s)#]+/);
                    url = httpMatch ? httpMatch[0] : "";
                }
                if (!url) continue;
                // 描述：第二列或第三列
                const description = cols[1] || "";
                entries.push({
                    name,
                    description,
                    project_url: url,
                    category: section.title,
                });
            }
        }
        return entries;
    }

    // HolyShell 链接列表解析
    parseHolyShell(readme: string): ParsedEntry[] {
        return this.parseGenericList(readme, "HolyShell");
    }

    // Ziyouvip 简单列表解析
    parseZiyouvip(readme: string): ParsedEntry[] {
        return this.parseGenericList(readme, "Ziyouvip");
    }

    // Ttionya 表格解析
    parseTtionya(readme: string): ParsedEntry[] {
        // 类似 Stackia 表格但可能有更多列
        const refMap: { [k: string]: string } = {};
        const refRegex = /^\[(\d+)\]:\s*(https?:\/\/github\.com\/[^/\s)]+\/[^/\s)#]+)/gm;
        let rm: RegExpExecArray | null;
        while ((rm = refRegex.exec(readme)) !== null) {
            refMap[rm[1]] = rm[2];
        }
        const sectionRegex = /^##\s+(.+?)$/gm;
        let sm: RegExpExecArray | null;
        const sections: { title: string; start: number }[] = [];
        while ((sm = sectionRegex.exec(readme)) !== null) {
            sections.push({ title: sm[1].trim(), start: sm.index + sm[0].length });
        }
        const entries: ParsedEntry[] = [];
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const end = (i + 1 < sections.length) ? sections[i + 1].start : readme.length;
            const content = readme.substring(section.start, end);
            const rows = content.split("\n").filter(l => l.startsWith("|"));
            for (const row of rows) {
                const cols = row.split("|").map(c => c.trim()).filter(Boolean);
                if (cols.length < 2) continue;
                const name = cols[0].replace(/[*`]/g, "");
                let url = "";
                const refLinkMatch = row.match(/\[(\d+)\]/);
                if (refLinkMatch && refMap[refLinkMatch[1]]) {
                    url = refMap[refLinkMatch[1]];
                } else {
                    const httpMatch = row.match(/https?:\/\/github\.com\/[^/\s)]+\/[^/\s)#]+/);
                    url = httpMatch ? httpMatch[0] : "";
                }
                if (!url) continue;
                const description = cols.slice(1).join(" ");
                entries.push({ name, description, project_url: url, category: section.title });
            }
        }
        return entries;
    }

    // Ossdate 企业级解析
    parseOssdate(readme: string): ParsedEntry[] {
        return this.parseGenericList(readme, "Enterprise");
    }

    // 通用 Markdown 列表解析
    parseGenericList(readme: string, defaultCategory: string = "Uncategorized"): ParsedEntry[] {
        const entries: ParsedEntry[] = [];
        // 提取分类
        const sectionRegex = /^##\s+(.+?)$/gm;
        let sm: RegExpExecArray | null;
        const sections: { title: string; start: number }[] = [];
        while ((sm = sectionRegex.exec(readme)) !== null) {
            sections.push({ title: sm[1].trim(), start: sm.index + sm[0].length });
        }

        if (sections.length === 0) {
            this.extractLinksFromSection(readme, defaultCategory, entries);
            return entries;
        }

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const end = (i + 1 < sections.length) ? sections[i + 1].start : readme.length;
            const content = readme.substring(section.start, end);
            this.extractLinksFromSection(content, section.title, entries);
        }
        return entries;
    }
}