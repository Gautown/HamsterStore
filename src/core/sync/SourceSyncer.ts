// SourceSyncer — 同步入口
import { SourceRepository, PackageRepository } from "../../data";
import { GitHubAPIClient } from "../sync/GitHubAPIClient";
import { inferCategories } from "../categorization/CategoryEngine";
import { BUILT_IN_PACKAGES } from "./BuiltInData";

export class SourceSyncer {
    syncAll(): number {
        let ok = 0;
        
        // Built-in packages from BUILT_IN_PACKAGES (144 条真实数据)
        for (let i = 0; i < BUILT_IN_PACKAGES.length; i++) {
            const p = BUILT_IN_PACKAGES[i];
            const name = p.owner + "/" + p.repo;
            const hash = GitHubAPIClient.urlHash(p.url);
            
            if (PackageRepository.getByUrlHash(hash)) continue;
            
            const cats = inferCategories(name, p.description, [p.category], "");
            try {
                PackageRepository.create({
                    source_id: 0, name, version: "", description: p.description,
                    categories: JSON.stringify(cats), platform_assets: "[]",
                    project_url: p.url, url_hash: hash, download_url: p.url,
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
