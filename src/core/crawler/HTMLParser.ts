// HTMLParser — GitHub 页面 HTML 解析
// 当 API 失败时从 GitHub 页面 HTML 中提取 Release 信息

import type { Asset, Release } from "../../types";

export class HTMLParser {
    // 从 GitHub Release 页面 HTML 中提取最新 release 信息
    parseReleasePage(html: string, owner: string, repo: string): Release | null {
        // GitHub Release 页面结构（简化抽取）
        // tag_name 通常在 <h1> 或 release-title 节点
        const tagMatch = html.match(/Release\s+([^\s<]+)/i) || html.match(/class="[^"]*release-title[^"]*"[^>]*>\s*([^<]+)/i);
        if (!tagMatch) return null;

        const tag_name = tagMatch[1].trim();
        const published_at = this.extractDate(html);
        const assets = this.parseAssets(html);
        const body = this.extractBody(html);

        return {
            tag_name,
            name: tag_name,
            body,
            published_at,
            assets,
        };
    }

    // 从 README HTML 或源码页面提取仓库名称链接
    // 适用于从 GitHub README 列表中提取 GitHub 项目链接
    extractGithubRepos(html: string): { owner: string; repo: string; url: string; name: string }[] {
        const results: { owner: string; repo: string; url: string; name: string }[] = [];
        const seen = new Set<string>();
        // 匹配 <a href="https://github.com/owner/repo">...</a>
        const regex = /href="(https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s)#?]+)[^"]*)"/gi;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(html)) !== null) {
            const owner = m[2];
            const repo = m[3];
            const key = `${owner}/${repo}`.toLowerCase();
            if (seen.has(key)) continue;
            // 过滤明显的非项目链接
            if (["topics", "features", "about", "signup", "login", "pricing"].includes(repo.toLowerCase())) {
                continue;
            }
            seen.add(key);
            results.push({
                owner,
                repo,
                url: m[1],
                name: repo,
            });
        }
        return results;
    }

    // 解析 assets（download_links）
    private parseAssets(html: string): Asset[] {
        const assets: Asset[] = [];
        // 匹配 release download URL：github.com/owner/repo/releases/download/tag/asset_name
        const regex = /href="(https?:\/\/github\.com\/[^\/]+\/[^\/]+\/releases\/download\/[^\/]+\/[^"]+)"/gi;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(html)) !== null) {
            const url = m[1];
            const name = decodeURIComponent(url.substring(url.lastIndexOf("/") + 1));
            assets.push({
                name,
                size: 0,
                url,
                browser_download_url: url,
            });
        }
        return assets;
    }

    // 提取发布日期
    private extractDate(html: string): string {
        const m = html.match(/datetime="([^"]+)"/i) || html.match(/[12]\d{3}-[01]\d-[0-3]\d[T ]\d{2}:\d{2}:\d{2}/);
        return m ? m[1] : "";
    }

    // 提取 release body（release notes）
    private extractBody(html: string): string {
        // 简化：寻找 markdown-body class
        const m = html.match(/class="[^"]*markdown-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        return m ? this.stripTags(m[1]).trim() : "";
    }

    // 移除 HTML 标签
    private stripTags(html: string): string {
        return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    }
}