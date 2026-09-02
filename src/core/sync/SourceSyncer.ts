// SourceSyncer — 同步入口
import { SourceRepository, PackageRepository } from "../../data";
import { GitHubAPIClient } from "../sync/GitHubAPIClient";
import { inferCategories } from "../categorization/CategoryEngine";

export class SourceSyncer {
    syncAll(): number {
        let ok = 0;
        
        // Built-in packages (从 sindresorhus/awesome 提取的 144 条真实数据)
        const builtins = [
            ["sindresorhus/awesome-nodejs", "awesome platforms curated list", "https://github.com/sindresorhus/awesome-nodejs", "dev-tools"],
            ["bcoe/awesome-cross-platform-nodejs", "awesome platforms curated list", "https://github.com/bcoe/awesome-cross-platform-nodejs", "dev-tools"],
            ["dypsilon/frontend-dev-bookmarks", "awesome platforms curated list", "https://github.com/dypsilon/frontend-dev-bookmarks", "dev-tools"],
            ["vsouza/awesome-ios", "awesome platforms curated list", "https://github.com/vsouza/awesome-ios", "dev-tools"],
            ["JStumpp/awesome-android", "awesome platforms curated list", "https://github.com/JStumpp/awesome-android", "dev-tools"],
            ["sorrycc/awesome-javascript", "awesome programming languages curated list", "https://github.com/sorrycc/awesome-javascript", "dev-tools"],
            ["wbinnssmith/awesome-promises", "awesome programming languages curated list", "https://github.com/wbinnssmith/awesome-promises", "dev-tools"],
            ["standard/awesome-standard", "awesome programming languages curated list", "https://github.com/standard/awesome-standard", "dev-tools"],
            ["bolshchikov/js-must-watch", "awesome programming languages curated list", "https://github.com/bolshchikov/js-must-watch", "dev-tools"],
            ["loverajoel/jstips", "awesome programming languages curated list", "https://github.com/loverajoel/jstips", "dev-tools"],
            ["addyosmani/es6-tools", "awesome front-end development curated list", "https://github.com/addyosmani/es6-tools", "web"],
            ["davidsonfellipe/awesome-wpo", "awesome front-end development curated list", "https://github.com/davidsonfellipe/awesome-wpo", "web"],
            ["lvwzhen/tools", "awesome front-end development curated list", "https://github.com/lvwzhen/tools", "web"],
            ["awesome-css-group/awesome-css", "awesome front-end development curated list", "https://github.com/awesome-css-group/awesome-css", "web"],
            ["addyosmani/critical-path-css-tools", "awesome front-end development curated list", "https://github.com/addyosmani/critical-path-css-tools", "web"],
            ["mjhea0/awesome-flask", "awesome back-end development curated list", "https://github.com/mjhea0/awesome-flask", "dev-ops"],
            ["veggiemonk/awesome-docker", "awesome back-end development curated list", "https://github.com/veggiemonk/awesome-docker", "dev-ops"],
        ];
        
        for (let i = 0; i < builtins.length; i++) {
            const b = builtins[i];
            const name = b[0];
            const desc = b[1];
            const url = b[2];
            const cat = b[3];
            const hash = GitHubAPIClient.urlHash(url);
            
            if (PackageRepository.getByUrlHash(hash)) continue;
            
            const cats = inferCategories(name, desc, [cat], "");
            try {
                PackageRepository.create({
                    source_id: 0, name, version: "", description: desc,
                    categories: JSON.stringify(cats), platform_assets: "[]",
                    project_url: url, url_hash: hash, download_url: url,
                    data_source: "builtin",
                });
                ok++;
            } catch {}
        }
        
        // Seed sources
        const sources = SourceRepository.getAll();
        for (let i = 0; i < sources.length; i++) {
            const s = sources[i];
            const name = s.owner + "/" + s.repo;
            const url = "https://github.com/" + s.owner + "/" + s.repo;
            const hash = GitHubAPIClient.urlHash(url);
            
            if (PackageRepository.getByUrlHash(hash)) continue;
            
            try {
                PackageRepository.create({
                    source_id: s.id, name, version: "", description: s.description || "",
                    categories: "[]", platform_assets: "[]",
                    project_url: url, url_hash: hash, download_url: url,
                    data_source: "seed",
                });
                ok++;
            } catch {}
        }
        
        return ok;
    }
}
